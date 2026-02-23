import { Request, Response } from "express";
import { Product } from "../models/Product";
import { parsePositiveInt } from "../utils/pagination";
import mongoose from "mongoose";
import dayjs from "dayjs";
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

const formatDateRange = (fromDays = 1, toDays = 2) =>
  `${dayjs().add(fromDays, "day").format("MMM D")} - ${dayjs().add(toDays, "day").format("MMM D")}`;

const DUPLICATE_GUARD_WINDOW_MS = Number(process.env.DUPLICATE_GUARD_WINDOW_MS || 15_000);
const PRODUCT_FALLBACK = ensureAbsoluteUrl("/images/fallback-product.png") || "http://localhost:5001/images/fallback-product.png";

const defaultSeller: SellerInfo = {
  name: "UniServe Mall",
  rating: 4.7,
  reviewCount: 1240,
  sales: 3200,
  contact: "+998 71 123 45 67",
  isOfficial: true,
  badges: ["Rasmiy diler", "Original mahsulot", "24/7 qo'llab-quvvatlash"]
};

const buildBadges = (p: any) =>
  p.badges || ["Tez yetkazib berish", "Original mahsulot", "15 kun qaytarish", "Qadoqlashni videoga olish"];

const buildDeliveryInfo = (p: any): DeliveryInfo => {
  const estimated = p.delivery?.estimated || formatDateRange(1, 2);
  return {
    type: p.delivery?.type || "fast",
    fee: p.delivery?.fee ?? 0,
    estimated,
    promise: p.delivery?.promise || "Buyurtma 18:00 gacha tasdiqlansa ertangi kuni yetkaziladi",
    origin: p.delivery?.origin || "Toshkent ombori",
    freeReturn: p.delivery?.freeReturn ?? true,
    address: p.delivery?.address
  };
};

const buildSellerInfo = (p: any): SellerInfo => {
  const seller = p.seller || {};
  return {
    name: seller.name || p.vendor?.name || "UniServe Market",
    rating: seller.rating ?? p.rating?.avg ?? defaultSeller.rating,
    reviewCount: seller.reviewCount ?? p.rating?.count ?? defaultSeller.reviewCount,
    sales: seller.sales ?? p.stats?.purchases ?? defaultSeller.sales,
    contact: seller.contact || defaultSeller.contact,
    isOfficial: seller.isOfficial ?? defaultSeller.isOfficial,
    badges: seller.badges || defaultSeller.badges
  };
};

const buildBenefits = (p: any, delivery: DeliveryInfo) => ({
  coupons:
    p.benefits?.coupons ||
    [
      { label: "5% kupon", description: "Checkout jarayonida avtomatik qo'llanadi" },
      { label: "10 000 so'm bonus", description: "Yangi foydalanuvchilar uchun" }
    ],
  installment:
    p.benefits?.installment || { months: [3, 6, 12], partner: "Paymart", minPrice: 100000 },
  delivery: p.benefits?.delivery || (delivery.fee === 0 ? "Yetkazib berish bepul" : "Tez yetkazish xizmati mavjud")
});

const buildPolicies = (p: any) => ({
  returnWindow: p.policies?.returnWindow || "15 kun ichida bepul qaytarish",
  exchange: p.policies?.exchange || "Oson almashtirish va pulni qaytarish",
  warranty: p.policies?.warranty || "12 oy ishlab chiqaruvchi kafolati",
  support: p.policies?.support || "24/7 qo'llab-quvvatlash"
});

const buildSpecs = (p: any) => {
  const baseSpecs = [
    { label: "Kategoriya", value: p.category || "Umumiy" },
    { label: "Brend", value: p.brand || "UniServe tanlovi" },
    { label: "Holati", value: p.condition || "Yangi" }
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

const buildOptions = (p: any) =>
  p.options || [
    { name: "Rangi", values: ["Oq", "Qora"], defaultValue: "Oq" },
    { name: "O'lcham", values: ["S", "M", "L"], defaultValue: "M" }
  ];

const buildHighlights = (name: string, delivery: DeliveryInfo, seller: SellerInfo, p: any) =>
  p.highlights || [
    `${name} uchun tez yetkazib berish (${delivery.estimated})`,
    `${seller.name} tomonidan kafolatlangan original mahsulot`,
    p.price ? `Hozirgi narx: ${p.price} so'm` : "Narx aniqlandi"
  ];

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
  policies: { returnWindow: string; exchange: string; warranty: string; support: string }
) => [
  { title: "Asosiy ma'lumotlar", items: highlights },
  { title: "Texnik xarakteristikalar", items: specs.map((s) => `${s.label}: ${s.value}`) },
  { title: "Yetkazib berish", items: [`Xizmat: ${delivery.type}`, `Narx: ${delivery.fee ? `${delivery.fee} so'm` : "Bepul"}`, `Taxminiy sana: ${delivery.estimated}`, delivery.promise] },
  {
    title: "Sotuvchi",
    items: [`Sotuvchi: ${seller.name}`, `Reyting: ${seller.rating} (${seller.reviewCount} izoh)`, `Sotuvlar: ${seller.sales}`, `Kontakt: ${seller.contact}`]
  },
  { title: "Qaytarish va kafolat", items: [policies.returnWindow, policies.exchange, policies.warranty, policies.support] }
];

const normalizeImages = (p: any): string[] => {
  return sanitizeImageArray(p?.images);
};

const normalizeText = (value: unknown): string => String(value || "").trim().toLowerCase();

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

const toDetailDto = (p: any) => {
  const name = p.name || p.title;
  const price = Number(p.price || 0);
  const oldPrice = p.oldPrice ?? (price ? Math.round(price * 1.12) : undefined);
  const rating = p.rating || { avg: 0, count: 0 };
  const ratingCount = Number(p.ratingCount ?? rating.count ?? 0);
  const stats = p.stats || { views: p.views || 0, likes: p.likes || 0, purchases: p.orders || 0 };
  const delivery = buildDeliveryInfo(p);
  const seller = buildSellerInfo(p);
  const badges = buildBadges(p);
  const benefits = buildBenefits(p, delivery);
  const specs = buildSpecs(p);
  const highlights = buildHighlights(name, delivery, seller, p);
  const policies = buildPolicies(p);
  const options = buildOptions(p);
  const detailSections = buildDetailSections(highlights, specs, delivery, seller, policies);
  const reviewSummary = buildReviewSummary(p);
  const images = normalizeImages(p);
  const coverImageUrl = resolveCoverImage(p);

  return {
    _id: p._id?.toString?.() ?? p.id ?? p.slug,
    id: p._id?.toString?.() ?? p.slug ?? p.id,
    type: "product",
    title: name,
    name,
    description: p.description || "",
    price,
    currency: p.currency || "UZS",
    oldPrice,
    thumbnail: coverImageUrl,
    image: coverImageUrl,
    imageUrl: coverImageUrl,
    coverImage: coverImageUrl,
    cardImageUrl: coverImageUrl,
    coverImageUrl,
    images,
    rating,
    ratingAvg: Number(p.ratingAvg ?? rating.avg ?? 0),
    ratingCount: Number.isFinite(ratingCount) ? ratingCount : 0,
    reviewSummary,
    stats,
    category: p.category,
    subCategory: p.subCategory,
    brand: p.brand,
    condition: p.condition || "Yangi",
    size: p.size,
    season: p.season,
    audience: p.audience,
    vendor: p.vendor || p.createdBy,
    badges,
    highlights,
    delivery,
    seller,
    benefits,
    specs,
    options,
    policies,
    stock: p.stock ?? p.quantity ?? 24,
    createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
    detailSections
  };
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
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
    const windowStart = new Date(Date.now() - DUPLICATE_GUARD_WINDOW_MS);
    const recentProducts = await Product.find({
      createdBy: req.user._id,
      createdAt: { $gte: windowStart }
    })
      .select("title category price createdAt")
      .lean();

    const normalizedTitle = normalizeText(title);
    const normalizedCategory = normalizeText(category);
    const duplicate = recentProducts.find(
      (item) =>
        normalizeText(item.title) === normalizedTitle &&
        normalizeText(item.category) === normalizedCategory &&
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
      category,
      coverImageUrl: finalCoverImageUrl,
      cardImageUrl: finalCoverImageUrl,
      createdBy: req.user._id
    });
    return res.status(201).json({ product });
  } catch (err) {
    console.error("createProduct error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listProducts = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 24, 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      Product.countDocuments({})
    ]);

    const products = items.map((p) => toDetailDto(p));
    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      products
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
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleCandidate = identifier.replace(/-/g, " ").trim();
    let product = mongoose.Types.ObjectId.isValid(identifier)
      ? await Product.findById(identifier).populate("createdBy", "name username role avatarUrl")
      : await Product.findOne({
          $or: [{ slug: identifier.toLowerCase() }, { title: { $regex: `^${escaped}$`, $options: "i" } }, { title: titleCandidate }]
        }).populate("createdBy", "name username role avatarUrl");
    if (!product) {
      product = await findProductByLegacyIdentifier(identifier);
    }
    if (!product) return res.status(404).json({ message: "Product not found" });
    return res.json(toDetailDto(product));
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
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleCandidate = identifier.replace(/-/g, " ").trim();
    let product = mongoose.Types.ObjectId.isValid(identifier)
      ? await Product.findById(identifier)
      : await Product.findOne({
          $or: [{ slug: identifier.toLowerCase() }, { title: { $regex: `^${escaped}$`, $options: "i" } }, { title: titleCandidate }]
        });
    if (!product) {
      product = await findProductByLegacyIdentifier(identifier);
    }
    if (!product) return res.status(404).json({ message: "Product not found" });

    const stats = { views: product.views || 0, likes: product.likes || 0, purchases: product.orders || 0 };
    if (action === "view") stats.views = (stats.views || 0) + 1;
    if (action === "like") stats.likes = (stats.likes || 0) + 1;
    if (action === "purchase") stats.purchases = (stats.purchases || 0) + 1;
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
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const products = await Product.find({ createdBy: req.user._id });
    return res.json({ products });
  } catch (err) {
    console.error("myProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateProductStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id } = req.params;
    const { status } = req.body;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (String(product.createdBy) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }
    product.status = status;
    await product.save();
    return res.json({ product });
  } catch (err) {
    console.error("updateProductStatus error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getPopularProducts = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 8, 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find({})
        .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      Product.countDocuments({})
    ]);

    const products = items.map((p) => toDetailDto(p));

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      items: products
    });
  } catch (err) {
    console.error("getPopularProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getTrendingProducts = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 9, 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find({})
        .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      Product.countDocuments({})
    ]);

    const products = items.map((p) => toDetailDto(p));

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      items: products
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
