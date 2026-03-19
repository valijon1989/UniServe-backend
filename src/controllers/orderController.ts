import mongoose from "mongoose";
import { Request, Response } from "express";
import { BuyerConfirmation } from "../models/BuyerConfirmation";
import { EscrowHold } from "../models/EscrowHold";
import { Order } from "../models/Order";
import { OrderFulfillmentDetail } from "../models/OrderFulfillmentDetail";
import { OrderFulfillmentEvent } from "../models/OrderFulfillmentEvent";
import { OrderItemRecord } from "../models/OrderItem";
import { Payment } from "../models/Payment";
import { ServiceOrder } from "../models/ServiceOrder";
import {
  getBuyerLifecycleLabel,
  getSellerLifecycleLabel
} from "../services/marketplaceStateMachine";
import {
  markEscrowSourceDelivered,
  markEscrowSourceInProgress,
  releasePaymentToSellerPending
} from "../services/paymentEngine";
import {
  canSellerAccessOrder,
  createProductOrder,
  normalizeText,
  parseObjectId,
  toOrderDtoBase
} from "../services/productOrderFlow";
import {
  findLatestPaymentCollectionForSource,
  getPaymentCollectionIntent,
  toPaymentCollectionDto
} from "../services/paymentCollection";
import { buildRecommendationModulesSafe } from "../services/recommendationEngine";
import { parsePositiveInt } from "../utils/pagination";
import type { AppLocale } from "../i18n";
import { t } from "../i18n";

type SourceModel = "Order" | "ServiceOrder";

type ResolvedOrderResource =
  | { sourceModel: "Order"; sourceType: "PRODUCT_ORDER"; kind: "PRODUCT"; order: any }
  | { sourceModel: "ServiceOrder"; sourceType: "SERVICE_ORDER"; kind: "SERVICE"; order: any };

const toMajorUnits = (value: unknown) => Number(value || 0) / 100;

const getConfirmationNextSteps = (paymentCollectionStatus: string, locale?: AppLocale) => {
  switch (String(paymentCollectionStatus || "").toUpperCase()) {
    case "HELD_IN_ESCROW":
      return [1, 2, 3].map((step) => t(locale, `checkout.next_steps.held.step_${step}`));
    case "PAYMENT_LINK_SENT":
      return [t(locale, "checkout.next_steps.sms_link.step_1"), t(locale, "checkout.next_steps.sms_link.step_2")];
    case "AWAITING_MANUAL_TRANSFER":
      return [t(locale, "checkout.next_steps.manual_transfer.step_1"), t(locale, "checkout.next_steps.manual_transfer.step_2")];
    case "PAYMENT_PENDING_VERIFICATION":
      return [t(locale, "checkout.next_steps.pending_verification.step_1"), t(locale, "checkout.next_steps.pending_verification.step_2")];
    default:
      return [t(locale, "checkout.next_steps.default.step_1")];
  }
};

const resolveSourceModelHint = (value: unknown): SourceModel | null => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "order" || normalized === "product_order" || normalized === "product") return "Order";
  if (normalized === "serviceorder" || normalized === "service_order" || normalized === "service") return "ServiceOrder";
  return null;
};

const toResolvedOrder = (order: any, sourceModel: SourceModel): ResolvedOrderResource =>
  sourceModel === "Order"
    ? { sourceModel, sourceType: "PRODUCT_ORDER", kind: "PRODUCT", order }
    : { sourceModel, sourceType: "SERVICE_ORDER", kind: "SERVICE", order };

const findOrderResourceById = async (
  orderId: mongoose.Types.ObjectId,
  options?: { lean?: boolean; sourceModelHint?: SourceModel | null }
): Promise<ResolvedOrderResource | null> => {
  const lean = Boolean(options?.lean);
  const orderQuery = lean ? Order.findById(orderId).lean() : Order.findById(orderId);
  const serviceQuery = lean ? ServiceOrder.findById(orderId).lean() : ServiceOrder.findById(orderId);

  if (options?.sourceModelHint === "Order") {
    const order = await orderQuery;
    return order ? toResolvedOrder(order, "Order") : null;
  }
  if (options?.sourceModelHint === "ServiceOrder") {
    const order = await serviceQuery;
    return order ? toResolvedOrder(order, "ServiceOrder") : null;
  }

  const order = await orderQuery;
  if (order) return toResolvedOrder(order, "Order");
  const serviceOrder = await serviceQuery;
  return serviceOrder ? toResolvedOrder(serviceOrder, "ServiceOrder") : null;
};

const getBuyerId = (resource: ResolvedOrderResource) =>
  String(resource.sourceModel === "Order" ? resource.order.userId : resource.order.customerId);

const getSellerId = (resource: ResolvedOrderResource) =>
  resource.sourceModel === "Order"
    ? String(resource.order.agentId || "")
    : String(resource.order.agentId || "");

const canAccessOrderResource = (resource: ResolvedOrderResource, userId: string, role: string) => {
  if (role === "ADMIN") return true;
  if (getBuyerId(resource) === userId) return true;
  if (resource.sourceModel === "Order") return canSellerAccessOrder(resource.order, userId);
  return getSellerId(resource) === userId;
};

const canManageOrderFulfillment = (resource: ResolvedOrderResource, userId: string, role: string) => {
  if (role === "ADMIN") return true;
  if (resource.sourceModel === "Order") return canSellerAccessOrder(resource.order, userId);
  return getSellerId(resource) === userId;
};

const getOrderPaymentCollection = async (resource: ResolvedOrderResource) => {
  if (resource.order.paymentIntentId) {
    return getPaymentCollectionIntent(resource.order.paymentIntentId).catch(() => null);
  }
  return findLatestPaymentCollectionForSource(resource.sourceType, resource.order._id).catch(() => null);
};

const buildServiceOrderBaseDto = async (order: any, paymentCollection: any | null, locale?: AppLocale) => {
  const [itemRecords, fulfillmentDetail] = await Promise.all([
    OrderItemRecord.find({ orderId: order._id, sourceModel: "ServiceOrder" }).sort({ createdAt: 1 }).lean(),
    OrderFulfillmentDetail.findOne({ orderId: order._id, sourceModel: "ServiceOrder" }).lean()
  ]);

  const items =
    itemRecords.length > 0
      ? itemRecords.map((item) => ({
          productId: item.targetId ? String(item.targetId) : null,
          sellerId: item.sellerOrAgentUserId ? String(item.sellerOrAgentUserId) : null,
          qty: Number(item.quantity || 0),
          unitPrice: toMajorUnits(item.unitPriceMinor),
          titleSnapshot: item.titleSnapshot,
          imageSnapshot: null,
          categoryKey: item.categorySnapshot || order.settlementCategory || "services",
          settlementBucketKey: order.settlementBucketKey || "services_held",
          lineTotal: toMajorUnits(item.lineTotalMinor),
          targetType: item.targetType,
          metadata: item.metadata || null
        }))
      : [
          {
            productId: String(order.serviceId),
            sellerId: String(order.agentId),
            qty: 1,
            unitPrice: paymentCollection ? Number(paymentCollection.amount || 0) : 0,
            titleSnapshot: order.serviceTitle,
            imageSnapshot: null,
            categoryKey: order.settlementCategory || "services",
            settlementBucketKey: order.settlementBucketKey || "services_held",
            lineTotal: paymentCollection ? Number(paymentCollection.amount || 0) : 0,
            targetType: "service_listing",
            metadata: {
              serviceIdentifier: order.serviceIdentifier
            }
          }
        ];

  const currency = itemRecords[0]?.currency || paymentCollection?.currency || "USD";
  const subtotal = items.reduce((acc, item) => acc + Number(item.lineTotal || 0), 0);

  return {
    _id: String(order._id),
    kind: "SERVICE",
    sourceModel: "ServiceOrder",
    resourceType: "SERVICE_ORDER",
    userId: String(order.customerId),
    agentId: String(order.agentId),
    status: order.status,
    lifecycleState: order.lifecycleState,
    paymentState: order.paymentState,
    fulfillmentState: order.fulfillmentState,
    settlementState: order.settlementState,
    disputeState: order.disputeState,
    buyerStatusLabel: getBuyerLifecycleLabel(order.lifecycleState || "awaiting_payment", locale),
    sellerStatusLabel: getSellerLifecycleLabel(order.lifecycleState || "awaiting_payment", locale),
    paymentWorkflowStatus: order.paymentWorkflowStatus,
    paymentCollectionStatus: order.paymentCollectionStatus || "DRAFT",
    paymentCollectionMethod: order.paymentCollectionMethod || null,
    paymentIntentId: order.paymentIntentId ? String(order.paymentIntentId) : null,
    paymentId: order.paymentId ? String(order.paymentId) : null,
    settlementCategory: order.settlementCategory,
    settlementBucketKey: order.settlementBucketKey,
    source: "SERVICE",
    paymentCollectionExpiresAt: order.paymentCollectionExpiresAt || null,
    paymentReferenceCode: order.paymentReferenceCode || null,
    buyerReviewEndsAt: order.buyerReviewEndsAt || null,
    releaseScheduledAt: order.releaseScheduledAt || null,
    deliveredAt: order.completedAt || null,
    completedAt: order.completedAt || null,
    trustMessage: order.trustMessage || null,
    items,
    subtotal,
    shippingFee: 0,
    total: subtotal,
    currency,
    deliveryOption: fulfillmentDetail?.deliveryType || fulfillmentDetail?.fulfillmentMode || null,
    shippingAddress: {
      name: order.customerName,
      phone: order.customerPhone,
      address1: order.customerAddress,
      address2: order.destinationAddress || null
    },
    payment: {
      method: order.paymentCollectionMethod || paymentCollection?.methodCode || null,
      provider: paymentCollection?.provider || null,
      paidAt: paymentCollection?.paidAt || null
    },
    serviceId: String(order.serviceId),
    serviceIdentifier: order.serviceIdentifier,
    serviceTitle: order.serviceTitle,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    destinationAddress: order.destinationAddress || null,
    note: order.note || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
};

const enrichOrderDto = async (resource: ResolvedOrderResource, locale?: AppLocale) => {
  const paymentCollection = await getOrderPaymentCollection(resource);
  const paymentCollectionDto = paymentCollection ? await toPaymentCollectionDto(paymentCollection, locale) : null;
  if (resource.sourceModel === "Order") {
    return {
      ...toOrderDtoBase(resource.order, locale),
      kind: "PRODUCT",
      sourceModel: "Order",
      resourceType: "PRODUCT_ORDER",
      note: resource.order.note || null,
      paymentCollection: paymentCollectionDto
    };
  }
  return {
    ...(await buildServiceOrderBaseDto(resource.order, paymentCollectionDto, locale)),
    paymentCollection: paymentCollectionDto
  };
};

const createFulfillmentEvent = async (
  resource: ResolvedOrderResource,
  actorUserId: string,
  payload: {
    eventType: string;
    notes?: string | null;
    proofType?: string | null;
    proofUrl?: string | null;
    metadata?: Record<string, unknown> | null;
  }
) =>
  OrderFulfillmentEvent.create({
    orderId: resource.order._id,
    sourceModel: resource.sourceModel,
    eventType: payload.eventType,
    actorUserId: new mongoose.Types.ObjectId(actorUserId),
    notes: payload.notes || null,
    proofType: payload.proofType || null,
    proofUrl: payload.proofUrl || null,
    metadata: payload.metadata || null
  });

const toFulfillmentHistoryDto = async (resource: ResolvedOrderResource) => {
  const [detail, events] = await Promise.all([
    OrderFulfillmentDetail.findOne({ orderId: resource.order._id, sourceModel: resource.sourceModel }).lean(),
    OrderFulfillmentEvent.find({ orderId: resource.order._id, sourceModel: resource.sourceModel }).sort({ createdAt: 1 }).lean()
  ]);
  return {
    orderId: String(resource.order._id),
    sourceModel: resource.sourceModel,
    kind: resource.kind,
    fulfillmentState: resource.order.fulfillmentState,
    reviewWindowEndsAt: resource.order.buyerReviewEndsAt || null,
    detail: detail
      ? {
          fulfillmentMode: detail.fulfillmentMode,
          deliveryType: detail.deliveryType || null,
          scheduledDate: detail.scheduledDate || null,
          scheduledTime: detail.scheduledTime || null,
          buyerNote: detail.buyerNote || null,
          serviceNote: detail.serviceNote || null,
          expectedCompletionAt: detail.expectedCompletionAt || null,
          metadata: detail.metadata || null
        }
      : null,
    events: events.map((event) => ({
      id: String(event._id),
      eventType: event.eventType,
      notes: event.notes || null,
      proofType: event.proofType || null,
      proofUrl: event.proofUrl || null,
      metadata: event.metadata || null,
      actorUserId: event.actorUserId ? String(event.actorUserId) : null,
      createdAt: event.createdAt
    }))
  };
};

const getEscrowHoldForResource = async (resource: ResolvedOrderResource) => {
  if (!resource.order.paymentIntentId) return null;
  return EscrowHold.findOne({
    orderId: resource.order._id,
    paymentIntentId: resource.order.paymentIntentId
  }).lean();
};

const buildConfirmationPayload = async (resource: ResolvedOrderResource, locale?: AppLocale) => {
  const enriched = await enrichOrderDto(resource, locale);
  const continueShopping = resource.sourceModel === "Order" ? "/products" : "/services";
  const categoryKey = normalizeText(
    enriched.items?.[0]?.categoryKey || enriched.settlementCategory || resource.order.settlementCategory
  ) || null;
  const recommendations = await buildRecommendationModulesSafe({
    surface: "ORDER_SUCCESS",
    locale,
    userId: getBuyerId(resource),
    categoryKey,
    limitPerModule: 4
  }, "order.confirmation.recommendations");
  return {
    orderNumber: String(resource.order._id).slice(-8).toUpperCase(),
    orderId: String(resource.order._id),
    sourceModel: resource.sourceModel,
    kind: resource.kind,
    paymentMethod:
      enriched.paymentCollection?.methodCode ||
      resource.order.paymentCollectionMethod ||
      resource.order.payment?.method ||
      null,
    paymentStatus: enriched.paymentCollection?.status || resource.order.paymentCollectionStatus || "DRAFT",
    escrowStatus: resource.order.settlementState || "none",
    amount: Number(enriched.total || 0),
    currency: enriched.currency || "USD",
    deliveryDetails: {
      address: enriched.shippingAddress || null,
      deliveryType: enriched.deliveryOption || null,
      buyerNote: enriched.note || null
    },
    items: enriched.items,
    nextSteps: getConfirmationNextSteps(String(enriched.paymentCollection?.status || resource.order.paymentCollectionStatus || ""), locale),
    actions: {
      myOrders: "/orders",
      continueShopping,
      paymentDetails: resource.order.paymentIntentId ? `/payments/intents/${String(resource.order.paymentIntentId)}` : null
    },
    paymentCollection: enriched.paymentCollection,
    recommendations
  };
};

const withOrderFilters = (baseFilter: Record<string, unknown>, req: Request, sourceModel: SourceModel) => {
  const filter = { ...baseFilter };
  const status = normalizeText(req.query.status).toUpperCase();
  const paymentState = normalizeText(req.query.payment_state || req.query.paymentState).toLowerCase();
  const disputeState = normalizeText(req.query.dispute_state || req.query.disputeState).toLowerCase();
  const settlementState = normalizeText(req.query.settlement_state || req.query.settlementState).toLowerCase();
  const fulfillmentState = normalizeText(req.query.fulfillment_state || req.query.fulfillmentState).toLowerCase();
  const paymentCollectionStatus = normalizeText(
    req.query.payment_collection_status || req.query.paymentCollectionStatus
  ).toUpperCase();

  if (status) filter.status = status;
  if (paymentState) filter.paymentState = paymentState;
  if (disputeState) filter.disputeState = disputeState;
  if (settlementState) filter.settlementState = settlementState;
  if (fulfillmentState) filter.fulfillmentState = fulfillmentState;
  if (paymentCollectionStatus) filter.paymentCollectionStatus = paymentCollectionStatus;

  const kind = normalizeText(req.query.kind || req.query.order_type || req.query.orderType).toLowerCase();
  if (kind) {
    if (sourceModel === "Order" && !["product", "products", "product_order"].includes(kind)) return null;
    if (sourceModel === "ServiceOrder" && !["service", "services", "service_order"].includes(kind)) return null;
  }

  return filter;
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const created = await createProductOrder({ userId: req.user._id, body: req.body, locale: req.locale });
    if ("error" in created) {
      return res.status(created.status || 400).json({ message: created.error });
    }

    return res.status(201).json({
      orderId: String(created.order._id),
      total: Number(created.order.total || 0),
      status: created.order.status,
      paymentWorkflowStatus: created.order.paymentWorkflowStatus,
      paymentCollectionStatus: created.order.paymentCollectionStatus,
      paymentIntentId: created.order.paymentIntentId ? String(created.order.paymentIntentId) : null,
      trustMessage: created.order.trustMessage
    });
  } catch (err) {
    console.error("createOrder error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const orderId = parseObjectId(req.params.id);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const resource = await findOrderResourceById(orderId, {
      lean: true,
      sourceModelHint: resolveSourceModelHint(req.query.sourceModel || req.query.source_type)
    });
    if (!resource) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (!canAccessOrderResource(resource, req.user._id, req.user.role)) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    return res.json({ order: await enrichOrderDto(resource, req.locale) });
  } catch (err) {
    console.error("getOrderById error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const listOrders = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const page = parsePositiveInt(req.query.page, 1, 1_000_000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const skip = (page - 1) * limit;
    const fetchLimit = skip + limit;

    const scope = normalizeText(req.query.scope || req.query.mine).toLowerCase();
    const sellerScope = scope === "seller";

    const productBaseFilter: Record<string, unknown> = {};
    const serviceBaseFilter: Record<string, unknown> = {};

    if (req.user.role !== "ADMIN") {
      if (sellerScope) {
        productBaseFilter.$or = [{ agentId: req.user._id }, { "items.sellerId": new mongoose.Types.ObjectId(req.user._id) }];
        serviceBaseFilter.agentId = req.user._id;
      } else {
        productBaseFilter.userId = req.user._id;
        serviceBaseFilter.customerId = req.user._id;
      }
    }

    const productFilter = withOrderFilters(productBaseFilter, req, "Order");
    const serviceFilter = withOrderFilters(serviceBaseFilter, req, "ServiceOrder");

    const [productItems, productTotal, serviceItems, serviceTotal] = await Promise.all([
      productFilter ? Order.find(productFilter).sort({ createdAt: -1 }).limit(fetchLimit).lean() : Promise.resolve([]),
      productFilter ? Order.countDocuments(productFilter) : Promise.resolve(0),
      serviceFilter ? ServiceOrder.find(serviceFilter).sort({ createdAt: -1 }).limit(fetchLimit).lean() : Promise.resolve([]),
      serviceFilter ? ServiceOrder.countDocuments(serviceFilter) : Promise.resolve(0)
    ]);

    const combined = [
      ...productItems.map((order) => toResolvedOrder(order, "Order")),
      ...serviceItems.map((order) => toResolvedOrder(order, "ServiceOrder"))
    ]
      .sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime())
      .slice(skip, skip + limit);

    return res.json({
      items: await Promise.all(combined.map((item) => enrichOrderDto(item, req.locale))),
      page,
      limit,
      total: Number(productTotal || 0) + Number(serviceTotal || 0)
    });
  } catch (err) {
    console.error("listOrders error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orderId = parseObjectId(req.params.id);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const resource = await findOrderResourceById(orderId);
    if (!resource) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (resource.sourceModel !== "Order") {
      return res.status(400).json({ message: t(req, "orders.status.products_only.message") });
    }

    const order = resource.order;
    const nextStatus = normalizeText(req.body.status).toUpperCase();
    const isAdmin = req.user.role === "ADMIN";
    const isBuyer = String(order.userId) === req.user._id;
    const isSeller = canSellerAccessOrder(order, req.user._id);
    if (!isAdmin && !isBuyer && !isSeller) return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });

    if (nextStatus === "CANCELLED") {
      if (!isAdmin && !isBuyer) return res.status(403).json({ message: t(req, "orders.status.cancel_unpaid_only.message") });
      if (order.status !== "PENDING_PAYMENT") {
        return res.status(400).json({ message: t(req, "orders.status.cancel_unpaid_state.message") });
      }
      order.status = "CANCELLED";
      order.paymentWorkflowStatus = "CANCELLED";
      order.paymentCollectionStatus = "CANCELLED";
      await order.save();
      const updated = await findOrderResourceById(order._id, { lean: true, sourceModelHint: "Order" });
      return res.json({ order: updated ? await enrichOrderDto(updated) : null });
    }

    if (!order.paymentId) {
      return res.status(400).json({ message: t(req, "orders.payment.escrow_required.message") });
    }

    if (nextStatus === "PROCESSING") {
      if (!isAdmin && !isSeller) return res.status(403).json({ message: t(req, "orders.status.processing_role.message") });
      if (!["PAID", "PROCESSING"].includes(order.status)) {
        return res.status(400).json({ message: t(req, "orders.status.processing_invalid.message") });
      }
      order.status = "PROCESSING";
      order.paymentWorkflowStatus = "IN_PROGRESS";
      if (normalizeText(req.body.note)) order.note = normalizeText(req.body.note);
      await order.save();
      await markEscrowSourceInProgress(order.paymentId, order.note);
      const updated = await findOrderResourceById(order._id, { lean: true, sourceModelHint: "Order" });
      return res.json({ order: updated ? await enrichOrderDto(updated) : null });
    }

    if (nextStatus === "CONFIRMED") {
      if (!isAdmin && !isSeller) return res.status(403).json({ message: t(req, "orders.status.confirm_role.message") });
      if (!["PAID", "PROCESSING", "CONFIRMED"].includes(order.status)) {
        return res.status(400).json({ message: t(req, "orders.status.confirm_invalid.message") });
      }
      await markEscrowSourceDelivered(order.paymentId, {
        proofType: normalizeText(req.body.proofType) || "delivery_confirmation",
        proofNote: normalizeText(req.body.note),
        proofUrl: normalizeText(req.body.proofUrl)
      });
      const updated = await findOrderResourceById(order._id, { lean: true, sourceModelHint: "Order" });
      return res.json({ order: updated ? await enrichOrderDto(updated) : null });
    }

    if (nextStatus === "COMPLETED") {
      if (!isAdmin && !isBuyer) return res.status(403).json({ message: t(req, "orders.status.complete_role.message") });
      await releasePaymentToSellerPending(order.paymentId, t(req, "orders.status.completed.note"));
      order.status = "COMPLETED";
      order.paymentWorkflowStatus = "RELEASED_TO_AGENT";
      order.completedAt = new Date();
      await order.save();
      const updated = await findOrderResourceById(order._id, { lean: true, sourceModelHint: "Order" });
      return res.json({ order: updated ? await enrichOrderDto(updated) : null });
    }

    return res.status(400).json({ message: t(req, "orders.status.transition_unsupported.message") });
  } catch (err) {
    console.error("updateOrderStatus error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getOrderConfirmation = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orderId = parseObjectId(req.params.id || req.params.orderId);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const resource = await findOrderResourceById(orderId, {
      lean: true,
      sourceModelHint: resolveSourceModelHint(req.query.sourceModel || req.query.source_type)
    });
    if (!resource) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (!canAccessOrderResource(resource, req.user._id, req.user.role)) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    return res.json(await buildConfirmationPayload(resource));
  } catch (err) {
    console.error("getOrderConfirmation error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const confirmOrderReceipt = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orderId = parseObjectId(req.params.id || req.params.orderId);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const resource = await findOrderResourceById(orderId, {
      sourceModelHint: resolveSourceModelHint(req.query.sourceModel || req.query.source_type)
    });
    if (!resource) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (getBuyerId(resource) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: t(req, "orders.access.buyer_confirm_only.message") });
    }
    if (!resource.order.paymentId) return res.status(400).json({ message: t(req, "orders.payment.confirmed_required.message") });

    await BuyerConfirmation.create({
      orderId: resource.order._id,
      sourceModel: resource.sourceModel,
      buyerUserId: new mongoose.Types.ObjectId(getBuyerId(resource)),
      confirmationType: "ACCEPTED",
      notes: normalizeText(req.body.note) || null
    });
    await releasePaymentToSellerPending(
      resource.order.paymentId,
      normalizeText(req.body.note) || t(req, "orders.receipt.confirmed.note")
    );

    const updated = await findOrderResourceById(resource.order._id, {
      lean: true,
      sourceModelHint: resource.sourceModel
    });
    return res.json({ order: updated ? await enrichOrderDto(updated) : null });
  } catch (err) {
    console.error("confirmOrderReceipt error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const rejectOrderReceipt = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orderId = parseObjectId(req.params.id || req.params.orderId);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const resource = await findOrderResourceById(orderId, {
      sourceModelHint: resolveSourceModelHint(req.query.sourceModel || req.query.source_type)
    });
    if (!resource) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (getBuyerId(resource) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: t(req, "orders.access.buyer_issue_only.message") });
    }

    const issueNote =
      normalizeText(req.body.note || req.body.reason || req.body.message) || t(req, "orders.issue.reported.note");

    await BuyerConfirmation.create({
      orderId: resource.order._id,
      sourceModel: resource.sourceModel,
      buyerUserId: new mongoose.Types.ObjectId(getBuyerId(resource)),
      confirmationType: "REJECTED",
      notes: issueNote
    });

    resource.order.note = issueNote;
    await resource.order.save();

    const updated = await findOrderResourceById(resource.order._id, {
      lean: true,
      sourceModelHint: resource.sourceModel
    });
    return res.json({
      order: updated ? await enrichOrderDto(updated) : null,
      disputeEligible: Boolean(resource.order.paymentId),
      nextAction: resource.order.paymentId ? "open_dispute" : "contact_support"
    });
  } catch (err) {
    console.error("rejectOrderReceipt error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const startOrderFulfillment = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orderId = parseObjectId(req.params.id || req.params.orderId);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const resource = await findOrderResourceById(orderId, {
      sourceModelHint: resolveSourceModelHint(req.query.sourceModel || req.query.source_type)
    });
    if (!resource) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (!canManageOrderFulfillment(resource, req.user._id, req.user.role)) {
      return res.status(403).json({ message: t(req, "orders.fulfillment.start_role.message") });
    }
    if (!resource.order.paymentId) {
      return res.status(400).json({ message: t(req, "orders.payment.escrow_required.message") });
    }

    const defaultEventType = resource.sourceModel === "Order" ? "PACKED" : "SERVICE_STARTED";
    await createFulfillmentEvent(resource, req.user._id, {
      eventType: normalizeText(req.body.eventType || defaultEventType).toUpperCase(),
      notes: normalizeText(req.body.note || req.body.notes),
      metadata: req.body.metadata || null
    });
    await markEscrowSourceInProgress(
      resource.order.paymentId,
      normalizeText(req.body.note || req.body.notes) || t(req, "orders.fulfillment.started.note")
    );

    const updated = await findOrderResourceById(resource.order._id, {
      lean: true,
      sourceModelHint: resource.sourceModel
    });
    return res.json({
      order: updated ? await enrichOrderDto(updated) : null,
      fulfillment: updated ? await toFulfillmentHistoryDto(updated) : null
    });
  } catch (err) {
    console.error("startOrderFulfillment error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const appendOrderFulfillmentEvent = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orderId = parseObjectId(req.params.id || req.params.orderId);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const resource = await findOrderResourceById(orderId, {
      sourceModelHint: resolveSourceModelHint(req.query.sourceModel || req.query.source_type)
    });
    if (!resource) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (!canManageOrderFulfillment(resource, req.user._id, req.user.role)) {
      return res.status(403).json({ message: t(req, "orders.fulfillment.append_role.message") });
    }

    const eventType = normalizeText(req.body.eventType).toUpperCase();
    if (!eventType) return res.status(400).json({ message: t(req, "orders.fulfillment.event_type.required.message") });

    await createFulfillmentEvent(resource, req.user._id, {
      eventType,
      notes: normalizeText(req.body.notes || req.body.note),
      proofType: normalizeText(req.body.proofType),
      proofUrl: normalizeText(req.body.proofUrl),
      metadata: req.body.metadata || null
    });

    if (resource.order.paymentId && ["PACKED", "SHIPPED", "SERVICE_STARTED"].includes(eventType)) {
      await markEscrowSourceInProgress(
        resource.order.paymentId,
        normalizeText(req.body.notes || req.body.note) || t(req, "orders.fulfillment.progress.note")
      );
    }
    if (resource.order.paymentId && ["DELIVERED", "SERVICE_COMPLETED", "FILE_UPLOADED", "SESSION_HELD", "COURSE_ACCESS_GRANTED"].includes(eventType)) {
      await markEscrowSourceDelivered(resource.order.paymentId, {
        proofType: normalizeText(req.body.proofType) || eventType.toLowerCase(),
        proofNote: normalizeText(req.body.notes || req.body.note),
        proofUrl: normalizeText(req.body.proofUrl)
      });
    }

    const updated = await findOrderResourceById(resource.order._id, {
      lean: true,
      sourceModelHint: resource.sourceModel
    });
    return res.json({
      order: updated ? await enrichOrderDto(updated) : null,
      fulfillment: updated ? await toFulfillmentHistoryDto(updated) : null
    });
  } catch (err) {
    console.error("appendOrderFulfillmentEvent error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const listOrderFulfillmentHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orderId = parseObjectId(req.params.id || req.params.orderId);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const resource = await findOrderResourceById(orderId, {
      lean: true,
      sourceModelHint: resolveSourceModelHint(req.query.sourceModel || req.query.source_type)
    });
    if (!resource) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (!canAccessOrderResource(resource, req.user._id, req.user.role)) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    return res.json(await toFulfillmentHistoryDto(resource));
  } catch (err) {
    console.error("listOrderFulfillmentHistory error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getOrderEscrowStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orderId = parseObjectId(req.params.id || req.params.orderId);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const resource = await findOrderResourceById(orderId, {
      lean: true,
      sourceModelHint: resolveSourceModelHint(req.query.sourceModel || req.query.source_type)
    });
    if (!resource) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (!canAccessOrderResource(resource, req.user._id, req.user.role)) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const [payment, hold] = await Promise.all([
      resource.order.paymentId ? Payment.findById(resource.order.paymentId).lean() : Promise.resolve(null),
      getEscrowHoldForResource(resource)
    ]);

    return res.json({
      orderId: String(resource.order._id),
      sourceModel: resource.sourceModel,
      kind: resource.kind,
      paymentStatus: resource.order.paymentCollectionStatus || "DRAFT",
      settlementState: resource.order.settlementState || "none",
      escrow: hold
        ? {
            holdStatus: hold.holdStatus,
            grossAmountMinor: hold.grossAmountMinor,
            netHeldAmountMinor: hold.netHeldAmountMinor,
            heldAt: hold.heldAt,
            releaseDueAt: hold.releaseDueAt || null,
            releasedAt: hold.releasedAt || null,
            refundedAt: hold.refundedAt || null
          }
        : null,
      payment: payment
        ? {
            id: String(payment._id),
            workflowStatus: payment.workflowStatus,
            escrowHeldAmount: Number(payment.escrowHeldAmount || 0),
            releasedAmount: Number(payment.releasedAmount || 0),
            refundedAmount: Number(payment.refundedAmount || 0),
            sellerPendingPayoutAmount: Number(payment.sellerPendingPayoutAmount || 0)
          }
        : null
    });
  } catch (err) {
    console.error("getOrderEscrowStatus error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getOrderPaymentInstructions = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orderId = parseObjectId(req.params.id || req.params.orderId);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const resource = await findOrderResourceById(orderId, {
      lean: true,
      sourceModelHint: resolveSourceModelHint(req.query.sourceModel || req.query.source_type)
    });
    if (!resource) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (!canAccessOrderResource(resource, req.user._id, req.user.role)) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const enriched = await enrichOrderDto(resource);
    return res.json({
      orderId: String(resource.order._id),
      sourceModel: resource.sourceModel,
      kind: resource.kind,
      paymentCollectionStatus: resource.order.paymentCollectionStatus || "DRAFT",
      paymentMethod: resource.order.paymentCollectionMethod || null,
      invoice: enriched.paymentCollection?.invoice || null,
      bankTransfer: enriched.paymentCollection?.bankTransfer || null,
      nextActionType: enriched.paymentCollection?.nextActionType || null,
      nextActionLabel: enriched.paymentCollection?.nextActionLabel || null
    });
  } catch (err) {
    console.error("getOrderPaymentInstructions error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
