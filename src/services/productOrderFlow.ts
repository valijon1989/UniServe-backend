import mongoose from "mongoose";
import { Cart, type ICartItem } from "../models/Cart";
import { Order } from "../models/Order";
import { OrderAddress } from "../models/OrderAddress";
import { OrderFulfillmentDetail } from "../models/OrderFulfillmentDetail";
import { OrderItemRecord } from "../models/OrderItem";
import { Product } from "../models/Product";
import {
  buildInitialMarketplaceStates,
  buildTimelineEntry,
  getBuyerLifecycleLabel,
  getSellerLifecycleLabel
} from "./marketplaceStateMachine";
import { findStrictProductByIdentifier } from "./productLookup";
import { t, type AppLocale } from "../i18n";

export const normalizeText = (value: unknown) => String(value || "").trim();

export const parseObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
  const raw = normalizeText(value);
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

export const parseQty = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intValue = Math.floor(parsed);
  if (intValue <= 0) return fallback;
  return Math.min(intValue, 999);
};

export const parseMoney = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const toMinorUnits = (value: number) => Math.max(0, Math.round(Number(value || 0) * 100));

export const resolveUnitPrice = (product: any) => {
  const salePrice = Number(product?.salePrice);
  if (Number.isFinite(salePrice) && salePrice >= 0) return salePrice;
  const price = Number(product?.price);
  return Number.isFinite(price) && price >= 0 ? price : 0;
};

export const resolveImageSnapshot = (product: any): string | undefined =>
  (typeof product?.coverImageUrl === "string" && product.coverImageUrl) ||
  (typeof product?.imageUrl === "string" && product.imageUrl) ||
  (typeof product?.image === "string" && product.image) ||
  (Array.isArray(product?.images) && typeof product.images[0] === "string" ? product.images[0] : undefined);

export const sumSubtotal = (items: { qty: number; unitPrice: number }[]) =>
  items.reduce((acc, item) => acc + Number(item.unitPrice || 0) * Number(item.qty || 0), 0);

export const normalizeShippingAddress = (body: any) => {
  const source = body?.shippingAddress && typeof body.shippingAddress === "object" ? body.shippingAddress : {};
  return {
    name: normalizeText(source.name || body?.name),
    phone: normalizeText(source.phone || body?.phone),
    address1: normalizeText(source.address1 || body?.address1),
    address2: normalizeText(source.address2 || body?.address2),
    postalCode: normalizeText(source.postalCode || body?.postalCode)
  };
};

export const normalizePayment = (body: any) => {
  const source = body?.payment && typeof body.payment === "object" ? body.payment : {};
  const method = normalizeText(source.method || body?.paymentMethod || "CARD") || "CARD";
  const provider = normalizeText(source.provider || body?.paymentProvider || "MOCK") || "MOCK";
  return { method, provider };
};

export const buildProductOrderItem = (product: any, qty: number) => ({
  productId: new mongoose.Types.ObjectId(String(product._id)),
  sellerId: mongoose.Types.ObjectId.isValid(String(product.createdBy))
    ? new mongoose.Types.ObjectId(String(product.createdBy))
    : undefined,
  qty,
  unitPrice: resolveUnitPrice(product),
  titleSnapshot: String(product?.title || ""),
  imageSnapshot: resolveImageSnapshot(product),
  categoryKey: "shopping" as const,
  settlementBucketKey: "shopping_held"
});

export const buildBuyNowItem = async (body: any, locale?: AppLocale) => {
  const productId = parseObjectId(body?.productId);
  if (!productId) {
    return { error: t(locale, "checkout.products.validation.product_id_required.message"), status: 400 as const };
  }

  const qty = parseQty(body?.qty, 1);
  if (qty <= 0) {
    return { error: t(locale, "checkout.items.validation.quantity_positive.message"), status: 400 as const };
  }

  const product = await Product.findById(productId).lean();
  if (!product) {
    return { error: t(locale, "products.lookup.not_found.message"), status: 404 as const };
  }
  if (String((product as any)?.status || "ACTIVE") !== "ACTIVE") {
    return { error: t(locale, "products.availability.purchase_disabled.message"), status: 400 as const };
  }

  const stockValue = Number((product as any)?.stock);
  if (Number.isFinite(stockValue) && stockValue >= 0 && qty > stockValue) {
    return {
      error: t(locale, "products.availability.stock_remaining.message", { count: stockValue }),
      status: 400 as const
    };
  }

  return { item: buildProductOrderItem(product, qty) };
};

export const buildCartItems = async (cartItems: ICartItem[]) => {
  const productIds = cartItems
    .map((item) => parseObjectId(item.productId))
    .filter((value): value is mongoose.Types.ObjectId => Boolean(value));
  const products = await Product.find({ _id: { $in: productIds } }).select("_id createdBy title salePrice price coverImageUrl imageUrl image images").lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return cartItems.map((item) => {
    const product = productMap.get(String(item.productId));
    if (!product) {
      return {
        productId: item.productId,
        sellerId: undefined,
        qty: Number(item.qty || 0),
        unitPrice: Number(item.priceSnapshot || 0),
        titleSnapshot: item.titleSnapshot,
        imageSnapshot: item.imageSnapshot,
        categoryKey: "shopping" as const,
        settlementBucketKey: "shopping_held"
      };
    }
    return buildProductOrderItem(product, Number(item.qty || 0));
  });
};

export const buildRequestedItems = async (rawItems: any[], locale?: AppLocale) => {
  if (!Array.isArray(rawItems) || !rawItems.length) {
    return { error: t(locale, "orders.items.required.message"), status: 400 as const };
  }

  const items: Array<ReturnType<typeof buildProductOrderItem>> = [];

  for (const rawItem of rawItems) {
    const identifier = normalizeText(rawItem?.productId || rawItem?._id || rawItem?.id);
    if (!identifier) {
      return { error: t(locale, "orders.items.product_required.message"), status: 400 as const };
    }

    const product = await findStrictProductByIdentifier(identifier);
    if (!product?._id) {
      return {
        error: t(locale, "products.lookup.identifier_not_found.message", { identifier }),
        status: 404 as const
      };
    }
    if (String((product as any)?.status || "ACTIVE") !== "ACTIVE") {
      return {
        error: t(locale, "products.availability.identifier_purchase_disabled.message", { identifier }),
        status: 400 as const
      };
    }

    const qty = parseQty(rawItem?.qty ?? rawItem?.quantity, 1);
    const stockValue = Number((product as any)?.stock);
    if (Number.isFinite(stockValue) && stockValue >= 0 && qty > stockValue) {
      return {
        error: t(locale, "products.availability.identifier_stock_remaining.message", {
          count: stockValue,
          identifier
        }),
        status: 400 as const
      };
    }

    items.push(buildProductOrderItem(product, qty));
  }

  return { items };
};

export const getOrderSellerIds = (order: any) =>
  Array.from(
    new Set(
      (order.items || [])
        .map((item: any) => normalizeText(item.sellerId))
        .filter(Boolean)
    )
  );

export const canSellerAccessOrder = (order: any, userId: string) => {
  const sellers = getOrderSellerIds(order);
  return sellers.includes(userId) || String(order.agentId || "") === userId;
};

export const toOrderDtoBase = (order: any, locale?: AppLocale) => ({
  _id: String(order._id),
  userId: String(order.userId),
  agentId: order.agentId ? String(order.agentId) : null,
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
  settlementCategory: order.settlementCategory,
  settlementBucketKey: order.settlementBucketKey,
  source: order.source,
  paymentId: order.paymentId ? String(order.paymentId) : null,
  paymentCollectionExpiresAt: order.paymentCollectionExpiresAt || null,
  paymentReferenceCode: order.paymentReferenceCode || null,
  buyerReviewEndsAt: order.buyerReviewEndsAt || null,
  releaseScheduledAt: order.releaseScheduledAt || null,
  deliveredAt: order.deliveredAt || null,
  completedAt: order.completedAt || null,
  trustMessage: order.trustMessage || null,
  items: (order.items || []).map((item: any) => ({
    productId: String(item.productId),
    sellerId: item.sellerId ? String(item.sellerId) : null,
    qty: Number(item.qty || 0),
    unitPrice: Number(item.unitPrice || 0),
    titleSnapshot: item.titleSnapshot,
    imageSnapshot: item.imageSnapshot || null,
    categoryKey: item.categoryKey || "shopping",
    settlementBucketKey: item.settlementBucketKey || "shopping_held",
    lineTotal: Number(item.unitPrice || 0) * Number(item.qty || 0)
  })),
  subtotal: Number(order.subtotal || 0),
  shippingFee: Number(order.shippingFee || 0),
  total: Number(order.total || 0),
  currency: order.currency || "USD",
  deliveryOption: order.deliveryOption || "standard",
  shippingAddress: order.shippingAddress,
  payment: order.payment,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt
});

export const createProductOrder = async (params: {
  userId: mongoose.Types.ObjectId | string;
  body: any;
  clearCartWhenUsingCart?: boolean;
  locale?: AppLocale;
}) => {
  const sourceRaw = normalizeText(params.body.source).toUpperCase();
  const shouldUseProvidedItems = Boolean(params.body?.useProvidedItems) || sourceRaw === "REQUESTED";
  const source: "CART" | "BUY_NOW" = sourceRaw === "BUY_NOW" || params.body.productId || shouldUseProvidedItems ? "BUY_NOW" : "CART";

  const shippingAddress = normalizeShippingAddress(params.body);
  if (!shippingAddress.name || !shippingAddress.phone || !shippingAddress.address1) {
    return { error: t(params.locale, "checkout.shipping.address.required.message"), status: 400 as const };
  }

  const payment = normalizePayment(params.body);
  let items: Array<ReturnType<typeof buildProductOrderItem>> = [];
  const initialStates = buildInitialMarketplaceStates();

  if (shouldUseProvidedItems) {
    const built = await buildRequestedItems(params.body?.items, params.locale);
    if ("error" in built) return { error: built.error, status: built.status };
    items = built.items;
  } else if (source === "BUY_NOW") {
    const built = await buildBuyNowItem(params.body, params.locale);
    if ("error" in built) return { error: built.error, status: built.status };
    items = [built.item];
  } else {
    const cart = await Cart.findOne({ userId: params.userId });
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      const built = await buildRequestedItems(params.body?.items, params.locale);
      if ("error" in built) return { error: built.error, status: built.status };
      items = built.items;
    } else {
      items = await buildCartItems(cart.items as ICartItem[]);
    }
  }

  if (!items.length) return { error: t(params.locale, "orders.items.required.message"), status: 400 as const };

  const shippingFee = parseMoney(params.body.shippingFee, 0);
  const subtotal = sumSubtotal(items);
  const total = subtotal + shippingFee;
  const sellerIds = Array.from(new Set(items.map((item) => normalizeText(item.sellerId)).filter(Boolean)));
  const agentId = sellerIds.length === 1 ? parseObjectId(sellerIds[0]) : null;

  const order = await Order.create({
    userId: params.userId,
    agentId: agentId || undefined,
    status: "PENDING_PAYMENT",
    statusLabelCache: getBuyerLifecycleLabel(initialStates.lifecycleState),
    lifecycleState: initialStates.lifecycleState,
    paymentState: initialStates.paymentState,
    fulfillmentState: initialStates.fulfillmentState,
    settlementState: initialStates.settlementState,
    disputeState: initialStates.disputeState,
    paymentWorkflowStatus: "INITIATED",
    paymentCollectionStatus: "DRAFT",
    paymentCollectionMethod: payment.method,
    settlementCategory: "shopping",
    settlementBucketKey: "shopping_held",
    source,
    items,
    subtotal,
    shippingFee,
    total,
    currency: normalizeText(params.body.currency || "USD") || "USD",
    deliveryOption: normalizeText(params.body.deliveryOption || "standard") || "standard",
    shippingAddress,
    payment: {
      method: payment.method,
      provider: payment.provider
    },
    stateTimeline: [
      buildTimelineEntry({
        group: "lifecycle",
        from: null,
        to: "awaiting_payment",
        actorType: "buyer",
        actorId: String(params.userId),
        note: t(params.locale, "orders.timeline.created.note")
      }),
      buildTimelineEntry({
        group: "payment",
        from: null,
        to: "awaiting_payment",
        actorType: "buyer",
        actorId: String(params.userId),
        note: t(params.locale, "payments.timeline.started.note")
      })
    ],
    note: normalizeText(params.body.note) || undefined,
    trustMessage: t(params.locale, "checkout.trust_notice.product.text")
  });

  await Promise.all([
    OrderAddress.create({
      orderId: order._id,
      sourceModel: "Order",
      addressType: "SHIPPING",
      line1: shippingAddress.address1,
      line2: shippingAddress.address2 || null,
      postalCode: shippingAddress.postalCode || null,
      contactName: shippingAddress.name || null,
      contactPhone: shippingAddress.phone || null,
      country: normalizeText(params.body.country) || null,
      region: normalizeText(params.body.region) || null,
      city: normalizeText(params.body.city) || null,
      district: normalizeText(params.body.district) || null,
      landmark: normalizeText(params.body.landmark) || null
    }),
    OrderFulfillmentDetail.create({
      orderId: order._id,
      sourceModel: "Order",
      fulfillmentMode: "SHIPPING",
      deliveryType: normalizeText(params.body.deliveryType || params.body.deliveryOption || "standard") || "standard",
      buyerNote: normalizeText(params.body.note) || null,
      expectedCompletionAt: params.body.expectedCompletionAt ? new Date(params.body.expectedCompletionAt) : null,
      metadata: {
        orderSource: source,
        itemCount: items.length
      }
    }),
    ...(items.length
      ? [
          OrderItemRecord.insertMany(
            items.map((item) => ({
              orderId: order._id,
              sourceModel: "Order" as const,
              itemType: "PRODUCT" as const,
              targetType: "product_listing",
              targetId: item.productId,
              sellerOrAgentUserId: item.sellerId || null,
              titleSnapshot: item.titleSnapshot,
              categorySnapshot: item.categoryKey || "shopping",
              quantity: Number(item.qty || 1),
              unitPriceMinor: toMinorUnits(Number(item.unitPrice || 0)),
              lineTotalMinor: toMinorUnits(Number(item.unitPrice || 0) * Number(item.qty || 0)),
              currency: order.currency,
              metadata: {
                imageSnapshot: item.imageSnapshot || null,
                settlementBucketKey: item.settlementBucketKey || null
              }
            }))
          )
        ]
      : [])
  ]);

  if (source === "CART" && params.clearCartWhenUsingCart !== false) {
    await Cart.updateOne({ userId: params.userId }, { $set: { items: [] } });
  }

  return { order };
};
