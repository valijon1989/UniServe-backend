import mongoose from "mongoose";
import { Request, Response } from "express";
import { AgentProfile } from "../models/AgentProfile";
import { EscrowHold } from "../models/EscrowHold";
import { Order } from "../models/Order";
import { OrderAddress } from "../models/OrderAddress";
import { OrderFulfillmentDetail } from "../models/OrderFulfillmentDetail";
import { OrderItemRecord } from "../models/OrderItem";
import { Payment } from "../models/Payment";
import { User } from "../models/User";
import {
  buildInitialMarketplaceStates,
  buildTimelineEntry,
  getBuyerLifecycleLabel,
  getSellerLifecycleLabel
} from "../services/marketplaceStateMachine";
import { canSellerAccessOrder, parseObjectId, parseMoney, toOrderDtoBase } from "../services/productOrderFlow";
import { t } from "../i18n";
import { respondAuthRequired } from "../utils/controllerResponses";

const normalizeText = (value: unknown) => String(value || "").trim();
const toMinorUnits = (value: number) => Math.max(0, Math.round(Number(value || 0) * 100));

const parseRoute = (value: unknown) => {
  if (Array.isArray(value)) {
    const [from, to] = value;
    return {
      from: normalizeText(from),
      to: normalizeText(to),
      raw: value
    };
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return {
      from: normalizeText(source.from || source.origin || source.pickup || source.pickupAddress),
      to: normalizeText(source.to || source.destination || source.dropoff || source.dropoffAddress),
      raw: value
    };
  }

  const raw = normalizeText(value);
  if (!raw) return { from: "", to: "", raw: value };

  const [from, to] = raw.split(/\s*(?:->|=>|→|to)\s*/i);
  return {
    from: normalizeText(from),
    to: normalizeText(to),
    raw
  };
};

const isDeliveryOrder = (order: any) => order?.kind === "SERVICE" && order?.settlementCategory === "transport";

const buildEscrowDto = (hold: any, payment: any) => ({
  status: payment?.workflowStatus || null,
  holdStatus: hold?.holdStatus || null,
  grossAmountMinor: typeof hold?.grossAmountMinor === "number" ? hold.grossAmountMinor : null,
  netHeldAmountMinor: typeof hold?.netHeldAmountMinor === "number" ? hold.netHeldAmountMinor : null,
  heldAt: hold?.heldAt || null,
  releaseDueAt: hold?.releaseDueAt || null,
  releasedAt: hold?.releasedAt || null,
  refundedAt: hold?.refundedAt || null,
  escrowHeldAmount: Number(payment?.escrowHeldAmount || 0),
  releasedAmount: Number(payment?.releasedAmount || 0),
  refundedAmount: Number(payment?.refundedAmount || 0),
  sellerPendingPayoutAmount: Number(payment?.sellerPendingPayoutAmount || 0)
});

export const createDeliveryOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const agentId = parseObjectId(req.body.agentId);
    const price = Number(req.body.price);
    const currency = normalizeText(req.body.currency || "USD") || "USD";
    const deliveryType = normalizeText(req.body.deliveryType || req.body.deliveryOption || "standard") || "standard";
    const weight = parseMoney(req.body.weight, 0);
    const route = parseRoute(req.body.route);
    const customerPhone = normalizeText(req.body.customerPhone || req.body.phone);
    const customerName = normalizeText(req.body.customerName || req.body.name || "Customer");
    const note = normalizeText(req.body.note);
    const paymentMethod = normalizeText(req.body.paymentMethod || req.body.method || "CARD") || "CARD";
    const paymentProvider = normalizeText(req.body.paymentProvider || req.body.provider || "MOCK") || "MOCK";

    if (!agentId) return res.status(400).json({ message: "Valid agentId is required" });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "price must be a positive number" });
    if (!route.from || !route.to) return res.status(400).json({ message: "route.from and route.to are required" });
    if (!customerPhone) return res.status(400).json({ message: "customerPhone is required" });
    if (!customerName) return res.status(400).json({ message: "customerName is required" });

    const [agent, profile] = await Promise.all([
      User.findById(agentId).select("_id role name username").lean(),
      AgentProfile.findOne({ user: agentId }).lean()
    ]);

    if (!agent || agent.role !== "AGENT" || !profile) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const initialStates = buildInitialMarketplaceStates();
    const syntheticItemId = new mongoose.Types.ObjectId();
    const titleSnapshot = normalizeText(req.body.title || "Delivery order");

    const order = await Order.create({
      userId: req.user._id,
      agentId,
      kind: "SERVICE",
      status: "PENDING_PAYMENT",
      statusLabelCache: getBuyerLifecycleLabel(initialStates.lifecycleState, req.locale),
      lifecycleState: initialStates.lifecycleState,
      paymentState: initialStates.paymentState,
      fulfillmentState: initialStates.fulfillmentState,
      settlementState: initialStates.settlementState,
      disputeState: initialStates.disputeState,
      paymentWorkflowStatus: "INITIATED",
      paymentCollectionStatus: "DRAFT",
      paymentCollectionMethod: paymentMethod as any,
      settlementCategory: "transport",
      settlementBucketKey: "transport_held",
      source: "BUY_NOW",
      items: [
        {
          productId: syntheticItemId,
          sellerId: agentId,
          qty: 1,
          unitPrice: price,
          titleSnapshot,
          categoryKey: "transport",
          settlementBucketKey: "transport_held"
        }
      ],
      subtotal: price,
      shippingFee: 0,
      total: price,
      currency,
      deliveryOption: deliveryType,
      shippingAddress: {
        name: customerName,
        phone: customerPhone,
        address1: route.from,
        address2: route.to
      },
      payment: {
        method: paymentMethod,
        provider: paymentProvider
      },
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
      ],
      note: note || undefined,
      trustMessage: t(req, "checkout.trust_notice.service.text")
    });

    await Promise.all([
      OrderAddress.create({
        orderId: order._id,
        sourceModel: "Order",
        addressType: "SHIPPING",
        line1: route.from,
        line2: route.to,
        contactName: customerName,
        contactPhone: customerPhone
      }),
      OrderFulfillmentDetail.create({
        orderId: order._id,
        sourceModel: "Order",
        fulfillmentMode: "SHIPPING",
        deliveryType,
        buyerNote: note || null,
        metadata: {
          orderType: "DELIVERY_ORDER",
          route: route.raw,
          weight
        }
      }),
      OrderItemRecord.create({
        orderId: order._id,
        sourceModel: "Order",
        itemType: "SERVICE",
        targetType: "delivery_order",
        targetId: null,
        sellerOrAgentUserId: agentId,
        titleSnapshot,
        categorySnapshot: "transport",
        quantity: 1,
        unitPriceMinor: toMinorUnits(price),
        lineTotalMinor: toMinorUnits(price),
        currency,
        metadata: {
          route: route.raw,
          weight,
          deliveryType
        }
      })
    ]);

    return res.status(201).json({
      order: {
        ...toOrderDtoBase(order, req.locale),
        buyerStatusLabel: getBuyerLifecycleLabel(order.lifecycleState, req.locale),
        sellerStatusLabel: getSellerLifecycleLabel(order.lifecycleState, req.locale),
        route: {
          from: route.from,
          to: route.to
        },
        weight,
        deliveryType
      },
      escrow: null
    });
  } catch (err) {
    console.error("createDeliveryOrder error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getDeliveryOrderById = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const orderId = parseObjectId(req.params.id);
    if (!orderId) return res.status(400).json({ message: "Invalid order id" });

    const order = await Order.findById(orderId).lean();
    if (!order || !isDeliveryOrder(order)) return res.status(404).json({ message: "Delivery order not found" });
    if (
      req.user.role !== "ADMIN" &&
      String(order.userId) !== req.user._id &&
      !canSellerAccessOrder(order, req.user._id)
    ) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const [detail, payment, hold] = await Promise.all([
      OrderFulfillmentDetail.findOne({ orderId: order._id, sourceModel: "Order" }).lean(),
      order.paymentId ? Payment.findById(order.paymentId).lean() : Promise.resolve(null),
      order.paymentIntentId
        ? EscrowHold.findOne({ orderId: order._id, paymentIntentId: order.paymentIntentId }).lean()
        : Promise.resolve(null)
    ]);

    const route = parseRoute((detail?.metadata as Record<string, unknown> | null)?.route || [
      order.shippingAddress?.address1,
      order.shippingAddress?.address2
    ]);

    return res.json({
      order: {
        ...toOrderDtoBase(order, req.locale),
        buyerStatusLabel: getBuyerLifecycleLabel(order.lifecycleState, req.locale),
        sellerStatusLabel: getSellerLifecycleLabel(order.lifecycleState, req.locale),
        route: {
          from: route.from,
          to: route.to
        },
        weight: Number((detail?.metadata as Record<string, unknown> | null)?.weight || 0),
        deliveryType: detail?.deliveryType || order.deliveryOption || null
      },
      escrow: buildEscrowDto(hold, payment)
    });
  } catch (err) {
    console.error("getDeliveryOrderById error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
