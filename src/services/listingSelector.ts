export type ListingKind = "product" | "service";

export type ListingStats = {
  likes: number;
  views: number;
  orders: number;
  likes_7d: number;
  views_7d: number;
  orders_7d: number;
};

export type HomeSelectableListing = {
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
  coverImageUrl: string | null;
  images: string[];
};

type SaleMetaInput = {
  basePrice: unknown;
  salePrice: unknown;
  discountPercent: unknown;
  oldPrice?: unknown;
};

type DealSaleInput = {
  price: unknown;
  salePrice: unknown;
  discountPercent: unknown;
};

export type DealSaleMeta = {
  price: number | null;
  salePrice: number | null;
  discountPercent: number;
  isOnSale: boolean;
};

const parseNumberish = (value: unknown): number => {
  if (Array.isArray(value)) return value.length;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parsePositive = (value: unknown): number => {
  const parsed = parseNumberish(value);
  return parsed > 0 ? parsed : 0;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;
const roundInt = (value: number): number => Math.round(value);

const getByPath = (obj: unknown, path: string): unknown => {
  if (!obj || typeof obj !== "object") return undefined;
  const keys = path.split(".");
  let current: any = obj;
  for (const key of keys) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = current[key];
  }
  return current;
};

const pickPath = (obj: unknown, paths: string[]): unknown => {
  for (const path of paths) {
    const value = getByPath(obj, path);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

export const buildListingStats = (source: unknown): ListingStats => {
  return {
    likes: parseNumberish(pickPath(source, ["likes", "stats.likes"])),
    views: parseNumberish(pickPath(source, ["views", "stats.views"])),
    orders: parseNumberish(pickPath(source, ["orders", "stats.orders", "purchases", "stats.purchases"])),
    likes_7d: parseNumberish(pickPath(source, ["likes_7d", "likes7d", "stats.likes_7d", "stats.likes7d"])),
    views_7d: parseNumberish(pickPath(source, ["views_7d", "views7d", "stats.views_7d", "stats.views7d"])),
    orders_7d: parseNumberish(pickPath(source, ["orders_7d", "orders7d", "stats.orders_7d", "stats.orders7d"]))
  };
};

export const resolveSaleMeta = (input: SaleMetaInput) => {
  const basePrice = parsePositive(input.basePrice);
  const explicitSalePrice = parsePositive(input.salePrice);
  const explicitDiscount = parseNumberish(input.discountPercent);
  const oldPrice = parsePositive(input.oldPrice);

  let price = basePrice;
  let originalPrice = basePrice;
  let salePrice: number | null = null;
  let discountPercent: number | null = null;
  let isSale = false;

  if (basePrice > 0 && explicitSalePrice > 0 && explicitSalePrice < basePrice) {
    price = explicitSalePrice;
    originalPrice = basePrice;
    salePrice = explicitSalePrice;
    discountPercent = round2(((basePrice - explicitSalePrice) / basePrice) * 100);
    isSale = true;
  } else if (basePrice > 0 && explicitDiscount > 0 && explicitDiscount < 100) {
    originalPrice = basePrice;
    price = round2(basePrice * (1 - explicitDiscount / 100));
    if (price > 0 && price < originalPrice) {
      salePrice = price;
      discountPercent = round2(explicitDiscount);
      isSale = true;
    }
  }

  if (!isSale) {
    return {
      price: basePrice > 0 ? basePrice : null,
      originalPrice: oldPrice > basePrice ? oldPrice : basePrice > 0 ? basePrice : null,
      salePrice: null,
      discountPercent: null,
      isSale: false
    };
  }

  return {
    price: price > 0 ? price : null,
    originalPrice: originalPrice > 0 ? originalPrice : null,
    salePrice: salePrice && salePrice > 0 ? salePrice : null,
    discountPercent: discountPercent && discountPercent > 0 ? discountPercent : null,
    isSale: true
  };
};

export const resolveDealSaleMeta = (input: DealSaleInput): DealSaleMeta => {
  const price = parsePositive(input.price);
  const explicitSalePrice = parsePositive(input.salePrice);
  const explicitDiscount = parseNumberish(input.discountPercent);

  const computedDiscountFromPrices =
    price > 0 && explicitSalePrice > 0 && explicitSalePrice < price ? roundInt(((price - explicitSalePrice) / price) * 100) : 0;
  const normalizedDiscount = explicitDiscount > 0 && explicitDiscount < 100 ? roundInt(explicitDiscount) : computedDiscountFromPrices;
  const normalizedSalePrice =
    explicitSalePrice > 0
      ? explicitSalePrice
      : price > 0 && normalizedDiscount > 0
        ? round2(price * (1 - normalizedDiscount / 100))
        : 0;
  const isOnSale = (price > 0 && normalizedSalePrice > 0 && normalizedSalePrice < price) || normalizedDiscount > 0;

  return {
    price: price > 0 ? price : null,
    salePrice: isOnSale && normalizedSalePrice > 0 ? normalizedSalePrice : null,
    discountPercent: isOnSale ? normalizedDiscount : 0,
    isOnSale
  };
};

export const toTypeIdKey = (item: Pick<HomeSelectableListing, "_id" | "type">): string => `${item.type}:${item._id}`;

const dedupeByTypeId = (items: HomeSelectableListing[]): HomeSelectableListing[] => {
  const seen = new Set<string>();
  const out: HomeSelectableListing[] = [];
  for (const item of items) {
    const key = toTypeIdKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

const dedupeByLogicalKey = (items: HomeSelectableListing[]): HomeSelectableListing[] => {
  const seen = new Set<string>();
  const out: HomeSelectableListing[] = [];
  for (const item of items) {
    const key =
      item.slug && item.slug.trim()
        ? `${item.type}:slug:${item.slug.trim().toLowerCase()}`
        : `${item.type}:title:${item.title.trim().toLowerCase()}|cat:${(item.category || "").trim().toLowerCase()}|price:${String(
            item.price ?? ""
          )}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

const reduceCoverRepeats = (items: HomeSelectableListing[]): HomeSelectableListing[] => {
  const used = new Set<string>();
  return items.map((item) => {
    const candidates = [item.coverImageUrl, ...item.images].filter(Boolean) as string[];
    const chosen = candidates.find((url) => !used.has(url)) || item.coverImageUrl;
    if (chosen) used.add(chosen);
    const images = chosen ? [chosen, ...item.images.filter((img) => img !== chosen)].slice(0, 5) : item.images.slice(0, 5);
    return {
      ...item,
      coverImageUrl: chosen || item.coverImageUrl,
      images
    };
  });
};

const daysSinceCreated = (createdAt: Date): number => {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
};

const computeTopRatedScore = (item: HomeSelectableListing): number => {
  const recencyBoost = Math.max(0, 10 - daysSinceCreated(item.createdAt));
  return item.ratingAvg * 5 + item.ratingCount * 2 + item.stats.orders * 3 + item.stats.views * 0.05 + recencyBoost;
};

const getWeeklyMetrics = (item: HomeSelectableListing, fallbackToTotals: boolean) => {
  const likes = item.stats.likes_7d;
  const views = item.stats.views_7d;
  const orders = item.stats.orders_7d;
  if (!fallbackToTotals) {
    return { likes, views, orders };
  }
  if (likes > 0 || views > 0 || orders > 0) {
    return { likes, views, orders };
  }
  return {
    likes: item.stats.likes,
    views: item.stats.views,
    orders: item.stats.orders
  };
};

export const selectTopRatedListings = (items: HomeSelectableListing[], limit: number): HomeSelectableListing[] => {
  const unique = reduceCoverRepeats(dedupeByTypeId(dedupeByLogicalKey(items)));
  const allNoRatings = unique.every((item) => item.ratingCount === 0);

  return [...unique]
    .sort((a, b) => {
      if (allNoRatings) {
        if (b.stats.views !== a.stats.views) return b.stats.views - a.stats.views;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      const bScore = computeTopRatedScore(b);
      const aScore = computeTopRatedScore(a);
      if (bScore !== aScore) return bScore - aScore;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);
};

export const selectNewestListings = (
  items: HomeSelectableListing[],
  limit: number,
  excludeKeys?: Set<string>
): HomeSelectableListing[] => {
  return reduceCoverRepeats(
    dedupeByTypeId(
      dedupeByLogicalKey([...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    ).filter((item) => !excludeKeys?.has(toTypeIdKey(item)))
  ).slice(0, limit);
};

export const selectSaleListings = (
  saleCandidates: HomeSelectableListing[],
  fallbackCandidates: HomeSelectableListing[],
  limit: number
): HomeSelectableListing[] => {
  const saleItems = reduceCoverRepeats(dedupeByTypeId(dedupeByLogicalKey(saleCandidates.filter((item) => item.isSale))))
    .sort((a, b) => {
      const discountDiff = (b.discountPercent || 0) - (a.discountPercent || 0);
      if (discountDiff !== 0) return discountDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);

  if (saleItems.length) return saleItems;
  return selectNewestListings(fallbackCandidates, limit);
};

export const selectWeeklyTopListings = (
  items: HomeSelectableListing[],
  fallbackCandidates: HomeSelectableListing[],
  limit: number
): HomeSelectableListing[] => {
  const unique = reduceCoverRepeats(dedupeByTypeId(dedupeByLogicalKey(items)));
  const hasWeeklySignals = unique.some((item) => item.stats.orders_7d > 0 || item.stats.views_7d > 0 || item.stats.likes_7d > 0);

  const top = unique
    .map((item) => {
      const metrics = getWeeklyMetrics(item, !hasWeeklySignals);
      const score = metrics.orders * 5 + metrics.views * 0.05 + metrics.likes * 2;
      return { item, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime();
    })
    .map((entry) => entry.item)
    .slice(0, limit);

  if (top.length) return top;
  return selectNewestListings(fallbackCandidates, limit);
};
