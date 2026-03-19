import { Request, Response } from "express";
import { Product } from "../models/Product";
import { parsePositiveInt } from "../utils/pagination";
import mongoose from "mongoose";
import path from "path";
import { ensureAbsoluteUrl } from "../utils/imageHelpers";
import { slugify } from "../utils/slug";
import {
  isLocalImageUrl,
  isRandomUnsplashUrl,
  localImageExists,
  resolveCoverImage,
  sanitizeImageArray
} from "../utils/resolveCoverImage";
import { resolveSaleMeta } from "../services/listingSelector";
import { findProductByIdentifier } from "../services/productLookup";
import { buildCategoryMeta, normalizeMarketplaceCategory } from "../services/categoryTaxonomy";
import { buildRecommendationModulesSafe, recordRecommendationSignal } from "../services/recommendationEngine";
import { buildListingUiMeta } from "../services/sharedFilters";
import {
  formatLocaleDateRange,
  getProductCopy,
  interpolateTemplate,
  localizeKeywordList,
  localizeKeyword,
  resolveLocalizedArrayField,
  resolveLocalizedTextField
} from "../services/localizedContent";
import { respondAuthRequired } from "../utils/controllerResponses";
import {
  buildProductCardContext,
  buildProductListingPipeline,
  createProductListingQueryState,
  serializeProductCard,
  serializeProductCards
} from "../services/productCard";

type DeliveryInfo = {
  type: string;
  fee: number;
  estimated: string;
  promise: string;
  origin: string;
  freeReturn: boolean;
  address?: string;
};

type SellerInfo = {
  name: string;
  rating: number;
  reviewCount: number;
  sales: number;
  contact: string;
  isOfficial: boolean;
  badges: string[];
};

const DUPLICATE_GUARD_WINDOW_MS = Number(process.env.DUPLICATE_GUARD_WINDOW_MS || 15_000);
const PRODUCT_FALLBACK = ensureAbsoluteUrl("/images/fallback-product.png") || "http://localhost:5001/images/fallback-product.png";

const defaultSeller: SellerInfo = {
  name: "UniServe Mall",
  rating: 4.7,
  reviewCount: 1240,
  sales: 3200,
  contact: "+998 71 123 45 67",
  isOfficial: true,
  badges: []
};

const buildBadges = (p: any, locale?: Request["locale"]) => {
  const copy = getProductCopy(locale);
  const localized = resolveLocalizedArrayField(p, "badges", locale, []);
  if (localized.length) return localized;
  const rawBadges = Array.isArray(p.badges) ? p.badges.filter(Boolean) : [];
  if (rawBadges.length) return localizeKeywordList(rawBadges, locale);
  return [...copy.defaultBadges, copy.packagingBadge];
};

const buildDeliveryInfo = (p: any, locale?: Request["locale"]): DeliveryInfo => {
  const copy = getProductCopy(locale);
  const estimated = p.delivery?.estimated || formatLocaleDateRange(locale, 1, 2);
  return {
    type: p.delivery?.type || "fast",
    fee: p.delivery?.fee ?? 0,
    estimated,
    promise: resolveLocalizedTextField(p.delivery, "promise", locale, p.delivery?.promise || copy.deliveryPromise),
    origin: resolveLocalizedTextField(p.delivery, "origin", locale, p.delivery?.origin || copy.origin),
    freeReturn: p.delivery?.freeReturn ?? true,
    address: p.delivery?.address
  };
};

const buildSellerInfo = (p: any, locale?: Request["locale"]): SellerInfo => {
  const copy = getProductCopy(locale);
  const seller = p.seller || {};
  return {
    name: resolveLocalizedTextField(seller, "name", locale, seller.name || p.vendor?.name || copy.sellerName),
    rating: seller.rating ?? p.rating?.avg ?? defaultSeller.rating,
    reviewCount: seller.reviewCount ?? p.rating?.count ?? defaultSeller.reviewCount,
    sales: seller.sales ?? p.stats?.purchases ?? defaultSeller.sales,
    contact: seller.contact || defaultSeller.contact,
    isOfficial: seller.isOfficial ?? defaultSeller.isOfficial,
    badges: localizeKeywordList(resolveLocalizedArrayField(seller, "badges", locale, seller.badges || defaultSeller.badges), locale)
  };
};

const buildBenefits = (p: any, delivery: DeliveryInfo, locale?: Request["locale"]) => {
  const copy = getProductCopy(locale);
  return {
  coupons:
    p.benefits?.coupons ||
    [
      { label: copy.couponLabel, description: copy.couponDescription },
      { label: copy.bonusLabel, description: copy.bonusDescription }
    ],
  installment:
    p.benefits?.installment || { months: [3, 6, 12], partner: copy.installmentPartner, minPrice: 100000 },
  delivery: resolveLocalizedTextField(
    p.benefits,
    "delivery",
    locale,
    p.benefits?.delivery || (delivery.fee === 0 ? copy.freeDelivery : copy.paidDelivery)
  )
};
};

const buildPolicies = (p: any, locale?: Request["locale"]) => {
  const copy = getProductCopy(locale);
  return {
    returnWindow: resolveLocalizedTextField(p.policies, "returnWindow", locale, p.policies?.returnWindow || copy.returnWindow),
    exchange: resolveLocalizedTextField(p.policies, "exchange", locale, p.policies?.exchange || copy.exchange),
    warranty: resolveLocalizedTextField(p.policies, "warranty", locale, p.policies?.warranty || copy.warranty),
    support: resolveLocalizedTextField(p.policies, "support", locale, p.policies?.support || copy.support)
  };
};

const buildSpecs = (p: any, locale?: Request["locale"]) => {
  const copy = getProductCopy(locale);
  const baseSpecs = [
    { label: copy.specCategory, value: buildCategoryMeta(p.category, locale, "products")?.displayName || p.category || copy.genericCategory },
    { label: copy.specBrand, value: p.brand || copy.selectedBrand },
    { label: copy.specCondition, value: p.condition || copy.conditionNew }
  ];
  const merged = [...baseSpecs, ...(p.specs || [])];
  const seen = new Set<string>();
  return merged.filter((spec) => {
    if (!spec.label) return false;
    const key = spec.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(spec.value);
  });
};

const buildOptions = (p: any, locale?: Request["locale"]) => {
  const copy = getProductCopy(locale);
  return (
    p.options || [
      { name: copy.colorName, values: [copy.white, copy.black], defaultValue: copy.white },
      { name: copy.sizeName, values: ["S", "M", "L"], defaultValue: "M" }
    ]
  );
};

const buildHighlights = (name: string, delivery: DeliveryInfo, seller: SellerInfo, p: any, locale?: Request["locale"]) => {
  const copy = getProductCopy(locale);
  const localized = resolveLocalizedArrayField(p, "highlights", locale, []);
  if (localized.length) return localized;
  return [
    interpolateTemplate(copy.highlightDelivery, { name, estimated: delivery.estimated }),
    interpolateTemplate(copy.highlightOriginal, { seller: seller.name }),
    p.price ? interpolateTemplate(copy.highlightPrice, { price: `${p.price} ${p.currency || "UZS"}` }) : copy.highlightPricePending
  ];
};

const buildReviewSummary = (p: any) => {
  const avg = Number(p.rating?.avg || 0);
  const count = Number(p.rating?.count || 0);
  return {
    average: avg,
    count,
    photoCount: p.reviewSummary?.photoCount ?? Math.max(0, Math.round(count * 0.35))
  };
};

const buildDetailSections = (
  highlights: string[],
  specs: { label: string; value: string }[],
  delivery: DeliveryInfo,
  seller: SellerInfo,
  policies: { returnWindow: string; exchange: string; warranty: string; support: string },
  locale?: Request["locale"]
) => {
  const copy = getProductCopy(locale);
  return [
  { title: copy.sectionOverview, items: highlights },
  { title: copy.sectionSpecs, items: specs.map((s) => `${s.label}: ${s.value}`) },
  {
    title: copy.sectionDelivery,
    items: [
      `${copy.deliveryServiceLabel}: ${localizeKeyword(delivery.type, locale)}`,
      `${copy.deliveryPriceLabel}: ${delivery.fee ? `${delivery.fee} UZS` : copy.freeDelivery}`,
      `${copy.deliveryDateLabel}: ${delivery.estimated}`,
      delivery.promise
    ]
  },
  {
    title: copy.sectionSeller,
    items: [
      `${copy.sellerLabel}: ${seller.name}`,
      `${copy.sellerRatingLabel}: ${seller.rating} (${seller.reviewCount})`,
      `${copy.sellerSalesLabel}: ${seller.sales}`,
      `${copy.sellerContactLabel}: ${seller.contact}`
    ]
  },
  { title: copy.sectionPolicies, items: [policies.returnWindow, policies.exchange, policies.warranty, policies.support] }
];
};

const normalizeImages = (p: any): string[] => {
  return sanitizeImageArray(p?.images);
};

const normalizeText = (value: unknown): string => String(value || "").trim().toLowerCase();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toAppLocale = (locale?: Request["locale"]) => (locale === "en" || locale === "ru" || locale === "ko" ? locale : "uz");

const buildUniqueProductSlug = async (title: string) => {
  const base = slugify(title) || "product";
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await Product.find({ slug: { $regex: `^${escaped}(?:-\\d+)?$`, $options: "i" } })
    .select("slug")
    .lean();
  const used = new Set(
    existing
      .map((item: any) => String(item.slug || "").toLowerCase())
      .filter(Boolean)
  );
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
};

const LEGACY_PRODUCT_SLUG_MAP: Record<string, string> = {
  "pc-1": "office-pc",
  "pc-2": "mini-pc",
  "pc-3": "gaming-pc",
  "game-1": "gaming-pc",
  "mobile-1": "mobile-2",
  "mobile-3": "mobile-2",
  "kids-cloth-1": "kiyim-kechak-product-1",
  "ready-1": "tayyor-taom-box",
  "ready-2": "tayyor-salat",
  "ready-3": "tayyor-shorva",
  "cam-1": "camcorder-4k",
  "frag-1": "atir",
  "skin-1": "yuz-kremi",
  "car-1": "sedan-2020",
  "carpart-1": "tormoz-diski",
  "tech-1": "notebook-i7",
  "vac-1": "chang-yutkich",
  "vac-2": "maishiy-uskunalar-product-1",
  "wash-1": "kir-yuvish-mashinasi",
  "oth-2": "oziq-ovqat-product-1",
  "men-1": "erkaklar-t-shirt",
  "women-1": "ayollar-bluzka"
};

const buildIdentifierTokens = (identifier: string): string[] =>
  identifier
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token && !/^\\d+$/.test(token));

const inferLegacyCategory = (tokens: string[]): string | null => {
  if (!tokens.length) return null;
  const joined = tokens.join(" ");
  if (tokens.includes("vac") || joined.includes("vacuum")) return "maishiy-uskunalar";
  if (tokens.includes("kids") || tokens.includes("cloth") || joined.includes("clothes")) return "kiyim-kechak";
  if (tokens.includes("mobile") || tokens.includes("ready") || tokens.includes("oth") || tokens.includes("food")) {
    return "oziq-ovqat";
  }
  if (tokens.includes("pc") || tokens.includes("game") || tokens.includes("cam") || joined.includes("tech")) return "elektronika";
  return null;
};

const findProductByLegacyIdentifier = async (identifier: string) => {
  const alias = LEGACY_PRODUCT_SLUG_MAP[identifier.toLowerCase()];
  if (alias) {
    const byAlias = await Product.findOne({ slug: alias }).populate("createdBy", "name username role avatarUrl");
    if (byAlias) return byAlias;
  }

  const tokens = buildIdentifierTokens(identifier);
  if (!tokens.length) return null;
  const pattern = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (!pattern) return null;

  const candidates = await Product.find({
    $or: [{ slug: { $regex: pattern, $options: "i" } }, { title: { $regex: pattern, $options: "i" } }]
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("createdBy", "name username role avatarUrl");

  if (!candidates.length) return null;

  const scored = candidates
    .map((item) => {
      const hay = `${String(item.slug || "")} ${String(item.title || "")}`.toLowerCase();
      const score = tokens.reduce((acc, token) => (hay.includes(token) ? acc + 1 : acc), 0);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) return scored[0].item;

  const inferredCategory = inferLegacyCategory(tokens);
  if (inferredCategory) {
    const byCategory = await Product.findOne({ category: inferredCategory, status: "ACTIVE" })
      .sort({ createdAt: -1 })
      .populate("createdBy", "name username role avatarUrl");
    if (byCategory) return byCategory;
  }

  return await Product.findOne({ status: "ACTIVE" })
    .sort({ createdAt: -1 })
    .populate("createdBy", "name username role avatarUrl");
};

export const toDetailDto = (p: any, locale?: Request["locale"]) => {
  const name = resolveLocalizedTextField(p, "title", locale, p.name || p.title || "");
  const price = Number(p.price || 0);
  const oldPrice = p.oldPrice ?? (price ? Math.round(price * 1.12) : undefined);
  const rating = p.rating || { avg: 0, count: 0 };
  const ratingCount = Number(p.ratingCount ?? rating.count ?? 0);
  const likes = Number(p?.likeCount ?? p?.stats?.likes ?? p.likes ?? 0);
  const views = Number(p?.viewCount ?? p?.stats?.views ?? p.views ?? 0);
  const orders = Number(p?.purchaseCount ?? p?.stats?.orders ?? p?.stats?.purchases ?? p.orders ?? p.purchases ?? 0);
  const stats = { views, likes, orders, purchases: orders };
  const saleMeta = resolveSaleMeta({
    basePrice: price,
    salePrice: p.salePrice,
    discountPercent: p.discountPercent,
    oldPrice: p.oldPrice
  });
  const delivery = buildDeliveryInfo(p, locale);
  const seller = buildSellerInfo(p, locale);
  const badges = buildBadges(p, locale);
  const benefits = buildBenefits(p, delivery, locale);
  const specs = buildSpecs(p, locale);
  const highlights = buildHighlights(name, delivery, seller, p, locale);
  const policies = buildPolicies(p, locale);
  const options = buildOptions(p, locale);
  const detailSections = buildDetailSections(highlights, specs, delivery, seller, policies, locale);
  const reviewSummary = buildReviewSummary(p);
  const images = normalizeImages(p);
  const coverImageUrl = resolveCoverImage(p);
  const primaryImage = coverImageUrl || images[0] || PRODUCT_FALLBACK;
  const gallery = Array.from(new Set([primaryImage, ...images].filter(Boolean)));
  const creator = p?.createdBy && typeof p.createdBy === "object" ? p.createdBy : null;
  const agent = creator
    ? {
        id: creator._id?.toString?.() || String(creator._id || ""),
        name: creator.name || seller.name || getProductCopy(locale).sellerName,
        avatarUrl: creator.avatarUrl || null,
        rating: Number(seller.rating || 0)
      }
    : undefined;
  const salePrice = saleMeta.salePrice ?? (Number.isFinite(price) ? price : null);
  const discountPercent = saleMeta.discountPercent ?? 0;
  const isOnSale = saleMeta.isSale;
  const originalPrice = saleMeta.originalPrice ?? oldPrice ?? (Number.isFinite(price) ? price : null);
  const categoryMeta = buildCategoryMeta(p.category, locale, "products");
  const stockCount = Number(p.stock ?? p.quantity ?? 24) || 0;
  const shippingInfo = {
    deliveryType: delivery.type,
    deliveryLabel: localizeKeyword(delivery.type, locale),
    estimated: delivery.estimated,
    promise: delivery.promise,
    origin: delivery.origin,
    fee: Number(delivery.fee || 0),
    freeDelivery: Number(delivery.fee || 0) === 0,
    freeReturn: Boolean(delivery.freeReturn),
    fastShipping: String(delivery.type || "").toLowerCase() === "fast"
  };
  const returnPolicy = {
    summary: policies.returnWindow,
    exchange: policies.exchange,
    warranty: policies.warranty,
    support: policies.support
  };
  const sellerSummary = {
    id: agent?.id || creator?._id?.toString?.() || String(creator?._id || ""),
    name: seller.name,
    avatarUrl: agent?.avatarUrl || creator?.avatarUrl || null,
    rating: Number(seller.rating || 0),
    reviewCount: Number(seller.reviewCount || 0),
    verified: Boolean(seller.isOfficial),
    contact: seller.contact || null,
    location: p.vendor?.location || null
  };
  const card = serializeProductCard(p, toAppLocale(locale));
  const shortDescription = resolveLocalizedTextField(
    p,
    "shortDescription",
    locale,
    resolveLocalizedTextField(p, "summary", locale, p.summary || p.description || "")
  );

  return {
    _id: p._id?.toString?.() ?? p.id ?? p.slug,
    id: p._id?.toString?.() ?? p.slug ?? p.id,
    slug: p.slug || null,
    type: "product",
    title: name,
    name,
    description: resolveLocalizedTextField(p, "description", locale, p.description || ""),
    shortDescription,
    fullDescription: resolveLocalizedTextField(p, "description", locale, p.description || ""),
    price,
    currentPrice: salePrice ?? price,
    salePrice,
    originalPrice,
    discountPercent,
    isOnSale,
    isSale: isOnSale,
    currency: p.currency || "UZS",
    oldPrice: originalPrice,
    thumbnail: primaryImage,
    image: primaryImage,
    imageUrl: primaryImage,
    primaryImage,
    coverImage: primaryImage,
    cardImageUrl: primaryImage,
    coverImageUrl: primaryImage,
    images: gallery,
    gallery,
    rating,
    ratingAvg: Number(p.ratingAvg ?? rating.avg ?? 0),
    ratingCount: Number.isFinite(ratingCount) ? ratingCount : 0,
    reviewCount: Number.isFinite(ratingCount) ? ratingCount : 0,
    reviewSummary,
    likes,
    views,
    orders,
    soldCount: orders,
    likeCount: likes,
    viewCount: views,
    purchaseCount: orders,
    stats,
    category: normalizeMarketplaceCategory(p.category, "products") || p.category,
    categoryRaw: p.category,
    categoryDisplay: categoryMeta?.displayName || p.category || null,
    topLevelCategory: categoryMeta?.mainCategory || "products",
    categorySlug: categoryMeta?.categorySlug || null,
    categoryMeta,
    subCategory: p.subCategory,
    subcategoryDisplay: buildCategoryMeta(p.subCategory, locale, "products")?.displayName || p.subCategory || null,
    brand: p.brand,
    condition: p.condition || getProductCopy(locale).conditionNew,
    size: p.size,
    season: p.season,
    audience: p.audience,
    vendor: p.vendor || p.createdBy,
    agent,
    badges,
    highlights,
    delivery,
    seller,
    sellerSummary,
    benefits,
    specs,
    options,
    policies,
    shippingInfo,
    returnPolicy,
    stock: stockCount,
    stockCount,
    stockStatus: card.display.values.stockStatus,
    createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
    updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
    detailSections,
    card
  };
};

const fetchProductCardPage = async (
  req: Request,
  options?: { defaultLimit?: number; forcedSort?: string; baseMatch?: Record<string, unknown> }
) => {
  const state = createProductListingQueryState(req.query as Record<string, unknown>, {
    defaultLimit: options?.defaultLimit ?? 24,
    maxLimit: 50,
    defaultSort: options?.forcedSort || "newest"
  });
  if (options?.forcedSort) state.sortValue = options.forcedSort;

  const [result] = await Product.aggregate(buildProductListingPipeline(state, { baseMatch: options?.baseMatch }));
  const rawItems = Array.isArray(result?.data) ? result.data : [];
  const total = Number(result?.metadata?.[0]?.total || 0);
  const context = await buildProductCardContext(rawItems, req.user?._id || null);

  return {
    page: state.page,
    limit: state.limit,
    total,
    totalPages: Math.max(Math.ceil(total / state.limit), 1),
    categoryKey: state.subcategoryKey || state.categoryKey || null,
    sortValue: state.sortValue,
    products: serializeProductCards(rawItems, req.locale, context)
  };
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const { title, description, price, currency, images, category, coverImageUrl, imageUrl, slug } = req.body;
    if (!title || !price) {
      return res.status(400).json({ message: "title and price required" });
    }
    if (!Array.isArray(images) || images.length < 3 || images.length > 20) {
      return res.status(400).json({ message: "images must contain between 3 and 20 items" });
    }
    if (
      isRandomUnsplashUrl(coverImageUrl) ||
      isRandomUnsplashUrl(imageUrl) ||
      images.some((img: unknown) => isRandomUnsplashUrl(typeof img === "string" ? img : (img as any)?.url))
    ) {
      return res.status(400).json({ message: "Random Unsplash image URLs are not allowed" });
    }

    const numericPrice = Number(price);
    const normalizedCategory = normalizeMarketplaceCategory(category, "products") || normalizeText(category);
    const windowStart = new Date(Date.now() - DUPLICATE_GUARD_WINDOW_MS);
    const recentProducts = await Product.find({
      createdBy: req.user._id,
      createdAt: { $gte: windowStart }
    })
      .select("title category price createdAt")
      .lean();

    const normalizedTitle = normalizeText(title);
    const duplicate = recentProducts.find(
      (item) =>
        normalizeText(item.title) === normalizedTitle &&
        normalizeMarketplaceCategory(item.category, "products") === normalizedCategory &&
        Number(item.price) === numericPrice
    );
    if (duplicate) {
      return res.status(409).json({ message: "Duplicate product creation blocked" });
    }

    const finalImages = sanitizeImageArray(images);
    const finalCoverImageUrl = resolveCoverImage({ coverImageUrl, imageUrl, images: finalImages }) || PRODUCT_FALLBACK;
    if (isLocalImageUrl(finalCoverImageUrl) && !localImageExists(finalCoverImageUrl)) {
      return res.status(400).json({ message: "coverImageUrl points to a missing local file" });
    }
    const finalSlug = typeof slug === "string" && slug.trim() ? slugify(slug) : await buildUniqueProductSlug(title);

    const product = await Product.create({
      title,
      slug: finalSlug || undefined,
      description,
      price,
      currency: currency || "USD",
      images: finalImages.map((img: string) => ensureAbsoluteUrl(img) || img),
      category: normalizedCategory,
      coverImageUrl: finalCoverImageUrl,
      cardImageUrl: finalCoverImageUrl,
      createdBy: req.user._id
    });
    return res.status(201).json({ product: toDetailDto(product, req.locale) });
  } catch (err) {
    console.error("createProduct error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listProducts = async (req: Request, res: Response) => {
  try {
    const result = await fetchProductCardPage(req, { defaultLimit: 24 });
    return res.json({
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      products: result.products,
      uiMeta: buildListingUiMeta(req, "products", {
        categoryKey: result.categoryKey,
        resultCount: result.total,
        sortValue: result.sortValue
      })
    });
  } catch (err) {
    console.error("listProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const productDetail = async (req: Request, res: Response) => {
  try {
    const identifier = String(req.params.identifier || req.params.id || "").trim();
    if (!identifier) return res.status(400).json({ message: "Product identifier is required" });
    const baseProduct = await findProductByIdentifier(identifier);
    const product = baseProduct
      ? await baseProduct.populate("createdBy", "name username role avatarUrl")
      : null;
    if (!product) return res.status(404).json({ message: "Product not found" });
    const dto = toDetailDto(product, req.locale);
    const recommendations = await buildRecommendationModulesSafe({
      surface: "DETAIL",
      locale: req.locale,
      userId: req.user?._id || null,
      entityType: "PRODUCT",
      entityId: String((product as any)._id || ""),
      entityIdentifier: String((product as any).slug || (product as any)._id || ""),
      categoryKey: dto.category || null,
      limitPerModule: 4
    }, "product.detail.recommendations");
    await recordRecommendationSignal({
      userId: req.user?._id || null,
      entityType: "PRODUCT",
      entityId: String((product as any)._id || ""),
      entityIdentifier: String((product as any).slug || (product as any)._id || ""),
      action: "VIEW",
      categoryKey: dto.category || null,
      locale: req.locale
    }).catch(() => null);
    return res.json({ ...dto, recommendations });
  } catch (err) {
    console.error("productDetail error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const productStat = async (req: Request, res: Response) => {
  try {
    const identifier = String(req.params.id || req.params.identifier || "").trim();
    const { action } = req.params;
    if (action !== "view" && !req.user) {
      return res.status(401).json({ message: "Login required" });
    }

    if (!identifier) return res.status(400).json({ message: "Product identifier is required" });
    const product = await findProductByIdentifier(identifier);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const stats = {
      views: Number(product.viewCount ?? product.views ?? 0),
      likes: Number(product.likeCount ?? product.likes ?? 0),
      purchases: Number(product.purchaseCount ?? product.orders ?? 0)
    };
    if (action === "view") stats.views = (stats.views || 0) + 1;
    if (action === "like") stats.likes = (stats.likes || 0) + 1;
    if (action === "purchase") stats.purchases = (stats.purchases || 0) + 1;

    product.viewCount = stats.views || 0;
    product.likeCount = stats.likes || 0;
    product.purchaseCount = stats.purchases || 0;
    product.views = stats.views || 0;
    product.likes = stats.likes || 0;
    product.orders = stats.purchases || 0;
    await product.save();
    return res.json({ stats });
  } catch (err) {
    console.error("productStat error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const myProducts = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const products = await Product.find({ createdBy: req.user._id }).lean();
    return res.json({ products: products.map((product) => toDetailDto(product, req.locale)) });
  } catch (err) {
    console.error("myProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateProductStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const { id } = req.params;
    const { status } = req.body;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (String(product.createdBy) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }
    product.status = status;
    await product.save();
    return res.json({ product: toDetailDto(product, req.locale) });
  } catch (err) {
    console.error("updateProductStatus error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getPopularProducts = async (req: Request, res: Response) => {
  try {
    const result = await fetchProductCardPage(req, { defaultLimit: 8, forcedSort: "popular" });

    return res.json({
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      items: result.products
    });
  } catch (err) {
    console.error("getPopularProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getTrendingProducts = async (req: Request, res: Response) => {
  try {
    const result = await fetchProductCardPage(req, { defaultLimit: 9, forcedSort: "popular" });

    return res.json({
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      items: result.products
    });
  } catch (err) {
    console.error("getTrendingProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const uploadProductImagesHandler = async (req: Request, res: Response) => {
  try {
    const files = (req.files as any[]) || [];
    if (!files.length) {
      return res.status(400).json({ message: "Hech qanday rasm yuklanmadi" });
    }
    const urls = files.map((file: any) => {
      const relative = `/static/products/${path.basename(file.filename || file.path || file.originalname)}`;
      return ensureAbsoluteUrl(relative) || relative;
    });
    return res.status(201).json({ urls, count: urls.length });
  } catch (err) {
    console.error("uploadProductImagesHandler error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
