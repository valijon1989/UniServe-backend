import { Request, Response } from "express";
import mongoose from "mongoose";
import { ChatMessage } from "../models/ChatMessage";
import { ChatThread } from "../models/ChatThread";
import { User } from "../models/User";
import { t } from "../i18n";
import { findProductByIdentifier } from "../services/productLookup";
import { findServiceByIdentifier } from "../services/serviceLookup";
import { sendToUser } from "../utils/websocket";

const normalizeText = (value: unknown) => String(value || "").trim();
const buildParticipantSignature = (participantIds: string[]) => [...participantIds].sort().join(":");
const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && Number((error as { code?: unknown }).code) === 11000;

const toMessageDto = (message: any) => ({
  id: String(message._id),
  threadId: String(message.threadId),
  senderId: String(message.senderId?._id || message.senderId),
  senderName: message.senderId?.name || undefined,
  recipientId: String(message.recipientId?._id || message.recipientId),
  text: message.text,
  createdAt: message.createdAt
});

const toThreadDto = (thread: any) => {
  const agentUser = thread.agentId;
  const customerUser = thread.customerId;
  return {
    id: String(thread._id),
    agentId: String(agentUser?._id || thread.agentId),
    agentName: agentUser?.name || undefined,
    customerId: String(customerUser?._id || thread.customerId),
    customerName: customerUser?.name || undefined,
    targetType: thread.targetType || (thread.serviceId || thread.serviceIdentifier ? "SERVICE" : null),
    targetId: thread.targetId ? String(thread.targetId) : null,
    targetIdentifier: thread.targetIdentifier || thread.serviceIdentifier || null,
    targetTitle: thread.targetTitle || thread.serviceTitle || null,
    serviceId: thread.serviceId ? String(thread.serviceId) : null,
    serviceIdentifier: thread.serviceIdentifier || null,
    serviceTitle: thread.serviceTitle || null,
    lastMessageText: thread.lastMessageText || null,
    lastMessageAt: thread.lastMessageAt || thread.updatedAt
  };
};

export const startChat = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const targetTypeRaw = normalizeText(req.body?.targetContext?.targetType).toUpperCase();
    const targetIdentifierRaw = normalizeText(
      req.body?.targetContext?.targetIdentifier || req.body?.targetContext?.identifier
    );
    const targetIdRaw = normalizeText(req.body?.targetContext?.targetId || req.body?.targetContext?.id);
    const targetTitleRaw = normalizeText(req.body?.targetContext?.targetTitle || req.body?.targetContext?.title);
    const serviceIdentifier = normalizeText(req.body?.serviceContext?.serviceIdentifier || req.body?.serviceContext?.identifier);
    const serviceIdRaw = normalizeText(req.body?.serviceContext?.serviceId);
    const serviceTitleRaw = normalizeText(req.body?.serviceContext?.serviceTitle || req.body?.serviceContext?.title);
    const requestedAgentId = normalizeText(req.body.agentId);

    let service = null;
    let product = null;
    if (serviceIdentifier) {
      service = await findServiceByIdentifier(serviceIdentifier);
    } else if (serviceIdRaw && mongoose.Types.ObjectId.isValid(serviceIdRaw)) {
      service = await findServiceByIdentifier(serviceIdRaw);
    }
    if (!service && serviceTitleRaw) {
      service = await findServiceByIdentifier(serviceTitleRaw);
    }
    if (!service && targetTypeRaw === "PRODUCT") {
      const productIdentifier = targetIdRaw || targetIdentifierRaw || targetTitleRaw;
      if (productIdentifier) {
        product = await findProductByIdentifier(productIdentifier);
      }
    }

    const targetType =
      targetTypeRaw === "PRODUCT" || targetTypeRaw === "SERVICE"
        ? targetTypeRaw
        : service
          ? "SERVICE"
          : product
            ? "PRODUCT"
            : null;
    const targetId =
      targetType === "SERVICE"
        ? String(service?._id || "").trim()
        : targetType === "PRODUCT"
          ? String(product?._id || targetIdRaw || "").trim()
          : "";
    const targetIdentifier =
      targetType === "SERVICE"
        ? normalizeText(serviceIdentifier || serviceIdRaw || req.body?.targetContext?.targetIdentifier)
        : normalizeText(targetIdentifierRaw || targetIdRaw);
    const targetTitle =
      targetType === "SERVICE"
        ? normalizeText(service?.title || serviceTitleRaw || targetTitleRaw)
        : normalizeText(product?.title || targetTitleRaw);

    const agentId =
      String(
        (service?.createdBy as any)?._id ||
          service?.createdBy ||
          (product?.createdBy as any)?._id ||
          product?.createdBy ||
          requestedAgentId ||
          ""
      ).trim();
    if (!agentId || !mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ message: t(req, "chat.agent.validation.required.message") });
    }
    if (agentId === req.user._id) {
      return res.status(400).json({ message: t(req, "chat.start.self_forbidden.message") });
    }

    const agent = await User.findById(agentId).select("_id role name username").lean();
    if (!agent || !["AGENT", "ADMIN"].includes(agent.role)) {
      return res.status(404).json({ message: t(req, "agents.lookup.not_found.message") });
    }

    const participantSignature = buildParticipantSignature([req.user._id, agentId]);
    const baseQuery = {
      customerId: req.user._id,
      agentId,
      participantSignature
    };
    const candidateQueries: Record<string, unknown>[] = [];
    if (service?._id) {
      candidateQueries.push({ ...baseQuery, serviceId: service._id });
    } else if (serviceIdentifier) {
      candidateQueries.push({ ...baseQuery, serviceIdentifier });
    }
    if (targetType === "PRODUCT" && targetId && mongoose.Types.ObjectId.isValid(targetId)) {
      candidateQueries.push({ ...baseQuery, targetType, targetId });
    }
    if (targetType && targetIdentifier) {
      candidateQueries.push({ ...baseQuery, targetType, targetIdentifier });
    }
    if (!candidateQueries.length) {
      candidateQueries.push(baseQuery);
    }

    const loadExistingThread = async () => {
      for (const query of candidateQueries) {
        const existingThread = await ChatThread.findOne(query)
          .populate("agentId", "name username")
          .populate("customerId", "name username");
        if (existingThread) return existingThread;
      }
      return null;
    };

    let thread = await loadExistingThread();
    let created = false;

    if (!thread) {
      try {
        thread = await ChatThread.create({
          participants: [req.user._id, agentId],
          participantSignature,
          agentId,
          customerId: req.user._id,
          targetType,
          targetId: targetId && mongoose.Types.ObjectId.isValid(targetId) ? targetId : null,
          targetIdentifier: targetIdentifier || null,
          targetTitle: targetTitle || null,
          serviceId: service?._id ?? null,
          serviceIdentifier: serviceIdentifier || serviceIdRaw || (targetType === "SERVICE" ? targetIdentifier || null : null),
          serviceTitle: service?.title || serviceTitleRaw || (targetType === "SERVICE" ? targetTitle || null : null)
        });
        created = true;
        thread = await ChatThread.findById(thread._id)
          .populate("agentId", "name username")
          .populate("customerId", "name username");
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
        thread = await loadExistingThread();
      }
    }

    if (!thread) {
      return res.status(500).json({ message: t(req, "chat.thread.create.failed.message") });
    }

    const messages = await ChatMessage.find({ threadId: thread!._id })
      .sort({ createdAt: 1 })
      .limit(50)
      .populate("senderId", "name username");

    return res.status(created ? 201 : 200).json({
      thread: toThreadDto(thread),
      messages: messages.map((message) => toMessageDto(message))
    });
  } catch (err) {
    console.error("startChat error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const listChatThreads = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const threads = await ChatThread.find({ participants: req.user._id })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate("agentId", "name username")
      .populate("customerId", "name username");
    return res.json({ threads: threads.map((thread) => toThreadDto(thread)) });
  } catch (err) {
    console.error("listChatThreads error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getChatThreadMessages = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: t(req, "chat.thread.lookup.not_found.message") });

    const thread = await ChatThread.findById(id).lean();
    if (!thread) return res.status(404).json({ message: t(req, "chat.thread.lookup.not_found.message") });
    if (!(thread.participants || []).some((participant) => String(participant) === req.user!._id)) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const messages = await ChatMessage.find({ threadId: id })
      .sort({ createdAt: 1 })
      .populate("senderId", "name username");
    return res.json({ messages: messages.map((message) => toMessageDto(message)) });
  } catch (err) {
    console.error("getChatThreadMessages error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const postChatMessage = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const threadId = normalizeText(req.body.threadId);
    const text = normalizeText(req.body.text || req.body.message);
    if (!threadId || !mongoose.Types.ObjectId.isValid(threadId)) {
      return res.status(404).json({ message: t(req, "chat.thread.lookup.not_found.message") });
    }
    if (!text) {
      return res.status(400).json({ message: t(req, "chat.message.validation.required.message") });
    }

    const thread = await ChatThread.findById(threadId);
    if (!thread) return res.status(404).json({ message: t(req, "chat.thread.lookup.not_found.message") });
    const participantIds = (thread.participants || []).map((participant) => String(participant));
    if (!participantIds.includes(req.user._id)) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const recipientId = participantIds.find((participantId) => participantId !== req.user!._id);
    if (!recipientId) {
      return res.status(400).json({ message: t(req, "chat.recipient.lookup.not_found.message") });
    }

    const message = await ChatMessage.create({
      threadId,
      senderId: req.user._id,
      recipientId,
      text
    });

    thread.lastMessageText = text.slice(0, 500);
    thread.lastMessageAt = message.createdAt;
    await thread.save();

    const populatedMessage = await ChatMessage.findById(message._id).populate("senderId", "name username");

    sendToUser(recipientId, "chat_message", {
      threadId,
      message: toMessageDto(populatedMessage)
    });

    return res.status(201).json({ message: toMessageDto(populatedMessage) });
  } catch (err) {
    console.error("postChatMessage error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
