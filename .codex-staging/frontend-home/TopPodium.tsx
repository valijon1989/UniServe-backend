"use client";

import { useEffect, useState } from "react";
import { client } from "@/api/client";
import ProductCard from "@/components/ProductCard";
import { ServiceCard } from "@/components/services/ServiceCard";
import { useI18n } from "@/context/i18n";
import { fetchPublicServicesFeed, fetchTrendingServicesFeed } from "@/lib/publicServicesFeed";
import { useAuthStore } from "@/store/auth";
import {
  normalizeListing,
  toProductCardProps,
  toServiceCardProps,
  type NormalizedListing
} from "@/lib/normalizeListing";

type TopPayload = {
  products?: any[];
  services?: any[];
  items?: any[];
  top?: any[];
  data?: {
    products?: any[];
    services?: any[];
    items?: any[];
    top?: any[];
  };
};

type TopData = {
  products: NormalizedListing[];
  services: NormalizedListing[];
  source: string;
};

type TopEndpointAvailability = {
  homeTop: boolean | null;
  splitTop: boolean | null;
};

type TopCacheMode = "public" | "auth";

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const TOP_MODE = (process.env.NEXT_PUBLIC_HOME_TOP_SOURCE || "trending").toLowerCase();
const TOP_AVAILABILITY_KEY = "home_top_endpoint_availability_v1";
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

let topAvailabilityCache: TopEndpointAvailability = {
  homeTop: null,
  splitTop: null
};
const topDataCache: Partial<Record<TopCacheMode, TopData>> = {};
const topDataPromise: Partial<Record<TopCacheMode, Promise<TopData>>> = {};

const readTopAvailability = (): TopEndpointAvailability => {
  if (typeof window === "undefined") return topAvailabilityCache;
  if (
    topAvailabilityCache.homeTop !== null ||
    topAvailabilityCache.splitTop !== null
  ) {
    return topAvailabilityCache;
  }

  try {
    const raw = window.localStorage.getItem(TOP_AVAILABILITY_KEY);
    if (!raw) return topAvailabilityCache;
    const parsed = JSON.parse(raw) as Partial<TopEndpointAvailability>;
    topAvailabilityCache = {
      homeTop:
        parsed.homeTop === true ? true : parsed.homeTop === false ? false : null,
      splitTop:
        parsed.splitTop === true ? true : parsed.splitTop === false ? false : null
    };
  } catch {
    topAvailabilityCache = { homeTop: null, splitTop: null };
  }

  return topAvailabilityCache;
};

const writeTopAvailability = (patch: Partial<TopEndpointAvailability>) => {
  topAvailabilityCache = {
    ...topAvailabilityCache,
    ...patch
  };
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      TOP_AVAILABILITY_KEY,
      JSON.stringify(topAvailabilityCache)
    );
  } catch {
    // ignore storage issues
  }
};

const resolveType = (item: any): "product" | "service" | "unknown" => {
  const type = String(item?.type ?? item?.kind ?? "").toLowerCase();
  if (type === "product") return "product";
  if (type === "service") return "service";
  return "unknown";
};

const splitTopPayload = (payload: TopPayload) => {
  const directProducts = asArray(payload?.products ?? payload?.data?.products);
  const directServices = asArray(payload?.services ?? payload?.data?.services);

  if (directProducts.length > 0 || directServices.length > 0) {
    return { products: directProducts, services: directServices };
  }

  const mixed = asArray(payload?.items ?? payload?.top ?? payload?.data?.items ?? payload?.data?.top);
  const products = mixed.filter((item) => resolveType(item) === "product");
  const services = mixed.filter((item) => resolveType(item) === "service");
  return { products, services };
};

const extractItems = (payload: any): any[] =>
  asArray(
    payload?.items ??
    payload?.products ??
    payload?.services ??
    payload?.data?.items ??
    payload?.data?.products ??
    payload?.data?.services ??
    payload
  );

const pickCanonicalId = (
  item: any,
  kind: "product" | "service",
  fallback: string
) => {
  const candidates =
    kind === "product"
      ? [
          item?.productId,
          item?.listingId,
          item?.targetId,
          item?.refId,
          item?._id,
          item?.id
        ]
      : [
          item?.serviceId,
          item?.listingId,
          item?.targetId,
          item?.refId,
          item?._id,
          item?.id
        ];

  const normalized = candidates
    .map((value) => (value === undefined || value === null ? "" : String(value).trim()))
    .filter(Boolean);

  const objectIdCandidate = normalized.find((value) => OBJECT_ID_RE.test(value));
  if (objectIdCandidate) return objectIdCandidate;
  return normalized[0] || fallback;
};

const normalizeTop = (items: any[], kind: "product" | "service"): NormalizedListing[] => {
  return items.map((item, idx) => {
    const normalized = normalizeListing(item, kind, idx);
    const id = pickCanonicalId(item, kind, normalized.id);
    return {
      ...normalized,
      id,
      _id: normalized._id ?? (item?._id ? String(item._id) : undefined),
      type: kind,
      href: kind === "product" ? `/products/${id}` : `/services/${id}`
    };
  });
};

const getStatus = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status;

const isProtectedStatus = (error: unknown) => {
  const status = getStatus(error);
  return status === 401 || status === 403;
};

const fetchHomeTop = async (): Promise<TopData> => {
  const res = await client.get<TopPayload>("/home/top", {
    params: { limit: 24 },
    headers: { "X-Skip-Auth": "1" }
  });
  const { products, services } = splitTopPayload(res.data || {});
  return {
    products: normalizeTop(products, "product").slice(0, 3),
    services: normalizeTop(services, "service").slice(0, 3),
    source: "home/top"
  };
};

const fetchSplitTop = async (): Promise<TopData> => {
  const [productsRes, servicesRes] = await Promise.all([
    client.get("/products/top", { params: { limit: 3 }, headers: { "X-Skip-Auth": "1" } }),
    client.get("/services/top", { params: { limit: 3 }, headers: { "X-Skip-Auth": "1" } })
  ]);

  return {
    products: normalizeTop(extractItems(productsRes.data), "product").slice(0, 3),
    services: normalizeTop(extractItems(servicesRes.data), "service").slice(0, 3),
    source: "products/top+services/top"
  };
};

const fetchPublicTop = async (): Promise<TopData> => {
  const [productsRes, servicesRes] = await Promise.all([
    client.get("/products", {
      params: { limit: 3, order: "latest" },
      headers: { "X-Skip-Auth": "1" }
    }),
    fetchPublicServicesFeed({ limit: 3, sort: "newest" })
  ]);

  return {
    products: normalizeTop(extractItems(productsRes.data), "product").slice(0, 3),
    services: normalizeTop(extractItems(servicesRes.data), "service").slice(0, 3),
    source: `products+services:${servicesRes.source}`
  };
};

const fetchTrendingTop = async (): Promise<TopData> => {
  const [productsRes, servicesRes] = await Promise.all([
    client.get("/products/trending", { params: { limit: 3, page: 1 } }),
    fetchTrendingServicesFeed({ limit: 3, page: 1 })
  ]);

  return {
    products: normalizeTop(extractItems(productsRes.data), "product").slice(0, 3),
    services: normalizeTop(extractItems(servicesRes.data), "service").slice(0, 3),
    source: `products/trending+services/trending:${servicesRes.source}`
  };
};

const fetchTopWithFallback = async (preferProtected: boolean): Promise<TopData> => {
  if (!preferProtected) {
    if (TOP_MODE === "auto") {
      const availability = readTopAvailability();

      if (availability.homeTop !== false) {
        try {
          const data = await fetchHomeTop();
          writeTopAvailability({ homeTop: true });
          return data;
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 404) {
            writeTopAvailability({ homeTop: false });
          }
        }
      }

      if (availability.splitTop !== false) {
        try {
          const data = await fetchSplitTop();
          writeTopAvailability({ splitTop: true });
          return data;
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 404) {
            writeTopAvailability({ splitTop: false });
          }
        }
      }
    }

    return fetchPublicTop();
  }

  // Default: no probing endpoints that may not exist on local backend.
  // Set NEXT_PUBLIC_HOME_TOP_SOURCE=auto to enable probing /home/top and /products|services/top.
  if (TOP_MODE !== "auto") {
    try {
      return await fetchTrendingTop();
    } catch (error) {
      if (!isProtectedStatus(error)) throw error;
      return fetchPublicTop();
    }
  }

  const availability = readTopAvailability();

  if (availability.homeTop !== false) {
    try {
      const data = await fetchHomeTop();
      writeTopAvailability({ homeTop: true });
      return data;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 404) {
        if (status === 401 || status === 403) return fetchPublicTop();
        throw err;
      }
      writeTopAvailability({ homeTop: false });
    }
  }

  if (availability.splitTop !== false) {
    try {
      const data = await fetchSplitTop();
      writeTopAvailability({ splitTop: true });
      return data;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status && status !== 404) {
        if (status === 401 || status === 403) return fetchPublicTop();
        throw err;
      }
      writeTopAvailability({ splitTop: false });
    }
  }

  try {
    return await fetchTrendingTop();
  } catch (error) {
    if (!isProtectedStatus(error)) throw error;
    return fetchPublicTop();
  }
};

const loadTopDataOnce = async (mode: TopCacheMode): Promise<TopData> => {
  if (topDataCache[mode]) return topDataCache[mode] as TopData;
  if (!topDataPromise[mode]) {
    topDataPromise[mode] = fetchTopWithFallback(mode === "auth")
      .then((data) => {
        topDataCache[mode] = data;
        return data;
      })
      .finally(() => {
        delete topDataPromise[mode];
      });
  }
  return topDataPromise[mode] as Promise<TopData>;
};

export function TopPodium() {
  const [topProducts, setTopProducts] = useState<NormalizedListing[]>([]);
  const [topServices, setTopServices] = useState<NormalizedListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    if (!isHydrated) return;

    let active = true;
    const mode: TopCacheMode = isAuthenticated ? "auth" : "public";

    const loadTop = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await loadTopDataOnce(mode);

        if (!active) return;
        setTopProducts(data.products);
        setTopServices(data.services);
      } catch (err: any) {
        if (!active) return;
        setTopProducts([]);
        setTopServices([]);
        setError(
          err?.message ||
            t({
              en: "Could not load top podium data.",
              uz: "Top podium ma'lumotlarini yuklab bo'lmadi.",
              ru: "Не удалось загрузить данные топ-подиума.",
              ko: "탑 포디움 데이터를 불러오지 못했습니다."
            })
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTop();

    return () => {
      active = false;
    };
  }, [isAuthenticated, isHydrated]);

  const noopServiceAction = (_id: string, _next: boolean) => undefined;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-xl shadow-black/25">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sky-300">
            {t({ en: "Top podium", uz: "Top podium", ru: "Топ-подиум", ko: "탑 포디움" })}
          </p>
          <h2 className="text-2xl font-bold text-slate-50">
            {t({
              en: "Weekly top products and services",
              uz: "Haftalik top mahsulotlar va xizmatlar",
              ru: "Топ товаров и услуг недели",
              ko: "주간 인기 상품 및 서비스"
            })}
          </h2>
          <p className="text-sm text-slate-400">
            {t({
              en: "Updated from the top endpoint data feed.",
              uz: "Top endpoint ma'lumotlari asosida yangilanadi.",
              ru: "Обновляется на основе данных top endpoint.",
              ko: "top 엔드포인트 데이터를 기준으로 갱신됩니다."
            })}
          </p>
        </div>
        {loading && (
          <span className="text-xs text-slate-300">
            {t({ en: "Loading...", uz: "Yuklanmoqda...", ru: "Загрузка...", ko: "불러오는 중..." })}
          </span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
          <span className="inline-flex rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100 ring-1 ring-amber-500/40">
            {t({ en: "Top products", uz: "Top mahsulotlar", ru: "Топ товары", ko: "인기 상품" })}
          </span>
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={`product-skeleton-${idx}`} className="h-40 animate-pulse rounded-2xl bg-slate-800/60" />
              ))}
            </div>
          ) : topProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
              {t({
                en: "No top products found.",
                uz: "Top mahsulotlar topilmadi.",
                ru: "Топ товары не найдены.",
                ko: "인기 상품을 찾지 못했습니다."
              })}
            </div>
          ) : (
            <div className="grid gap-3">
              {topProducts.map((item) => (
                <ProductCard key={item.id ?? item._id} data={toProductCardProps(item)} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
          <span className="inline-flex rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-500/40">
            {t({ en: "Top services", uz: "Top xizmatlar", ru: "Топ услуги", ko: "인기 서비스" })}
          </span>
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={`service-skeleton-${idx}`} className="h-40 animate-pulse rounded-2xl bg-slate-800/60" />
              ))}
            </div>
          ) : topServices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
              {t({
                en: "No top services found.",
                uz: "Top xizmatlar topilmadi.",
                ru: "Топ услуги не найдены.",
                ko: "인기 서비스를 찾지 못했습니다."
              })}
            </div>
          ) : (
            <div className="grid gap-3">
              {topServices.map((item) => (
                <ServiceCard
                  key={item.id ?? item._id}
                  service={toServiceCardProps(item)}
                  onLike={noopServiceAction}
                  onSave={noopServiceAction}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
