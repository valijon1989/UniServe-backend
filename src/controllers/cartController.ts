import mongoose from "mongoose";
import { Request, Response } from "express";
import { Cart, ICart, ICartItem } from "../models/Cart";
import { Product } from "../models/Product";
import { t } from "../i18n";
import { toDetailDto } from "./productController";
import { findStrictProductByIdentifier, normalizePurchasableProductId } from "../services/productLookup";
import { buildRecommendationModulesSafe, recordRecommendationSignal } from "../services/recommendationEngine";

const normalizeText = (value: unknown) => String(value || "").trim();

const parseObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
  const raw = normalizeText(value);
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

const parseQty = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intValue = Math.floor(parsed);
  if (intValue <= 0) return fallback;
  return Math.min(intValue, 999);
};

const resolveUnitPrice = (product: any) => {
  const salePrice = Number(product?.salePrice);
  if (Number.isFinite(salePrice) && salePrice >= 0) return salePrice;
  const price = Number(product?.price);
  return Number.isFinite(price) && price >= 0 ? price : 0;
};

const resolveImageSnapshot = (product: any): string | undefined => {
  const image =
    (typeof product?.coverImageUrl === "string" && product.coverImageUrl) ||
    (typeof product?.imageUrl === "string" && product.imageUrl) ||
    (typeof product?.image === "string" && product.image) ||
    (Array.isArray(product?.images) && typeof product.images[0] === "string" && product.images[0]) ||
    undefined;
  return image;
};

const calculateSubtotal = (items: ICartItem[]) =>
  items.reduce((acc, item) => acc + Number(item.priceSnapshot || 0) * Number(item.qty || 0), 0);

const buildCartProductMap = async (items: ICartItem[]) => {
  const productIds = Array.from(
    new Set(
      items
        .map((item) => String(item.productId || "").trim())
        .filter((productId) => mongoose.Types.ObjectId.isValid(productId))
    )
  );

  if (!productIds.length) return new Map<string, any>();

  const products = await Product.find({
    _id: {
      $in: productIds.map((productId) => new mongoose.Types.ObjectId(productId))
    }
  })
    .populate("createdBy", "name username role avatarUrl")
    .lean();

  return new Map<string, any>(products.map((product) => [String(product._id), product]));
};

const syncCartSnapshots = (cart: ICart, productMap: Map<string, any>) => {
  let changed = false;

  for (const item of cart.items) {
    const product = productMap.get(String(item.productId));
    if (!product) continue;

    const nextPrice = resolveUnitPrice(product);
    const nextTitle = String((product as any)?.title || item.titleSnapshot || "");
    const nextImage = resolveImageSnapshot(product) || item.imageSnapshot;

    if (Number(item.priceSnapshot || 0) !== nextPrice) {
      item.priceSnapshot = nextPrice;
      changed = true;
    }
    if (item.titleSnapshot !== nextTitle) {
      item.titleSnapshot = nextTitle;
      changed = true;
    }
    if ((item.imageSnapshot || "") !== (nextImage || "")) {
      item.imageSnapshot = nextImage;
      changed = true;
    }
  }

  return changed;
};

const toCartResponse = (items: ICartItem[], productMap: Map<string, any> = new Map(), locale?: Request["locale"]) => ({
  items: items.map((item) => ({
    productId: String(item.productId),
    qty: Number(item.qty || 0),
    priceSnapshot: Number(item.priceSnapshot || 0),
    titleSnapshot: item.titleSnapshot,
    imageSnapshot: item.imageSnapshot || null,
    lineTotal: Number(item.priceSnapshot || 0) * Number(item.qty || 0),
    product: productMap.has(String(item.productId)) ? toDetailDto(productMap.get(String(item.productId)), locale) : null
  })),
  subtotal: calculateSubtotal(items)
});

const ensureCart = async (userId: string) => {
  const existing = await Cart.findOne({ userId });
  if (existing) return existing;
  return await Cart.create({ userId, items: [] });
};

export const getCart = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) return res.json({ items: [], subtotal: 0 });

    const productMap = await buildCartProductMap(cart.items as ICartItem[]);
    const changed = syncCartSnapshots(cart, productMap);
    if (changed) await cart.save();

    const payload = toCartResponse(cart.items as ICartItem[], productMap, req.locale);
    const recommendations = await buildRecommendationModulesSafe({
      surface: "CART",
      locale: req.locale,
      userId: req.user._id,
      cartProductIds: payload.items.map((item) => item.productId),
      limitPerModule: 4
    }, "cart.getCart.recommendations");

    return res.json({ ...payload, recommendations });
  } catch (err) {
    console.error("getCart error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const addCartItem = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const rawProductId = normalizeText(req.body.productId);
    if (!rawProductId) return res.status(400).json({ message: t(req, "cart.validation.product_id_required.message") });

    const qtyToAdd = parseQty(req.body.qty, 1);
    if (qtyToAdd <= 0) return res.status(400).json({ message: t(req, "cart.validation.quantity_positive.message") });

    const product = await findStrictProductByIdentifier(rawProductId);
    if (!product) return res.status(404).json({ message: t(req, "products.lookup.not_found.message") });
    if (String((product as any)?.status || "ACTIVE") !== "ACTIVE") {
      return res.status(400).json({ message: t(req, "products.availability.purchase_disabled.message") });
    }

    const productId = normalizePurchasableProductId(product as any);
    if (!parseObjectId(productId)) {
      return res.status(400).json({ message: t(req, "products.validation.resolved_id_invalid.message") });
    }

    const stockValue = Number((product as any)?.stock);
    const hasStockConstraint = Number.isFinite(stockValue) && stockValue >= 0;
    if (hasStockConstraint && stockValue === 0) {
      return res.status(400).json({ message: t(req, "products.availability.out_of_stock.message") });
    }

    const cart = await ensureCart(req.user._id);

    const index = cart.items.findIndex((item) => String(item.productId) === productId);
    const currentQty = index >= 0 ? Number(cart.items[index].qty || 0) : 0;
    const nextQty = currentQty + qtyToAdd;

    if (hasStockConstraint && nextQty > stockValue) {
      return res.status(400).json({
        message: t(req, "products.availability.stock_remaining.message", { count: stockValue })
      });
    }

    const nextItem = {
      productId: new mongoose.Types.ObjectId(productId),
      qty: nextQty,
      priceSnapshot: resolveUnitPrice(product),
      titleSnapshot: String((product as any)?.title || ""),
      imageSnapshot: resolveImageSnapshot(product)
    };

    if (index >= 0) {
      cart.items[index] = nextItem;
    } else {
      cart.items.push(nextItem as any);
    }

    await cart.save();

    const productMap = await buildCartProductMap(cart.items as ICartItem[]);
    const payload = toCartResponse(cart.items as ICartItem[], productMap, req.locale);
    await recordRecommendationSignal({
      userId: req.user._id,
      entityType: "PRODUCT",
      entityId: productId,
      entityIdentifier: String((product as any)._id || productId),
      action: "CART_ADD",
      categoryKey: String((product as any).category || "").trim() || null,
      locale: req.locale,
      weight: qtyToAdd
    }).catch(() => null);
    const recommendations = await buildRecommendationModulesSafe({
      surface: "CART",
      locale: req.locale,
      userId: req.user._id,
      cartProductIds: payload.items.map((item) => item.productId),
      limitPerModule: 4
    }, "cart.addCartItem.recommendations");
    return res.json({ ...payload, recommendations });
  } catch (err) {
    console.error("addCartItem error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const updateCartItemQty = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const productId = parseObjectId(req.params.productId);
    if (!productId) return res.status(400).json({ message: t(req, "cart.validation.product_id_invalid.message") });

    const qty = parseQty(req.body.qty, 0);
    if (qty <= 0) return res.status(400).json({ message: t(req, "cart.validation.quantity_positive.message") });

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) return res.status(404).json({ message: t(req, "cart.lookup.not_found.message") });

    const index = cart.items.findIndex((item) => String(item.productId) === String(productId));
    if (index < 0) return res.status(404).json({ message: t(req, "cart.items.lookup.not_found.message") });

    const product = await findStrictProductByIdentifier(String(productId));
    if (!product) return res.status(404).json({ message: t(req, "products.lookup.not_found.message") });
    if (String((product as any)?.status || "ACTIVE") !== "ACTIVE") {
      return res.status(400).json({ message: t(req, "products.availability.purchase_disabled.message") });
    }

    const stockValue = Number((product as any)?.stock);
    if (Number.isFinite(stockValue) && stockValue >= 0 && qty > stockValue) {
      return res.status(400).json({
        message: t(req, "products.availability.stock_remaining.message", { count: stockValue })
      });
    }

    cart.items[index].qty = qty;
    cart.items[index].priceSnapshot = resolveUnitPrice(product);
    cart.items[index].titleSnapshot = String((product as any)?.title || cart.items[index].titleSnapshot || "");
    cart.items[index].imageSnapshot = resolveImageSnapshot(product) || cart.items[index].imageSnapshot;

    await cart.save();

    const productMap = await buildCartProductMap(cart.items as ICartItem[]);
    const payload = toCartResponse(cart.items as ICartItem[], productMap, req.locale);
    const recommendations = await buildRecommendationModulesSafe({
      surface: "CART",
      locale: req.locale,
      userId: req.user._id,
      cartProductIds: payload.items.map((item) => item.productId),
      limitPerModule: 4
    }, "cart.updateCartItemQty.recommendations");
    return res.json({ ...payload, recommendations });
  } catch (err) {
    console.error("updateCartItemQty error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const removeCartItem = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const productId = parseObjectId(req.params.productId);
    if (!productId) return res.status(400).json({ message: t(req, "cart.validation.product_id_invalid.message") });

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) return res.json({ items: [], subtotal: 0 });

    cart.items = cart.items.filter((item) => String(item.productId) !== String(productId));
    await cart.save();

    const productMap = await buildCartProductMap(cart.items as ICartItem[]);
    const payload = toCartResponse(cart.items as ICartItem[], productMap, req.locale);
    await recordRecommendationSignal({
      userId: req.user._id,
      entityType: "PRODUCT",
      entityId: String(productId),
      entityIdentifier: String(productId),
      action: "CART_REMOVE",
      locale: req.locale
    }).catch(() => null);
    const recommendations = await buildRecommendationModulesSafe({
      surface: "CART",
      locale: req.locale,
      userId: req.user._id,
      cartProductIds: payload.items.map((item) => item.productId),
      limitPerModule: 4
    }, "cart.removeCartItem.recommendations");
    return res.json({ ...payload, recommendations });
  } catch (err) {
    console.error("removeCartItem error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const clearCart = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const cart = await ensureCart(req.user._id);
    cart.items = [];
    await cart.save();

    const recommendations = await buildRecommendationModulesSafe({
      surface: "CART",
      locale: req.locale,
      userId: req.user._id,
      cartProductIds: [],
      limitPerModule: 4
    }, "cart.clearCart.recommendations");
    return res.json({ items: [], subtotal: 0, recommendations });
  } catch (err) {
    console.error("clearCart error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
