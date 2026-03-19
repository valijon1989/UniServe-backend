import crypto from "crypto";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { Cart } from "../models/Cart";
import { CheckoutSession } from "../models/CheckoutSession";
import { Order } from "../models/Order";
import { Service } from "../models/Service";
import { ServiceOrder } from "../models/ServiceOrder";
import {
  buildCartItems,
  buildRequestedItems,
  createProductOrder,
  normalizeText,
  parseQty,
  resolveImageSnapshot,
  resolveUnitPrice
} from "../services/productOrderFlow";
import { findStrictProductByIdentifier, normalizePurchasableProductId } from "../services/productLookup";
import {
  confirmPaymentCollection,
  findLatestPaymentCollectionForSource,
  initiatePaymentCollection,
  listCheckoutPaymentMethods,
  toPaymentCollectionDto
} from "../services/paymentCollection";
import type { AppLocale } from "../i18n";
import { t } from "../i18n";

const parseObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
  const raw = String(value || "").trim();
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

const buildCheckoutSessionId = () =>
  typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);

type CheckoutPreviewItem = {
  productId: string;
  qty: number;
  unitPrice: number;
  titleSnapshot: string;
  imageSnapshot: string | null;
  lineTotal: number;
};

type CheckoutPreviewResult = { items: CheckoutPreviewItem[] } | { error: string; status?: number };

const groupPaymentMethods = (methods: Awaited<ReturnType<typeof listCheckoutPaymentMethods>>) => ({
  instantOnline: methods.filter((method) => ["INSTANT_ONLINE", "PLATFORM_LINKED"].includes(method.group)),
  smsMethods: methods.filter((method) => ["SMS_LINK", "SMS_INVOICE"].includes(method.group)),
  manualTransferMethods: methods.filter((method) => method.group === "MANUAL_BANK_TRANSFER"),
  futureMethods: methods.filter((method) => method.group === "FUTURE_MODERN"),
  all: methods
});

const resolveConfirmationNextSteps = (status: string, locale?: AppLocale) => {
  switch (status) {
    case "HELD_IN_ESCROW":
      return [1, 2, 3].map((step) => t(locale, `checkout.next_steps.held.step_${step}`));
    case "PAYMENT_LINK_SENT":
      return [1, 2, 3].map((step) => t(locale, `checkout.next_steps.sms_link.step_${step}`));
    case "AWAITING_MANUAL_TRANSFER":
      return [1, 2, 3].map((step) => t(locale, `checkout.next_steps.manual_transfer.step_${step}`));
    case "PAYMENT_PENDING_VERIFICATION":
      return [1, 2].map((step) => t(locale, `checkout.next_steps.pending_verification.step_${step}`));
    default:
      return [t(locale, "checkout.next_steps.default.step_1")];
  }
};

const toOrderSummary = async (order: any, locale?: AppLocale) => {
  const paymentCollection = order.paymentIntentId
    ? await findLatestPaymentCollectionForSource("PRODUCT_ORDER", order._id).catch(() => null)
    : await findLatestPaymentCollectionForSource("PRODUCT_ORDER", order._id).catch(() => null);
  const paymentCollectionDto = paymentCollection ? await toPaymentCollectionDto(paymentCollection, locale) : null;
  return {
    id: String(order._id),
    status: order.status,
    paymentWorkflowStatus: order.paymentWorkflowStatus,
    paymentCollectionStatus: order.paymentCollectionStatus,
    paymentMethod: order.paymentCollectionMethod || order.payment?.method || null,
    paymentIntentId: order.paymentIntentId ? String(order.paymentIntentId) : null,
    paymentId: order.paymentId ? String(order.paymentId) : null,
    amount: Number(order.total || 0),
    currency: order.currency || "USD",
    fulfillmentDetails: {
      deliveryAddress: order.shippingAddress || null,
      phone: order.shippingAddress?.phone || null,
      deliveryType: normalizeText(order.deliveryOption || "") || "standard",
      buyerNotes: order.note || null
    },
    items: (order.items || []).map((item: any) => ({
      productId: String(item.productId),
      title: item.titleSnapshot,
      image: item.imageSnapshot || null,
      qty: Number(item.qty || 0),
      unitPrice: Number(item.unitPrice || 0),
      subtotal: Number(item.unitPrice || 0) * Number(item.qty || 0)
    })),
    subtotal: Number(order.subtotal || 0),
    shippingFee: Number(order.shippingFee || 0),
    total: Number(order.total || 0),
    trustNotice: order.trustMessage || t(locale, "checkout.trust_notice.product.text"),
    paymentCollection: paymentCollectionDto,
    nextSteps: paymentCollectionDto ? resolveConfirmationNextSteps(paymentCollectionDto.status, locale) : []
  };
};

const toCheckoutSessionDto = async (session: any, locale?: AppLocale) => {
  const supportedMethods = groupPaymentMethods(await listCheckoutPaymentMethods(session.sourceType, locale));
  return {
    checkoutSessionId: String(session._id),
    draftOrderId: session.draftOrderId ? String(session.draftOrderId) : null,
    orderType: session.sourceType,
    status: session.status,
    currency: session.currency || "USD",
    summary: {
      subtotal: Number(session.subtotalAmount || 0),
      delivery: Number(session.deliveryAmount || 0),
      total: Number(session.totalAmount || 0),
      itemCount: (session.items || []).reduce((acc: number, item: any) => acc + Number(item.quantity || 0), 0)
    },
    items: (session.items || []).map((item: any) => ({
      itemType: item.itemType,
      targetId: item.targetId ? String(item.targetId) : null,
      title: item.titleSnapshot,
      image: item.imageSnapshot || null,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      lineTotal: Number(item.lineTotal || 0),
      metadata: item.metadata || null
    })),
    phone: session.phone || null,
    buyerNote: session.buyerNote || null,
    shippingAddress: session.shippingAddress || null,
    fulfillmentDetails: session.fulfillmentDetails || null,
    selectedPaymentMethod: session.paymentMethodSelection || null,
    supportedPaymentMethods: supportedMethods,
    escrowNotice: session.trustNotice || t(locale, "checkout.trust_notice.default.text"),
    mixedOrderSupport: { enabled: false, reason: t(locale, "checkout.mixed_order.disabled.message") },
    expiresAt: session.expiresAt || null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
};

const resolveProductSessionItems = async (userId: string, body: any, locale?: AppLocale) => {
  if (body?.productId || Array.isArray(body?.items)) {
    const preview = await resolvePreviewItems(body, locale);
    if ("error" in preview) return preview;
    return { items: preview.items, cartId: null as mongoose.Types.ObjectId | null };
  }

  const cart = await Cart.findOne({ userId });
  if (!cart || !Array.isArray(cart.items) || !cart.items.length) {
    return { error: t(locale, "orders.items.required.message"), status: 400 };
  }
  const items = await buildCartItems(cart.items as any);
  return {
    items: items.map((item) => ({
      productId: String(item.productId),
      qty: Number(item.qty || 0),
      unitPrice: Number(item.unitPrice || 0),
      titleSnapshot: item.titleSnapshot,
      imageSnapshot: item.imageSnapshot || null,
      lineTotal: Number(item.unitPrice || 0) * Number(item.qty || 0)
    })),
    cartId: cart._id
  };
};

const materializeProductOrderFromSession = async (session: any, locale?: AppLocale) => {
  if (session.draftOrderId) {
    const existing = await Order.findById(session.draftOrderId);
    if (existing) return existing;
  }

  const shippingAddress = session.shippingAddress || {};
  if (!shippingAddress?.name || !shippingAddress?.phone || !shippingAddress?.address1) {
    throw new Error(t(locale, "checkout.shipping.address.required.message"));
  }

  const sourceItems = (session.items || []).map((item: any) => ({
    productId: item.targetId ? String(item.targetId) : normalizeText(item.metadata?.productId),
    qty: Number(item.quantity || 1)
  }));
  const created = await createProductOrder({
    userId: session.buyerUserId,
    clearCartWhenUsingCart: true,
    locale,
    body: {
      source: sourceItems.length === 1 ? "BUY_NOW" : "REQUESTED",
      useProvidedItems: true,
      items: sourceItems,
      shippingFee: Number(session.deliveryAmount || 0),
      currency: session.currency || "USD",
      deliveryOption: normalizeText(session.fulfillmentDetails?.deliveryType || "standard") || "standard",
      note: normalizeText(session.buyerNote),
      paymentMethod: session.paymentMethodSelection || "CARD",
      phone: normalizeText(session.phone || shippingAddress.phone),
      shippingAddress
    }
  });
  if ("error" in created) throw new Error(created.error);
  session.draftOrderId = created.order._id;
  session.sourceModel = "Order";
  await session.save();
  return created.order;
};

const buildPaymentCollectionFromOrder = async (order: any, req: Request) => {
  const intent = await initiatePaymentCollection(
    {
      orderId: order._id,
      buyerId: order.userId,
      sellerId: order.agentId || order.items?.find((item: any) => item.sellerId)?.sellerId || null,
      sourceType: "PRODUCT_ORDER",
      sourceId: order._id,
      sourceModel: "Order",
      rawCategory: order.settlementCategory || "shopping",
      amount: Number(order.total || 0),
      currency: order.currency || "USD",
      phone: normalizeText(req.body.phone || order.shippingAddress?.phone || ""),
      metadata: {
        orderSource: order.source,
        checkoutSubmit: true
      }
    },
    {
      methodCode: normalizeText(req.body.paymentMethod || req.body.method || order.payment?.method || "CARD"),
      phone: normalizeText(req.body.phone || order.shippingAddress?.phone || ""),
      metadata: {
        deliveryOption: normalizeText(req.body.deliveryOption),
        buyerNotes: normalizeText(req.body.note)
      }
    }
  );

  if (["INSTANT_ONLINE", "PLATFORM_LINKED", "FUTURE_MODERN"].includes(intent.methodGroup)) {
    const confirmed = await confirmPaymentCollection(intent._id, {
      transactionId: normalizeText(req.body.transactionId),
      providerReference: normalizeText(req.body.providerReference),
      note: normalizeText(req.body.note),
      verifiedBy: req.user?._id || null
    });
    return confirmed;
  }

  return intent;
};

const resolvePreviewItems = async (body: any, locale?: AppLocale): Promise<CheckoutPreviewResult> => {
  if (body?.productId) {
    const rawProductId = String(body.productId || "").trim();
    const qty = parseQty(body.qty, 1);
    const product = await findStrictProductByIdentifier(rawProductId);
    if (!product) return { error: t(locale, "products.lookup.not_found.message"), status: 404 };
    const productId = normalizePurchasableProductId(product as any);
    return {
      items: [
        {
          productId: String(productId),
          qty,
          unitPrice: resolveUnitPrice(product),
          titleSnapshot: String((product as any)?.title || ""),
          imageSnapshot: resolveImageSnapshot(product) || null,
          lineTotal: resolveUnitPrice(product) * qty
        }
      ]
    };
  }

  const built = await buildRequestedItems(body?.items, locale);
  if ("error" in built) return { error: String(built.error || t(locale, "orders.items.required.message")), status: built.status };
  return {
    items: built.items.map((item) => ({
      productId: String(item.productId),
      qty: item.qty,
      unitPrice: item.unitPrice,
      titleSnapshot: item.titleSnapshot,
      imageSnapshot: item.imageSnapshot || null,
      lineTotal: item.unitPrice * item.qty
    }))
  };
};

export const buyNowCheckout = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const rawProductId = String(req.body.productId || "").trim();
    if (!rawProductId) return res.status(400).json({ message: t(req, "checkout.products.validation.product_id_required.message") });

    const qty = parseQty(req.body.qty, 1);
    if (qty <= 0) return res.status(400).json({ message: t(req, "checkout.items.validation.quantity_positive.message") });

    const product = await findStrictProductByIdentifier(rawProductId);
    if (!product) return res.status(404).json({ message: t(req, "products.lookup.not_found.message") });
    if (String((product as any)?.status || "ACTIVE") !== "ACTIVE") {
      return res.status(400).json({ message: t(req, "products.availability.purchase_disabled.message") });
    }

    const productId = normalizePurchasableProductId(product as any);
    if (!parseObjectId(productId)) {
      return res.status(400).json({ message: t(req, "products.validation.resolved_id_invalid.message") });
    }

    const unitPrice = resolveUnitPrice(product);
    const subtotal = unitPrice * qty;
    const shippingFee = 0;
    const total = subtotal + shippingFee;
    const checkoutSessionId = buildCheckoutSessionId();

    return res.status(201).json({
      checkoutSessionId,
      trustNotice: t(req, "checkout.trust_notice.default.text"),
      paymentMethods: await listCheckoutPaymentMethods("PRODUCT_ORDER", req.locale),
      draft: {
        source: "BUY_NOW",
        items: [
          {
            productId: String(productId),
            qty,
            unitPrice,
            titleSnapshot: String((product as any)?.title || ""),
            imageSnapshot: resolveImageSnapshot(product) || null,
            lineTotal: unitPrice * qty
          }
        ],
        subtotal,
        shippingFee,
        total
      }
    });
  } catch (err) {
    console.error("buyNowCheckout error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const sourceType = normalizeText(req.body.orderType || req.body.sourceType || "PRODUCT_ORDER").toUpperCase();
    const currency = normalizeText(req.body.currency || "USD") || "USD";

    if (sourceType === "SERVICE_ORDER") {
      const serviceOrderId = parseObjectId(req.body.serviceOrderId || req.body.orderId || req.body.sourceId);
      if (!serviceOrderId) return res.status(400).json({ message: t(req, "checkout.services.validation.order_required.message") });

      const serviceOrder = await ServiceOrder.findById(serviceOrderId).lean();
      if (!serviceOrder) return res.status(404).json({ message: t(req, "services.orders.lookup.not_found.message") });
      if (String(serviceOrder.customerId) !== req.user._id && req.user.role !== "ADMIN") {
        return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
      }

      const service = await Service.findById(serviceOrder.serviceId).select("price salePrice hourlyRate currency category image images").lean();
      const amount = Number(service?.salePrice || service?.price || service?.hourlyRate || 0);

      const session = await CheckoutSession.create({
        buyerUserId: req.user._id,
        sourceType: "SERVICE_ORDER",
        sourceModel: "ServiceOrder",
        draftOrderId: serviceOrder._id,
        currency: normalizeText(service?.currency || currency) || "USD",
        items: [
          {
            itemType: "SERVICE",
            targetId: serviceOrder.serviceId,
            titleSnapshot: serviceOrder.serviceTitle,
            imageSnapshot: Array.isArray(service?.images) ? service?.images?.[0] || null : (service as any)?.image || null,
            quantity: 1,
            unitPrice: amount,
            lineTotal: amount,
            metadata: {
              serviceIdentifier: serviceOrder.serviceIdentifier,
              category: service?.category || null
            }
          }
        ],
        subtotalAmount: amount,
        deliveryAmount: 0,
        totalAmount: amount,
        phone: normalizeText(req.body.phone || serviceOrder.customerPhone || ""),
        buyerNote: normalizeText(req.body.buyerNote || req.body.note || serviceOrder.note),
        paymentMethodSelection: normalizeText(req.body.paymentMethod || req.body.method || "CARD") as any,
        shippingAddress: {
          name: serviceOrder.customerName,
          phone: serviceOrder.customerPhone,
          address1: serviceOrder.customerAddress,
          address2: serviceOrder.destinationAddress || null
        },
        fulfillmentDetails: {
          fulfillmentMode: normalizeText(req.body.fulfillmentMode || "OFFLINE_SERVICE") || "OFFLINE_SERVICE",
          scheduledDate: normalizeText(req.body.scheduledDate || req.body.date) || null,
          scheduledTime: normalizeText(req.body.scheduledTime || req.body.time) || null,
          location: normalizeText((service as any)?.location || serviceOrder.customerAddress) || null
        },
        trustNotice: t(req, "checkout.trust_notice.service.text"),
        expiresAt: addHours(new Date(), 24)
      });
      return res.status(201).json(await toCheckoutSessionDto(session, req.locale));
    }

    const preview = await resolveProductSessionItems(req.user._id, req.body, req.locale);
    if ("error" in preview) {
      return res.status(preview.status || 400).json({ message: preview.error });
    }
    const subtotal = preview.items.reduce((acc, item) => acc + Number(item.lineTotal || 0), 0);
    const delivery = Math.max(0, Number(req.body.deliveryAmount || req.body.shippingFee || 0));
    const total = subtotal + delivery;

    const session = await CheckoutSession.create({
      buyerUserId: req.user._id,
      sourceType: "PRODUCT_ORDER",
      sourceModel: "Order",
      draftOrderId: null,
      cartId: preview.cartId,
      currency,
      items: preview.items.map((item) => ({
        itemType: "PRODUCT",
        targetId: item.productId ? new mongoose.Types.ObjectId(String(item.productId)) : null,
        titleSnapshot: item.titleSnapshot,
        imageSnapshot: item.imageSnapshot || null,
        quantity: Number(item.qty || 1),
        unitPrice: Number(item.unitPrice || 0),
        lineTotal: Number(item.lineTotal || 0),
        metadata: {
          productId: item.productId
        }
      })),
      subtotalAmount: subtotal,
      deliveryAmount: delivery,
      totalAmount: total,
      phone: normalizeText(req.body.phone),
      buyerNote: normalizeText(req.body.buyerNote || req.body.note),
      paymentMethodSelection: normalizeText(req.body.paymentMethod || req.body.method || "CARD") as any,
      shippingAddress: req.body.shippingAddress || null,
      fulfillmentDetails: {
        deliveryType: normalizeText(req.body.deliveryType || req.body.deliveryOption || "standard") || "standard",
        fulfillmentMode: "SHIPPING"
      },
      trustNotice: t(req, "checkout.trust_notice.default.text"),
      metadata: {
        checkoutSessionId: buildCheckoutSessionId()
      },
      expiresAt: addHours(new Date(), 24)
    });
    return res.status(201).json(await toCheckoutSessionDto(session, req.locale));
  } catch (err) {
    console.error("createCheckoutSession error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const updateCheckoutSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const sessionId = parseObjectId(req.params.sessionId);
    if (!sessionId) return res.status(400).json({ message: t(req, "checkout.session.validation.invalid_id.message") });

    const session = await CheckoutSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: t(req, "checkout.session.lookup.not_found.message") });
    if (String(session.buyerUserId) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    if (req.body.shippingAddress && typeof req.body.shippingAddress === "object") {
      session.shippingAddress = {
        ...(session.shippingAddress || {}),
        ...req.body.shippingAddress
      };
    }
    if (req.body.fulfillmentDetails && typeof req.body.fulfillmentDetails === "object") {
      session.fulfillmentDetails = {
        ...(session.fulfillmentDetails || {}),
        ...req.body.fulfillmentDetails
      };
    }
    if (typeof req.body.phone !== "undefined") session.phone = normalizeText(req.body.phone) || null;
    if (typeof req.body.buyerNote !== "undefined" || typeof req.body.note !== "undefined") {
      session.buyerNote = normalizeText(req.body.buyerNote || req.body.note) || null;
    }
    if (typeof req.body.paymentMethod !== "undefined" || typeof req.body.method !== "undefined") {
      session.paymentMethodSelection = normalizeText(req.body.paymentMethod || req.body.method || "") as any;
    }
    if (typeof req.body.deliveryAmount !== "undefined" || typeof req.body.shippingFee !== "undefined") {
      session.deliveryAmount = Math.max(0, Number(req.body.deliveryAmount || req.body.shippingFee || 0));
      session.totalAmount = Number(session.subtotalAmount || 0) + Number(session.deliveryAmount || 0);
    }
    await session.save();

    return res.json(await toCheckoutSessionDto(session, req.locale));
  } catch (err) {
    console.error("updateCheckoutSession error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getCheckoutSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const sessionId = parseObjectId(req.params.sessionId);
    if (!sessionId) return res.status(400).json({ message: t(req, "checkout.session.validation.invalid_id.message") });

    const session = await CheckoutSession.findById(sessionId).lean();
    if (!session) return res.status(404).json({ message: t(req, "checkout.session.lookup.not_found.message") });
    if (String(session.buyerUserId) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });
    }

    return res.json(await toCheckoutSessionDto(session, req.locale));
  } catch (err) {
    console.error("getCheckoutSession error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const materializeCheckoutSessionOrder = async (
  sessionId: mongoose.Types.ObjectId | string,
  buyerUserId?: string | null,
  locale?: AppLocale
) => {
  const normalizedId = parseObjectId(sessionId);
  if (!normalizedId) throw new Error(t(locale, "checkout.session.validation.invalid_id.message"));
  const session = await CheckoutSession.findById(normalizedId);
  if (!session) throw new Error(t(locale, "checkout.session.lookup.not_found.message"));
  if (buyerUserId && String(session.buyerUserId) !== String(buyerUserId)) throw new Error(t(locale, "common.errors.forbidden.message"));

  if (session.sourceType === "SERVICE_ORDER") {
    if (!session.draftOrderId) throw new Error(t(locale, "checkout.services.draft_order_required.message"));
    const serviceOrder = await ServiceOrder.findById(session.draftOrderId);
    if (!serviceOrder) throw new Error(t(locale, "services.orders.lookup.not_found.message"));
    return { session, sourceType: "SERVICE_ORDER" as const, order: serviceOrder };
  }

  const order = await materializeProductOrderFromSession(session, locale);
  return { session, sourceType: "PRODUCT_ORDER" as const, order };
};

export const previewCheckout = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const preview = await resolvePreviewItems(req.body, req.locale);
    if ("error" in preview) {
      return res.status(preview.status || 400).json({ message: preview.error });
    }

    const subtotal = preview.items.reduce((acc, item) => acc + Number(item.lineTotal || 0), 0);
    const shippingFee = Math.max(0, Number(req.body.shippingFee || 0));
    const total = subtotal + shippingFee;

    return res.json({
      trustNotice: t(req, "checkout.trust_notice.product.text"),
      paymentMethods: await listCheckoutPaymentMethods("PRODUCT_ORDER", req.locale),
      summary: {
        subtotal,
        shippingFee,
        total,
        currency: normalizeText(req.body.currency || "USD") || "USD",
        itemCount: preview.items.reduce((acc, item) => acc + Number(item.qty || 0), 0)
      },
      items: preview.items
    });
  } catch (err) {
    console.error("previewCheckout error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const submitCheckout = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const created = await createProductOrder({ userId: req.user._id, body: req.body, locale: req.locale });
    if ("error" in created) {
      return res.status(created.status || 400).json({ message: created.error });
    }

    const paymentCollection = await buildPaymentCollectionFromOrder(created.order, req);
    const refreshedOrder = await Order.findById(created.order._id).lean();
    if (!refreshedOrder) {
      return res.status(201).json({
        orderId: String(created.order._id),
        paymentCollection: await toPaymentCollectionDto(paymentCollection, req.locale)
      });
    }

    return res.status(201).json({
      order: await toOrderSummary(refreshedOrder, req.locale),
      paymentCollection: await toPaymentCollectionDto(paymentCollection, req.locale),
      trustNotice: refreshedOrder.trustMessage || t(req, "checkout.trust_notice.product.text")
    });
  } catch (err) {
    console.error("submitCheckout error", err);
    return res.status(500).json({ message: (err as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const getCheckoutConfirmation = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const orderId = parseObjectId(req.params.id);
    if (!orderId) return res.status(400).json({ message: t(req, "orders.validation.invalid_id.message") });
    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: t(req, "orders.lookup.not_found.message") });

    const canAccess =
      String(order.userId) === req.user._id ||
      req.user.role === "ADMIN" ||
      (Array.isArray(order.items) && order.items.some((item: any) => String(item.sellerId || "") === req.user!._id));
    if (!canAccess) return res.status(403).json({ message: t(req, "common.errors.forbidden.message") });

    return res.json({
      order: await toOrderSummary(order, req.locale)
    });
  } catch (err) {
    console.error("getCheckoutConfirmation error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
