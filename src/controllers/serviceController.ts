import { Request, Response } from "express";
import mongoose from "mongoose";
import { Service } from "../models/Service";
import { parsePositiveInt } from "../utils/pagination";
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

const DUPLICATE_GUARD_WINDOW_MS = Number(process.env.DUPLICATE_GUARD_WINDOW_MS || 15_000);
const SERVICE_FALLBACK = ensureAbsoluteUrl("/images/fallback-service.png") || "http://localhost:5001/images/fallback-service.png";
const normalizeText = (value: unknown): string => String(value || "").trim().toLowerCase();

const LEGACY_SERVICE_SLUG_MAP: Record<string, string> = {
  "build-brick-1": "construction-service-1",
  "build-brick-2": "construction-service-2",
  "taxi-limuzin-2-1-v11": "airport-delivery-support"
};

const buildIdentifierTokens = (identifier: string): string[] =>
  identifier
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token && !/^\\d+$/.test(token));

const findServiceByLegacyIdentifier = async (identifier: string) => {
  const alias = LEGACY_SERVICE_SLUG_MAP[identifier.toLowerCase()];
  if (alias) {
    const byAlias = await Service.findOne({ slug: alias }).populate("createdBy", "name username role avatarUrl");
    if (byAlias) return byAlias;
  }

  const tokens = buildIdentifierTokens(identifier);
  if (!tokens.length) return null;
  const pattern = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (!pattern) return null;

  const candidates = await Service.find({
    $or: [{ slug: { $regex: pattern, $options: "i" } }, { title: { $regex: pattern, $options: "i" } }]
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("createdBy", "name username role avatarUrl");

  if (!candidates.length) return null;

  const scored = candidates
    .map((item) => {
      const hay = `${String(item.slug || "")} ${String(item.title || "")} ${String(item.category || "")}`.toLowerCase();
      const score = tokens.reduce((acc, token) => (hay.includes(token) ? acc + 1 : acc), 0);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.item || null;
};

const buildUniqueServiceSlug = async (title: string) => {
  const base = slugify(title) || "service";
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await Service.find({ slug: { $regex: `^${escaped}(?:-\\d+)?$`, $options: "i" } })
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

const pickCreator = (createdBy: any) => {
  if (!createdBy) return null;
  const { _id, name, username, role, avatarUrl } = createdBy;
  return { _id, name, username, role, avatarUrl };
};

export const attachServiceCover = (service: any) => {
  const raw = service?.toObject ? service.toObject() : { ...service };
  const creator = pickCreator(raw.createdBy);
  const images = sanitizeImageArray(raw.images);
  const coverImageUrl = resolveCoverImage(raw);
  const ratingAvg = Number(raw?.ratingAvg ?? raw?.rating?.avg ?? 0);
  const ratingCount = Number(raw?.ratingCount ?? raw?.rating?.count ?? 0);
  const price = Number(raw?.price ?? raw?.hourlyRate);
  const likes = Number(raw?.stats?.likes ?? raw?.likes ?? 0);
  const views = Number(raw?.stats?.views ?? raw?.views ?? 0);
  const orders = Number(raw?.stats?.orders ?? raw?.stats?.purchases ?? raw?.orders ?? raw?.purchases ?? 0);
  const saleMeta = resolveSaleMeta({
    basePrice: Number.isFinite(price) ? price : null,
    salePrice: raw?.salePrice,
    discountPercent: raw?.discountPercent,
    oldPrice: raw?.oldPrice
  });
  const salePrice = saleMeta.salePrice ?? (Number.isFinite(price) ? price : null);
  const discountPercent = saleMeta.discountPercent ?? 0;
  const originalPrice = saleMeta.originalPrice ?? (Number.isFinite(price) ? price : null);
  const isOnSale = saleMeta.isSale;
  const agent = creator
    ? {
        id: creator._id?.toString?.() || String(creator._id || ""),
        name: creator.name || "UniServe Agent",
        avatarUrl: creator.avatarUrl || null,
        rating: ratingAvg
      }
    : undefined;

  return {
    _id: raw._id,
    id: raw._id?.toString?.() ?? raw.id,
    type: "service",
    title: raw.title ?? raw.name ?? "",
    description: raw.description ?? "",
    kind: raw.kind,
    category: raw.category,
    hourlyRate: raw.hourlyRate,
    currency: raw.currency ?? "USD",
    location: raw.location,
    price: Number.isFinite(price) ? price : null,
    salePrice,
    originalPrice,
    oldPrice: originalPrice,
    discountPercent,
    isOnSale,
    isSale: isOnSale,
    likes,
    views,
    orders,
    stats: {
      likes,
      views,
      orders,
      purchases: orders
    },
    ratingAvg,
    ratingCount: Number.isFinite(ratingCount) ? ratingCount : 0,
    createdBy: creator,
    agent,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    images,
    image: coverImageUrl,
    thumbnail: coverImageUrl,
    coverImage: coverImageUrl,
    coverImageUrl,
    cardImageUrl: coverImageUrl,
    imageUrl: coverImageUrl
  };
};

export const createService = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { title, description, kind, category, hourlyRate, currency, location, images, coverImageUrl, imageUrl, slug } = req.body;
    if (!title || !kind || !category) {
      return res.status(400).json({ message: "title, kind, category required" });
    }
    if (
      isRandomUnsplashUrl(coverImageUrl) ||
      isRandomUnsplashUrl(imageUrl) ||
      (Array.isArray(images) &&
        images.some((img: unknown) => isRandomUnsplashUrl(typeof img === "string" ? img : (img as any)?.url)))
    ) {
      return res.status(400).json({ message: "Random Unsplash image URLs are not allowed" });
    }

    const numericPrice = Number(req.body.price ?? hourlyRate);
    const windowStart = new Date(Date.now() - DUPLICATE_GUARD_WINDOW_MS);
    const recentServices = await Service.find({
      createdBy: req.user._id,
      createdAt: { $gte: windowStart }
    })
      .select("title category hourlyRate price createdAt")
      .lean();

    const normalizedTitle = normalizeText(title);
    const normalizedCategory = normalizeText(category);
    const duplicate = recentServices.find((item) => {
      const itemPrice = Number((item as any).price ?? item.hourlyRate);
      return (
        normalizeText(item.title) === normalizedTitle &&
        normalizeText(item.category) === normalizedCategory &&
        itemPrice === numericPrice
      );
    });
    if (duplicate) {
      return res.status(409).json({ message: "Duplicate service creation blocked" });
    }

    const finalImages = sanitizeImageArray(images);
    const finalCoverImageUrl =
      resolveCoverImage({ coverImageUrl, imageUrl, images: finalImages }) || SERVICE_FALLBACK;
    if (isLocalImageUrl(finalCoverImageUrl) && !localImageExists(finalCoverImageUrl)) {
      return res.status(400).json({ message: "coverImageUrl points to a missing local file" });
    }
    const finalSlug = typeof slug === "string" && slug.trim() ? slugify(slug) : await buildUniqueServiceSlug(title);

    const service = await Service.create({
      title,
      slug: finalSlug || undefined,
      description,
      kind,
      category,
      hourlyRate,
      currency: currency || "USD",
      location,
      images: finalImages,
      cardImageUrl: finalCoverImageUrl,
      coverImageUrl: finalCoverImageUrl,
      createdBy: req.user._id
    });
    return res.status(201).json({ service: attachServiceCover(service) });
  } catch (err) {
    console.error("createService error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listServices = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 24, 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Service.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl")
        .lean(),
      Service.countDocuments({})
    ]);

    const services = items.map((service) => attachServiceCover(service));

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      services
    });
  } catch (err) {
    console.error("listServices error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const myServices = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const services = await Service.find({ createdBy: req.user._id });
    return res.json({ services });
  } catch (err) {
    console.error("myServices error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getTrendingServices = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 9, 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Service.find({})
        .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      Service.countDocuments({})
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      items: items.map((service) => attachServiceCover(service))
    });
  } catch (err) {
    console.error("getTrendingServices error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getServiceDetail = async (req: Request, res: Response) => {
  try {
    const identifier = String(req.params.identifier || req.params.id || "").trim();
    if (!identifier) return res.status(400).json({ message: "Service identifier is required" });
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleCandidate = identifier.replace(/-/g, " ").trim();
    let service = mongoose.Types.ObjectId.isValid(identifier)
      ? await Service.findById(identifier).populate("createdBy", "name username role avatarUrl")
      : await Service.findOne({
          $or: [{ slug: identifier.toLowerCase() }, { title: { $regex: `^${escaped}$`, $options: "i" } }, { title: titleCandidate }]
        }).populate("createdBy", "name username role avatarUrl");
    if (!service) {
      service = await findServiceByLegacyIdentifier(identifier);
    }
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    return res.json({ service: attachServiceCover(service) });
  } catch (err) {
    console.error("getServiceDetail error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
