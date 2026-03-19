import mongoose, { type PipelineStage } from "mongoose";
import type { AppLocale } from "../i18n";
import { User } from "../models/User";
import { ProductFeedback } from "../models/ProductFeedback";
import { ProductLike } from "../models/ProductLike";
import { buildCategoryMeta, normalizeMarketplaceCategory, resolveMarketplaceTaxonomy } from "./categoryTaxonomy";
import { resolveSaleMeta } from "./listingSelector";
import { getProductCopy, resolveLocalizedArrayField, resolveLocalizedTextField } from "./localizedContent";
import { ensureAbsoluteUrl } from "../utils/imageHelpers";
import { normalizeCoverImageUrl, resolveCoverImage, sanitizeImageArray } from "../utils/resolveCoverImage";

const PRODUCT_FALLBACK = ensureAbsoluteUrl("/images/fallback-product.png") || "http://localhost:5001/images/fallback-product.png";

const PRODUCT_CARD_COPY: Record<
  AppLocale,
  {
    badgeNew: string;
    badgeBestSeller: string;
    badgeFeatured: string;
    badgeDiscount: string;
    shippingFast: string;
    shippingStandard: string;
    shippingFree: string;
    shippingFastFree: string;
    shippingPickup: string;
    stockIn: string;
    stockLow: string;
    stockOut: string;
    stockPreorder: string;
  }
> = {
  uz: {
    badgeNew: "Yangi",
    badgeBestSeller: "Ko'p sotilgan",
    badgeFeatured: "Tavsiya etiladi",
    badgeDiscount: "Chegirma",
    shippingFast: "Tezkor yetkazish",
    shippingStandard: "Standart yetkazish",
    shippingFree: "Bepul yetkazish",
    shippingFastFree: "Tezkor va bepul yetkazish",
    shippingPickup: "Olib ketish",
    stockIn: "Mavjud",
    stockLow: "Kam qoldi",
    stockOut: "Tugagan",
    stockPreorder: "Oldindan buyurtma"
  },
  ru: {
    badgeNew: "Новинка",
    badgeBestSeller: "Хит продаж",
    badgeFeatured: "Рекомендуем",
    badgeDiscount: "Скидка",
    shippingFast: "Быстрая доставка",
    shippingStandard: "Стандартная доставка",
    shippingFree: "Бесплатная доставка",
    shippingFastFree: "Быстрая и бесплатная доставка",
    shippingPickup: "Самовывоз",
    stockIn: "В наличии",
    stockLow: "Мало осталось",
    stockOut: "Нет в наличии",
    stockPreorder: "Предзаказ"
  },
  en: {
    badgeNew: "New",
    badgeBestSeller: "Best Seller",
    badgeFeatured: "Featured",
    badgeDiscount: "Discount",
    shippingFast: "Fast shipping",
    shippingStandard: "Standard shipping",
    shippingFree: "Free shipping",
    shippingFastFree: "Fast free shipping",
    shippingPickup: "Pickup",
    stockIn: "In stock",
    stockLow: "Low stock",
    stockOut: "Out of stock",
    stockPreorder: "Preorder"
  },
  ko: {
    badgeNew: "신상품",
    badgeBestSeller: "베스트셀러",
    badgeFeatured: "추천 상품",
    badgeDiscount: "할인",
    shippingFast: "빠른 배송",
    shippingStandard: "일반 배송",
    shippingFree: "무료 배송",
    shippingFastFree: "빠른 무료 배송",
    shippingPickup: "픽업",
    stockIn: "재고 있음",
    stockLow: "재고 적음",
    stockOut: "품절",
    stockPreorder: "예약 주문"
  }
};

export const PRODUCT_CARD_PROJECT: Record<string, 1> = {
  _id: 1,
  slug: 1,
  title: 1,
  titleI18n: 1,
  titleLocalized: 1,
  titleLocales: 1,
  titleTranslations: 1,
  shortTitle: 1,
  shortTitleI18n: 1,
  shortTitleLocalized: 1,
  shortTitleLocales: 1,
  shortTitleTranslations: 1,
  subtitle: 1,
  subtitleI18n: 1,
  subtitleLocalized: 1,
  subtitleLocales: 1,
  subtitleTranslations: 1,
  summary: 1,
  summaryI18n: 1,
  summaryLocalized: 1,
  summaryLocales: 1,
  summaryTranslations: 1,
  specSummary: 1,
  specSummaryI18n: 1,
  specSummaryLocalized: 1,
  specSummaryLocales: 1,
  specSummaryTranslations: 1,
  description: 1,
  descriptionI18n: 1,
  descriptionLocalized: 1,
  descriptionLocales: 1,
  descriptionTranslations: 1,
  category: 1,
  subCategory: 1,
  subcategory: 1,
  categorySlug: 1,
  subcategorySlug: 1,
  brand: 1,
  brandI18n: 1,
  brandLocalized: 1,
  brandLocales: 1,
  brandTranslations: 1,
  condition: 1,
  price: 1,
  oldPrice: 1,
  salePrice: 1,
  discountPercent: 1,
  currency: 1,
  installment: 1,
  installmentPrice: 1,
  images: 1,
  image: 1,
  imageUrl: 1,
  thumbnail: 1,
  coverImage: 1,
  coverImageUrl: 1,
  cardImageUrl: 1,
  hoverImage: 1,
  media: 1,
  rating: 1,
  ratingAvg: 1,
  ratingCount: 1,
  likes: 1,
  views: 1,
  orders: 1,
  likeCount: 1,
  viewCount: 1,
  purchaseCount: 1,
  popularityCount: 1,
  seller: 1,
  vendor: 1,
  createdBy: 1,
  delivery: 1,
  deliveryType: 1,
  shippingLabel: 1,
  fastShipping: 1,
  freeShipping: 1,
  shippingFee: 1,
  stock: 1,
  quantity: 1,
  inventoryCount: 1,
  stockCount: 1,
  stockStatus: 1,
  inStock: 1,
  preorder: 1,
  policies: 1,
  returnAvailable: 1,
  warrantyAvailable: 1,
  warranty: 1,
  badges: 1,
  isNew: 1,
  isBestSeller: 1,
  isFeatured: 1,
  bestSeller: 1,
  featured: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1
};

export const PRODUCT_CARD_SELECT = Object.keys(PRODUCT_CARD_PROJECT).join(" ");

type BadgeTone = "neutral" | "success" | "accent" | "sale";
type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "preorder";

export interface ProductCardPayload {
  id: string;
  slug: string;
  type: "product";
  route: string;
  identity: {
    id: string;
    slug: string;
    category: string | null;
    subcategory: string | null;
    brand: string | null;
  };
  display: {
    locale: AppLocale;
    title: string;
    shortTitle: string;
    subtitle: string;
    values: {
      category: string | null;
      subcategory: string | null;
      brand: string | null;
      condition: string | null;
      shippingLabel: string;
      stockStatus: string;
    };
  };
  media: {
    primaryImage: string;
    hoverImage: string | null;
    galleryPreview: string[];
    thumbnail: string;
  };
  pricing: {
    currentPrice: number | null;
    oldPrice: number | null;
    discountPercent: number;
    currency: string;
    installmentPrice: number | null;
  };
  trust: {
    ratingAverage: number;
    reviewCount: number;
    soldCount: number;
    popularityCount: number;
    verifiedSeller: boolean;
    returnAvailable: boolean;
    warrantyAvailable: boolean;
  };
  logistics: {
    stockCount: number;
    stockStatus: StockStatus;
    deliveryType: string;
    shippingLabel: string;
    fastShipping: boolean;
    freeShipping: boolean;
  };
  badges: {
    isNew: boolean;
    isBestSeller: boolean;
    isFeatured: boolean;
    isDiscounted: boolean;
    list: Array<{ key: string; label: string; tone: BadgeTone }>;
  };
  seller: {
    sellerId: string | null;
    sellerName: string;
    sellerVerified: boolean;
    sellerType: string;
  };
  actions: {
    canAddToCart: boolean;
    canBuyNow: boolean;
    isSavedByCurrentUser: boolean;
  };
  meta: {
    locale: AppLocale;
    status: string;
    createdAt: string | null;
    updatedAt: string | null;
  };
}

export interface ProductCardContext {
  savedProductIds?: Set<string>;
  sellerMap?: Map<string, Record<string, unknown>>;
}

export interface ProductListingQueryState {
  page: number;
  limit: number;
  sortValue: string;
  categoryKey: string | null;
  subcategoryKey: string | null;
  brand: string | null;
  condition: string | null;
  delivery: string | null;
  stock: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  ratingMin: number | null;
  searchRegex?: RegExp | null;
}

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeToken = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const firstPositiveNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const firstNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseQueryNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = normalizeToken(value);
    if (["true", "1", "yes", "y", "available", "in-stock", "in-stock-now"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "none", "unavailable", "out-of-stock"].includes(normalized)) return false;
  }
  return fallback;
};

const clampMoney = (value: number | null) => (value !== null ? Math.round(value * 100) / 100 : null);

const truncateText = (value: string, maxLength: number) => {
  const input = normalizeText(value);
  if (!input || input.length <= maxLength) return input;
  return `${input.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
};

const uniqueStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const resolveFirstLocalizedText = (
  source: Record<string, unknown> | null | undefined,
  fields: string[],
  locale: AppLocale,
  fallback = ""
) => {
  for (const field of fields) {
    const resolved = resolveLocalizedTextField(source, field, locale, "");
    if (resolved) return resolved;
  }
  return fallback;
};

const localizedRegexClauses = (fields: string[], regex: RegExp) =>
  fields.flatMap((field) => [
    { [field]: regex },
    { [`${field}I18n.uz`]: regex },
    { [`${field}I18n.ru`]: regex },
    { [`${field}I18n.en`]: regex },
    { [`${field}I18n.ko`]: regex }
  ]);

const buildTaxonomyCandidates = (rawValue: unknown) => {
  const raw = normalizeText(rawValue);
  if (!raw) return [];
  const resolved = resolveMarketplaceTaxonomy(rawValue, undefined, "products");
  const values = new Set<string>([raw, normalizeMarketplaceCategory(rawValue, "products")]);
  if (resolved?.subcategory) {
    values.add(resolved.subcategory.slug);
    Object.values(resolved.subcategory.name).forEach((entry) => values.add(entry));
    (resolved.subcategory.aliases || []).forEach((entry) => values.add(entry));
  }
  if (resolved?.main && resolved.main.slug !== "products") {
    values.add(resolved.main.slug);
    Object.values(resolved.main.name).forEach((entry) => values.add(entry));
    (resolved.main.aliases || []).forEach((entry) => values.add(entry));
  }
  return Array.from(values)
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
};

const buildCategoryClause = (rawValue: unknown) => {
  const candidates = buildTaxonomyCandidates(rawValue).filter((entry) => normalizeToken(entry) !== "products");
  if (!candidates.length) return null;
  const regex = new RegExp(`^(?:${candidates.map(escapeRegex).join("|")})$`, "i");
  return {
    $or: [
      { category: regex },
      { subCategory: regex },
      { subcategory: regex },
      { categorySlug: regex },
      { subcategorySlug: regex }
    ]
  };
};

const buildBrandClause = (rawValue: unknown) => {
  const value = normalizeText(rawValue);
  if (!value) return null;
  const regex = new RegExp(escapeRegex(value), "i");
  return { $or: localizedRegexClauses(["brand"], regex) };
};

const buildConditionClause = (rawValue: unknown) => {
  const value = normalizeText(rawValue);
  if (!value) return null;
  return { condition: new RegExp(escapeRegex(value), "i") };
};

const buildDeliveryClause = (rawValue: unknown) => {
  const token = normalizeToken(rawValue);
  if (!token) return null;
  if (token === "free" || token === "free-shipping") {
    return {
      $or: [
        { freeShipping: true },
        { "delivery.fee": 0 },
        { shippingFee: 0 },
        { shippingLabel: /free/i }
      ]
    };
  }
  if (["fast", "express", "same-day", "sameday"].includes(token)) {
    return {
      $or: [
        { fastShipping: true },
        { deliveryType: /fast|express|same[-\s]?day/i },
        { "delivery.type": /fast|express|same[-\s]?day/i },
        { shippingLabel: /fast|express/i }
      ]
    };
  }
  if (token === "pickup") {
    return {
      $or: [{ deliveryType: /pickup/i }, { "delivery.type": /pickup/i }, { shippingLabel: /pickup/i }]
    };
  }
  return {
    $or: [
      { deliveryType: new RegExp(escapeRegex(token), "i") },
      { "delivery.type": new RegExp(escapeRegex(token), "i") },
      { shippingLabel: new RegExp(escapeRegex(token), "i") }
    ]
  };
};

const buildStockClause = (rawValue: unknown) => {
  const token = normalizeToken(rawValue);
  if (!token) return null;
  if (["in-stock", "available", "ready"].includes(token)) {
    return {
      $or: [
        { stock: { $gt: 0 } },
        { quantity: { $gt: 0 } },
        { inventoryCount: { $gt: 0 } },
        { stockCount: { $gt: 0 } },
        { inStock: true },
        { stockStatus: /in[-\s]?stock|available/i }
      ]
    };
  }
  if (["out-of-stock", "sold-out", "unavailable"].includes(token)) {
    return {
      $or: [
        { status: { $in: ["SOLD", "BLOCKED"] } },
        { stock: { $lte: 0 } },
        { quantity: { $lte: 0 } },
        { inventoryCount: { $lte: 0 } },
        { stockCount: { $lte: 0 } },
        { inStock: false },
        { stockStatus: /out[-\s]?of[-\s]?stock|sold[-\s]?out/i }
      ]
    };
  }
  if (token === "preorder") {
    return {
      $or: [{ preorder: true }, { stockStatus: /pre[-\s]?order/i }]
    };
  }
  return null;
};

const toNumericExpr = (path: string) => ({
  $convert: {
    input: path,
    to: "double",
    onError: 0,
    onNull: 0
  }
});

export const normalizeProductSort = (value: unknown, fallback = "newest") => {
  const token = normalizeToken(value);
  if (["best-match", "best_match"].includes(token)) return "best_match";
  if (["price-asc", "price_asc"].includes(token)) return "price_asc";
  if (["price-desc", "price_desc"].includes(token)) return "price_desc";
  if (["top-rated", "top_rated", "rating"].includes(token)) return "top_rated";
  if (["popular", "trending"].includes(token)) return "popular";
  if (token === "newest") return "newest";
  return fallback;
};

export const createProductListingQueryState = (
  query: Record<string, unknown>,
  options?: { defaultLimit?: number; maxLimit?: number; defaultSort?: string }
): ProductListingQueryState => {
  const defaultLimit = options?.defaultLimit ?? 24;
  const maxLimit = options?.maxLimit ?? 50;
  const pageRaw = Number(query.page);
  const limitRaw = Number(query.limit);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), maxLimit) : defaultLimit;
  const categoryInput = query.category;
  const subcategoryInput = query.subcategory;
  const normalizedCategory = buildTaxonomyCandidates(categoryInput).find((entry) => normalizeToken(entry) !== "products") || null;
  const normalizedSubcategory =
    buildTaxonomyCandidates(subcategoryInput).find((entry) => normalizeToken(entry) !== "products") || null;
  return {
    page,
    limit,
    sortValue: normalizeProductSort(query.sort, options?.defaultSort || "newest"),
    categoryKey: normalizedCategory ? normalizeMarketplaceCategory(normalizedCategory, "products") : null,
    subcategoryKey: normalizedSubcategory ? normalizeMarketplaceCategory(normalizedSubcategory, "products") : null,
    brand: normalizeText(query.brand) || null,
    condition: normalizeText(query.condition) || null,
    delivery: normalizeText(query.delivery) || null,
    stock: normalizeText(query.stock || query.availability) || null,
    minPrice: parseQueryNumber(query.minPrice ?? query.priceMin),
    maxPrice: parseQueryNumber(query.maxPrice ?? query.priceMax),
    ratingMin: parseQueryNumber(query.rating),
    searchRegex: query.searchRegex instanceof RegExp ? query.searchRegex : null
  };
};

export const buildProductListingPipeline = (
  state: ProductListingQueryState,
  options?: { baseMatch?: Record<string, unknown> }
) => {
  const baseMatch: Record<string, unknown> = {
    status: "ACTIVE",
    ...(options?.baseMatch || {})
  };
  const andClauses: Record<string, unknown>[] = [];

  const categoryClause = buildCategoryClause(state.categoryKey);
  if (categoryClause) andClauses.push(categoryClause);

  const subcategoryClause = buildCategoryClause(state.subcategoryKey);
  if (subcategoryClause) andClauses.push(subcategoryClause);

  const brandClause = buildBrandClause(state.brand);
  if (brandClause) andClauses.push(brandClause);

  const conditionClause = buildConditionClause(state.condition);
  if (conditionClause) andClauses.push(conditionClause);

  const deliveryClause = buildDeliveryClause(state.delivery);
  if (deliveryClause) andClauses.push(deliveryClause);

  const stockClause = buildStockClause(state.stock);
  if (stockClause) andClauses.push(stockClause);

  if (state.searchRegex) {
    andClauses.push({
      $or: localizedRegexClauses(["title", "description", "subtitle", "summary", "specSummary", "brand"], state.searchRegex).concat([
        { category: state.searchRegex },
        { subCategory: state.searchRegex },
        { subcategory: state.searchRegex },
        { slug: state.searchRegex }
      ])
    });
  }

  if (andClauses.length) {
    baseMatch.$and = andClauses;
  }

  const basePrice = toNumericExpr("$price");
  const salePrice = toNumericExpr("$salePrice");
  const discountPercent = toNumericExpr("$discountPercent");
  const ratingAvg = toNumericExpr("$ratingAvg");
  const ratingNested = toNumericExpr("$rating.avg");
  const ratingCount = toNumericExpr("$ratingCount");
  const ratingNestedCount = toNumericExpr("$rating.count");
  const purchaseCount = toNumericExpr("$purchaseCount");
  const orderCount = toNumericExpr("$orders");
  const nestedOrders = toNumericExpr("$stats.orders");
  const nestedPurchases = toNumericExpr("$stats.purchases");
  const viewCount = toNumericExpr("$viewCount");
  const views = toNumericExpr("$views");
  const likeCount = toNumericExpr("$likeCount");
  const likes = toNumericExpr("$likes");
  const stock = toNumericExpr("$stock");
  const quantity = toNumericExpr("$quantity");
  const inventoryCount = toNumericExpr("$inventoryCount");
  const stockCount = toNumericExpr("$stockCount");

  const effectivePrice = {
    $cond: [
      {
        $and: [{ $gt: [salePrice, 0] }, { $gt: [basePrice, 0] }, { $lt: [salePrice, basePrice] }]
      },
      salePrice,
      {
        $cond: [
          {
            $and: [{ $gt: [basePrice, 0] }, { $gt: [discountPercent, 0] }, { $lt: [discountPercent, 100] }]
          },
          { $multiply: [basePrice, { $subtract: [1, { $divide: [discountPercent, 100] }] }] },
          basePrice
        ]
      }
    ]
  };

  const addFieldsStage = {
    $addFields: {
      effectivePrice,
      ratingValue: { $cond: [{ $gt: [ratingAvg, 0] }, ratingAvg, ratingNested] },
      reviewCountValue: { $cond: [{ $gt: [ratingCount, 0] }, ratingCount, ratingNestedCount] },
      soldCountValue: {
        $max: [purchaseCount, orderCount, nestedOrders, nestedPurchases]
      },
      viewCountValue: { $max: [viewCount, views] },
      likeCountValue: { $max: [likeCount, likes] },
      stockCountValue: { $max: [stock, quantity, inventoryCount, stockCount] },
      featuredScore: {
        $cond: [{ $or: [{ $eq: ["$isFeatured", true] }, { $eq: ["$featured", true] }] }, 1, 0]
      }
    }
  };

  const computedMatch: Record<string, unknown> = {};
  if (typeof state.ratingMin === "number" && state.ratingMin > 0) {
    computedMatch.ratingValue = { $gte: state.ratingMin };
  }
  if (typeof state.minPrice === "number" || typeof state.maxPrice === "number") {
    computedMatch.effectivePrice = {};
    if (typeof state.minPrice === "number") (computedMatch.effectivePrice as Record<string, unknown>).$gte = state.minPrice;
    if (typeof state.maxPrice === "number") (computedMatch.effectivePrice as Record<string, unknown>).$lte = state.maxPrice;
  }

  const sortStage: Record<string, 1 | -1> =
    state.sortValue === "price_asc"
      ? { effectivePrice: 1, createdAt: -1, _id: -1 }
      : state.sortValue === "price_desc"
        ? { effectivePrice: -1, createdAt: -1, _id: -1 }
        : state.sortValue === "top_rated"
          ? { ratingValue: -1, reviewCountValue: -1, soldCountValue: -1, createdAt: -1 }
          : state.sortValue === "popular"
            ? { soldCountValue: -1, viewCountValue: -1, likeCountValue: -1, createdAt: -1 }
            : state.sortValue === "best_match"
              ? { featuredScore: -1, soldCountValue: -1, ratingValue: -1, viewCountValue: -1, createdAt: -1 }
              : { createdAt: -1, _id: -1 };

  const skip = (state.page - 1) * state.limit;
  const pipeline: PipelineStage[] = [{ $match: baseMatch }, addFieldsStage as PipelineStage];

  if (Object.keys(computedMatch).length) {
    pipeline.push({ $match: computedMatch });
  }

  pipeline.push({ $sort: sortStage });
  pipeline.push({
    $facet: {
      metadata: [{ $count: "total" }],
      data: [{ $skip: skip }, { $limit: state.limit }, { $project: PRODUCT_CARD_PROJECT }]
    }
  });

  return pipeline;
};

const resolveSellerMapKey = (raw: unknown) => {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof mongoose.Types.ObjectId) return String(raw);
  return normalizeText((raw as { _id?: unknown })._id || raw);
};

export const buildProductCardContext = async (items: any[], userId?: string | null): Promise<ProductCardContext> => {
  const sellerIds = Array.from(
    new Set(items.map((item) => resolveSellerMapKey(item?.createdBy)).filter(Boolean))
  );
  const productIds = items
    .map((item) => item?._id)
    .filter((item) => item instanceof mongoose.Types.ObjectId || typeof item === "string");

  const [sellers, helpfulFeedback, legacyLikes] = await Promise.all([
    sellerIds.length
      ? User.find({ _id: { $in: sellerIds } })
          .select("_id name username displayName avatarUrl isVerified role")
          .lean()
      : Promise.resolve([] as any[]),
    userId && mongoose.Types.ObjectId.isValid(userId) && productIds.length
      ? ProductFeedback.find({
          productId: { $in: productIds },
          userId: new mongoose.Types.ObjectId(userId),
          feedback: "HELPFUL"
        })
          .select("productId")
          .lean()
      : Promise.resolve([] as any[]),
    userId && mongoose.Types.ObjectId.isValid(userId) && productIds.length
      ? ProductLike.find({
          productId: { $in: productIds },
          userId: new mongoose.Types.ObjectId(userId)
        })
          .select("productId")
          .lean()
      : Promise.resolve([] as any[])
  ]);

  const sellerMap = new Map<string, Record<string, unknown>>();
  for (const seller of sellers) {
    sellerMap.set(String(seller._id), seller as Record<string, unknown>);
  }

  const savedProductIds = new Set<string>();
  for (const item of [...helpfulFeedback, ...legacyLikes]) {
    savedProductIds.add(String(item.productId));
  }

  return { sellerMap, savedProductIds };
};

const resolveMediaGallery = (raw: any) => {
  const mediaArray = Array.isArray(raw?.media) ? sanitizeImageArray(raw.media) : [];
  const images = uniqueStrings([
    normalizeCoverImageUrl(raw?.cardImageUrl),
    resolveCoverImage(raw),
    normalizeCoverImageUrl(raw?.hoverImage),
    ...sanitizeImageArray(raw?.images),
    ...mediaArray,
    normalizeCoverImageUrl(raw?.image),
    normalizeCoverImageUrl(raw?.imageUrl),
    normalizeCoverImageUrl(raw?.thumbnail),
    normalizeCoverImageUrl(raw?.coverImage),
    normalizeCoverImageUrl(raw?.coverImageUrl)
  ]);
  const galleryPreview = images.slice(0, 4);
  const primaryImage = galleryPreview[0] || PRODUCT_FALLBACK;
  return {
    primaryImage,
    hoverImage: galleryPreview[1] || null,
    galleryPreview: galleryPreview.length ? galleryPreview : [primaryImage],
    thumbnail: primaryImage
  };
};

const resolveInstallmentPrice = (raw: any, currentPrice: number | null) => {
  const explicit = firstPositiveNumber(raw?.installmentPrice, raw?.installment?.price, raw?.installment?.monthlyPrice, raw?.benefits?.installment?.monthlyPrice);
  if (explicit !== null) return clampMoney(explicit);
  const months = [
    ...(Array.isArray(raw?.installment?.months) ? raw.installment.months : []),
    ...(Array.isArray(raw?.benefits?.installment?.months) ? raw.benefits.installment.months : [])
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!currentPrice || !months.length) return null;
  return clampMoney(currentPrice / Math.max(...months));
};

const normalizeStockState = (raw: any) => {
  const rawStatus = normalizeToken(raw?.stockStatus);
  const explicitStock = firstNumber(raw?.stockCount, raw?.stock, raw?.quantity, raw?.inventoryCount);
  const blocked = ["sold", "blocked"].includes(normalizeToken(raw?.status));
  const derivedFromAvailability = explicitStock === null;

  let stockCount = explicitStock !== null ? Math.max(0, Math.round(explicitStock)) : null;
  if (blocked) stockCount = 0;
  if (stockCount === null) {
    stockCount = resolveBoolean(raw?.inStock, !blocked) ? 1 : 0;
  }

  let stockStatus: StockStatus = "in_stock";
  if (rawStatus === "preorder" || resolveBoolean(raw?.preorder)) {
    stockStatus = "preorder";
  } else if (blocked || stockCount <= 0) {
    stockStatus = "out_of_stock";
  } else if (!derivedFromAvailability && stockCount <= 3) {
    stockStatus = "low_stock";
  }

  return { stockCount, stockStatus };
};

const resolveShippingLabel = (
  raw: any,
  locale: AppLocale,
  freeShipping: boolean,
  fastShipping: boolean,
  deliveryType: string
) => {
  const localized = resolveFirstLocalizedText(raw?.delivery, ["shippingLabel", "label", "promise"], locale, "");
  if (localized) return localized;
  const copy = getProductCopy(locale);
  const cardCopy = PRODUCT_CARD_COPY[locale];
  if (deliveryType === "pickup") return cardCopy.shippingPickup;
  if (freeShipping && fastShipping) return cardCopy.shippingFastFree;
  if (freeShipping) return copy.freeDelivery || cardCopy.shippingFree;
  if (fastShipping) return cardCopy.shippingFast;
  return copy.paidDelivery || cardCopy.shippingStandard;
};

const resolveDisplaySubtitle = (
  raw: any,
  locale: AppLocale,
  categoryLabel: string | null,
  subcategoryLabel: string | null,
  brandLabel: string | null,
  shippingLabel: string
) => {
  const localized = resolveFirstLocalizedText(raw, ["subtitle", "specSummary", "summary"], locale, "");
  if (localized) return localized;
  return [brandLabel, subcategoryLabel || categoryLabel, shippingLabel]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" • ");
};

const resolveSellerType = (raw: any, seller: Record<string, unknown> | null) => {
  const explicit = normalizeToken(raw?.seller?.type || raw?.vendor?.type);
  if (explicit) return explicit;
  const role = normalizeToken(seller?.role);
  if (role) return role;
  if (resolveBoolean(raw?.seller?.isOfficial) || resolveBoolean(seller?.isVerified)) return "official";
  return "seller";
};

const buildBadgeList = (
  raw: any,
  locale: AppLocale,
  flags: { isNew: boolean; isBestSeller: boolean; isFeatured: boolean; isDiscounted: boolean }
) => {
  const copy = PRODUCT_CARD_COPY[locale];
  const items: Array<{ key: string; label: string; tone: BadgeTone }> = [];
  const seen = new Set<string>();
  const pushBadge = (key: string, label: string, tone: BadgeTone) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push({ key, label, tone });
  };

  if (flags.isNew) pushBadge("new", copy.badgeNew, "success");
  if (flags.isBestSeller) pushBadge("best_seller", copy.badgeBestSeller, "accent");
  if (flags.isFeatured) pushBadge("featured", copy.badgeFeatured, "accent");
  if (flags.isDiscounted) pushBadge("discount", copy.badgeDiscount, "sale");

  const rawBadges = resolveLocalizedArrayField(
    raw,
    "badges",
    locale,
    Array.isArray(raw?.badges) ? raw.badges.map((entry: unknown) => normalizeText(entry)).filter(Boolean) : []
  );
  for (const rawBadge of rawBadges) {
    const key = normalizeToken(rawBadge);
    pushBadge(key, rawBadge, "neutral");
  }
  return items;
};

export const serializeProductCard = (
  raw: any,
  locale?: AppLocale,
  context?: ProductCardContext
): ProductCardPayload => {
  const activeLocale = locale || "uz";
  const id = String(raw?._id || raw?.id || raw?.slug || "");
  const slug = normalizeText(raw?.slug) || id;
  const route = `/products/${slug}`;

  const sellerFromMap = context?.sellerMap?.get(resolveSellerMapKey(raw?.createdBy)) || null;
  const sellerSource = (raw?.seller as Record<string, unknown>) || {};
  const creator = sellerFromMap || (raw?.createdBy && typeof raw.createdBy === "object" ? (raw.createdBy as Record<string, unknown>) : null);

  const categoryMeta = buildCategoryMeta(raw?.category, activeLocale, "products");
  const subcategoryRaw = raw?.subCategory ?? raw?.subcategory ?? raw?.subcategorySlug ?? null;
  const subcategoryMeta = subcategoryRaw ? buildCategoryMeta(subcategoryRaw, activeLocale, "products") : null;
  const brandLabel =
    resolveFirstLocalizedText(raw, ["brand"], activeLocale, "") ||
    resolveFirstLocalizedText(raw?.seller as Record<string, unknown>, ["brand"], activeLocale, "") ||
    null;

  const title = resolveFirstLocalizedText(raw, ["title"], activeLocale, normalizeText(raw?.title || raw?.name || "Product"));
  const shortTitle = resolveFirstLocalizedText(raw, ["shortTitle"], activeLocale, truncateText(title, 64));

  const ratingAverage = Number(firstNumber(raw?.ratingAvg, raw?.rating?.avg) || 0);
  const reviewCount = Math.max(0, Math.round(firstNumber(raw?.ratingCount, raw?.rating?.count) || 0));
  const soldCount = Math.max(
    0,
    Math.round(firstNumber(raw?.purchaseCount, raw?.orders, raw?.stats?.orders, raw?.stats?.purchases, raw?.seller?.sales) || 0)
  );
  const popularityCount = Math.max(
    soldCount,
    Math.round((firstNumber(raw?.popularityCount) || 0) + (firstNumber(raw?.viewCount, raw?.views) || 0) + (firstNumber(raw?.likeCount, raw?.likes) || 0))
  );

  const saleMeta = resolveSaleMeta({
    basePrice: raw?.price,
    salePrice: raw?.salePrice,
    discountPercent: raw?.discountPercent,
    oldPrice: raw?.oldPrice
  });
  const currentPrice = clampMoney(saleMeta.price);
  const oldPrice = clampMoney(saleMeta.originalPrice);
  const discountPercent = Math.max(0, Math.round(Number(saleMeta.discountPercent || 0)));
  const currency = normalizeText(raw?.currency) || "UZS";

  const media = resolveMediaGallery(raw);
  const { stockCount, stockStatus } = normalizeStockState(raw);
  const freeShipping = resolveBoolean(raw?.freeShipping, firstNumber(raw?.delivery?.fee, raw?.shippingFee) === 0);
  const deliveryType = normalizeToken(raw?.deliveryType || raw?.delivery?.type || (resolveBoolean(raw?.fastShipping) ? "fast" : "standard")) || "standard";
  const fastShipping = resolveBoolean(
    raw?.fastShipping,
    /fast|express|same[-\s]?day|next[-\s]?day|priority/i.test(normalizeText(raw?.deliveryType || raw?.delivery?.type))
  );
  const shippingLabel = resolveShippingLabel(raw, activeLocale, freeShipping, fastShipping, deliveryType);
  const subtitle = resolveDisplaySubtitle(
    raw,
    activeLocale,
    categoryMeta?.displayName || null,
    subcategoryMeta?.displayName || null,
    brandLabel,
    shippingLabel
  );

  const sellerName =
    resolveFirstLocalizedText(sellerSource, ["name"], activeLocale, "") ||
    normalizeText(creator?.displayName || creator?.name || creator?.username) ||
    getProductCopy(activeLocale).sellerName;
  const sellerVerified = resolveBoolean(
    raw?.seller?.verified ?? raw?.seller?.isOfficial ?? raw?.verifiedSeller ?? creator?.isVerified,
    false
  );
  const returnAvailable = resolveBoolean(
    raw?.returnAvailable ?? raw?.policies?.returnAvailable ?? raw?.delivery?.freeReturn,
    Boolean(resolveFirstLocalizedText(raw?.policies, ["returnWindow"], activeLocale, ""))
  );
  const warrantyAvailable = resolveBoolean(
    raw?.warrantyAvailable ?? raw?.warranty,
    Boolean(resolveFirstLocalizedText(raw?.policies, ["warranty"], activeLocale, ""))
  );

  const createdAt = raw?.createdAt ? new Date(raw.createdAt) : null;
  const isNew = resolveBoolean(raw?.isNew, Boolean(createdAt && Date.now() - createdAt.getTime() <= 1000 * 60 * 60 * 24 * 21));
  const isBestSeller = resolveBoolean(raw?.isBestSeller ?? raw?.bestSeller, soldCount >= 12);
  const isFeatured = resolveBoolean(raw?.isFeatured ?? raw?.featured, false);
  const isDiscounted = Boolean(saleMeta.isSale);
  const badgeList = buildBadgeList(raw, activeLocale, { isNew, isBestSeller, isFeatured, isDiscounted });
  const canTransact = normalizeToken(raw?.status || "ACTIVE") === "active" && stockStatus !== "out_of_stock";
  const stockStatusLabel = PRODUCT_CARD_COPY[activeLocale][
    stockStatus === "low_stock" ? "stockLow" : stockStatus === "out_of_stock" ? "stockOut" : stockStatus === "preorder" ? "stockPreorder" : "stockIn"
  ];

  return {
    id,
    slug,
    type: "product",
    route,
    identity: {
      id,
      slug,
      category: categoryMeta?.categorySlug || normalizeMarketplaceCategory(raw?.category, "products") || null,
      subcategory: subcategoryMeta?.categorySlug || normalizeMarketplaceCategory(subcategoryRaw, "products") || null,
      brand: brandLabel ? normalizeToken(brandLabel) : null
    },
    display: {
      locale: activeLocale,
      title,
      shortTitle,
      subtitle,
      values: {
        category: categoryMeta?.displayName || normalizeText(raw?.category) || null,
        subcategory: subcategoryMeta?.displayName || normalizeText(subcategoryRaw) || null,
        brand: brandLabel,
        condition: normalizeText(raw?.condition) || null,
        shippingLabel,
        stockStatus: stockStatusLabel
      }
    },
    media,
    pricing: {
      currentPrice,
      oldPrice,
      discountPercent,
      currency,
      installmentPrice: resolveInstallmentPrice(raw, currentPrice)
    },
    trust: {
      ratingAverage,
      reviewCount,
      soldCount,
      popularityCount,
      verifiedSeller: sellerVerified,
      returnAvailable,
      warrantyAvailable
    },
    logistics: {
      stockCount,
      stockStatus,
      deliveryType,
      shippingLabel,
      fastShipping,
      freeShipping
    },
    badges: {
      isNew,
      isBestSeller,
      isFeatured,
      isDiscounted,
      list: badgeList
    },
    seller: {
      sellerId: normalizeText(creator?._id || raw?.seller?._id || raw?.vendor?._id) || null,
      sellerName,
      sellerVerified,
      sellerType: resolveSellerType(raw, creator)
    },
    actions: {
      canAddToCart: canTransact && currentPrice !== null,
      canBuyNow: canTransact && currentPrice !== null,
      isSavedByCurrentUser: Boolean(context?.savedProductIds?.has(id))
    },
    meta: {
      locale: activeLocale,
      status: normalizeText(raw?.status || "ACTIVE") || "ACTIVE",
      createdAt: createdAt ? createdAt.toISOString() : null,
      updatedAt: raw?.updatedAt ? new Date(raw.updatedAt).toISOString() : createdAt ? createdAt.toISOString() : null
    }
  };
};

export const serializeProductCards = (items: any[], locale?: AppLocale, context?: ProductCardContext) =>
  items.map((item) => serializeProductCard(item, locale, context));
