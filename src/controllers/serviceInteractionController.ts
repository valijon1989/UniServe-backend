import { Request, Response } from "express";
import mongoose from "mongoose";
import { OrderAddress } from "../models/OrderAddress";
import { OrderFulfillmentDetail } from "../models/OrderFulfillmentDetail";
import { OrderItemRecord } from "../models/OrderItem";
import { Service } from "../models/Service";
import { ServiceReaction, type ServiceReactionKind } from "../models/ServiceReaction";
import { ServiceOrder, type ServiceOrderStatus } from "../models/ServiceOrder";
import { markEscrowSourceDelivered, markEscrowSourceInProgress } from "../services/paymentEngine";
import {
  buildDeliveredState,
  buildFulfillmentStartedState,
  buildInitialMarketplaceStates,
  buildTimelineEntry,
  getBuyerLifecycleLabel,
  getSellerLifecycleLabel
} from "../services/marketplaceStateMachine";
import { inferSettlementCategory } from "../services/paymentPolicy";
import { recordRecommendationSignal } from "../services/recommendationEngine";
import { findServiceByIdentifier } from "../services/serviceLookup";
import { sendToUser } from "../utils/websocket";
import type { AppLocale } from "../i18n";
import { t } from "../i18n";

const reactionKinds: ServiceReactionKind[] = ["LIKE", "DISLIKE"];
const orderStatuses: ServiceOrderStatus[] = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED"];
const agentOrderTransitions: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  PENDING: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["COMPLETED"],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: []
};
const customerOrderTransitions: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  PENDING: ["CANCELLED"],
  ACCEPTED: [],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: []
};

const normalizeText = (value: unknown) => String(value || "").trim();
const toMinorUnits = (value: number) => Math.max(0, Math.round(Number(value || 0) * 100));

const toReactionDto = async (serviceId: mongoose.Types.ObjectId, userId?: string | null) => {
  const [likes, dislikes, current] = await Promise.all([
    ServiceReaction.countDocuments({ serviceId, reaction: "LIKE" }),
    ServiceReaction.countDocuments({ serviceId, reaction: "DISLIKE" }),
    userId ? ServiceReaction.findOne({ serviceId, userId }).lean() : Promise.resolve(null)
  ]);

  await Service.updateOne({ _id: serviceId }, { $set: { likes } });

  return {
    likes,
    dislikes,
    reaction:
      current?.reaction === "LIKE" ? "like" : current?.reaction === "DISLIKE" ? "dislike" : null
  };
};

const toOrderDto = (order: any, locale?: AppLocale) => ({
  id: String(order._id),
  serviceId: String(order.serviceId),
  serviceIdentifier: order.serviceIdentifier,
  serviceTitle: order.serviceTitle,
  agentId: String(order.agentId?._id || order.agentId),
  agentName: order.agentId?.name || order.agentName || undefined,
  customerId: String(order.customerId?._id || order.customerId),
  customerName: order.customerName,
  customerPhone: order.customerPhone,
  customerAddress: order.customerAddress,
  destinationAddress: order.destinationAddress || undefined,
  note: order.note || undefined,
  status: order.status,
  paymentWorkflowStatus: order.paymentWorkflowStatus,
  paymentCollectionStatus: order.paymentCollectionStatus || "DRAFT",
  paymentCollectionMethod: order.paymentCollectionMethod || null,
  lifecycleState: order.lifecycleState,
  paymentState: order.paymentState,
  fulfillmentState: order.fulfillmentState,
  settlementState: order.settlementState,
  disputeState: order.disputeState,
  buyerStatusLabel: getBuyerLifecycleLabel(order.lifecycleState || "awaiting_payment", locale),
  sellerStatusLabel: getSellerLifecycleLabel(order.lifecycleState || "awaiting_payment", locale),
  settlementCategory: order.settlementCategory,
  settlementBucketKey: order.settlementBucketKey,
  paymentIntentId: order.paymentIntentId ? String(order.paymentIntentId) : null,
  paymentId: order.paymentId ? String(order.paymentId) : null,
  paymentCollectionExpiresAt: order.paymentCollectionExpiresAt || null,
  paymentReferenceCode: order.paymentReferenceCode || null,
  buyerReviewEndsAt: order.buyerReviewEndsAt || null,
  releaseScheduledAt: order.releaseScheduledAt || null,
  completedAt: order.completedAt || null,
  trustMessage: order.trustMessage || null,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt
});

export const getServiceReactionSummary = async (req: Request, res: Response) => {
  try {
    const service = await findServiceByIdentifier(req.params.identifier);
    if (!service) return res.status(404).json({ message: t(req, "services.lookup.not_found.message") });

    const summary = await toReactionDto(service._id as mongoose.Types.ObjectId, req.user?._id || null);
    return res.json(summary);
  } catch (err) {
    console.error("getServiceReactionSummary error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const toggleServiceReaction = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const service = await findServiceByIdentifier(req.params.identifier);
    if (!service) return res.status(404).json({ message: t(req, "services.lookup.not_found.message") });

    const reactionInput = normalizeText(req.body.reaction).toUpperCase() as ServiceReactionKind;
    if (!reactionKinds.includes(reactionInput)) {
      return res.status(400).json({ message: t(req, "services.reactions.validation.type.message") });
    }

    const existing = await ServiceReaction.findOne({
      serviceId: service._id,
      userId: req.user._id
    });

    if (existing?.reaction === reactionInput) {
      await existing.deleteOne();
    } else if (existing) {
      existing.reaction = reactionInput;
      await existing.save();
    } else {
      await ServiceReaction.create({
        serviceId: service._id,
        userId: req.user._id,
        reaction: reactionInput
      });
    }

    const summary = await toReactionDto(service._id as mongoose.Types.ObjectId, req.user._id);
    await recordRecommendationSignal({
      userId: req.user._id,
      entityType: "SERVICE",
      entityId: String(service._id),
      entityIdentifier: String((service as any).slug || service._id),
      action: reactionInput === "LIKE" ? "LIKE" : "DISLIKE",
      categoryKey: String(service.category || "").trim() || null,
      location: normalizeText((service as any).location) || null,
      locale: req.locale
    }).catch(() => null);
    return res.json(summary);
  } catch (err) {
    console.error("toggleServiceReaction error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const createServiceOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const service = await findServiceByIdentifier(req.params.identifier);
    if (!service) return res.status(404).json({ message: t(req, "services.lookup.not_found.message") });

    const serviceOwnerId = String((service.createdBy as any)?._id || service.createdBy);
    if (!serviceOwnerId) return res.status(400).json({ message: t(req, "services.owner.lookup.not_found.message") });
    if (serviceOwnerId === req.user._id) {
      return res.status(400).json({ message: t(req, "services.orders.self_order.forbidden.message") });
    }

    const customerName = normalizeText(req.body.customerName || req.body.name);
    const customerPhone = normalizeText(req.body.customerPhone || req.body.phone);
    const customerAddress = normalizeText(req.body.customerAddress || req.body.address);
    const destinationAddress = normalizeText(req.body.destinationAddress || req.body.dropoffAddress);
    const note = normalizeText(req.body.note);
    const servicePrice = Math.max(0, Number((service as any).salePrice || (service as any).price || (service as any).hourlyRate || 0));
    const settlementCategory = inferSettlementCategory("SERVICE_ORDER", service.category);
    const initialStates = buildInitialMarketplaceStates();

    if (!customerName || !customerPhone || !customerAddress) {
      return res.status(400).json({ message: t(req, "checkout.customer.validation.required.message") });
    }

    const order = await ServiceOrder.create({
      serviceId: service._id,
      serviceIdentifier: req.params.identifier,
      serviceTitle: service.title,
      agentId: serviceOwnerId,
      customerId: req.user._id,
      customerName,
      customerPhone,
      customerAddress,
      destinationAddress: destinationAddress || undefined,
      note: note || undefined,
      statusLabelCache: getBuyerLifecycleLabel(initialStates.lifecycleState, req.locale),
      lifecycleState: initialStates.lifecycleState,
      paymentState: initialStates.paymentState,
      fulfillmentState: initialStates.fulfillmentState,
      settlementState: initialStates.settlementState,
      disputeState: initialStates.disputeState,
      settlementCategory,
      settlementBucketKey: `${settlementCategory}_held`,
      trustMessage: t(req, "checkout.trust_notice.service.text"),
      stateTimeline: [
        buildTimelineEntry({
          group: "lifecycle",
          from: null,
          to: "awaiting_payment",
          actorType: "buyer",
          actorId: req.user._id,
          note: t(req, "orders.timeline.created.note")
        }),
        buildTimelineEntry({
          group: "payment",
          from: null,
          to: "awaiting_payment",
          actorType: "buyer",
          actorId: req.user._id,
          note: t(req, "payments.timeline.started.note")
        })
      ]
    });

    await Promise.all([
      OrderAddress.create({
        orderId: order._id,
        sourceModel: "ServiceOrder",
        addressType: "SHIPPING",
        line1: customerAddress,
        line2: destinationAddress || null,
        contactName: customerName,
        contactPhone: customerPhone,
        city: normalizeText((service as any).location) || null
      }),
      OrderFulfillmentDetail.create({
        orderId: order._id,
        sourceModel: "ServiceOrder",
        fulfillmentMode:
          normalizeText(req.body.fulfillmentMode).toUpperCase() === "ONLINE_SERVICE" ? "ONLINE_SERVICE" : "OFFLINE_SERVICE",
        scheduledDate: normalizeText(req.body.scheduledDate || req.body.date) || null,
        scheduledTime: normalizeText(req.body.scheduledTime || req.body.time) || null,
        buyerNote: note || null,
        serviceNote: normalizeText(req.body.serviceNote) || null,
        expectedCompletionAt: req.body.expectedCompletionAt ? new Date(req.body.expectedCompletionAt) : null,
        metadata: {
          sourceModel: "ServiceOrder",
          serviceCategory: service.category
        }
      }),
      OrderItemRecord.create({
        orderId: order._id,
        sourceModel: "ServiceOrder",
        itemType: "SERVICE",
        targetType: "service_listing",
        targetId: service._id,
        sellerOrAgentUserId: mongoose.Types.ObjectId.isValid(serviceOwnerId) ? new mongoose.Types.ObjectId(serviceOwnerId) : null,
        titleSnapshot: service.title,
        categorySnapshot: normalizeText(service.category) || null,
        quantity: 1,
        unitPriceMinor: toMinorUnits(servicePrice),
        lineTotalMinor: toMinorUnits(servicePrice),
        currency: normalizeText((service as any).currency || "USD") || "USD",
        metadata: {
          serviceIdentifier: req.params.identifier,
          destinationAddress: destinationAddress || null
        }
      })
    ]);

    await Service.updateOne({ _id: service._id }, { $inc: { orders: 1 } });
    await recordRecommendationSignal({
      userId: req.user._id,
      entityType: "SERVICE",
      entityId: String(service._id),
      entityIdentifier: String((service as any).slug || service._id),
      action: "PURCHASE",
      categoryKey: String(service.category || "").trim() || null,
      location: normalizeText((service as any).location) || null,
      locale: req.locale,
      metadata: {
        orderId: String(order._id)
      }
    }).catch(() => null);

    sendToUser(serviceOwnerId, "service_order_created", {
      orderId: String(order._id),
      serviceId: String(service._id),
      serviceTitle: service.title,
      customerName,
      customerPhone,
      customerAddress
    });

    return res.status(201).json({ order: toOrderDto(order, req.locale) });
  } catch (err) {
    console.error("createServiceOrder error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const listMyServiceOrders = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orders = await ServiceOrder.find({ customerId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("agentId", "name username");
    return res.json({ orders: orders.map((order) => toOrderDto(order, req.locale)) });
  } catch (err) {
    console.error("listMyServiceOrders error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const listIncomingServiceOrders = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const filter: Record<string, unknown> = {};
    if (req.user.role !== "ADMIN") {
      filter.agentId = req.user._id;
    } else if (typeof req.query.agentId === "string" && mongoose.Types.ObjectId.isValid(req.query.agentId)) {
      filter.agentId = req.query.agentId;
    }

    const orders = await ServiceOrder.find(filter)
      .sort({ createdAt: -1 })
      .populate("customerId", "name username")
      .populate("agentId", "name username");

    return res.json({ orders: orders.map((order) => toOrderDto(order, req.locale)) });
  } catch (err) {
    console.error("listIncomingServiceOrders error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const updateServiceOrderStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    }

    const nextStatus = normalizeText(req.body.status).toUpperCase() as ServiceOrderStatus;
    if (!orderStatuses.includes(nextStatus)) {
      return res.status(400).json({ message: t(req, "services.orders.status.invalid.message") });
    }

    const order = await ServiceOrder.findById(id);
    if (!order) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });

    const isAgent = req.user.role === "AGENT";
    const isCustomer = req.user.role === "USER";
    if (isAgent && String(order.agentId) !== req.user._id) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }
    if (isCustomer && String(order.customerId) !== req.user._id) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const transitions = isCustomer ? customerOrderTransitions : agentOrderTransitions;
    if (!transitions[order.status].includes(nextStatus)) {
      return res.status(400).json({ message: t(req, "services.orders.status.transition_invalid.message") });
    }

    order.status = nextStatus;
    await order.save();

    if (nextStatus === "ACCEPTED" && order.paymentId) {
      await markEscrowSourceInProgress(order.paymentId, normalizeText(req.body.note) || t(req, "services.orders.status.accepted.note"));
      order.paymentWorkflowStatus = "IN_PROGRESS";
      const next = buildFulfillmentStartedState("seller", normalizeText(req.body.note) || t(req, "services.orders.status.accepted.note"));
      order.lifecycleState = next.lifecycleState;
      order.fulfillmentState = next.fulfillmentState;
      order.stateTimeline = [...(order.stateTimeline || []), ...next.timeline];
      await order.save();
    }

    if (nextStatus === "COMPLETED" && order.paymentId) {
      await markEscrowSourceDelivered(order.paymentId, {
        proofType: normalizeText(req.body.proofType) || "service_completion",
        proofNote: normalizeText(req.body.note),
        proofUrl: normalizeText(req.body.proofUrl)
      });
      const delivered = buildDeliveredState({
        awaitingBuyerConfirmation: true,
        actorType: "seller",
        note: normalizeText(req.body.note) || t(req, "services.orders.status.completed.note")
      });
      order.lifecycleState = delivered.lifecycleState;
      order.fulfillmentState = delivered.fulfillmentState;
      order.settlementState = delivered.settlementState;
      order.stateTimeline = [...(order.stateTimeline || []), ...delivered.timeline];
      const refreshed = await ServiceOrder.findById(order._id);
      if (refreshed) {
        return res.json({ order: toOrderDto(refreshed, req.locale) });
      }
    }

    const recipientId =
      req.user._id === String(order.agentId) ? String(order.customerId) : String(order.agentId);
    sendToUser(recipientId, "service_order_updated", {
      orderId: String(order._id),
      status: order.status
    });

    return res.json({ order: toOrderDto(order, req.locale) });
  } catch (err) {
    console.error("updateServiceOrderStatus error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
