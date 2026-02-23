import { Request, Response } from "express";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { AgentProfile } from "../models/AgentProfile";
import { User } from "../models/User";
import { ensureAbsoluteUrl } from "../utils/imageHelpers";
import { isLocalImageUrl, localImageExists, resolveCoverImage, sanitizeImageArray } from "../utils/resolveCoverImage";
import { resolveAvatarUrl } from "../utils/avatarImage";

type ListingKind = "product" | "service";
type HomeListing = {
  _id: string;
  type: ListingKind;
  slug?: string | null;
  title: string;
  description: string;
  price: number | null;
  category: string | null;
  ratingAvg: number;
  ratingCount: number;
  stats: { likes: number; views: number; orders: number };
  createdAt: Date;
  coverImageUrl: string | null;
  images: string[];
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
      .populate("createdBy", "name avatarUrl"),
    Service.find({})
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate("createdBy", "name avatarUrl")
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
  const likes = parseNumber(doc.likes);
  const views = parseNumber(doc.views);
  const orders = parseNumber(doc.orders);
  return {
    _id: String(doc._id),
    type: kind,
    slug: typeof doc.slug === "string" ? doc.slug : null,
    title: String(doc.title || doc.name || ""),
    description: String(doc.description || ""),
    price: pickPrice(kind, doc),
    category: typeof doc.category === "string" ? doc.category : null,
    ratingAvg: parseNumber(doc.ratingAvg ?? doc.rating?.avg),
    ratingCount: parseNumber(ratingCount),
    stats: { likes, views, orders },
    createdAt: new Date(doc.createdAt),
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
        ratingAvg: "$__ratingAvg",
        ratingCount: "$__ratingCount",
        likes: { $ifNull: ["$likes", 0] },
        orders: { $ifNull: ["$orders", 0] },
        views: { $ifNull: ["$views", 0] },
        createdAt: 1,
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

const dedupeByTypeId = (items: HomeListing[]): HomeListing[] => {
  const seen = new Set<string>();
  const out: HomeListing[] = [];
  for (const item of items) {
    const key = `${item.type}:${item._id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
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

const dedupeByLogicalKey = (items: HomeListing[]): HomeListing[] => {
  const seen = new Set<string>();
  const out: HomeListing[] = [];
  for (const item of items) {
    const logicalKey =
      item.slug && item.slug.trim()
        ? `${item.type}:slug:${item.slug.trim().toLowerCase()}`
        : `${item.type}:title:${item.title.trim().toLowerCase()}|cat:${(item.category || "").trim().toLowerCase()}|price:${String(
            item.price ?? ""
          )}`;
    if (seen.has(logicalKey)) continue;
    seen.add(logicalKey);
    out.push(item);
  }
  return out;
};

const reduceCoverRepeats = (items: HomeListing[]): HomeListing[] => {
  const usedCovers = new Set<string>();
  return items.map((item) => {
    const candidates = [item.coverImageUrl, ...item.images].filter(Boolean) as string[];
    let chosen = candidates.find((url) => !usedCovers.has(url)) || item.coverImageUrl;
    if (!chosen) {
      chosen = item.type === "product" ? PRODUCT_FALLBACK : SERVICE_FALLBACK;
    }
    usedCovers.add(chosen);
    const images = [chosen, ...item.images.filter((img) => img !== chosen)].slice(0, 5);
    return {
      ...item,
      coverImageUrl: chosen,
      images
    };
  });
};

const toPublicHomeListing = (item: HomeListing) => ({
  _id: item._id,
  type: item.type,
  title: item.title,
  description: item.description,
  price: item.price,
  category: item.category,
  ratingAvg: item.ratingAvg,
  ratingCount: item.ratingCount,
  stats: item.stats,
  createdAt: item.createdAt,
  coverImageUrl: item.coverImageUrl,
  images: item.images
});

const resolvePublicOrigin = (req: Request): string => {
  const envOrigin =
    process.env.PUBLIC_ORIGIN ||
    process.env.API_BASE_URL ||
    process.env.BACKEND_ORIGIN ||
    process.env.SERVER_ORIGIN ||
    process.env.SERVER_URL;
  if (envOrigin && /^https?:\/\//i.test(envOrigin)) {
    return envOrigin.replace(/\/+$/, "");
  }
  const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.get("host") || "localhost:5001";
  return `${protocol}://${host}`.replace(/\/+$/, "");
};

const toAbsoluteUrl = (origin: string, value: string | null | undefined): string | null => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${origin}${value}`;
  return `${origin}/${value.replace(/^\/+/, "")}`;
};

const normalizeHomeResponseUrls = (origin: string, item: ReturnType<typeof toPublicHomeListing>) => {
  const fallback =
    item.type === "product" ? `${origin}/images/fallback-product.png` : `${origin}/images/fallback-service.png`;
  const coverImageUrl = toAbsoluteUrl(origin, item.coverImageUrl) || fallback;
  const images = (item.images || [])
    .map((img) => toAbsoluteUrl(origin, img))
    .filter(Boolean) as string[];

  const normalizedImages = [coverImageUrl, ...images.filter((img) => img !== coverImageUrl)].slice(0, 5);
  return {
    ...item,
    coverImageUrl,
    images: normalizedImages
  };
};

const daysSinceCreated = (createdAt: Date): number => {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
};

const computeTopScore = (item: HomeListing): number => {
  const recencyBoost = Math.max(0, 10 - daysSinceCreated(item.createdAt));
  return (
    item.ratingAvg * 5 +
    item.ratingCount * 2 +
    item.stats.orders * 3 +
    item.stats.views * 0.05 +
    recencyBoost
  );
};

export const getHomeListings = async (req: Request, res: Response) => {
  try {
    const publicOrigin = resolvePublicOrigin(req);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "8"), 10) || 8, 1), 12);

    const [topProducts, topServices, newProducts, newServices, discountedProducts] = await Promise.all([
      fetchHomeListingsByType("product", "topRated", limit),
      fetchHomeListingsByType("service", "topRated", limit),
      fetchHomeListingsByType("product", "newest", limit),
      fetchHomeListingsByType("service", "newest", limit),
      Product.aggregate([
        { $match: { status: "ACTIVE", oldPrice: { $exists: true, $gt: 0 } } },
        { $addFields: { __oldPrice: { $ifNull: ["$oldPrice", 0] } } },
        { $match: { $expr: { $gt: ["$__oldPrice", "$price"] } } },
        { $sort: { createdAt: -1 } },
        { $limit: limit * 3 }
      ]).then((docs) => docs.map((doc) => toHomeListing("product", doc, parseNumber(doc.ratingCount))))
    ]);

    const topRatedMerged = [...topProducts, ...topServices];
    const topRatedUnique = reduceCoverRepeats(dedupeByTypeId(dedupeByLogicalKey([...topRatedMerged])));
    const allNoRatings = topRatedUnique.every((item) => item.ratingCount === 0);

    const topRatedRaw = [...topRatedUnique]
      .sort((a, b) => {
        if (allNoRatings) {
          if (b.stats.views !== a.stats.views) return b.stats.views - a.stats.views;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        const bScore = computeTopScore(b);
        const aScore = computeTopScore(a);
        if (bScore !== aScore) return bScore - aScore;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, limit);

    const topRated = topRatedRaw
      .map(toPublicHomeListing)
      .map((item) => normalizeHomeResponseUrls(publicOrigin, item));

    const topRatedKeys = new Set(topRatedRaw.map((item) => `${item.type}:${item._id}`));
    const newestMerged = [...newProducts, ...newServices];
    const newestRaw = reduceCoverRepeats(
      dedupeByTypeId(
        dedupeByLogicalKey([...newestMerged].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      ).filter((item) => !topRatedKeys.has(`${item.type}:${item._id}`))
    ).slice(0, limit);

    const newest = newestRaw
      .map(toPublicHomeListing)
      .map((item) => normalizeHomeResponseUrls(publicOrigin, item));

    const latestFallbackRaw = reduceCoverRepeats(
      dedupeByTypeId(
        dedupeByLogicalKey([...newestMerged, ...topRatedMerged].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      )
    ).slice(0, limit);

    const discountedRawBase = reduceCoverRepeats(dedupeByTypeId(dedupeByLogicalKey(discountedProducts))).slice(0, limit);
    const discountedRaw = discountedRawBase.length ? discountedRawBase : latestFallbackRaw;
    const discounted = discountedRaw
      .map(toPublicHomeListing)
      .map((item) => normalizeHomeResponseUrls(publicOrigin, item));

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const weeklyTopBase = reduceCoverRepeats(
      dedupeByTypeId(dedupeByLogicalKey([...topRatedMerged, ...newestMerged]))
    )
      .map((item) => {
        const ageMs = Date.now() - new Date(item.createdAt).getTime();
        const recencyBonus = ageMs <= sevenDaysMs ? 20 : 0;
        const score = item.stats.orders * 4 + item.stats.views * 0.08 + item.stats.likes * 1.5 + item.ratingAvg * 2 + recencyBonus;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item)
      .slice(0, limit);

    const weeklyTopRaw = weeklyTopBase.length ? weeklyTopBase : latestFallbackRaw;
    const weeklyTop = weeklyTopRaw
      .map(toPublicHomeListing)
      .map((item) => normalizeHomeResponseUrls(publicOrigin, item));

    return res.json({
      topRated,
      newest,
      discounted,
      weeklyTop
    });
  } catch (err) {
    console.error("getHomeListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getHomeFeatured = getHomeListings;

export const getTopListings = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || "12"), 10), 50);
    const { products, services } = await fetchListings();
    const agentMap = await buildAgentProfilesMap(products, services);
    const docs = [
      ...products.map((p) => buildListing("product", p, agentMap)),
      ...services.map((s) => buildListing("service", s, agentMap))
    ];
    const scored = dedupeListingCards(docs)
      .map((listing) => ({
        ...listing,
        score: (listing.stats.likes ?? 0) + (listing.stats.views ?? 0) / 10 + (listing.stats.orders ?? 0) * 5
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...rest }) => rest);
    return res.json({ listings: scored });
  } catch (err) {
    console.error("getTopListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getLatestListings = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || "12"), 10), 50);
    const { products, services } = await fetchListings();
    const agentMap = await buildAgentProfilesMap(products, services);
    const docs = dedupeListingCards([
      ...products.map((p) => buildListing("product", p, agentMap)),
      ...services.map((s) => buildListing("service", s, agentMap))
    ]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ listings: docs.slice(0, limit) });
  } catch (err) {
    console.error("getLatestListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
