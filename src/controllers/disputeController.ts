import mongoose from "mongoose";
import { Request, Response } from "express";
import { DisputeEvidenceRecord } from "../models/DisputeEvidence";
import { Dispute } from "../models/Dispute";
import { DisputeMessage } from "../models/DisputeMessage";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { createDisputeCase, respondToDisputeCase } from "../services/disputeEngine";
import { t } from "../i18n";

const normalizeText = (value: unknown) => String(value || "").trim();

const parseObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
  const raw = normalizeText(value);
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

const toDisputeDto = (item: any) => ({
  id: String(item._id),
  sourceType: item.sourceType,
  sourceId: String(item.sourceId),
  paymentId: item.paymentId ? String(item.paymentId) : null,
  orderId: item.orderId ? String(item.orderId) : null,
  categoryKey: item.categoryKey,
  bucketKey: item.bucketKey,
  buyerId: String(item.buyerId),
  sellerId: item.sellerId ? String(item.sellerId) : null,
  status: item.status,
  reasonCode: item.reasonCode,
  explanation: item.explanation,
  desiredResolution: item.desiredResolution,
  buyerEvidence: item.buyerEvidence || [],
  sellerResponse: item.sellerResponse || null,
  sellerEvidence: item.sellerEvidence || [],
  outcome: item.outcome || null,
  decisionReason: item.decisionReason || null,
  resolutionAmount: typeof item.resolutionAmount === "number" ? item.resolutionAmount : null,
  timeline: item.timeline || [],
  closedAt: item.closedAt || null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

const canAccessDispute = (dispute: any, req: Request) =>
  req.user?.role === "ADMIN" ||
  String(dispute.buyerId) === req.user?._id ||
  String(dispute.sellerId || "") === req.user?._id;

export const createDispute = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentId = parseObjectId(req.body.paymentId);
    const orderId = parseObjectId(req.body.orderId || req.body.order_id);
    let resolvedPaymentId = paymentId;
    if (!resolvedPaymentId && orderId) {
      const order = await Order.findById(orderId).select("paymentId").lean();
      if (order?.paymentId) {
        resolvedPaymentId = new mongoose.Types.ObjectId(String(order.paymentId));
      } else {
        const payment = await Payment.findOne({ $or: [{ orderId }, { sourceId: orderId }] })
          .sort({ createdAt: -1 })
          .select("_id")
          .lean();
        resolvedPaymentId = payment?._id ? new mongoose.Types.ObjectId(String(payment._id)) : null;
      }
    }
    if (!resolvedPaymentId) return res.status(400).json({ message: t(req, "disputes.payment.validation.required.message") });

    const dispute = await createDisputeCase({
      paymentId: resolvedPaymentId,
      buyerId: req.user._id,
      reasonCode: normalizeText(req.body.reason_key || req.body.reason || req.body.reasonCode) || "other",
      explanation: normalizeText(req.body.text || req.body.explanation || req.body.message),
      desiredResolution: normalizeText(req.body.desiredResolution || "FULL_REFUND").toUpperCase() as any,
      evidence: Array.isArray(req.body.evidence) ? req.body.evidence : []
    });

    return res.status(201).json({ dispute: toDisputeDto(dispute) });
  } catch (error) {
    console.error("createDispute error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const listDisputes = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const scope = normalizeText(req.query.scope).toLowerCase();
    const filter: Record<string, unknown> = {};
    if (req.user.role !== "ADMIN") {
      if (scope === "seller") {
        filter.sellerId = req.user._id;
      } else {
        filter.buyerId = req.user._id;
      }
    }
    const items = await Dispute.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items: items.map((item) => toDisputeDto(item)) });
  } catch (error) {
    console.error("listDisputes error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getDisputeById = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: t(req, "disputes.validation.invalid_id.message") });
    const dispute = await Dispute.findById(id).lean();
    if (!dispute) return res.status(404).json({ message: t(req, "disputes.lookup.not_found.message") });

    if (!canAccessDispute(dispute, req)) return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });

    const [payment, messages, evidence] = await Promise.all([
      dispute.paymentId ? Payment.findById(dispute.paymentId).lean() : Promise.resolve(null),
      DisputeMessage.find({ disputeId: dispute._id }).sort({ createdAt: 1 }).lean(),
      DisputeEvidenceRecord.find({ disputeId: dispute._id }).sort({ createdAt: 1 }).lean()
    ]);
    return res.json({
      dispute: toDisputeDto(dispute),
      messages: messages.map((message) => ({
        id: String(message._id),
        authorUserId: String(message.authorUserId),
        authorRole: message.authorRole,
        messageText: message.messageText,
        isInternalAdminNote: Boolean(message.isInternalAdminNote),
        createdAt: message.createdAt
      })),
      evidence: evidence.map((item) => ({
        id: String(item._id),
        uploadedByUserId: String(item.uploadedByUserId),
        evidenceType: item.evidenceType,
        fileUrl: item.fileUrl || null,
        description: item.description || null,
        metadata: item.metadata || null,
        createdAt: item.createdAt
      })),
      payment: payment
        ? {
            id: String(payment._id),
            status: payment.status,
            workflowStatus: payment.workflowStatus,
            amount: payment.amount,
            currency: payment.currency
          }
        : null
    });
  } catch (error) {
    console.error("getDisputeById error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const respondToDispute = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: t(req, "disputes.validation.invalid_id.message") });

    const dispute = await respondToDisputeCase({
      disputeId: id,
      sellerId: req.user._id,
      response: normalizeText(req.body.response || req.body.message),
      evidence: Array.isArray(req.body.evidence) ? req.body.evidence : []
    });

    return res.json({ dispute: toDisputeDto(dispute) });
  } catch (error) {
    console.error("respondToDispute error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const addDisputeMessage = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: t(req, "disputes.validation.invalid_id.message") });
    const dispute = await Dispute.findById(id);
    if (!dispute) return res.status(404).json({ message: t(req, "disputes.lookup.not_found.message") });
    if (!canAccessDispute(dispute, req)) return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });

    const messageText = normalizeText(req.body.message || req.body.messageText);
    if (!messageText) return res.status(400).json({ message: t(req, "disputes.message.validation.required.message") });
    const authorRole =
      req.user.role === "ADMIN"
        ? "ADMIN"
        : String(dispute.buyerId) === req.user._id
          ? "BUYER"
          : "SELLER";
    const message = await DisputeMessage.create({
      disputeId: dispute._id,
      authorUserId: new mongoose.Types.ObjectId(req.user._id),
      authorRole,
      messageText,
      isInternalAdminNote: Boolean(req.body.isInternalAdminNote && req.user.role === "ADMIN")
    });
    return res.status(201).json({
      message: {
        id: String(message._id),
        disputeId: String(message.disputeId),
        authorUserId: String(message.authorUserId),
        authorRole: message.authorRole,
        messageText: message.messageText,
        isInternalAdminNote: message.isInternalAdminNote,
        createdAt: message.createdAt
      }
    });
  } catch (error) {
    console.error("addDisputeMessage error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const addDisputeEvidence = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: t(req, "disputes.validation.invalid_id.message") });
    const dispute = await Dispute.findById(id);
    if (!dispute) return res.status(404).json({ message: t(req, "disputes.lookup.not_found.message") });
    if (!canAccessDispute(dispute, req)) return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });

    const evidenceType = normalizeText(req.body.evidenceType || req.body.type || "DOCUMENT").toUpperCase();
    const fileUrl = normalizeText(req.body.fileUrl || req.body.url);
    const description = normalizeText(req.body.description || req.body.label);
    if (!description && !fileUrl) return res.status(400).json({ message: t(req, "disputes.evidence.validation.required.message") });

    const evidence = await DisputeEvidenceRecord.create({
      disputeId: dispute._id,
      uploadedByUserId: new mongoose.Types.ObjectId(req.user._id),
      evidenceType,
      fileUrl: fileUrl || null,
      description: description || null,
      metadata: req.body.metadata || null
    });

    const inlineEvidence = {
      uploadedBy: new mongoose.Types.ObjectId(req.user._id),
      type: evidenceType === "IMAGE" ? "IMAGE" : evidenceType === "LINK" ? "LINK" : "FILE",
      label: description || "Evidence",
      url: fileUrl || undefined,
      note: normalizeText(req.body.note) || undefined,
      createdAt: new Date()
    };
    if (String(dispute.buyerId) === req.user._id) {
      dispute.buyerEvidence = [...(dispute.buyerEvidence || []), inlineEvidence as any];
    } else {
      dispute.sellerEvidence = [...(dispute.sellerEvidence || []), inlineEvidence as any];
    }
    await dispute.save();

    return res.status(201).json({
      evidence: {
        id: String(evidence._id),
        disputeId: String(evidence.disputeId),
        uploadedByUserId: String(evidence.uploadedByUserId),
        evidenceType: evidence.evidenceType,
        fileUrl: evidence.fileUrl || null,
        description: evidence.description || null,
        metadata: evidence.metadata || null,
        createdAt: evidence.createdAt
      }
    });
  } catch (error) {
    console.error("addDisputeEvidence error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
