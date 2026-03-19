import { Request, Response } from "express";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { AgentProfile } from "../models/AgentProfile";
import { User } from "../models/User";
import { ensureAbsoluteUrl } from "../utils/imageHelpers";
import { isLocalImageUrl, localImageExists, resolveCoverImage, sanitizeImageArray } from "../utils/resolveCoverImage";
import { resolveAvatarUrl } from "../utils/avatarImage";
import { toDetailDto } from "./productController";
import { attachServiceCover } from "./serviceController";
import {
  buildListingStats,
  DealSaleMeta,
  ListingStats,
  resolveDealSaleMeta,
  resolveSaleMeta,
  selectNewestListings,
  selectSaleListings,
  selectTopRatedListings,
  selectWeeklyTopListings,
  toTypeIdKey
} from "../services/listingSelector";
import { buildRecommendationModulesSafe } from "../services/recommendationEngine";

type ListingKind = "product" | "service";
type HomeListing = {
  _id: string;
  type: ListingKind;
  slug?: string | null;
  title: string;
  description: string;
  price: number | null;
  originalPrice: number | null;
  salePrice: number | null;
  discountPercent: number | null;
  isSale: boolean;
  category: string | null;
  ratingAvg: number;
  ratingCount: number;
  stats: ListingStats;
  createdAt: Date;
  updatedAt?: Date;
  coverImageUrl: string | null;
  images: string[];
};

type DealListing = {
  _id: string;
  id: string;
  type: ListingKind;
  kind: ListingKind;
  title: string;
  name: string;
  price: number | null;
  salePrice: number | null;
  discountPercent: number;
  isOnSale: boolean;
  isSale: boolean;
  stats: {
    likes: number;
    views: number;
    orders: number;
    purchases: number;
  };
  likes: number;
  views: number;
  orders: number;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  coverImageUrl: string | null;
  coverImage: string | null;
  imageUrl: string | null;
  image: string | null;
  thumbnail: string | null;
  cardImageUrl: string | null;
  images: string[];
  [key: string]: unknown;
};

const buildListing = (kind: ListingKind, item: any, agentProfileMap: Record<string, { profile?: any; user?: any }>) => {
  const agent = item.createdBy;
  const key = agent?._id?.toString();
  const bundle = key ? agentProfileMap[key] : undefined;
  const displayName = agent?.name || bundle?.user?.name || "UniServe Agent";
  const avatarUrl = resolveAvatarUrl(agent?.avatarUrl || bundle?.user?.avatarUrl, key || item?._id);
  const rating = bundle?.profile?.rating ?? 0;
  const agentInfo = agent
    ? {
        id: agent._id,
        name: displayName,
        avatarUrl,
        rating
      }
    : undefined;

  const likes = typeof item.likes === "number" ? item.likes : Array.isArray(item.likes) ? item.likes.length : 0;
  const views = item.views ?? 0;
  const orders = item.orders ?? 0;

  const price = kind === "product" ? item.price : item.hourlyRate;

  const priceText =
    kind === "service"
      ? item.hourlyRate
        ? `${item.currency || "USD"} ${item.hourlyRate.toLocaleString()} / hour`
        : item.priceText || ""
      : undefined;
  const resolvedImage = resolveCoverImage(item);

  return {
    id: item._id,
    kind,
    type: kind,
    title: item.name || item.title,
    description: item.description,
    category: item.category,
    price: kind === "product" ? price : undefined,
    currency: kind === "product" ? item.currency : undefined,
    priceText,
    stats: {
      likes,
      views,
      orders
    },
    likes,
    views,
    orders,
    createdAt: item.createdAt,
    cardImageUrl: resolvedImage,
    thumbnailUrl: resolvedImage,
    thumbnail: resolvedImage,
    coverImageUrl: resolvedImage,
    imageUrl: resolvedImage,
    images: item.images || [],
    rating,
    agent: agentInfo
  };
};

const prepareAgentMap = async (userIds: string[]) => {
  const profiles = await AgentProfile.find({ user: { $in: userIds } }).lean();
  const map: Record<string, { profile?: any; user?: any }> = {};
  profiles.forEach((profile) => {
    map[profile.user.toString()] = { ...map[profile.user.toString()], profile };
  });
  const users = await User.find({ _id: { $in: userIds } }).select("name avatarUrl");
  users.forEach((user) => {
    const key = user._id.toString();
    map[key] = { ...map[key], user };
  });
  return map;
};

const fetchListings = async () => {
  const [products, services] = await Promise.all([
    Product.find({ status: "ACTIVE" })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate("createdBy", "name username role avatarUrl"),
    Service.find({})
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate("createdBy", "name username role avatarUrl")
  ]);
  return { products, services };
};

const buildAgentProfilesMap = async (products: any[], services: any[]) => {
  const ids = Array.from(
    new Set([
      ...products.map((p) => p.createdBy?._id?.toString()),
      ...services.map((s) => s.createdBy?._id?.toString())
    ].filter(Boolean) as string[])
  );
  return prepareAgentMap(ids);
};

const parseNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const PRODUCT_FALLBACK = ensureAbsoluteUrl("/images/fallback-product.png") || "http://localhost:5001/images/fallback-product.png";
const SERVICE_FALLBACK = ensureAbsoluteUrl("/images/fallback-service.png") || "http://localhost:5001/images/fallback-service.png";

const extractMediaImages = (media: unknown): string[] => {
  if (!Array.isArray(media)) return [];
  return media
    .map((item: unknown) => {
      if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
        return String((item as { url: string }).url);
      }
      if (typeof item === "string") return item;
      return null;
    })
    .filter(Boolean) as string[];
};

const uniqueUrls = (items: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
};

const ensureReachable = (value: string | null): string | null => {
  if (!value) return null;
  if (isLocalImageUrl(value) && !localImageExists(value)) return null;
  return value;
};

const resolveHomeMedia = (kind: ListingKind, doc: any): { coverImageUrl: string | null; images: string[] } => {
  const rawImages = sanitizeImageArray(doc?.images);
  const rawMediaImages = sanitizeImageArray(extractMediaImages(doc?.media));
  let gallery = uniqueUrls([...rawImages, ...rawMediaImages]).map((url) => ensureReachable(url)).filter(Boolean) as string[];

  let coverImageUrl = ensureReachable(resolveCoverImage(doc));
  if (!coverImageUrl && gallery.length) {
    coverImageUrl = gallery[0];
  }
  if (!coverImageUrl) {
    coverImageUrl = kind === "product" ? PRODUCT_FALLBACK : SERVICE_FALLBACK;
  }

  if (coverImageUrl) {
    gallery = [coverImageUrl, ...gallery.filter((item) => item !== coverImageUrl)];
  }
  return { coverImageUrl: coverImageUrl || null, images: gallery.slice(0, 5) };
};

const pickPrice = (kind: ListingKind, doc: any): number | null => {
  if (kind === "product") {
    const value = Number(doc?.price);
    return Number.isFinite(value) ? value : null;
  }
  const servicePrice = Number(doc?.price ?? doc?.hourlyRate);
  return Number.isFinite(servicePrice) ? servicePrice : null;
};

const toHomeListing = (kind: ListingKind, doc: any, ratingCount: number): HomeListing => {
  const media = resolveHomeMedia(kind, doc);
  const saleMeta = resolveSaleMeta({
    basePrice: pickPrice(kind, doc),
    salePrice: doc?.salePrice,
    discountPercent: doc?.discountPercent,
    oldPrice: doc?.oldPrice
  });
  return {
    _id: String(doc._id),
    type: kind,
    slug: typeof doc.slug === "string" ? doc.slug : null,
    title: String(doc.title || doc.name || ""),
    description: String(doc.description || ""),
    price: saleMeta.price,
    originalPrice: saleMeta.originalPrice,
    salePrice: saleMeta.salePrice,
    discountPercent: saleMeta.discountPercent,
    isSale: saleMeta.isSale,
    category: typeof doc.category === "string" ? doc.category : null,
    ratingAvg: parseNumber(doc.ratingAvg ?? doc.rating?.avg),
    ratingCount: parseNumber(ratingCount),
    stats: buildListingStats(doc),
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt || doc.createdAt),
    coverImageUrl: media.coverImageUrl,
    images: media.images
  };
};

const fetchHomeListingsByType = async (
  kind: ListingKind,
  sortMode: "topRated" | "newest",
  perTypeLimit: number
): Promise<HomeListing[]> => {
  const Model = kind === "product" ? Product : Service;
  const match = kind === "product" ? { status: "ACTIVE" } : {};
  const docs = await Model.aggregate([
    { $match: match },
    {
      $addFields: {
        __ratingAvg: { $ifNull: ["$ratingAvg", { $ifNull: ["$rating.avg", 0] }] },
        __ratingCount: { $ifNull: ["$ratingCount", { $ifNull: ["$rating.count", 0] }] }
      }
    },
    {
      $sort:
        sortMode === "topRated"
          ? { __ratingAvg: -1, __ratingCount: -1, createdAt: -1 }
          : { createdAt: -1 }
    },
    { $limit: perTypeLimit },
    {
      $project: {
        slug: 1,
        title: 1,
        category: 1,
        description: 1,
        price: 1,
        hourlyRate: 1,
        oldPrice: 1,
        salePrice: 1,
        discountPercent: 1,
        ratingAvg: "$__ratingAvg",
        ratingCount: "$__ratingCount",
        likes: { $ifNull: ["$likes", 0] },
        orders: { $ifNull: ["$orders", 0] },
        views: { $ifNull: ["$views", 0] },
        likes_7d: { $ifNull: ["$likes_7d", { $ifNull: ["$likes7d", 0] }] },
        views_7d: { $ifNull: ["$views_7d", { $ifNull: ["$views7d", 0] }] },
        orders_7d: { $ifNull: ["$orders_7d", { $ifNull: ["$orders7d", 0] }] },
        createdAt: 1,
        updatedAt: 1,
        imageUrl: 1,
        image: 1,
        thumbnail: 1,
        cardImageUrl: 1,
        coverImage: 1,
        coverImageUrl: 1,
        banner: 1,
        images: 1,
        media: 1
      }
    }
  ]);
  return docs.map((doc) => toHomeListing(kind, doc, parseNumber(doc.ratingCount)));
};

const fetchSaleListingsByType = async (kind: ListingKind, perTypeLimit: number): Promise<HomeListing[]> => {
  const Model = kind === "product" ? Product : Service;
  const match = kind === "product" ? { status: "ACTIVE" } : {};
  const basePriceExpr = kind === "product" ? { $ifNull: ["$price", 0] } : { $ifNull: ["$price", { $ifNull: ["$hourlyRate", 0] }] };

  const docs = await Model.aggregate([
    { $match: match },
    {
      $addFields: {
        __ratingAvg: { $ifNull: ["$ratingAvg", { $ifNull: ["$rating.avg", 0] }] },
        __ratingCount: { $ifNull: ["$ratingCount", { $ifNull: ["$rating.count", 0] }] },
        __basePrice: basePriceExpr,
        __salePrice: { $ifNull: ["$salePrice", 0] },
        __discountPercent: { $ifNull: ["$discountPercent", 0] }
      }
    },
    {
      $addFields: {
        __effectiveDiscount: {
          $cond: [
            { $and: [{ $gt: ["$__salePrice", 0] }, { $gt: ["$__basePrice", 0] }, { $lt: ["$__salePrice", "$__basePrice"] }] },
            { $multiply: [{ $divide: [{ $subtract: ["$__basePrice", "$__salePrice"] }, "$__basePrice"] }, 100] },
            {
              $cond: [
                { $and: [{ $gt: ["$__discountPercent", 0] }, { $lt: ["$__discountPercent", 100] }] },
                "$__discountPercent",
                0
              ]
            }
          ]
        }
      }
    },
    { $match: { $expr: { $gt: ["$__effectiveDiscount", 0] } } },
    { $sort: { __effectiveDiscount: -1, updatedAt: -1, createdAt: -1 } },
    { $limit: perTypeLimit },
    {
      $project: {
        slug: 1,
        title: 1,
        category: 1,
        description: 1,
        price: 1,
        hourlyRate: 1,
        oldPrice: 1,
        salePrice: 1,
        discountPercent: 1,
        ratingAvg: "$__ratingAvg",
        ratingCount: "$__ratingCount",
        likes: { $ifNull: ["$likes", 0] },
        orders: { $ifNull: ["$orders", 0] },
        views: { $ifNull: ["$views", 0] },
        likes_7d: { $ifNull: ["$likes_7d", { $ifNull: ["$likes7d", 0] }] },
        views_7d: { $ifNull: ["$views_7d", { $ifNull: ["$views7d", 0] }] },
        orders_7d: { $ifNull: ["$orders_7d", { $ifNull: ["$orders7d", 0] }] },
        createdAt: 1,
        updatedAt: 1,
        imageUrl: 1,
        image: 1,
        thumbnail: 1,
        cardImageUrl: 1,
        coverImage: 1,
        coverImageUrl: 1,
        banner: 1,
        images: 1,
        media: 1
      }
    }
  ]);

  return docs.map((doc) => toHomeListing(kind, doc, parseNumber(doc.ratingCount)));
};

const dedupeListingCards = (items: any[]) => {
  const seenLogical = new Set<string>();
  const seenId = new Set<string>();
  const out: any[] = [];
  for (const item of items) {
    const slugKey = typeof item?.slug === "string" ? item.slug.trim().toLowerCase() : "";
    const logicalKey = slugKey
      ? `${item.type || item.kind}:slug:${slugKey}`
      : `${item.type || item.kind}:title:${String(item.title || "")
          .trim()
          .toLowerCase()}|cat:${String(item.category || "")
          .trim()
          .toLowerCase()}|price:${String(item.price ?? item.hourlyRate ?? "")}`;
    const idKey = `${item.type || item.kind}:id:${String(item.id || item._id || "")}`;
    if (seenId.has(idKey) || seenLogical.has(logicalKey)) continue;
    seenId.add(idKey);
    seenLogical.add(logicalKey);
    out.push(item);
  }
  return out;
};

const toHomeFallbackDto = (item: HomeListing) => ({
  _id: item._id,
  id: item._id,
  type: item.type,
  kind: item.type,
  slug: item.slug || null,
  title: item.title,
  name: item.title,
  description: item.description,
  price: item.price,
  salePrice: item.salePrice ?? item.price,
  originalPrice: item.originalPrice,
  oldPrice: item.originalPrice,
  discountPercent: item.discountPercent ?? 0,
  isOnSale: item.isSale,
  isSale: item.isSale,
  category: item.category,
  ratingAvg: item.ratingAvg,
  ratingCount: item.ratingCount,
  stats: {
    likes: item.stats.likes,
    views: item.stats.views,
    orders: item.stats.orders,
    purchases: item.stats.orders
  },
  likes: item.stats.likes,
  views: item.stats.views,
  orders: item.stats.orders,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt || item.createdAt,
  coverImageUrl: item.coverImageUrl,
  coverImage: item.coverImageUrl,
  imageUrl: item.coverImageUrl,
  image: item.coverImageUrl,
  thumbnail: item.coverImageUrl,
  cardImageUrl: item.coverImageUrl,
  images: item.images
});

const serializeHomeItems = async (items: HomeListing[], locale?: Request["locale"]) => {
  if (!items.length) return [];

  const productIds = items.filter((item) => item.type === "product").map((item) => item._id);
  const serviceIds = items.filter((item) => item.type === "service").map((item) => item._id);

  const [productDocs, serviceDocs] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).populate("createdBy", "name username role avatarUrl").lean()
      : Promise.resolve([] as any[]),
    serviceIds.length
      ? Service.find({ _id: { $in: serviceIds } }).populate("createdBy", "name username role avatarUrl").lean()
      : Promise.resolve([] as any[])
  ]);

  const productMap = new Map(productDocs.map((doc) => [String(doc._id), toDetailDto(doc, locale)]));
  const serviceMap = new Map(serviceDocs.map((doc) => [String(doc._id), attachServiceCover(doc, locale)]));

  return items.map((item) => {
    if (item.type === "product") {
      return productMap.get(item._id) || toHomeFallbackDto(item);
    }
    return serviceMap.get(item._id) || toHomeFallbackDto(item);
  });
};

export const getHomeListings = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "8"), 10) || 8, 1), 12);
    const perTypeLimit = limit * 3;

    const [topProducts, topServices, newProducts, newServices, saleProducts, saleServices] = await Promise.all([
      fetchHomeListingsByType("product", "topRated", perTypeLimit),
      fetchHomeListingsByType("service", "topRated", perTypeLimit),
      fetchHomeListingsByType("product", "newest", perTypeLimit),
      fetchHomeListingsByType("service", "newest", perTypeLimit),
      fetchSaleListingsByType("product", perTypeLimit),
      fetchSaleListingsByType("service", perTypeLimit)
    ]);

    const topRatedMerged = [...topProducts, ...topServices];
    const newestMerged = [...newProducts, ...newServices];
    const saleMerged = [...saleProducts, ...saleServices];

    const topRatedRaw = selectTopRatedListings(topRatedMerged, limit);
    const topRated = await serializeHomeItems(topRatedRaw, req.locale);

    const topRatedKeys = new Set(topRatedRaw.map((item) => toTypeIdKey(item)));
    const newestRaw = selectNewestListings(newestMerged, limit, topRatedKeys);
    const newest = await serializeHomeItems(newestRaw, req.locale);

    const latestFallbackRaw = selectNewestListings([...newestMerged, ...topRatedMerged], limit);
    const discountedRaw = selectSaleListings(saleMerged, latestFallbackRaw, limit);
    const discounted = await serializeHomeItems(discountedRaw, req.locale);

    const weeklyTopRaw = selectWeeklyTopListings([...topRatedMerged, ...newestMerged], latestFallbackRaw, limit);
    const weeklyTop = await serializeHomeItems(weeklyTopRaw, req.locale);

    const recommendations = await buildRecommendationModulesSafe({
      surface: "HOME",
      locale: req.locale,
      userId: req.user?._id || null,
      limitPerModule: 4
    }, "listing.home.recommendations");

    return res.json({
      topRated,
      newest,
      discounted,
      weeklyTop,
      recommendations
    });
  } catch (err) {
    console.error("getHomeListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getHomeFeatured = getHomeListings;

const resolveDealKind = (item: any): ListingKind => {
  const type = String(item?.type || "").trim().toLowerCase();
  if (type === "service") return "service";
  if (type === "product") return "product";
  const kind = String(item?.kind || "").trim().toLowerCase();
  return kind === "service" ? "service" : "product";
};

const toDealId = (item: { _id?: unknown; id?: unknown }): string => String(item?._id || item?.id || "");
const toDealTypeIdKey = (item: Pick<DealListing, "_id" | "type">): string => `${item.type}:${item._id}`;

const normalizeDealSale = (item: {
  price?: unknown;
  salePrice?: unknown;
  discountPercent?: unknown;
}): DealSaleMeta =>
  resolveDealSaleMeta({
    price: item.price,
    salePrice: item.salePrice,
    discountPercent: item.discountPercent
  });

const normalizeDealDto = (item: any): DealListing => {
  const type = resolveDealKind(item);
  const id = toDealId(item);
  const title = String(item?.title || item?.name || "");
  const name = String(item?.name || title);

  const rawPrice = parseNumber(item?.price ?? item?.hourlyRate);
  const price = rawPrice > 0 ? rawPrice : null;
  const saleMeta = normalizeDealSale({
    price,
    salePrice: item?.salePrice,
    discountPercent: item?.discountPercent
  });

  const likes = parseNumber(item?.stats?.likes ?? item?.likes);
  const views = parseNumber(item?.stats?.views ?? item?.views);
  const orders = parseNumber(item?.stats?.orders ?? item?.stats?.purchases ?? item?.orders ?? item?.purchases);

  const rawImages = sanitizeImageArray(item?.images);
  const fallbackCover = type === "product" ? PRODUCT_FALLBACK : SERVICE_FALLBACK;
  const resolvedCover = ensureReachable(resolveCoverImage({ ...item, images: rawImages })) || fallbackCover;
  const images = uniqueUrls([resolvedCover, ...rawImages].filter(Boolean) as string[]).slice(0, 5);
  const coverImageUrl = images[0] || resolvedCover || null;

  return {
    ...item,
    _id: id,
    id,
    type,
    kind: type,
    title,
    name,
    price: saleMeta.price,
    salePrice: saleMeta.salePrice,
    discountPercent: saleMeta.discountPercent,
    isOnSale: saleMeta.isOnSale,
    isSale: saleMeta.isOnSale,
    stats: {
      likes,
      views,
      orders,
      purchases: orders
    },
    likes,
    views,
    orders,
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || item?.createdAt || null,
    coverImageUrl,
    coverImage: coverImageUrl,
    imageUrl: coverImageUrl,
    image: coverImageUrl,
    thumbnail: coverImageUrl,
    cardImageUrl: coverImageUrl,
    images
  };
};

const dedupeDeals = (items: DealListing[]): DealListing[] => {
  const seen = new Set<string>();
  const out: DealListing[] = [];
  for (const item of items) {
    const key = toDealTypeIdKey(item);
    if (!item._id || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

const isSaleListingDto = (item: DealListing): boolean => normalizeDealSale(item).isOnSale;

const toDealSortTime = (item: any): number => {
  const stamp = item?.updatedAt || item?.createdAt || 0;
  const date = new Date(stamp);
  const ts = date.getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const sortDealItems = (a: any, b: any): number => {
  const discountDiff = parseNumber(b?.discountPercent) - parseNumber(a?.discountPercent);
  if (discountDiff !== 0) return discountDiff;
  return toDealSortTime(b) - toDealSortTime(a);
};

const selectDealsByType = (items: DealListing[], type: ListingKind, limit: number, onlySale: boolean): DealListing[] => {
  const typed = dedupeDeals(items.filter((item) => item.type === type));
  if (!typed.length) return [];

  const sorted = onlySale ? typed.filter((item) => isSaleListingDto(item)).sort(sortDealItems) : typed.sort((a, b) => toDealSortTime(b) - toDealSortTime(a));
  return sorted.slice(0, limit);
};

const toFallbackDeal = (item: DealListing): DealListing => ({
  ...item,
  salePrice: null,
  discountPercent: 0,
  isOnSale: false,
  isSale: false
});

const fillDealsByType = (saleItems: DealListing[], latestItems: DealListing[], type: ListingKind, limit: number): DealListing[] => {
  const pickedSale = selectDealsByType(saleItems, type, limit, true);
  if (pickedSale.length >= limit) return pickedSale.slice(0, limit);

  const seen = new Set(pickedSale.map((item) => toDealTypeIdKey(item)));
  const needed = limit - pickedSale.length;
  const fallback = selectDealsByType(latestItems, type, limit * 6, false)
    .filter((item) => !seen.has(toDealTypeIdKey(item)))
    .slice(0, needed)
    .map((item) => toFallbackDeal(item));

  return [...pickedSale, ...fallback];
};

export const getHomeDeals = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "3"), 10) || 3, 1), 24);
    const scanLimit = Math.max(limit * 8, 24);

    const [saleProductsRaw, saleServicesRaw, latestProductsRaw, latestServicesRaw] = await Promise.all([
      fetchSaleListingsByType("product", scanLimit),
      fetchSaleListingsByType("service", scanLimit),
      fetchHomeListingsByType("product", "newest", scanLimit),
      fetchHomeListingsByType("service", "newest", scanLimit)
    ]);

    const [serializedSale, serializedLatest] = await Promise.all([
      serializeHomeItems([...saleProductsRaw, ...saleServicesRaw], req.locale),
      serializeHomeItems([...latestProductsRaw, ...latestServicesRaw], req.locale)
    ]);

    const saleDtos = dedupeDeals(serializedSale.map((item) => normalizeDealDto(item)));
    const latestDtos = dedupeDeals(serializedLatest.map((item) => normalizeDealDto(item)));

    const products = fillDealsByType(saleDtos, latestDtos, "product", limit);
    const services = fillDealsByType(saleDtos, latestDtos, "service", limit);
    products.sort(sortDealItems);
    services.sort(sortDealItems);

    return res.json({
      limit,
      products,
      services
    });
  } catch (err) {
    console.error("getHomeDeals error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getTopListings = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "12"), 10) || 12, 1), 50);
    const weeklyOrdersWeight = Number(process.env.WEEKLY_TOP_ORDERS_WEIGHT ?? 5);
    const weeklyViewsWeight = Number(process.env.WEEKLY_TOP_VIEWS_WEIGHT ?? 0.05);
    const weeklyLikesWeight = Number(process.env.WEEKLY_TOP_LIKES_WEIGHT ?? 2);
    const { products, services } = await fetchListings();

    const withWeeklyScore = dedupeListingCards([
      ...products.map((product) => {
        const dto = toDetailDto(product, req.locale);
        const weeklyLikes = parseNumber((product as any)?.likes_7d ?? (product as any)?.likes7d);
        const weeklyViews = parseNumber((product as any)?.views_7d ?? (product as any)?.views7d);
        const weeklyOrders = parseNumber((product as any)?.orders_7d ?? (product as any)?.orders7d);
        const weeklyScore = weeklyOrders * weeklyOrdersWeight + weeklyViews * weeklyViewsWeight + weeklyLikes * weeklyLikesWeight;
        return {
          ...dto,
          stats: {
            ...(dto.stats || {}),
            weeklyLikes,
            weeklyViews,
            weeklyOrders
          },
          weeklyScore
        };
      }),
      ...services.map((service) => {
        const dto = attachServiceCover(service, req.locale);
        const weeklyLikes = parseNumber((service as any)?.likes_7d ?? (service as any)?.likes7d);
        const weeklyViews = parseNumber((service as any)?.views_7d ?? (service as any)?.views7d);
        const weeklyOrders = parseNumber((service as any)?.orders_7d ?? (service as any)?.orders7d);
        const weeklyScore = weeklyOrders * weeklyOrdersWeight + weeklyViews * weeklyViewsWeight + weeklyLikes * weeklyLikesWeight;
        return {
          ...dto,
          stats: {
            ...(dto.stats || {}),
            weeklyLikes,
            weeklyViews,
            weeklyOrders
          },
          weeklyScore
        };
      })
    ]);

    const weeklyTop = withWeeklyScore
      .sort((a: any, b: any) => {
        const scoreDiff = parseNumber(b?.weeklyScore) - parseNumber(a?.weeklyScore);
        if (scoreDiff !== 0) return scoreDiff;
        return toDealSortTime(b) - toDealSortTime(a);
      })
      .slice(0, limit);

    return res.json({ listings: weeklyTop });
  } catch (err) {
    console.error("getTopListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getLatestListings = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "12"), 10) || 12, 1), 50);
    const { products, services } = await fetchListings();
    const docs = dedupeListingCards([
      ...products.map((p) => toDetailDto(p, req.locale)),
      ...services.map((s) => attachServiceCover(s, req.locale))
    ]).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    return res.json({ listings: docs.slice(0, limit) });
  } catch (err) {
    console.error("getLatestListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
