import { api } from "./client";
import type { LocalizedText, SupportedLocale } from "@/lib/localization";
import { normalizeMarketplaceSubtitle, normalizeMarketplaceTitle } from "@/lib/marketplaceNaming";

export interface ProductRating {
  avg: number;
  count: number;
}

export interface ProductStats {
  views: number;
  likes: number;
  purchases: number;
  orders?: number;
}

export interface ProductVendor {
  _id?: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  rating?: number;
  location?: string;
  contact?: string;
}

export interface ProductAgentSummary {
  id?: string;
  name?: string;
  avatarUrl?: string;
  rating?: number;
}

export interface ProductSellerSummary {
  id?: string;
  name?: string;
  avatarUrl?: string | null;
  rating?: number;
  reviewCount?: number;
  verified?: boolean;
  contact?: string | null;
  location?: string | null;
}

export interface ProductShippingInfo {
  deliveryType?: string;
  deliveryLabel?: string;
  estimated?: string;
  promise?: string;
  origin?: string;
  fee?: number;
  freeDelivery?: boolean;
  freeReturn?: boolean;
  fastShipping?: boolean;
}

export interface ProductReturnPolicy {
  summary?: string;
  exchange?: string;
  warranty?: string;
  support?: string;
}

export interface ProductCardBadge {
  key: string;
  label: string;
  tone?: string;
  icon?: string;
}

export interface ProductCardSummary {
  route?: string;
  title?: string;
  subtitle?: string;
  categoryLabel?: string;
  primaryImage?: string;
  gallery?: string[];
  price?: {
    currentAmount?: number | null;
    currentFormatted?: string;
    originalAmount?: number | null;
    originalFormatted?: string | null;
    discountPercent?: number;
    currency?: string;
  };
  trust?: {
    ratingAverage?: number;
    reviewCount?: number;
    soldCount?: number;
    sellerName?: string;
    verifiedSeller?: boolean;
  };
  logistics?: {
    deliveryLabel?: string;
    etaLabel?: string;
    returnLabel?: string;
    stockLabel?: string;
    freeDelivery?: boolean;
    fastShipping?: boolean;
    limitedStock?: boolean;
  };
  badges?: ProductCardBadge[];
  seller?: ProductSellerSummary;
  cta?: {
    primaryLabel?: string;
    secondaryLabel?: string;
    quickViewLabel?: string;
    saveLabel?: string;
  };
}

export interface Product {
  _id?: string;
  id?: string;
  slug?: string | null;
  route?: string;
  title?: string;
  name?: string;
  shortDescription?: string;
  fullDescription?: string;
  description?: string;
  titleLocalized?: LocalizedText;
  nameLocalized?: LocalizedText;
  descriptionLocalized?: LocalizedText;
  localized?: {
    title?: LocalizedText;
    name?: LocalizedText;
    description?: LocalizedText;
  };
  price?: number;
  oldPrice?: number;
  currency?: string;
  currentPrice?: number;
  thumbnail?: string;
  primaryImage?: string;
  gallery?: string[];
  images?: string[];
  likes?: number;
  likeCount?: number;
  views?: number;
  viewCount?: number;
  orders?: number;
  purchases?: number;
  purchaseCount?: number;
  category?: string;
  categoryDisplay?: string | null;
  subcategoryDisplay?: string | null;
  subCategory?: string;
  createdAt?: string;
  stock?: number;
  stockCount?: number;
  stockStatus?: string;
  seller?: ProductVendor;
  sellerSummary?: ProductSellerSummary;
  createdBy?: {
    _id?: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
  agent?: ProductAgentSummary;
  shippingInfo?: ProductShippingInfo;
  returnPolicy?: ProductReturnPolicy;
  rating?: ProductRating;
  reviewCount?: number;
  soldCount?: number;
  stats?: ProductStats;
  specifications?: Record<string, string>;
  vendor?: ProductVendor;
  brand?: string;
  condition?: string;
  size?: string;
  season?: string;
  audience?: string;
  badges?: string[];
  specs?: Array<{ label?: string; value?: string }>;
  recommendations?: unknown[];
  card?: ProductCardSummary;
}

export interface ProductsResponse {
  page: number;
  limit: number;
  total: number;
  products: Product[];
}

export type TrendProduct = Product;

export interface TrendResponse<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: T[];
}

export interface ProductInteractionResult {
  liked?: boolean;
  likeCount?: number;
  stats?: ProductStats;
}

const ENDPOINT_MISSING_STATUSES = [404, 405, 422, 501];

const asRecord = (value: unknown): Record<string, any> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, any>;
};

const asLocalizedText = (value: unknown): LocalizedText | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;
  const localized: LocalizedText = {};
  if (typeof record.en === "string") localized.en = record.en;
  if (typeof record.uz === "string") localized.uz = record.uz;
  if (typeof record.ru === "string") localized.ru = record.ru;
  if (typeof record.ko === "string") localized.ko = record.ko;
  return Object.keys(localized).length ? localized : undefined;
};

const extractLocalizedField = (product: Record<string, any>, field: string): LocalizedText | undefined => {
  const direct =
    asLocalizedText(product?.[`${field}Localized`]) ||
    asLocalizedText(product?.[`${field}_localized`]) ||
    asLocalizedText(asRecord(product?.localized)?.[field]);
  if (direct) return direct;

  const suffixed: LocalizedText = {};
  if (typeof product?.[`${field}_en`] === "string") suffixed.en = product[`${field}_en`];
  if (typeof product?.[`${field}_uz`] === "string") suffixed.uz = product[`${field}_uz`];
  if (typeof product?.[`${field}_ru`] === "string") suffixed.ru = product[`${field}_ru`];
  if (typeof product?.[`${field}_ko`] === "string") suffixed.ko = product[`${field}_ko`];
  return Object.keys(suffixed).length ? suffixed : undefined;
};

const asArrayOfStrings = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
};

const normalizeCardSummary = (product: Record<string, any>): ProductCardSummary | undefined => {
  const source = asRecord(product.card) || (asRecord(product.display) && asRecord(product.media) ? product : null);
  if (!source) return undefined;
  const display = asRecord(source.display);
  const media = asRecord(source.media);
  const pricing = asRecord(source.pricing);
  const trust = asRecord(source.trust);
  const logistics = asRecord(source.logistics);
  const seller = asRecord(source.seller);
  const cta = asRecord(source.cta);
  const badges = Array.isArray(source.badges)
    ? source.badges
        .map((badge) => asRecord(badge))
        .filter((badge): badge is Record<string, any> => Boolean(badge))
        .map((badge) => ({
          key: String(badge.key || ""),
          label: String(badge.label || ""),
          tone: typeof badge.tone === "string" ? badge.tone : undefined,
          icon: typeof badge.icon === "string" ? badge.icon : undefined
        }))
        .filter((badge) => badge.key && badge.label)
    : [];

  return {
    route: typeof source.route === "string" ? source.route : undefined,
    title: typeof source.title === "string" ? source.title : typeof display?.title === "string" ? display.title : undefined,
    subtitle: typeof source.subtitle === "string" ? source.subtitle : typeof display?.subtitle === "string" ? display.subtitle : undefined,
    categoryLabel:
      typeof source.categoryLabel === "string"
        ? source.categoryLabel
        : typeof display?.values === "object" && display?.values && typeof (display.values as any).category === "string"
          ? (display.values as any).category
          : undefined,
    primaryImage:
      typeof source.primaryImage === "string"
        ? source.primaryImage
        : typeof media?.primaryImage === "string"
          ? media.primaryImage
          : undefined,
    gallery:
      asArrayOfStrings(source.gallery).length > 0
        ? asArrayOfStrings(source.gallery)
        : asArrayOfStrings(media?.galleryPreview),
    price: pricing
      ? {
          currentAmount: Number(pricing.currentAmount ?? pricing.currentPrice),
          currentFormatted: typeof pricing.currentFormatted === "string" ? pricing.currentFormatted : undefined,
          originalAmount: Number(pricing.originalAmount ?? pricing.oldPrice),
          originalFormatted: typeof pricing.originalFormatted === "string" ? pricing.originalFormatted : undefined,
          discountPercent: Number(pricing.discountPercent ?? 0),
          currency: typeof pricing.currency === "string" ? pricing.currency : undefined
        }
      : undefined,
    trust: trust
      ? {
          ratingAverage: Number(trust.ratingAverage ?? 0),
          reviewCount: Number(trust.reviewCount ?? 0),
          soldCount: Number(trust.soldCount ?? 0),
          sellerName: typeof trust.sellerName === "string" ? trust.sellerName : undefined,
          verifiedSeller: Boolean(trust.verifiedSeller)
        }
      : undefined,
    logistics: logistics
      ? {
          deliveryLabel:
            typeof logistics.deliveryLabel === "string"
              ? logistics.deliveryLabel
              : typeof logistics.shippingLabel === "string"
                ? logistics.shippingLabel
                : undefined,
          etaLabel: typeof logistics.etaLabel === "string" ? logistics.etaLabel : undefined,
          returnLabel: typeof logistics.returnLabel === "string" ? logistics.returnLabel : undefined,
          stockLabel:
            typeof logistics.stockLabel === "string"
              ? logistics.stockLabel
              : typeof display?.values === "object" && display?.values && typeof (display.values as any).stockStatus === "string"
                ? (display.values as any).stockStatus
                : typeof logistics.stockStatus === "string"
                  ? logistics.stockStatus
                  : undefined,
          freeDelivery: Boolean(logistics.freeDelivery ?? logistics.freeShipping),
          fastShipping: Boolean(logistics.fastShipping),
          limitedStock: Boolean(logistics.limitedStock)
        }
      : undefined,
    badges,
    seller: seller
      ? {
          id: typeof seller.id === "string" ? seller.id : typeof seller.sellerId === "string" ? seller.sellerId : undefined,
          name:
            typeof seller.name === "string"
              ? seller.name
              : typeof seller.sellerName === "string"
                ? seller.sellerName
                : undefined,
          verified: Boolean(seller.verified ?? seller.sellerVerified)
        }
      : undefined,
    cta: cta
      ? {
          primaryLabel: typeof cta.primaryLabel === "string" ? cta.primaryLabel : undefined,
          secondaryLabel: typeof cta.secondaryLabel === "string" ? cta.secondaryLabel : undefined,
          quickViewLabel: typeof cta.quickViewLabel === "string" ? cta.quickViewLabel : undefined,
          saveLabel: typeof cta.saveLabel === "string" ? cta.saveLabel : undefined
        }
      : undefined
  };
};

const getStatus = (error: unknown) => {
  return (error as { response?: { status?: number } })?.response?.status;
};

const shouldTryNextEndpoint = (error: unknown) => {
  const status = getStatus(error);
  return typeof status === "number" && ENDPOINT_MISSING_STATUSES.includes(status);
};

const canUseRemoteProductInteraction = (id: string) => Boolean(String(id || "").trim());

const parseStats = (raw: unknown): ProductStats | undefined => {
  const root = asRecord(raw);
  const data = asRecord(root?.data) || root;
  const statsRaw = asRecord(data?.stats) || data;
  if (!statsRaw) return undefined;
  const views = Number(statsRaw.views ?? statsRaw.viewCount);
  const likes = Number(statsRaw.likes ?? statsRaw.likeCount);
  const purchases = Number(statsRaw.purchases ?? statsRaw.orders ?? statsRaw.purchaseCount);
  if (!Number.isFinite(views) && !Number.isFinite(likes) && !Number.isFinite(purchases)) return undefined;
  return {
    views: Number.isFinite(views) ? views : 0,
    likes: Number.isFinite(likes) ? likes : 0,
    purchases: Number.isFinite(purchases) ? purchases : 0
  };
};

async function postByPaths(paths: string[], body?: Record<string, any>) {
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      return await api.post(path, body || {});
    } catch (error) {
      if (shouldTryNextEndpoint(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  if (lastError) throw lastError;
  throw new Error("No endpoint matched");
}

const extractItems = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return (
    data.products
    || data.items
    || data.data?.items
    || data.data
    || []
  );
};

const normalizeProduct = (product: any, idx = 0): Product => {
  const id = product?.id || product?._id || String(idx);
  const card = normalizeCardSummary(product);
  const display = asRecord(product?.display);
  const media = asRecord(product?.media);
  const pricing = asRecord(product?.pricing);
  const trust = asRecord(product?.trust);
  const logistics = asRecord(product?.logistics);
  const seller = asRecord(product?.seller);
  const displayValues = asRecord(display?.values);
  const title = normalizeMarketplaceTitle(product?.title || product?.name || display?.title || card?.title, "Product");
  const images = asArrayOfStrings(product?.gallery).length
    ? asArrayOfStrings(product.gallery)
    : product?.images?.length
      ? product.images
      : asArrayOfStrings(media?.galleryPreview);
  const primaryImage =
    product?.primaryImage ||
    product?.thumbnail ||
    product?.imageUrl ||
    media?.primaryImage ||
    card?.primaryImage ||
    images[0];
  const titleLocalized = extractLocalizedField(product, "title");
  const nameLocalized = extractLocalizedField(product, "name");
  const descriptionLocalized = extractLocalizedField(product, "description");

  const rating: ProductRating = {
    avg: Number(product?.rating?.avg ?? product?.rating?.average ?? product?.rating ?? trust?.ratingAverage ?? 0),
    count: Number(product?.rating?.count ?? product?.ratingCount ?? product?.reviewCount ?? trust?.reviewCount ?? 0)
  };

  const stats: ProductStats = {
    views: Number(product?.stats?.views ?? product?.views ?? 0),
    likes: Number(product?.stats?.likes ?? product?.likes ?? 0),
    purchases: Number(product?.stats?.purchases ?? product?.orders ?? product?.purchases ?? product?.soldCount ?? trust?.soldCount ?? 0)
  };

  return {
    ...product,
    id,
    _id: product?._id ?? id,
    slug: product?.slug || product?.identity?.slug || null,
    route: product?.route || card?.route,
    title,
    name: normalizeMarketplaceTitle(product?.name || title, title),
    shortDescription: normalizeMarketplaceSubtitle(product?.shortDescription || display?.subtitle || card?.subtitle),
    fullDescription: normalizeMarketplaceSubtitle(product?.fullDescription || product?.description),
    description: normalizeMarketplaceSubtitle(product?.description || product?.shortDescription || display?.subtitle || card?.subtitle),
    titleLocalized,
    nameLocalized,
    descriptionLocalized,
    localized: {
      title: titleLocalized,
      name: nameLocalized,
      description: descriptionLocalized
    },
    currentPrice: Number(product?.currentPrice ?? pricing?.currentPrice ?? pricing?.currentAmount ?? product?.salePrice ?? product?.price ?? 0) || undefined,
    thumbnail: primaryImage,
    primaryImage,
    gallery: images.length ? images : primaryImage ? [primaryImage] : [],
    images: images.length ? images : primaryImage ? [primaryImage] : [],
    rating,
    stats,
    price: Number(product?.price ?? pricing?.currentPrice ?? pricing?.currentAmount ?? 0) || undefined,
    oldPrice: Number(product?.oldPrice ?? product?.originalPrice ?? pricing?.oldPrice ?? pricing?.originalAmount ?? 0) || undefined,
    reviewCount: rating.count,
    soldCount: Number(product?.soldCount ?? product?.orders ?? product?.purchases ?? stats.purchases ?? 0) || 0,
    category: product?.category || product?.identity?.category || displayValues?.category,
    categoryDisplay: product?.categoryDisplay || displayValues?.category || card?.categoryLabel || null,
    subcategoryDisplay: product?.subcategoryDisplay || displayValues?.subcategory || null,
    brand: product?.brand || displayValues?.brand,
    stockCount: Number(product?.stockCount ?? logistics?.stockCount ?? product?.stock ?? 0) || undefined,
    stockStatus: product?.stockStatus || logistics?.stockStatus || displayValues?.stockStatus,
    sellerSummary: product?.sellerSummary || (seller ? {
      id: typeof seller.sellerId === "string" ? seller.sellerId : undefined,
      name: typeof seller.sellerName === "string" ? seller.sellerName : undefined,
      verified: Boolean(seller.sellerVerified)
    } : undefined),
    shippingInfo: product?.shippingInfo || (logistics ? {
      deliveryType: typeof logistics.deliveryType === "string" ? logistics.deliveryType : undefined,
      deliveryLabel: typeof logistics.shippingLabel === "string" ? logistics.shippingLabel : undefined,
      freeDelivery: Boolean(logistics.freeShipping),
      fastShipping: Boolean(logistics.fastShipping)
    } : undefined),
    returnPolicy: product?.returnPolicy,
    card
  };
};

// Bazani ikki marta takrorlamaslik uchun dinamik endpoint prefiksi
const PRODUCTS_PATH = api.defaults.baseURL?.includes("/api")
  ? "/products"
  : "/api/products";

export async function getProducts(
  params: Record<string, any> = {},
  locale?: SupportedLocale
): Promise<ProductsResponse> {
  const res = await api.get(PRODUCTS_PATH, {
    params,
    headers: locale
      ? {
          "X-Locale": locale,
          "Accept-Language": locale
        }
      : undefined
  });
  const items = extractItems(res.data);

  const page = Number(res.data?.page ?? params.page ?? 1) || 1;
  const limit = Number(res.data?.limit ?? params.limit ?? 12) || 12;
  const total = Number(res.data?.total ?? res.data?.count ?? items.length) || items.length;

  return {
    page,
    limit,
    total,
    products: items.map(normalizeProduct)
  };
}

export async function getProductDetail(id: string, locale?: SupportedLocale): Promise<Product> {
  const res = await api.get(`${PRODUCTS_PATH}/${id}`, {
    headers: locale
      ? {
          "X-Locale": locale,
          "Accept-Language": locale
        }
      : undefined
  });
  return normalizeProduct(res.data, 0);
}

// Alias user so‘ragani uchun
export const getProductById = getProductDetail;

export async function addProductView(id: string) {
  if (!canUseRemoteProductInteraction(id)) return undefined;
  const res = await api.post(`${PRODUCTS_PATH}/${id}/view`);
  return parseStats(res.data);
}

export async function likeProduct(id: string) {
  if (!canUseRemoteProductInteraction(id)) return undefined;
  const res = await api.post(`${PRODUCTS_PATH}/${id}/like`);
  return parseStats(res.data);
}

export async function purchaseProduct(id: string) {
  if (!canUseRemoteProductInteraction(id)) return undefined;
  const res = await api.post(`${PRODUCTS_PATH}/${id}/purchase`);
  return parseStats(res.data);
}

export async function toggleProductLike(id: string, desiredLiked: boolean): Promise<ProductInteractionResult> {
  if (!canUseRemoteProductInteraction(id)) {
    return { liked: desiredLiked };
  }
  try {
    const res = await postByPaths([`${PRODUCTS_PATH}/${id}/like/toggle`, `${PRODUCTS_PATH}/${id}/likes/toggle`], {
      liked: desiredLiked
    });
    const root = asRecord(res.data);
    const data = asRecord(root?.data) || root || {};
    const stats = parseStats(data);
    const likeCount = Number(data.likeCount ?? data.likes ?? stats?.likes);
    return {
      liked: typeof data.liked === "boolean" ? data.liked : desiredLiked,
      likeCount: Number.isFinite(likeCount) ? likeCount : stats?.likes,
      stats
    };
  } catch (error) {
    if (!shouldTryNextEndpoint(error)) throw error;
  }

  if (desiredLiked) {
    const stats = await likeProduct(id);
    return {
      liked: true,
      likeCount: stats?.likes,
      stats
    };
  }

  return {
    liked: false
  };
}

const normalizeTrend = (data: any): TrendResponse<Product> => {
  const items = extractItems(data);
  const limit = Number(data?.limit) || items.length || 9;
  const total = Number(data?.total) || items.length;
  return {
    page: Number(data?.page) || 1,
    limit,
    total,
    totalPages: Number(data?.totalPages) || Math.max(1, Math.ceil(total / Math.max(1, limit))),
    items: items.map(normalizeProduct)
  };
};

export async function getTrendingProducts(page = 1, limit = 9): Promise<TrendResponse<TrendProduct>> {
  const res = await api.get(`${PRODUCTS_PATH}/trending`, { params: { page, limit } });
  return normalizeTrend(res.data);
}

export async function getLatestProducts(): Promise<TrendProduct[]> {
  const res = await api.get(PRODUCTS_PATH, { params: { order: "latest", limit: 20 } });
  const products = extractItems(res.data).map(normalizeProduct);
  return products.sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db - da;
  });
}
