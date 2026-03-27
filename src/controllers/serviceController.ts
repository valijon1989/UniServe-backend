import { Request, Response } from "express";
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
import { findServiceByIdentifier } from "../services/serviceLookup";
import { buildCategoryMeta, normalizeMarketplaceCategory } from "../services/categoryTaxonomy";
import { localizeKeyword, resolveLocalizedTextField } from "../services/localizedContent";
import { buildRecommendationModulesSafe, recordRecommendationSignal } from "../services/recommendationEngine";
import { buildListingUiMeta } from "../services/sharedFilters";
import { respondAuthRequired } from "../utils/controllerResponses";

const DUPLICATE_GUARD_WINDOW_MS = Number(process.env.DUPLICATE_GUARD_WINDOW_MS || 15_000);
const SERVICE_FALLBACK = ensureAbsoluteUrl("/images/fallback-service.png") || "http://localhost:5001/images/fallback-service.png";
const normalizeText = (value: unknown): string => String(value || "").trim().toLowerCase();

export const normalizeServiceSort = (value: unknown) => {
  const token = normalizeText(value);
  if (!token) return "newest";
  if (token === "new" || token === "newest") return "newest";
  if (token === "rating" || token === "top_rated" || token === "top-rated") return "top_rated";
  if (token === "price_low" || token === "price_asc" || token === "price-asc") return "price_asc";
  if (token === "price_high" || token === "price_desc" || token === "price-desc") return "price_desc";
  if (token === "popular" || token === "trending" || token === "best_match" || token === "best-match") return "popular";
  return "newest";
};

type ServiceQueryShape = Partial<Record<"category" | "subCategory" | "subcategory", unknown>>;

export const resolveServiceCategoryFilter = (query: ServiceQueryShape) => {
  const subcategory = normalizeMarketplaceCategory(query.subCategory ?? query.subcategory, "services");
  if (subcategory && subcategory !== "services") return subcategory;
  const category = normalizeMarketplaceCategory(query.category, "services");
  if (category && category !== "services") return category;
  return null;
};

export const resolveServiceUiCategoryKey = (query: ServiceQueryShape) =>
  normalizeMarketplaceCategory(query.subCategory ?? query.subcategory ?? query.category, "services") ||
  normalizeMarketplaceCategory(query.category, "services") ||
  null;

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

export const attachServiceCover = (service: any, locale?: Request["locale"]) => {
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
        name: creator.name || localizeKeyword("service", locale),
        avatarUrl: creator.avatarUrl || null,
        rating: ratingAvg
      }
    : undefined;

  const categoryMeta = buildCategoryMeta(raw.category, locale);
  const title = resolveLocalizedTextField(raw, "title", locale, raw.title ?? raw.name ?? "");
  const description = resolveLocalizedTextField(raw, "description", locale, raw.description ?? "");
  return {
    _id: raw._id,
    id: raw._id?.toString?.() ?? raw.id,
    type: "service",
    title,
    description,
    kind: raw.kind,
    kindLabel: localizeKeyword(raw.kind === "MATERIAL" ? "seller" : "service", locale),
    category: normalizeMarketplaceCategory(raw.category) || raw.category,
    categoryRaw: raw.category,
    topLevelCategory: categoryMeta?.mainCategory || null,
    categorySlug: categoryMeta?.categorySlug || null,
    categoryMeta,
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
    if (!req.user) return respondAuthRequired(req, res);
    const { title, description, kind, category, hourlyRate, currency, location, images, coverImageUrl, imageUrl, slug } = req.body;
    if (!title || !kind || !category) {
      return res.status(400).json({ message: "title, kind, category required" });
    }
    const normalizedCategory = normalizeMarketplaceCategory(category) || normalizeText(category);
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
    const duplicate = recentServices.find((item) => {
      const itemPrice = Number((item as any).price ?? item.hourlyRate);
      return (
        normalizeText(item.title) === normalizedTitle &&
        normalizeMarketplaceCategory(item.category) === normalizedCategory &&
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
      category: normalizedCategory,
      hourlyRate,
      currency: currency || "USD",
      location,
      images: finalImages,
      cardImageUrl: finalCoverImageUrl,
      coverImageUrl: finalCoverImageUrl,
      createdBy: req.user._id
    });
    return res.status(201).json({ service: attachServiceCover(service, req.locale) });
  } catch (err) {
    console.error("createService error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listServices = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page ?? req.query.cursor, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 24, 50);
    const categoryFilter = resolveServiceCategoryFilter(req.query as ServiceQueryShape);
    const uiCategory = resolveServiceUiCategoryKey(req.query as ServiceQueryShape);
    const filter: Record<string, unknown> = { status: "ACTIVE" };
    if (categoryFilter) filter.category = categoryFilter;
    const location = normalizeText(req.query.location);
    if (location) filter.location = new RegExp(location, "i");

    const items = await Service.find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name username role avatarUrl")
      .lean();

    const ratingMin = Number(req.query.rating ?? req.query.minRating ?? 0);
    const minPrice = Number(req.query.minPrice ?? req.query.priceMin ?? 0);
    const maxPrice = Number(req.query.maxPrice ?? req.query.priceMax ?? 0);
    const searchQuery = normalizeText(req.query.q);
    const sortMode = normalizeServiceSort(req.query.sort);

    const filtered = items
      .map((service) => attachServiceCover(service, req.locale))
      .filter((service) => {
        const ratingValue = Number(service.ratingAvg ?? 0);
        const effectivePrice = Number(service.salePrice ?? service.price ?? service.hourlyRate ?? 0);
        const haystack = [
          service.title,
          service.description,
          service.category,
          service.location,
          service.createdBy?.name,
          service.createdBy?.username
        ]
          .map((value) => normalizeText(value))
          .filter(Boolean)
          .join(" ");
        if (searchQuery && !haystack.includes(searchQuery)) return false;
        if (ratingMin > 0 && ratingValue < ratingMin) return false;
        if (minPrice > 0 && effectivePrice < minPrice) return false;
        if (maxPrice > 0 && effectivePrice > maxPrice) return false;
        return true;
      });

    filtered.sort((left, right) => {
      if (sortMode === "top_rated") return Number(right.ratingAvg || 0) - Number(left.ratingAvg || 0);
      if (sortMode === "popular") return Number(right.orders || 0) - Number(left.orders || 0);
      if (sortMode === "price_asc") return Number(left.salePrice ?? left.price ?? 0) - Number(right.salePrice ?? right.price ?? 0);
      if (sortMode === "price_desc") return Number(right.salePrice ?? right.price ?? 0) - Number(left.salePrice ?? left.price ?? 0);
      return new Date(String(right.createdAt || 0)).getTime() - new Date(String(left.createdAt || 0)).getTime();
    });

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const services = filtered.slice(skip, skip + limit);
    const hasMore = skip + services.length < total;

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      items: services,
      services,
      hasMore,
      nextCursor: hasMore ? String(page + 1) : null,
      uiMeta: buildListingUiMeta(req, "services", {
        categoryKey: uiCategory,
        resultCount: total,
        sortValue: sortMode
      })
    });
  } catch (err) {
    console.error("listServices error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const myServices = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const services = await Service.find({ createdBy: req.user._id }).lean();
    return res.json({ services: services.map((service) => attachServiceCover(service, req.locale)) });
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
      items: items.map((service) => attachServiceCover(service, req.locale))
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
    const service = await findServiceByIdentifier(identifier);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }
    const dto = attachServiceCover(service, req.locale);
    const recommendations = await buildRecommendationModulesSafe({
      surface: "DETAIL",
      locale: req.locale,
      userId: req.user?._id || null,
      entityType: "SERVICE",
      entityId: String((service as any)._id || ""),
      entityIdentifier: String((service as any).slug || (service as any)._id || ""),
      categoryKey: dto.category || null,
      location: dto.location || null,
      limitPerModule: 4
    }, "service.detail.recommendations");
    await recordRecommendationSignal({
      userId: req.user?._id || null,
      entityType: "SERVICE",
      entityId: String((service as any)._id || ""),
      entityIdentifier: String((service as any).slug || (service as any)._id || ""),
      action: "VIEW",
      categoryKey: dto.category || null,
      location: dto.location || null,
      locale: req.locale
    }).catch(() => null);
    return res.json({ service: dto, recommendations });
  } catch (err) {
    console.error("getServiceDetail error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
