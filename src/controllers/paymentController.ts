import crypto from "crypto";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { BankTransferRequest } from "../models/BankTransferRequest";
import { Invoice } from "../models/Invoice";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { PaymentProviderEvent } from "../models/PaymentProviderEvent";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { ServiceOrder } from "../models/ServiceOrder";
import { materializeCheckoutSessionOrder } from "./checkoutController";
import {
  maybeAutoReleasePayment,
  releasePaymentToSellerPending
} from "../services/paymentEngine";
import {
  cancelPaymentCollection,
  confirmPaymentCollection,
  expirePaymentCollection,
  failPaymentCollection,
  getPaymentCollectionIntent,
  initiatePaymentCollection,
  listCheckoutPaymentMethods,
  logPaymentProviderEvent,
  markPaymentCollectionPendingVerification,
  resendSmsPaymentCollection,
  toPaymentCollectionDto
} from "../services/paymentCollection";
import type { PaymentSourceType } from "../types/paymentDomain";
import { t } from "../i18n";

const normalizeText = (value: unknown) => String(value || "").trim();

const parseObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
  const raw = normalizeText(value);
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

const makeTransactionId = () =>
  typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");

const groupPaymentMethods = (methods: Awaited<ReturnType<typeof listCheckoutPaymentMethods>>) => ({
  instant_online: methods.filter((method) => ["INSTANT_ONLINE", "PLATFORM_LINKED"].includes(method.group)),
  sms_methods: methods.filter((method) => ["SMS_LINK", "SMS_INVOICE"].includes(method.group)),
  manual_transfer_methods: methods.filter((method) => method.group === "MANUAL_BANK_TRANSFER"),
  future_methods: methods.filter((method) => method.group === "FUTURE_MODERN"),
  all: methods
});

const toPaymentDto = (payment: any) => ({
  id: String(payment._id),
  orderId: payment.orderId ? String(payment.orderId) : null,
  sourceType: payment.sourceType,
  sourceId: payment.sourceId ? String(payment.sourceId) : null,
  sourceModel: payment.sourceModel || null,
  userId: payment.userId ? String(payment.userId) : null,
  sellerId: payment.sellerId ? String(payment.sellerId) : null,
  status: payment.status,
  workflowStatus: payment.workflowStatus,
  categoryKey: payment.categoryKey,
  bucketKey: payment.bucketKey,
  provider: payment.provider,
  collectionStatus: payment.collectionStatus || null,
  collectionMethod: payment.collectionMethod || null,
  paymentIntentId: payment.paymentIntentId ? String(payment.paymentIntentId) : null,
  amount: Number(payment.amount || 0),
  currency: payment.currency || "USD",
  escrowHeldAmount: Number(payment.escrowHeldAmount || 0),
  releasedAmount: Number(payment.releasedAmount || 0),
  refundedAmount: Number(payment.refundedAmount || 0),
  sellerPendingPayoutAmount: Number(payment.sellerPendingPayoutAmount || 0),
  reviewWindowEndsAt: payment.reviewWindowEndsAt || null,
  releaseScheduledAt: payment.releaseScheduledAt || null,
  releasedAt: payment.releasedAt || null,
  payoutTransferredAt: payment.payoutTransferredAt || null,
  payoutRequestId: payment.payoutRequestId ? String(payment.payoutRequestId) : null,
  disputeId: payment.disputeId ? String(payment.disputeId) : null,
  transactionId: payment.transactionId || null,
  note: payment.note || null,
  decisionReason: payment.decisionReason || null,
  metadata: payment.metadata || null,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt
});

const canAccessPayment = (payment: any, req: Request) => {
  if (!req.user) return false;
  if (req.user.role === "ADMIN") return true;
  if (String(payment.userId) === req.user._id) return true;
  if (payment.sellerId && String(payment.sellerId) === req.user._id) return true;
  return false;
};

const incrementPurchasedProducts = async (order: any) => {
  const bulkOps = (order.items || [])
    .filter((item: any) => mongoose.Types.ObjectId.isValid(String(item.productId)))
    .map((item: any) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(String(item.productId)) },
        update: {
          $inc: {
            purchaseCount: Number(item.qty || 0),
            orders: Number(item.qty || 0)
          }
        }
      }
    }));

  if (bulkOps.length) {
    await Product.bulkWrite(bulkOps);
  }
};

const buildProductCollectionResponse = async (order: any, paymentIntentId?: mongoose.Types.ObjectId | string | null) => {
  const intent =
    (paymentIntentId && (await getPaymentCollectionIntent(paymentIntentId))) ||
    (order.paymentIntentId && (await getPaymentCollectionIntent(order.paymentIntentId)));
  const payment = order.paymentId ? await Payment.findById(order.paymentId).lean() : intent?.paymentId ? await Payment.findById(intent.paymentId).lean() : null;
  return {
    status: order.status,
    paymentWorkflowStatus: order.paymentWorkflowStatus,
    paymentCollectionStatus: intent?.status || order.paymentCollectionStatus || "DRAFT",
    paymentMethod: intent?.methodCode || order.paymentCollectionMethod || order.payment?.method || null,
    orderId: String(order._id),
    payment: payment ? toPaymentDto(payment) : null,
    paymentCollection: intent ? await toPaymentCollectionDto(intent) : null
  };
};

const initiateOrderCollection = async (order: any, req: Request) => {
  const method = normalizeText(req.body.method || req.body.paymentMethod || order.paymentCollectionMethod || order.payment?.method || "CARD") || "CARD";
  const provider = normalizeText(req.body.provider || req.body.paymentProvider || order.payment?.provider || "MOCK") || "MOCK";
  const intent = await initiatePaymentCollection(
    {
      orderId: order._id as mongoose.Types.ObjectId,
      buyerId: order.userId,
      sellerId: order.agentId || order.items?.find((item: any) => item.sellerId)?.sellerId || null,
      sourceType: "PRODUCT_ORDER",
      sourceId: order._id as mongoose.Types.ObjectId,
      sourceModel: "Order",
      rawCategory: order.settlementCategory || "shopping",
      amount: Number(order.total || 0),
      currency: order.currency || "USD",
      phone: normalizeText(req.body.phone || order.shippingAddress?.phone || ""),
      metadata: {
        orderSource: order.source,
        requestedProvider: provider,
        trustMessage: order.trustMessage
      }
    },
    {
      methodCode: method,
      phone: normalizeText(req.body.phone || order.shippingAddress?.phone || ""),
      metadata: {
        successUrl: normalizeText(req.body.successUrl) || null,
        cancelUrl: normalizeText(req.body.cancelUrl) || null
      }
    }
  );

  if (["INSTANT_ONLINE", "PLATFORM_LINKED", "FUTURE_MODERN"].includes(intent.methodGroup)) {
    const confirmed = await confirmPaymentCollection(intent._id, {
      transactionId: normalizeText(req.body.transactionId) || makeTransactionId(),
      providerReference: normalizeText(req.body.providerReference),
      note: normalizeText(req.body.note),
      verifiedBy: req.user?._id || null
    });
    const updatedOrder = await Order.findById(order._id);
    if (updatedOrder) {
      await incrementPurchasedProducts(updatedOrder);
      return buildProductCollectionResponse(updatedOrder, confirmed._id);
    }
    return buildProductCollectionResponse(order, confirmed._id);
  }

  const refreshedOrder = await Order.findById(order._id);
  return buildProductCollectionResponse(refreshedOrder || order, intent._id);
};

export const confirmOrderPayment = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const orderId = parseObjectId(req.params.orderId);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });

    if (String(order.userId) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    if (order.status !== "PENDING_PAYMENT" && order.status !== "PAID") {
      return res.status(400).json({ message: t(req, "payments.orders.status.invalid.message", { status: order.status }) });
    }

    if (order.paymentId && !req.body.forceNewIntent) {
      return res.json(await buildProductCollectionResponse(order));
    }

    return res.json(await initiateOrderCollection(order, req));
  } catch (err) {
    console.error("confirmOrderPayment error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const confirmSourcePayment = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const sourceType = normalizeText(req.body.sourceType).toUpperCase() as PaymentSourceType;
    const sourceId = parseObjectId(req.body.sourceId);
    if (!sourceId) return res.status(400).json({ message: t(req, "payments.source.validation.required.message") });

    if (sourceType === "SERVICE_ORDER") {
      const serviceOrder = await ServiceOrder.findById(sourceId);
      if (!serviceOrder) return res.status(404).json({ message: t(req, "services.orders.lookup.not_found.message") });
      if (String(serviceOrder.customerId) !== req.user._id && req.user.role !== "ADMIN") {
        return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
      }

      const service = await Service.findById(serviceOrder.serviceId).select("category price salePrice hourlyRate currency").lean();
      const amount =
        Number(req.body.amount) > 0
          ? Number(req.body.amount)
          : Number(service?.salePrice || service?.price || service?.hourlyRate || 0);
      const currency = normalizeText(req.body.currency || service?.currency || "USD") || "USD";
      if (serviceOrder.paymentId && !req.body.forceNewIntent) {
        const payment = await Payment.findById(serviceOrder.paymentId).lean();
        const paymentCollection =
          (serviceOrder.paymentIntentId && (await getPaymentCollectionIntent(serviceOrder.paymentIntentId))) ||
          (await getPaymentCollectionIntent(serviceOrder.paymentId).catch(() => null));
        return res.json({
          status: serviceOrder.status,
          paymentWorkflowStatus: serviceOrder.paymentWorkflowStatus,
          paymentCollectionStatus: serviceOrder.paymentCollectionStatus,
          paymentMethod: serviceOrder.paymentCollectionMethod || null,
          payment: payment ? toPaymentDto(payment) : null,
          paymentCollection: paymentCollection ? await toPaymentCollectionDto(paymentCollection) : null
        });
      }

      const intent = await initiatePaymentCollection(
        {
          orderId: serviceOrder._id as mongoose.Types.ObjectId,
          buyerId: serviceOrder.customerId,
          sellerId: serviceOrder.agentId,
          sourceType,
          sourceId: serviceOrder._id,
          sourceModel: "ServiceOrder",
          rawCategory: normalizeText(service?.category),
          amount,
          currency,
          phone: normalizeText(req.body.phone || serviceOrder.customerPhone || ""),
          metadata: {
            serviceId: String(serviceOrder.serviceId),
            serviceTitle: serviceOrder.serviceTitle
          }
        },
        {
          methodCode: normalizeText(req.body.method || req.body.paymentMethod || "CARD"),
          phone: normalizeText(req.body.phone || serviceOrder.customerPhone || ""),
          locale: req.locale
        }
      );

      if (["INSTANT_ONLINE", "PLATFORM_LINKED", "FUTURE_MODERN"].includes(intent.methodGroup)) {
        const confirmed = await confirmPaymentCollection(intent._id, {
          transactionId: normalizeText(req.body.transactionId) || makeTransactionId(),
          providerReference: normalizeText(req.body.providerReference),
          note: normalizeText(req.body.note),
          verifiedBy: req.user?._id || null
        });
        const refreshedPayment = confirmed.paymentId ? await Payment.findById(confirmed.paymentId).lean() : null;
        const refreshedOrder = await ServiceOrder.findById(serviceOrder._id).lean();
        return res.status(201).json({
          status: refreshedOrder?.status || serviceOrder.status,
          paymentWorkflowStatus: refreshedOrder?.paymentWorkflowStatus || "HELD_IN_ESCROW",
          paymentCollectionStatus: refreshedOrder?.paymentCollectionStatus || confirmed.status,
          paymentMethod: refreshedOrder?.paymentCollectionMethod || confirmed.methodCode,
          payment: refreshedPayment ? toPaymentDto(refreshedPayment) : null,
          paymentCollection: await toPaymentCollectionDto(confirmed, req.locale)
        });
      }

      const refreshedOrder = await ServiceOrder.findById(serviceOrder._id).lean();
      return res.status(201).json({
        status: refreshedOrder?.status || serviceOrder.status,
        paymentWorkflowStatus: refreshedOrder?.paymentWorkflowStatus || serviceOrder.paymentWorkflowStatus,
        paymentCollectionStatus: refreshedOrder?.paymentCollectionStatus || intent.status,
        paymentMethod: refreshedOrder?.paymentCollectionMethod || intent.methodCode,
        payment: null,
        paymentCollection: await toPaymentCollectionDto(intent, req.locale)
      });
    }

    if (sourceType === "PRODUCT_ORDER") {
      req.params.orderId = String(sourceId);
      return confirmOrderPayment(req, res);
    }

    return res.status(400).json({ message: t(req, "payments.source.unsupported.message") });
  } catch (err) {
    console.error("confirmSourcePayment error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getPaymentById = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentId = parseObjectId(req.params.id);
    if (!paymentId) return res.status(400).json({ message: t(req, "payments.validation.payment_id.message") });

    await maybeAutoReleasePayment(paymentId).catch(() => undefined);
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: t(req, "payments.intent.lookup.not_found.message") });
    if (!canAccessPayment(payment, req)) return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });

    return res.json({ payment: toPaymentDto(payment) });
  } catch (err) {
    console.error("getPaymentById error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getPaymentIntentById = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentIntentId = parseObjectId(req.params.id);
    if (!paymentIntentId) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const paymentIntent = await getPaymentCollectionIntent(paymentIntentId);
    if (!paymentIntent) return res.status(404).json({ message: t(req, "payments.intent.lookup.not_found.message") });

    const buyerId = String((paymentIntent as any).userId || "");
    const sellerId = String((paymentIntent as any).sellerId || "");
    if (req.user.role !== "ADMIN" && buyerId !== req.user._id && sellerId !== req.user._id) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    return res.json({ paymentCollection: await toPaymentCollectionDto(paymentIntent, req.locale) });
  } catch (err) {
    console.error("getPaymentIntentById error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const listPayments = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;
    const scope = normalizeText(req.query.scope).toLowerCase();

    const filter: Record<string, unknown> = {};
    if (req.user.role !== "ADMIN") {
      if (scope === "seller") {
        filter.sellerId = req.user._id;
      } else {
        filter.userId = req.user._id;
      }
    }

    const [items, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Payment.countDocuments(filter)
    ]);

    return res.json({
      items: items.map((payment) => toPaymentDto(payment)),
      page,
      limit,
      total
    });
  } catch (err) {
    console.error("listPayments error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const listPaymentMethodCatalog = async (req: Request, res: Response) => {
  try {
    const sourceType = normalizeText(req.query.sourceType || "PRODUCT_ORDER").toUpperCase() as PaymentSourceType;
    const methods = await listCheckoutPaymentMethods(sourceType, req.locale);
    return res.json({ methods });
  } catch (err) {
    console.error("listPaymentMethodCatalog error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const listPaymentMethodsResource = async (req: Request, res: Response) => {
  try {
    const sourceType = normalizeText(req.query.order_type || req.query.sourceType || "PRODUCT_ORDER").toUpperCase() as PaymentSourceType;
    const methods = await listCheckoutPaymentMethods(sourceType, req.locale);
    return res.json({
      orderType: sourceType,
      currency: normalizeText(req.query.currency || "USD") || "USD",
      country: normalizeText(req.query.country || ""),
      categoryKey: normalizeText(req.query.category_key || req.query.categoryKey || ""),
      ...groupPaymentMethods(methods)
    });
  } catch (err) {
    console.error("listPaymentMethodsResource error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const createPaymentIntentResource = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const sourceType = normalizeText(req.body.sourceType || req.body.orderType || "PRODUCT_ORDER").toUpperCase() as PaymentSourceType;
    const checkoutSessionId = parseObjectId(req.body.checkoutSessionId || req.body.checkout_session_id || req.body.sessionId);
    const orderId = parseObjectId(req.body.orderId || req.body.order_id || req.body.sourceId);
    const methodCode = normalizeText(req.body.paymentMethodKey || req.body.paymentMethod || req.body.method || "CARD");
    const phone = normalizeText(req.body.phone);

    if (checkoutSessionId) {
      const materialized = await materializeCheckoutSessionOrder(checkoutSessionId, req.user._id, req.locale);
      if (materialized.sourceType === "SERVICE_ORDER") {
        const serviceOrder = materialized.order;
        const service = await Service.findById(serviceOrder.serviceId).select("category price salePrice hourlyRate currency").lean();
        const amount = Number(service?.salePrice || service?.price || service?.hourlyRate || 0);
        const intent = await initiatePaymentCollection(
          {
            orderId: serviceOrder._id as mongoose.Types.ObjectId,
            buyerId: serviceOrder.customerId,
            sellerId: serviceOrder.agentId,
            sourceType: "SERVICE_ORDER",
            sourceId: serviceOrder._id,
            sourceModel: "ServiceOrder",
            rawCategory: normalizeText(service?.category),
            amount,
            currency: normalizeText(service?.currency || "USD") || "USD",
            phone: phone || normalizeText(serviceOrder.customerPhone || ""),
            metadata: {
              checkoutSessionId: String(checkoutSessionId),
              serviceId: String(serviceOrder.serviceId),
              serviceTitle: serviceOrder.serviceTitle,
              invoiceDeliveryChannel: normalizeText(req.body.invoiceDeliveryChannel || req.body.invoice_delivery_channel) || null
            }
        },
        {
          methodCode,
          phone: phone || normalizeText(serviceOrder.customerPhone || ""),
          locale: req.locale
        }
      );
      return res.status(201).json({ paymentIntentId: String(intent._id), paymentCollection: await toPaymentCollectionDto(intent, req.locale) });
    }

    const order = await Order.findById(materialized.order._id);
      if (!order) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
      const intent = await initiatePaymentCollection(
        {
          orderId: order._id as mongoose.Types.ObjectId,
          buyerId: order.userId,
          sellerId: order.agentId || order.items?.find((item: any) => item.sellerId)?.sellerId || null,
          sourceType: "PRODUCT_ORDER",
          sourceId: order._id as mongoose.Types.ObjectId,
          sourceModel: "Order",
          rawCategory: order.settlementCategory || "shopping",
          amount: Number(order.total || 0),
          currency: order.currency || "USD",
          phone: phone || normalizeText(order.shippingAddress?.phone || ""),
          metadata: {
            checkoutSessionId: String(checkoutSessionId)
          }
        },
        {
          methodCode,
          phone: phone || normalizeText(order.shippingAddress?.phone || ""),
          locale: req.locale,
          metadata: {
            invoiceDeliveryChannel: normalizeText(req.body.invoiceDeliveryChannel || req.body.invoice_delivery_channel) || null
          }
        }
      );
      return res.status(201).json({ paymentIntentId: String(intent._id), paymentCollection: await toPaymentCollectionDto(intent, req.locale) });
    }

    if (sourceType === "SERVICE_ORDER") {
      const serviceOrderId = orderId;
      if (!serviceOrderId) return res.status(400).json({ message: t(req, "checkout.services.validation.order_required.message") });
      const serviceOrder = await ServiceOrder.findById(serviceOrderId);
      if (!serviceOrder) return res.status(404).json({ message: t(req, "services.orders.lookup.not_found.message") });
      if (String(serviceOrder.customerId) !== req.user._id && req.user.role !== "ADMIN") {
        return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
      }
      const service = await Service.findById(serviceOrder.serviceId).select("category price salePrice hourlyRate currency").lean();
      const amount =
        Number(req.body.amount) > 0
          ? Number(req.body.amount)
          : Number(service?.salePrice || service?.price || service?.hourlyRate || 0);
      const intent = await initiatePaymentCollection(
        {
          orderId: serviceOrder._id as mongoose.Types.ObjectId,
          buyerId: serviceOrder.customerId,
          sellerId: serviceOrder.agentId,
          sourceType: "SERVICE_ORDER",
          sourceId: serviceOrder._id,
          sourceModel: "ServiceOrder",
          rawCategory: normalizeText(service?.category),
          amount,
          currency: normalizeText(req.body.currency || service?.currency || "USD") || "USD",
          phone: phone || normalizeText(serviceOrder.customerPhone || ""),
          metadata: {
            serviceId: String(serviceOrder.serviceId),
            serviceTitle: serviceOrder.serviceTitle,
            invoiceDeliveryChannel: normalizeText(req.body.invoiceDeliveryChannel || req.body.invoice_delivery_channel) || null
          }
        },
        {
          methodCode,
          phone: phone || normalizeText(serviceOrder.customerPhone || ""),
          locale: req.locale
        }
      );
      return res.status(201).json({ paymentIntentId: String(intent._id), paymentCollection: await toPaymentCollectionDto(intent, req.locale) });
    }

    if (!orderId) return res.status(400).json({ message: t(req, "payments.validation.order_or_session_required.message") });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });
    if (String(order.userId) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const intent = await initiatePaymentCollection(
      {
        orderId: order._id as mongoose.Types.ObjectId,
        buyerId: order.userId,
        sellerId: order.agentId || order.items?.find((item: any) => item.sellerId)?.sellerId || null,
        sourceType: "PRODUCT_ORDER",
        sourceId: order._id as mongoose.Types.ObjectId,
        sourceModel: "Order",
        rawCategory: order.settlementCategory || "shopping",
        amount: Number(order.total || 0),
        currency: order.currency || "USD",
        phone: phone || normalizeText(order.shippingAddress?.phone || ""),
        metadata: {
          invoiceDeliveryChannel: normalizeText(req.body.invoiceDeliveryChannel || req.body.invoice_delivery_channel) || null
        }
      },
      {
        methodCode,
        phone: phone || normalizeText(order.shippingAddress?.phone || ""),
        locale: req.locale
      }
    );
    return res.status(201).json({ paymentIntentId: String(intent._id), paymentCollection: await toPaymentCollectionDto(intent, req.locale) });
  } catch (err) {
    console.error("createPaymentIntentResource error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const acceptEscrowDelivery = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentId = parseObjectId(req.params.id);
    if (!paymentId) return res.status(400).json({ message: t(req, "payments.validation.payment_id.message") });
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: t(req, "payments.intent.lookup.not_found.message") });
    if (String(payment.userId) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: t(req, "payments.release.confirm_buyer_only.message") });
    }
    const updated = await releasePaymentToSellerPending(payment._id, t(req, "payments.release.confirmed.note"));
    return res.json({ payment: toPaymentDto(updated) });
  } catch (err) {
    console.error("acceptEscrowDelivery error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const confirmPaymentIntent = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentIntentId = parseObjectId(req.params.id);
    if (!paymentIntentId) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const paymentIntent = await getPaymentCollectionIntent(paymentIntentId);
    if (!paymentIntent) return res.status(404).json({ message: t(req, "payments.intent.lookup.not_found.message") });

    const buyerId = String((paymentIntent as any).userId || "");
    if (req.user.role !== "ADMIN" && buyerId !== req.user._id) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const confirmed = await confirmPaymentCollection(paymentIntentId, {
      transactionId: normalizeText(req.body.transactionId) || makeTransactionId(),
      providerReference: normalizeText(req.body.providerReference),
      note: normalizeText(req.body.note),
      verifiedBy: req.user._id
    });
    return res.json({ paymentCollection: await toPaymentCollectionDto(confirmed, req.locale) });
  } catch (err) {
    console.error("confirmPaymentIntent error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const resendPaymentIntentSms = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentIntentId = parseObjectId(req.params.id);
    if (!paymentIntentId) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const paymentIntent = await getPaymentCollectionIntent(paymentIntentId);
    if (!paymentIntent) return res.status(404).json({ message: t(req, "payments.intent.lookup.not_found.message") });
    const buyerId = String((paymentIntent as any).userId || "");
    if (req.user.role !== "ADMIN" && buyerId !== req.user._id) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const updated = await resendSmsPaymentCollection(paymentIntentId);
    const refreshed = await getPaymentCollectionIntent(updated._id);
    return res.json({ paymentCollection: refreshed ? await toPaymentCollectionDto(refreshed, req.locale) : null });
  } catch (err) {
    console.error("resendPaymentIntentSms error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const uploadPaymentIntentReceipt = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentIntentId = parseObjectId(req.params.id);
    if (!paymentIntentId) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const paymentIntent = await getPaymentCollectionIntent(paymentIntentId);
    if (!paymentIntent) return res.status(404).json({ message: t(req, "payments.intent.lookup.not_found.message") });
    const buyerId = String((paymentIntent as any).userId || "");
    if (req.user.role !== "ADMIN" && buyerId !== req.user._id) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }
    if (!(paymentIntent as any).bankTransferRequestId) {
      return res.status(400).json({ message: t(req, "payments.validation.receipt_upload_unsupported.message") });
    }

    const receiptUrl = normalizeText(req.body.receiptUrl || req.body.receipt_url || req.body.fileUrl);
    if (!receiptUrl) return res.status(400).json({ message: t(req, "payments.validation.receipt_url_required.message") });

    await BankTransferRequest.updateOne(
      { _id: (paymentIntent as any).bankTransferRequestId },
      {
        $set: {
          status: "RECEIPT_UPLOADED",
          receiptUrl,
          receiptUploadedAt: new Date()
        }
      }
    );
    await markPaymentCollectionPendingVerification(paymentIntentId, {
      reason: "Manual transfer receipt uploaded and waiting for admin verification.",
      receiptUrl
    });
    const refreshed = await getPaymentCollectionIntent(paymentIntentId);
    return res.json({ paymentCollection: refreshed ? await toPaymentCollectionDto(refreshed, req.locale) : null });
  } catch (err) {
    console.error("uploadPaymentIntentReceipt error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const expirePaymentIntentController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentIntentId = parseObjectId(req.params.id);
    if (!paymentIntentId) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const paymentIntent = await getPaymentCollectionIntent(paymentIntentId);
    if (!paymentIntent) return res.status(404).json({ message: t(req, "payments.intent.lookup.not_found.message") });
    const buyerId = String((paymentIntent as any).userId || "");
    if (req.user.role !== "ADMIN" && buyerId !== req.user._id) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const expired = await expirePaymentCollection(paymentIntentId, normalizeText(req.body.reason));
    const refreshed = await getPaymentCollectionIntent(expired._id);
    return res.json({ paymentCollection: refreshed ? await toPaymentCollectionDto(refreshed, req.locale) : null });
  } catch (err) {
    console.error("expirePaymentIntentController error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const cancelPaymentIntentController = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentIntentId = parseObjectId(req.params.id);
    if (!paymentIntentId) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const paymentIntent = await getPaymentCollectionIntent(paymentIntentId);
    if (!paymentIntent) return res.status(404).json({ message: t(req, "payments.intent.lookup.not_found.message") });
    const buyerId = String((paymentIntent as any).userId || "");
    if (req.user.role !== "ADMIN" && buyerId !== req.user._id) {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    const cancelled = await cancelPaymentCollection(paymentIntentId, normalizeText(req.body.reason));
    const refreshed = await getPaymentCollectionIntent(cancelled._id);
    return res.json({ paymentCollection: refreshed ? await toPaymentCollectionDto(refreshed, req.locale) : null });
  } catch (err) {
    console.error("cancelPaymentIntentController error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const handlePaymentProviderWebhook = async (req: Request, res: Response) => {
  try {
    const providerKey = normalizeText(req.params.providerKey || req.body.provider || "UNKNOWN");
    const eventId = normalizeText(req.body.eventId || req.body.id || req.headers["x-event-id"]);
    if (eventId) {
      const existing = await PaymentProviderEvent.findOne({ provider: providerKey, eventId, processed: true }).lean();
      if (existing) return res.json({ ok: true, duplicate: true });
    }
    const paymentIntentId = parseObjectId(req.body.paymentIntentId || req.body.intentId);
    const eventType = normalizeText(req.body.eventType || req.body.status || "unknown");
    const provider = providerKey;
    await logPaymentProviderEvent({
      provider,
      eventType,
      eventId,
      paymentIntentId,
      externalReference: normalizeText(req.body.externalReference || req.body.providerReference),
      payload: req.body,
      status: "RECEIVED"
    });

    if (paymentIntentId && ["success", "paid", "confirmed"].includes(eventType.toLowerCase())) {
      const confirmed = await confirmPaymentCollection(paymentIntentId, {
        transactionId: normalizeText(req.body.transactionId) || makeTransactionId(),
        providerReference: normalizeText(req.body.externalReference || req.body.providerReference),
        note: "Confirmed from provider webhook."
      });
      await logPaymentProviderEvent({
        provider,
        eventType,
        eventId,
        paymentIntentId: confirmed._id,
        paymentId: confirmed.paymentId,
        externalReference: normalizeText(req.body.externalReference || req.body.providerReference),
        payload: req.body,
        status: "PROCESSED"
      });
      return res.json({ ok: true, paymentCollection: await toPaymentCollectionDto(confirmed, req.locale) });
    }

    if (paymentIntentId && ["expired", "cancelled", "failed"].includes(eventType.toLowerCase())) {
      const terminal =
        eventType.toLowerCase() === "expired"
          ? await expirePaymentCollection(paymentIntentId, `Provider marked payment as ${eventType}.`)
          : eventType.toLowerCase() === "failed"
            ? await failPaymentCollection(paymentIntentId, `Provider marked payment as ${eventType}.`)
            : await cancelPaymentCollection(paymentIntentId, `Provider marked payment as ${eventType}.`);
      await logPaymentProviderEvent({
        provider,
        eventType,
        eventId,
        paymentIntentId: terminal._id,
        externalReference: normalizeText(req.body.externalReference || req.body.providerReference),
        payload: req.body,
        status: "PROCESSED"
      });
      return res.json({ ok: true, paymentCollection: await toPaymentCollectionDto(terminal, req.locale) });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("handlePaymentProviderWebhook error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const verifyPaymentIntentByAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentIntentId = parseObjectId(req.params.intentId || req.params.id);
    if (!paymentIntentId) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const confirmed = await confirmPaymentCollection(paymentIntentId, {
      transactionId: normalizeText(req.body.transactionId) || makeTransactionId(),
      providerReference: normalizeText(req.body.providerReference),
      note: normalizeText(req.body.reason || req.body.note || t(req, "payments.reviews.manual_approved.note")),
      verifiedBy: req.user._id
    });
    return res.json({ paymentCollection: await toPaymentCollectionDto(confirmed, req.locale) });
  } catch (err) {
    console.error("verifyPaymentIntentByAdmin error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const rejectPaymentIntentByAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentIntentId = parseObjectId(req.params.intentId || req.params.id);
    if (!paymentIntentId) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const failed = await failPaymentCollection(
      paymentIntentId,
      normalizeText(req.body.reason || req.body.note || t(req, "payments.reviews.manual_rejected.note"))
    );
    return res.json({ paymentCollection: await toPaymentCollectionDto(failed, req.locale) });
  } catch (err) {
    console.error("rejectPaymentIntentByAdmin error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const triggerAutoRelease = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const paymentId = parseObjectId(req.params.id);
    if (!paymentId) return res.status(400).json({ message: t(req, "payments.validation.payment_id.message") });
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: t(req, "payments.intent.lookup.not_found.message") });
    if (!canAccessPayment(payment, req)) return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    const result = await maybeAutoReleasePayment(payment._id);
    const refreshed = await Payment.findById(payment._id);
    return res.json({
      result,
      payment: refreshed ? toPaymentDto(refreshed) : null
    });
  } catch (err) {
    console.error("triggerAutoRelease error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
