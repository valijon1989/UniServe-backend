"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTopAgents, type TopAgent } from "@/api/agent";
import { client } from "@/api/client";
import { TopPodium } from "@/components/TopPodium";
import { EventsSection } from "@/components/EventsSection";
import { useI18n } from "@/context/i18n";
import { getHomeHeroCategoryHref, getHomeHeroPrimaryHref } from "@/lib/homeHeroRouting";
import { normalizeListing, type NormalizedListing } from "@/lib/normalizeListing";
import { fetchPublicServicesFeed, fetchTrendingServicesFeed } from "@/lib/publicServicesFeed";
import { useAuthStore } from "@/store/auth";

export default function HomePage() {
  const router = useRouter();
  const [agents, setAgents] = useState<TopAgent[]>([]);
  const [saleProducts, setSaleProducts] = useState<NormalizedListing[]>([]);
  const [saleServices, setSaleServices] = useState<NormalizedListing[]>([]);
  const [dealsCount, setDealsCount] = useState(0);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const salesLoadedRef = useRef<string | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  const isOnSale = (item: NormalizedListing) =>
    item.isOnSale === true ||
    item.isSale === true ||
    (item.salePrice != null &&
      item.price != null &&
      Number(item.salePrice) < Number(item.price)) ||
    (item.discountPercent != null && Number(item.discountPercent) > 0);

  const toTimestamp = (value?: string) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const pickVisibleCards = (items: NormalizedListing[]) => {
    const saleItems = items.filter(isOnSale);
    if (saleItems.length > 0) {
      return saleItems.slice(0, 3);
    }

    const latest = [...items]
      .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
      .slice(0, 3)
      .map((item) => {
        const normalizedPrice = item.salePrice > 0 ? item.salePrice : item.price;
        return {
          ...item,
          price: normalizedPrice,
          salePrice: normalizedPrice,
          discountPercent: 0,
          isOnSale: false,
          isSale: false
        };
      });
    return latest;
  };

  const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);
  const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
  const HOME_DEALS_MODE = (process.env.NEXT_PUBLIC_HOME_DEALS_SOURCE || "trending").toLowerCase();
  const getStatus = (error: unknown) =>
    (error as { response?: { status?: number } })?.response?.status;
  const isProtectedStatus = (error: unknown) => {
    const status = getStatus(error);
    return status === 401 || status === 403;
  };
  const extractItems = (payload: any): any[] =>
    asArray(
      payload?.items
      || payload?.products
      || payload?.services
      || payload?.data?.items
      || payload?.data?.products
      || payload?.data?.services
      || payload
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

  useEffect(() => {
    if (!isHydrated) return;

    const salesMode = isAuthenticated ? "auth" : "public";
    if (salesLoadedRef.current === salesMode) return;
    salesLoadedRef.current = salesMode;

    let active = true;

    const loadSales = async () => {
      let rawProducts: any[] = [];
      let rawServices: any[] = [];
      let source = salesMode === "auth" ? "products/trending+services/trending" : "products+services";

      const fetchPublicDeals = async () => {
        const [productsRes, servicesRes] = await Promise.all([
          client.get("/products", {
            params: { limit: 24, order: "latest" },
            headers: { "X-Skip-Auth": "1" }
          }),
          fetchPublicServicesFeed({ limit: 24, sort: "newest" })
        ]);

        rawProducts = extractItems(productsRes.data);
        rawServices = extractItems(servicesRes.data);
        source = `products+services:${servicesRes.source}`;
      };

      if (!isAuthenticated && (HOME_DEALS_MODE === "home-deals" || HOME_DEALS_MODE === "auto")) {
        try {
          const dealsRes = await client.get("/home/deals", {
            params: { limit: 24 },
            headers: { "X-Skip-Auth": "1" }
          });
          const payload = dealsRes.data || {};
          rawProducts = asArray(payload?.products ?? payload?.data?.products);
          rawServices = asArray(payload?.services ?? payload?.data?.services);
          source = "home/deals";
        } catch (dealsErr) {
          const status = getStatus(dealsErr);
          if (process.env.NODE_ENV !== "production") {
            console.info("Home deals fallback to trending", status || "unknown");
          }
        }
      }

      if (rawProducts.length === 0 && rawServices.length === 0 && isAuthenticated) {
        try {
          const [productsRes, servicesRes] = await Promise.all([
            client.get("/products/trending", { params: { limit: 24, page: 1 } }),
            fetchTrendingServicesFeed({ limit: 24, page: 1 })
          ]);
          rawProducts = extractItems(productsRes.data);
          rawServices = extractItems(servicesRes.data);
          source = `products/trending+services/trending:${servicesRes.source}`;
        } catch (fallbackErr) {
          if (!isProtectedStatus(fallbackErr)) {
            console.error("Home deals fallback load error", fallbackErr);
          }
        }
      }

      if (rawProducts.length === 0 && rawServices.length === 0) {
        try {
          await fetchPublicDeals();
        } catch (publicErr) {
          console.error("Home public deals load error", publicErr);
        }
      }

      const normalizedProducts = rawProducts.map((item, idx) => {
        const normalized = normalizeListing(item, "product", idx);
        const id = pickCanonicalId(item, "product", normalized.id);
        return {
          ...normalized,
          id,
          _id: normalized._id ?? (item?._id ? String(item._id) : undefined),
          type: "product" as const,
          href: `/products/${id}`
        };
      });
      const normalizedServices = rawServices.map((item, idx) => {
        const normalized = normalizeListing(item, "service", idx);
        const id = pickCanonicalId(item, "service", normalized.id);
        return {
          ...normalized,
          id,
          _id: normalized._id ?? (item?._id ? String(item._id) : undefined),
          type: "service" as const,
          href: `/services/${id}`
        };
      });
      const normalizedDeals = [...normalizedProducts, ...normalizedServices];

      if (active) {
        setDealsCount(normalizedDeals.length);
      }

      const saleProductsOnly = normalizedProducts.filter(isOnSale);
      const saleServicesOnly = normalizedServices.filter(isOnSale);

      const visibleProducts = pickVisibleCards(normalizedProducts);
      const visibleServices = pickVisibleCards(normalizedServices);

      if (active) {
        setSaleProducts(normalizedProducts);
        setSaleServices(normalizedServices);
      }
    };

    loadSales();

    return () => {
      active = false;
    };
  }, [isAuthenticated, isHydrated]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getTopAgents(20);
        setAgents(data || []);
      } catch (err) {
        console.error("Top agents load error", err);
      }
    })();
  }, []);

  const toNumberOrZero = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const resolveKind = (agent: TopAgent) => {
    if (agent.kind) return agent.kind.toUpperCase();
    if (agent.serviceCategory) return "SERVICE";
    const role = (agent as any)?.role || (agent as any)?.user?.role;
    if (typeof role === "string" && role.toUpperCase().includes("SERVICE")) return "SERVICE";
    return "SELLER";
  };

  const resolveAvatar = (agent: TopAgent) => {
    return (
      agent.avatarUrl ||
      agent.user?.avatarUrl ||
      (agent as any)?.profile?.avatarUrl ||
      (agent as any)?.image ||
      (agent as any)?.photo?.url ||
      (agent as any)?.photo
    );
  };

  const resolveAgentId = (agent?: TopAgent | null) => {
    if (!agent) return "";
    return String(
      agent.id ||
        agent._id ||
        agent.user?._id ||
        agent.user?.username ||
        agent.name ||
        ""
    );
  };

  const resolveAgentRouteId = (agent?: TopAgent | null) => {
    if (!agent) return null;
    const value = agent._id || agent.user?._id || agent.id || agent.user?.username || (agent as any)?.username || null;
    return value ? String(value) : null;
  };

  const resolveWeeklyScore = (agent: TopAgent) =>
    toNumberOrZero(agent.weeklyScore ?? agent.score ?? (agent as any)?.stats?.weeklyScore);

  const resolveWeeklyListingsCount = (agent: TopAgent) =>
    toNumberOrZero(
      agent.weeklyListingsCount ??
      (agent as any)?.weeklyListings ??
      (agent as any)?.stats?.weeklyListingsCount
    );

  const resolveListingsOrders = (agent: TopAgent) =>
    toNumberOrZero(
      agent.listingsOrders ??
      agent.weeklyListingsOrders ??
      agent.stats?.orders ??
      agent.stats?.listingsOrders ??
      (agent as any)?.weeklyStats?.orders
    );

  const resolveListingsViews = (agent: TopAgent) =>
    toNumberOrZero(
      agent.listingsViews ??
      agent.weeklyListingsViews ??
      agent.stats?.views ??
      agent.stats?.listingsViews ??
      (agent as any)?.weeklyStats?.views
    );

  const sortWeeklyAgents = (a: TopAgent, b: TopAgent) => {
    const weeklyA = resolveWeeklyScore(a);
    const weeklyB = resolveWeeklyScore(b);
    if (weeklyB !== weeklyA) return weeklyB - weeklyA;
    const ratingA = toNumberOrZero(a.rating);
    const ratingB = toNumberOrZero(b.rating);
    if (ratingB !== ratingA) return ratingB - ratingA;
    return resolveAgentId(a).localeCompare(resolveAgentId(b));
  };

  const weeklyQualifiedAgents = useMemo(() => {
    return (agents || []).filter((agent) => {
      const verified = agent.verifiedByAdmin === true;
      const activeWeekly = resolveWeeklyScore(agent) > 0 || resolveWeeklyListingsCount(agent) > 0;
      return verified && activeWeekly;
    });
  }, [agents]);

  const topSellerAgents = useMemo(
    () =>
      weeklyQualifiedAgents
        .filter((agent) => resolveKind(agent) === "SELLER")
        .sort(sortWeeklyAgents)
        .slice(0, 10),
    [weeklyQualifiedAgents]
  );

  const topServiceAgents = useMemo(
    () =>
      weeklyQualifiedAgents
        .filter((agent) => resolveKind(agent) === "SERVICE")
        .sort(sortWeeklyAgents)
        .slice(0, 10),
    [weeklyQualifiedAgents]
  );

  const handleHeroNavigate = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!href || pendingHref === href) return;
    setPendingHref(href);
    startNavigation(() => {
      router.push(href);
    });
  };

  const primaryHeroHref = getHomeHeroPrimaryHref("services");
  const secondaryHeroHref = getHomeHeroPrimaryHref("register");
  const heroCategories = [
    {
      key: "consulting",
      icon: "💼",
      title: t("home.category.consulting.title"),
      desc: t("home.category.consulting.desc"),
      href: getHomeHeroCategoryHref("consulting"),
      tone: "bg-emerald-500/15 text-emerald-100"
    },
    {
      key: "translation",
      icon: "🌐",
      title: t("home.category.translation.title"),
      desc: t("home.category.translation.desc"),
      href: getHomeHeroCategoryHref("translation"),
      tone: "bg-sky-500/15 text-sky-100"
    },
    {
      key: "legal",
      icon: "⚖️",
      title: t("home.category.legal.title"),
      desc: t("home.category.legal.desc"),
      href: getHomeHeroCategoryHref("legal"),
      tone: "bg-amber-500/15 text-amber-100"
    },
    {
      key: "psychology",
      icon: "🧠",
      title: t("home.category.psychology.title"),
      desc: t("home.category.psychology.desc"),
      href: getHomeHeroCategoryHref("psychology"),
      tone: "bg-rose-500/15 text-rose-100"
    },
    {
      key: "sport",
      icon: "🏋️",
      title: t("home.category.sports.title"),
      desc: t("home.category.sports.desc"),
      href: getHomeHeroCategoryHref("sport"),
      tone: "bg-indigo-500/15 text-indigo-100"
    },
    {
      key: "product",
      icon: "🛒",
      title: t("home.category.products.title"),
      desc: t("home.category.products.desc"),
      href: getHomeHeroCategoryHref("product"),
      tone: "bg-slate-100/15 text-slate-100"
    }
  ] as const;
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.16),transparent_45%),radial-gradient(circle_at_bottom,_rgba(14,165,233,0.18),transparent_40%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-emerald-200">
              {t("home.hero.kicker")}
            </p>
            <h1 className="text-4xl font-semibold leading-tight">
              {t("home.hero.title.v2")}
            </h1>
            <p className="max-w-2xl text-sm text-slate-200">
              {t("home.hero.subtitle.v2")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={primaryHeroHref}
                onClick={handleHeroNavigate(primaryHeroHref)}
                aria-label={t("home.hero.cta.primary")}
                aria-busy={pendingHref === primaryHeroHref && isNavigating}
                className={`rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:shadow-emerald-500/50 ${
                  pendingHref === primaryHeroHref && isNavigating ? "pointer-events-none opacity-80" : ""
                }`}
              >
                {t("home.hero.cta.primary")}
                {pendingHref === primaryHeroHref && isNavigating ? "..." : ""}
              </Link>
              <Link
                href={secondaryHeroHref}
                onClick={handleHeroNavigate(secondaryHeroHref)}
                aria-label={t("home.hero.cta.secondary")}
                aria-busy={pendingHref === secondaryHeroHref && isNavigating}
                className={`rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/60 ${
                  pendingHref === secondaryHeroHref && isNavigating ? "pointer-events-none opacity-80" : ""
                }`}
              >
                {t("home.hero.cta.secondary")}
                {pendingHref === secondaryHeroHref && isNavigating ? "..." : ""}
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-emerald-100/90">
              <span className="rounded-full bg-white/10 px-3 py-1">{t("home.hero.tag.trusted")}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">{t("home.hero.tag.secure")}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {heroCategories.map((item) => {
              const cardLabel = `${item.title} · ${item.desc}`;
              const isPendingCard = pendingHref === item.href && isNavigating;
              return (
              <Link
                key={item.key}
                href={item.href}
                onClick={handleHeroNavigate(item.href)}
                aria-label={cardLabel}
                title={cardLabel}
                aria-busy={isPendingCard}
                className={`group cursor-pointer rounded-2xl border border-white/10 p-4 transition hover:-translate-y-0.5 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 ${
                  item.tone
                } ${isPendingCard ? "pointer-events-none opacity-80" : ""}`}
              >
                <div className="text-2xl">{item.icon}</div>
                <p className="mt-2 text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-white/80">{item.desc}</p>
              </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm md:grid-cols-3">
          {[
            {
              icon: "🔍",
              title: t("home.info.choose.title"),
              desc: t("home.info.choose.desc"),
              href: "/services?step=choose&from=home_info_choose"
            },
            {
              icon: "💬",
              title: t("home.info.chat.title"),
              desc: t("home.info.chat.desc"),
              href: "/how-it-works#chat"
            },
            {
              icon: "✅",
              title: t("home.info.results.title"),
              desc: t("home.info.results.desc"),
              href: "/trust-and-safety?from=home_info_results"
            }
          ].map((step) => (
            <Link
              key={step.title}
              href={step.href}
              className="rounded-2xl border border-slate-100 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
            >
              <div className="text-2xl">{step.icon}</div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{step.title}</p>
              <p className="text-xs text-slate-500">{step.desc}</p>
            </Link>
          ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("home.trust.kicker")}</p>
            <h2 className="text-xl font-semibold text-slate-900">{t("home.trust.title")}</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <Link
              href="/agents?verified=1&from=home_trust_verified"
              className="rounded-full bg-emerald-50 px-3 py-1 transition hover:-translate-y-0.5 hover:bg-emerald-100"
            >
              {t("home.trust.verified")}
            </Link>
            <Link
              href="/trust-and-safety?from=home_trust_chat#chat"
              className="rounded-full bg-slate-100 px-3 py-1 transition hover:-translate-y-0.5 hover:bg-slate-200"
            >
              {t("home.trust.messaging")}
            </Link>
            <Link
              href="/trust-and-safety?from=home_trust_files#files"
              className="rounded-full bg-slate-100 px-3 py-1 transition hover:-translate-y-0.5 hover:bg-slate-200"
            >
              {t("home.trust.files")}
            </Link>
            <Link
              href="/trust-and-safety?from=home_trust_payments#payments"
              className="rounded-full bg-slate-100 px-3 py-1 transition hover:-translate-y-0.5 hover:bg-slate-200"
            >
              {t("home.trust.payments")}
            </Link>
          </div>
        </div>
      </section>

      

      <EventsSection saleProducts={saleProducts} saleServices={saleServices} dealsCount={dealsCount} />

      <TopPodium />

      <div className="-mx-4 sm:-mx-6 lg:-mx-8 mt-6 mb-8">
        <video
          className="block w-full h-auto"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          controls={false}
        >
          <source src="/video/Uni.mp4" type="video/mp4" />
          <source src="https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4" type="video/mp4" />
          {t("home.video.fallback")}
        </video>
      </div>

      <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-lg shadow-black/25">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300">
              {t("home.top.kicker")}
            </p>
            <h2 className="text-2xl font-bold text-slate-50">{t("home.top.title")}</h2>
            <p className="text-sm text-slate-400">
              {t("home.top.subtitle")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            { title: t("home.top.block.seller"), data: topSellerAgents, tone: "amber" as const },
            { title: t("home.top.block.service"), data: topServiceAgents, tone: "emerald" as const }
          ].map((block) => {
            const podium = block.data.slice(0, 3);
            const rest = block.data.slice(3);
            const heights = [170, 140, 120];
            const order = [0, 1, 2]; // 1-o'rin, 2-o'rin, 3-o'rin
            const badgeColor =
              block.tone === "amber"
                ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40"
                : "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40";

            return (
              <div
                key={block.title}
                className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-50">{block.title}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeColor}`}>
                    {t("home.top.badge.top10")}
                  </span>
                </div>

                <div className="flex items-end gap-2">
                  {order.map((idx) => {
                    const agent = podium[idx];
                    const agentId = resolveAgentId(agent);
                    const routeId = resolveAgentRouteId(agent);
                    const displayName = agent?.user?.name || agent?.name || t("home.top.agentLabel");
                    const cardKey = agentId || `${block.tone}-empty-${idx + 1}`;
                    const snippet =
                      agent?.snippet || agent?.user?.bio || agent?.user?.region || t("home.top.activeAgent");
                    const rating = toNumberOrZero(agent?.rating).toFixed(1);
                    const weeklyScore = resolveWeeklyScore(agent || {});
                    const listingsOrders = resolveListingsOrders(agent || {});
                    const listingsViews = resolveListingsViews(agent || {});
                    return (
                      <Link
                        key={cardKey}
                        href={routeId ? `/agents/${routeId}` : "/agents"}
                        style={{ minHeight: heights[idx] }}
                        className="relative flex-1 rounded-xl border border-slate-800/70 bg-slate-950/80 p-3 shadow-lg shadow-black/25 cursor-pointer transition hover:border-sky-500/60"
                      >
                        <span className="absolute right-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-200">
                          {idx + 1}
                          {t("home.top.rankSuffix")}
                        </span>
                        {agent ? (
                          <div className="flex h-full flex-col justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {resolveAvatar(agent) ? (
                                <img
                                  src={resolveAvatar(agent)}
                                  alt={displayName}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-slate-800 text-center text-sm font-semibold text-slate-100 flex items-center justify-center">
                                  {displayName.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-100 line-clamp-2">
                                  {displayName}
                                </p>
                                <p className="text-[11px] text-slate-400 line-clamp-2">
                                  {snippet}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-200">
                              <span className="rounded-full bg-slate-900/70 px-2 py-0.5">⭐ {rating}</span>
                              <span className="rounded-full bg-slate-900/70 px-2 py-0.5">W {weeklyScore}</span>
                              <span className="rounded-full bg-slate-900/70 px-2 py-0.5">🧾 {listingsOrders}</span>
                              <span className="rounded-full bg-slate-900/70 px-2 py-0.5">👁 {listingsViews}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">{t("home.top.noData")}</p>
                        )}
                      </Link>
                    );
                  })}
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {rest.map((agent) => {
                    const agentId = resolveAgentId(agent);
                    const routeId = resolveAgentRouteId(agent);
                    const displayName = agent.user?.name || agent.name || t("home.top.agentLabel");
                    const cardKey = agentId || `${block.tone}-rest-${displayName}`;
                    const snippet =
                      agent.snippet || agent.user?.bio || agent.user?.region || t("home.top.activeAgent");
                    const rating = toNumberOrZero(agent.rating).toFixed(1);
                    const weeklyScore = resolveWeeklyScore(agent);
                    const listingsOrders = resolveListingsOrders(agent);
                    const listingsViews = resolveListingsViews(agent);
                    return (
                      <Link
                        key={cardKey}
                        href={routeId ? `/agents/${routeId}` : "/agents"}
                        className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-sm cursor-pointer transition hover:border-sky-500/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {resolveAvatar(agent) ? (
                            <img
                              src={resolveAvatar(agent)}
                              alt={displayName}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-slate-800 text-center text-xs font-semibold text-slate-100 flex items-center justify-center">
                              {displayName.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-100">{displayName}</p>
                            <p className="truncate text-xs text-slate-400">
                              {snippet}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 text-[11px] text-slate-200">
                          <span className="rounded-full bg-slate-800 px-2 py-0.5">⭐ {rating}</span>
                          <span className="rounded-full bg-slate-800 px-2 py-0.5">W {weeklyScore}</span>
                          <span className="rounded-full bg-slate-800 px-2 py-0.5">🧾 {listingsOrders}</span>
                          <span className="rounded-full bg-slate-800 px-2 py-0.5">👁 {listingsViews}</span>
                        </div>
                      </Link>
                    );
                  })}
                  {rest.length === 0 && (
                    <p className="text-sm text-slate-400">{t("home.top.noMore")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
