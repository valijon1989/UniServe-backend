"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ServicesHub } from "@/components/ServicesHub";
import { getAgents, type AgentListItem } from "@/api/agent";
import { Avatar } from "@/components/ui/Avatar";
import { useI18n } from "@/context/i18n";
import {
  formatAgentNumber,
  formatAgentRelativeTime,
  getAgentSortTimestamp,
  getAgentStatusKey,
  normalizeAgentCategoryKey
} from "@/lib/agentsPresentation";
import type { SupportedLocale } from "@/lib/localization";
import { toAbsoluteMediaUrl } from "@/lib/mediaUrl";

const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZES = [12, 24, 48];
const SECTION_PAGE_SIZE = 6;
const AVATAR_POOL_SIZE = 30;

type SortKey = "best_match" | "rating" | "likes" | "views" | "recent" | "oldest";
type AgentRecord = AgentListItem & Record<string, unknown>;
type TranslateFn = (key: string, fallback: string) => string;

const CATEGORY_TRANSLATION_KEYS: Record<string, { key: string; fallback: string }> = {
  "product-sales": { key: "agents.card.productSales", fallback: "Product sales" },
  consulting: { key: "agents.card.consulting", fallback: "Consulting" },
  education: { key: "agents.card.education", fallback: "Education" },
  translation: { key: "agents.card.translation", fallback: "Translation" },
  repair: { key: "agents.card.repair", fallback: "Repair" },
  construction: { key: "agents.card.construction", fallback: "Construction" },
  "electronics-resale": { key: "agents.card.electronicsResale", fallback: "Electronics resale" },
  delivery: { key: "agents.card.delivery", fallback: "Delivery" },
  legal: { key: "agents.card.legal", fallback: "Legal" },
  psychology: { key: "agents.card.psychology", fallback: "Psychology" },
  sports: { key: "agents.card.sports", fallback: "Sports" },
  "platform-help": { key: "agents.card.platformHelp", fallback: "Platform help" },
  cleaning: { key: "agents.card.cleaning", fallback: "Cleaning" },
  moving: { key: "agents.card.moving", fallback: "Moving" },
  logistics: { key: "agents.card.logistics", fallback: "Logistics" }
};

const normalizeLocalAvatarIndex = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return ((Math.trunc(value) - 1) % AVATAR_POOL_SIZE) + 1;
};

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeToken = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const looksLikeCode = (value: unknown) => /^[a-z0-9_-]+$/i.test(normalizeText(value));

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]+/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const readLocalizedField = (
  record: Record<string, unknown> | undefined,
  base: string,
  locale: SupportedLocale
) => {
  if (!record) return "";
  const locales: SupportedLocale[] = [locale, "uz", "en", "ru", "ko"];
  for (const currentLocale of locales) {
    const value = record[`${base}_${currentLocale}`];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const normalizeAvatar = (value?: string) => {
  if (!value) return "";
  if (value.startsWith("/avatars/")) {
    const filename = value.split("/").pop() || "";
    const match = filename.match(/^agent-?(\d+)\.(jpg|jpeg|png|webp)$/i);
    if (match) {
      const num = normalizeLocalAvatarIndex(Number(match[1]));
      const padded = String(num).padStart(2, "0");
      return `/avatars/agent-${padded}.jpg`;
    }
    return value;
  }
  if (value.startsWith("/static/avatars/")) {
    const filename = value.split("/").pop() || "";
    const match = filename.match(/^agent-?(\d+)\.(jpg|jpeg|png|webp)$/i);
    if (match) {
      const num = normalizeLocalAvatarIndex(Number(match[1]));
      const padded = String(num).padStart(2, "0");
      return `/avatars/agent-${padded}.jpg`;
    }
    return value.replace("/static/avatars/", "/avatars/");
  }
  return toAbsoluteMediaUrl(value) || value;
};

const getAvatar = (agent: AgentListItem) =>
  normalizeAvatar(agent.avatarUrl) || normalizeAvatar(agent.user?.avatarUrl) || "";

const getDisplayName = (agent: AgentListItem, locale: SupportedLocale, translate: TranslateFn) => {
  const agentRecord = agent as AgentRecord;
  const localizedAgentName = readLocalizedField(agentRecord, "name", locale);
  const localizedAgentTitle = readLocalizedField(agentRecord, "title", locale);
  const localizedUserName = readLocalizedField((agent.user as Record<string, unknown> | undefined), "name", locale);

  return (
    localizedAgentName ||
    localizedAgentTitle ||
    localizedUserName ||
    agent.name ||
    agent.user?.name ||
    translate("agents.card.unknownAgent", "Unknown agent")
  );
};

const getUsername = (agent: AgentListItem) =>
  normalizeText(agent.nickname || agent.username || agent.user?.username) || "agent";

const getCompletedJobs = (agent: AgentListItem) =>
  toNumber((agent as AgentRecord).completedJobs ?? (agent as AgentRecord).jobsDone ?? agent.user?.postsCount ?? 0);

const getResponseMinutes = (agent: AgentListItem) => {
  const raw = (agent as AgentRecord).responseTime ?? (agent as AgentRecord).responseMinutes;
  const parsed = toNumber(raw);
  return parsed > 0 ? parsed : null;
};

const getRecentActivity = (agent: AgentListItem) => toNumber(agent.views) + toNumber(agent.likes);

const getListingsCount = (agent: AgentListItem) => {
  const record = agent as AgentRecord;
  const baseCount = agent.listingsCount ?? record.productsCount ?? 0;
  const serviceCount = record.servicesCount ?? 0;
  return toNumber(baseCount) + toNumber(serviceCount);
};

const getComplaintRate = (agent: AgentListItem) =>
  toNumber((agent as AgentRecord).complaintRate ?? (agent as AgentRecord).cancelRate ?? 0);

const isVerifiedAgent = (agent: AgentListItem) =>
  Boolean(agent.verifiedByAdmin || agent.isVerified || agent.user?.isVerified);

const computeScore = (agent: AgentListItem) => {
  const rating = toNumber(agent.rating);
  const completed = getCompletedJobs(agent);
  const activity = getRecentActivity(agent);
  const complaint = getComplaintRate(agent);

  return rating * 20 + Math.log10(completed + 1) * 12 + Math.log10(activity + 1) * 6 - complaint * 15;
};

const sortAgents = (list: AgentListItem[], sort: SortKey) => {
  const normalized = [...list];

  if (sort === "best_match") return normalized.sort((a, b) => computeScore(b) - computeScore(a));
  if (sort === "rating") return normalized.sort((a, b) => toNumber(b.rating) - toNumber(a.rating));
  if (sort === "likes") return normalized.sort((a, b) => toNumber(b.likes) - toNumber(a.likes));
  if (sort === "views") return normalized.sort((a, b) => toNumber(b.views) - toNumber(a.views));
  if (sort === "recent") {
    return normalized.sort(
      (a, b) => getAgentSortTimestamp(b as AgentRecord) - getAgentSortTimestamp(a as AgentRecord)
    );
  }
  if (sort === "oldest") {
    return normalized.sort(
      (a, b) => getAgentSortTimestamp(a as AgentRecord) - getAgentSortTimestamp(b as AgentRecord)
    );
  }
  return normalized;
};

const translateCategoryToken = (token: string, translate: TranslateFn) => {
  const config = CATEGORY_TRANSLATION_KEYS[token];
  if (!config) return "";
  return translate(config.key, config.fallback);
};

const getRoleLabel = (agent: AgentListItem, translate: TranslateFn) => {
  const direct = normalizeText((agent as AgentRecord).kindLabel);
  if (direct && !looksLikeCode(direct)) return direct;
  return agent.kind === "SELLER"
    ? translate("agents.sections.sellerAgents", "Seller agents")
    : translate("agents.sections.serviceAgents", "Service agents");
};

const resolveCategoryLabel = (agent: AgentListItem, locale: SupportedLocale, translate: TranslateFn) => {
  const record = agent as AgentRecord;
  const directCandidates = [
    normalizeText(record.serviceCategoryMeta?.displayName),
    readLocalizedField(record, "serviceCategoryLabel", locale),
    normalizeText(record.serviceCategoryLabel),
    readLocalizedField(record, "serviceCategory", locale)
  ];

  for (const candidate of directCandidates) {
    if (candidate && !looksLikeCode(candidate)) return candidate;
  }

  const rawCandidates = [
    normalizeText(record.serviceCategoryLabel),
    normalizeText(record.serviceCategory),
    Array.isArray(record.socialServices) ? normalizeText(record.socialServices[0]) : "",
    Array.isArray(record.materialServices) ? normalizeText(record.materialServices[0]) : "",
    agent.kind === "SELLER" ? "product-sales" : ""
  ];

  for (const candidate of rawCandidates) {
    const normalized = normalizeAgentCategoryKey(candidate);
    const translated = translateCategoryToken(normalized, translate);
    if (translated) return translated;
    if (candidate && !looksLikeCode(candidate)) return candidate;
  }

  return agent.kind === "SELLER"
    ? translate("agents.card.productSales", "Product sales")
    : translate("agents.sections.serviceAgents", "Service agents");
};

const getAgentCategoryTokens = (agent: AgentListItem) => {
  const record = agent as AgentRecord;
  const rawCandidates = [
    normalizeText(record.serviceCategoryLabel),
    normalizeText(record.serviceCategory),
    ...(Array.isArray(record.socialServices) ? record.socialServices.map(normalizeText) : []),
    ...(Array.isArray(record.materialServices) ? record.materialServices.map(normalizeText) : []),
    agent.kind === "SELLER" ? "product-sales" : ""
  ];

  return Array.from(
    new Set(
      rawCandidates
        .map((value) => normalizeAgentCategoryKey(value))
        .filter(Boolean)
    )
  );
};

const matchesAgentCategory = (agent: AgentListItem, category: string) => {
  if (!category) return true;
  return getAgentCategoryTokens(agent).includes(category);
};

const getTagLabels = (agent: AgentListItem, locale: SupportedLocale, translate: TranslateFn) => {
  const record = agent as AgentRecord;
  const labels = [
    getRoleLabel(agent, translate),
    resolveCategoryLabel(agent, locale, translate),
    ...(Array.isArray(record.socialServices) ? record.socialServices : []),
    ...(Array.isArray(record.materialServices) ? record.materialServices : []),
    normalizeText(agent.region)
  ]
    .map((value) => {
      const raw = normalizeText(value);
      if (!raw) return "";
      if (!looksLikeCode(raw)) return raw;
      const normalized = normalizeAgentCategoryKey(raw);
      return translateCategoryToken(normalized, translate) || raw;
    })
    .filter(Boolean);

  return Array.from(new Set(labels));
};

const getStatusLabel = (agent: AgentListItem, translate: TranslateFn) => {
  const key = getAgentStatusKey(agent);
  if (key === "online") return translate("agents.card.online", "Online");
  if (key === "busy") return translate("agents.card.busy", "Busy");
  return translate("agents.card.offline", "Offline");
};

const getLastActiveSource = (agent: AgentListItem) => {
  const record = agent as AgentRecord;
  return record.lastActiveAt || record.lastActive || record.updatedAt || record.createdAt || agent.user?.updatedAt || agent.user?.createdAt;
};

const getPriceLabel = (agent: AgentListItem, locale: SupportedLocale, translate: TranslateFn) => {
  const record = agent as AgentRecord;
  const rawPrice = record.hourlyRate ?? record.priceHourly ?? record.price ?? record.rate;
  const price = toNumber(rawPrice);
  if (price <= 0) return translate("agents.card.negotiable", "Negotiable");

  const formatted = formatAgentNumber(price, locale);
  const currency = normalizeText(record.currency || record.priceCurrency);
  const perHour = translate("agents.card.perHour", "hour");

  if (currency) return `${formatted} ${currency}/${perHour}`;
  return `${formatted} / ${perHour}`;
};

const getVerifiedLabel = (agent: AgentListItem, translate: TranslateFn) => {
  if (agent.verifiedByAdmin) return translate("agents.card.adminVerified", "Admin verified");
  if (agent.isVerified || agent.user?.isVerified) return translate("agents.card.idVerified", "ID verified");
  return null;
};

const buildQueryString = (params: Record<string, string | number | boolean | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

export function AgentsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, language } = useI18n();
  const locale = language as SupportedLocale;
  const view = searchParams.get("view");
  const isServicesView = view === "services";
  const categoryFilter = useMemo(
    () => normalizeAgentCategoryKey(searchParams.get("category") || ""),
    [searchParams]
  );

  const translate = useMemo<TranslateFn>(
    () => (key, fallback) => {
      const resolved = t(key);
      return resolved && resolved !== key ? resolved : fallback;
    },
    [t]
  );

  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [sort, setSort] = useState<SortKey>("best_match");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [ratingMin, setRatingMin] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sellerPage, setSellerPage] = useState(1);
  const [servicePage, setServicePage] = useState(1);

  const sortOptions = useMemo(
    () => [
      { value: "best_match" as const, label: translate("common.bestMatch", "Best match") },
      { value: "rating" as const, label: translate("agents.filters.sortOption.topRated", "Top rated") },
      { value: "likes" as const, label: translate("agents.filters.sortOption.mostLikes", "Most liked") },
      { value: "views" as const, label: translate("agents.filters.sortOption.mostViews", "Most viewed") },
      { value: "recent" as const, label: translate("agents.filters.sortOption.newest", "Newest") },
      { value: "oldest" as const, label: translate("agents.filters.sortOption.oldest", "Oldest") }
    ],
    [translate]
  );

  const ratingAllLabel = translate("agents.filters.ratingOption.all", "Rating: all");
  const loadingText = translate("agents.states.loading", "Loading...");
  const emptyText = translate("agents.states.empty", "No agents found.");
  const errorText = translate("agents.states.error", "Could not load agents.");
  const verifiedFallbackText = translate(
    "agents.states.verifiedFallback",
    "No verified agents match the current filters, so all agents are shown."
  );

  useEffect(() => {
    if (isServicesView) return;
    const fromQuery = (key: string) => searchParams.get(key) || "";
    const qPage = Math.max(1, Number(fromQuery("page")) || 1);
    const qLimit = Number(fromQuery("limit")) || DEFAULT_PAGE_SIZE;
    const qSort = (fromQuery("sort") as SortKey) || "best_match";
    const qRating = Number(fromQuery("ratingMin")) || 0;
    const qVerified = fromQuery("verified") === "1";
    const qSearch = fromQuery("search");

    setPage(qPage);
    setPageSize(PAGE_SIZES.includes(qLimit) ? qLimit : DEFAULT_PAGE_SIZE);
    setSort(qSort);
    setRatingMin(qRating);
    setVerifiedOnly(qVerified);
    setSearchInput(qSearch);
    setSearchValue(qSearch);
  }, [isServicesView, searchParams]);

  useEffect(() => {
    if (isServicesView) return;
    const timer = window.setTimeout(() => {
      setSearchValue(searchInput.trim());
      setPage(1);
      setSellerPage(1);
      setServicePage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isServicesView, searchInput]);

  useEffect(() => {
    if (isServicesView) return;
    const query = buildQueryString({
      page,
      limit: pageSize,
      sort,
      ratingMin: ratingMin || undefined,
      verified: verifiedOnly ? 1 : undefined,
      search: searchValue || undefined,
      category: categoryFilter || undefined,
      view: view || undefined
    });
    router.replace(`/agents${query}`);
  }, [categoryFilter, isServicesView, page, pageSize, ratingMin, router, searchValue, sort, verifiedOnly, view]);

  useEffect(() => {
    if (isServicesView) return;
    setSellerPage(1);
    setServicePage(1);
  }, [categoryFilter, isServicesView, ratingMin, searchValue, sort, verifiedOnly]);

  useEffect(() => {
    if (isServicesView) return;
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const apiSort = sort === "best_match" ? "rating" : sort;
        const fetchLimit = Math.max(pageSize, 200);
        const { items } = await getAgents({
          active: true,
          sort: apiSort as any,
          page: 1,
          limit: fetchLimit,
          search: searchValue || undefined,
          verified: verifiedOnly ? 1 : undefined,
          withListings: 1
        });
        setAgents(items.filter((item) => item.active !== false));
      } catch (loadError) {
        console.error("Agents load error", loadError);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isServicesView, language, page, pageSize, searchValue, sort, verifiedOnly]);

  const filteredAgents = useMemo(() => {
    const byListings = agents.filter((agent) => getListingsCount(agent) > 0);
    const byCategory = byListings.filter((agent) => matchesAgentCategory(agent, categoryFilter));
    const byRating = byCategory.filter((agent) => toNumber(agent.rating) >= ratingMin);
    const verifiedAgents = byRating.filter(isVerifiedAgent);
    const effective = verifiedOnly ? (verifiedAgents.length ? verifiedAgents : byRating) : byRating;
    return sortAgents(effective, sort);
  }, [agents, categoryFilter, ratingMin, sort, verifiedOnly]);

  const hasVerifiedForCurrentFilters = useMemo(() => {
    const byListings = agents.filter((agent) => getListingsCount(agent) > 0);
    const byCategory = byListings.filter((agent) => matchesAgentCategory(agent, categoryFilter));
    const byRating = byCategory.filter((agent) => toNumber(agent.rating) >= ratingMin);
    return byRating.some(isVerifiedAgent);
  }, [agents, categoryFilter, ratingMin]);

  if (isServicesView) {
    return <ServicesHub />;
  }

  const renderGrid = (list: AgentListItem[]) => {
    if (list.length === 0) {
      return <p className="text-sm text-slate-500">{emptyText}</p>;
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((agent) => {
          const id = agent.user?._id || agent.id || agent._id || "";
          const name = getDisplayName(agent, locale, translate);
          const username = getUsername(agent);
          const ratingValue = toNumber(agent.rating);
          const completed = getCompletedJobs(agent);
          const listingsCount = getListingsCount(agent);
          const responseMinutes = getResponseMinutes(agent);
          const statusKey = getAgentStatusKey(agent);
          const statusLabel = getStatusLabel(agent, translate);
          const lastActiveLabel = formatAgentRelativeTime(getLastActiveSource(agent), locale);
          const priceLabel = getPriceLabel(agent, locale, translate);
          const verifiedLabel = getVerifiedLabel(agent, translate);
          const tags = getTagLabels(agent, locale, translate);
          const visibleTags = tags.slice(0, 2);
          const restTags = tags.length - visibleTags.length;
          const cardLabel = `${translate("agents.aria.card", "Open agent profile")}: ${name}`;

          return (
            <Link
              key={id || `${username}-${name}`}
              href={id ? `/agents/${id}` : "/agents"}
              title={cardLabel}
              aria-label={cardLabel}
              className="flex h-[260px] items-stretch gap-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/60"
            >
              <div className="flex w-[40%] items-center justify-center rounded-2xl bg-slate-950/60 p-3">
                <Avatar
                  src={getAvatar(agent)}
                  alt={name}
                  fallbackText={name}
                  size={112}
                  className="border border-slate-700/70 shadow-lg shadow-black/30"
                />
              </div>

              <div className="flex w-[60%] min-w-0 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{name}</p>
                    <p className="truncate text-[11px] text-slate-400">@{username}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    {verifiedLabel && (
                      <span
                        title={verifiedLabel}
                        aria-label={verifiedLabel}
                        className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200"
                      >
                        ✔
                      </span>
                    )}
                    <span
                      title={statusLabel}
                      aria-label={statusLabel}
                      className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300"
                    >
                      {statusKey === "online" ? "●" : statusKey === "busy" ? "◐" : "○"}
                    </span>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                  <span title={translate("agents.card.rating", "Rating")}>
                    {ratingValue > 0 ? `⭐ ${ratingValue.toFixed(1)}` : "🆕"}
                  </span>
                  <span title={translate("agents.card.completed", "Completed")}>
                    ✅ {formatAgentNumber(completed, locale)}
                  </span>
                  <span title={translate("agents.card.responseTime", "Response time")}>
                    ⏱ {responseMinutes ? `~${formatAgentNumber(responseMinutes, locale)}m` : "—"}
                  </span>
                  <span title={translate("agents.card.lastActive", "Last active")}>🕒 {lastActiveLabel}</span>
                  <span title={translate("agents.card.listings", "Listings")}>
                    📄 {formatAgentNumber(listingsCount, locale)}
                  </span>
                  <span title={translate("agents.card.views", "Views")}>
                    👁 {formatAgentNumber(toNumber(agent.views), locale)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {visibleTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-700/70 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                  {restTags > 0 && (
                    <span className="rounded-full border border-slate-700/70 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300">
                      +{formatAgentNumber(restTags, locale)}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                  <span title={translate("agents.card.price", "Price")}>💰 {priceLabel}</span>
                  <span title={translate("agents.card.likes", "Likes")}>
                    ❤ {formatAgentNumber(toNumber(agent.likes), locale)}
                  </span>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-3">
                  <span
                    title={translate("agents.actions.chat", "Chat")}
                    aria-hidden="true"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm text-emerald-100"
                  >
                    💬
                  </span>
                  <span
                    title={translate("agents.actions.profile", "Profile")}
                    aria-hidden="true"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-sm text-slate-200"
                  >
                    👤
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    );
  };

  const renderPager = (
    current: number,
    totalPages: number,
    onChange: (value: number) => void,
    sectionLabel: string
  ) => {
    if (totalPages <= 1) return null;

    const visibleWindow = 6;
    const start = Math.max(1, Math.min(current - Math.floor(visibleWindow / 2), totalPages - visibleWindow + 1));
    const end = Math.min(totalPages, start + visibleWindow - 1);
    const buttons = Array.from({ length: end - start + 1 }, (_, index) => start + index);

    return (
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300">
        <button
          type="button"
          disabled={current <= 1}
          title={translate("agents.pagination.previous", "Previous")}
          aria-label={`${sectionLabel}: ${translate("agents.aria.previousPage", "Go to previous page")}`}
          onClick={() => onChange(Math.max(1, current - 1))}
          className="rounded-full border border-slate-700 px-3 py-1 transition hover:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {translate("agents.pagination.previous", "Previous")}
        </button>
        {buttons.map((buttonValue) => (
          <button
            key={buttonValue}
            type="button"
            aria-current={buttonValue === current ? "page" : undefined}
            onClick={() => onChange(buttonValue)}
            className={`rounded-full border px-3 py-1 transition ${
              buttonValue === current
                ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-200"
                : "border-slate-700 hover:border-emerald-400/60"
            }`}
          >
            {formatAgentNumber(buttonValue, locale)}
          </button>
        ))}
        <button
          type="button"
          disabled={current >= totalPages}
          title={translate("agents.pagination.next", "Next")}
          aria-label={`${sectionLabel}: ${translate("agents.aria.nextPage", "Go to next page")}`}
          onClick={() => onChange(Math.min(totalPages, current + 1))}
          className="rounded-full border border-slate-700 px-3 py-1 transition hover:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {translate("agents.pagination.next", "Next")}
        </button>
      </div>
    );
  };

  const sellersAll = filteredAgents.filter((agent) => agent.kind === "SELLER");
  const servicesAll = filteredAgents.filter((agent) => agent.kind === "SERVICE");
  const sellerPages = Math.max(1, Math.ceil(sellersAll.length / SECTION_PAGE_SIZE));
  const servicePages = Math.max(1, Math.ceil(servicesAll.length / SECTION_PAGE_SIZE));
  const safeSellerPage = Math.min(sellerPage, sellerPages);
  const safeServicePage = Math.min(servicePage, servicePages);
  const sellers = sellersAll.slice((safeSellerPage - 1) * SECTION_PAGE_SIZE, safeSellerPage * SECTION_PAGE_SIZE);
  const services = servicesAll.slice((safeServicePage - 1) * SECTION_PAGE_SIZE, safeServicePage * SECTION_PAGE_SIZE);

  const sectionCount = (value: number) =>
    `${formatAgentNumber(value, locale)} ${translate("agents.sections.count", "total")}`;

  const sellerSectionLabel = translate("agents.sections.sellerAgents", "Seller agents");
  const serviceSectionLabel = translate("agents.sections.serviceAgents", "Service agents");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-200">
              {translate("agents.page.subtitle", "Agents directory")}
            </p>
            <h1 className="text-xl font-semibold text-slate-50">
              {translate("agents.page.title", "Agents roster")}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {translate("agents.page.description", "Top agents first, then the full active directory.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <input
              className="w-60 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
              aria-label={translate("agents.aria.search", "Search agents")}
              title={translate("agents.filters.searchPlaceholder", "Search agents (name, username, keyword)")}
              placeholder={translate("agents.filters.searchPlaceholder", "Search agents (name, username, keyword)")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <select
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
              aria-label={translate("agents.aria.sort", "Choose sorting")}
              title={translate("agents.filters.sort", "Sort")}
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as SortKey);
                setPage(1);
              }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
              aria-label={translate("agents.aria.rating", "Choose minimum rating")}
              title={translate("agents.filters.rating", "Rating")}
              value={ratingMin}
              onChange={(event) => {
                setRatingMin(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={0}>{ratingAllLabel}</option>
              <option value={4}>4.0+</option>
              <option value={4.5}>4.5+</option>
              <option value={4.8}>4.8+</option>
            </select>
            <select
              className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100"
              aria-label={translate("agents.aria.pageSize", "Choose page size")}
              title={translate("agents.filters.pageSize", "Page size")}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {`${formatAgentNumber(size, locale)} / ${translate("agents.filters.perPage", "page")}`}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2">
              <input
                type="checkbox"
                className="h-3 w-3"
                aria-label={translate("agents.aria.verified", "Show verified agents only")}
                checked={verifiedOnly}
                onChange={(event) => {
                  setVerifiedOnly(event.target.checked);
                  setPage(1);
                }}
              />
              <span title={translate("common.verified", "Verified")}>
                {translate("agents.filters.verified", "Verified only")}
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
              {translate("agents.sections.allActive", "All active agents")}
            </p>
            <h2 className="text-xl font-semibold text-slate-50">
              {translate("agents.sections.allActive", "All active agents")}
            </h2>
            <p className="text-sm text-slate-400">
              {translate("agents.sections.allActiveSubtitle", "Sorted by the selected ranking.")}
            </p>
          </div>
        </div>

        {verifiedOnly && !hasVerifiedForCurrentFilters && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {verifiedFallbackText}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">{loadingText}</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{errorText}</p>
        ) : filteredAgents.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyText}</p>
        ) : (
          <div className="space-y-8">
            <div>
              <div className="mb-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">{sellerSectionLabel}</p>
                <h3 className="text-lg font-semibold text-slate-100">
                  {`${sellerSectionLabel} (${sectionCount(sellersAll.length)})`}
                </h3>
              </div>
              {renderGrid(sellers)}
              {renderPager(safeSellerPage, sellerPages, (value) => setSellerPage(value), sellerSectionLabel)}
            </div>

            <div>
              <div className="mb-3">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">{serviceSectionLabel}</p>
                <h3 className="text-lg font-semibold text-slate-100">
                  {`${serviceSectionLabel} (${sectionCount(servicesAll.length)})`}
                </h3>
              </div>
              {renderGrid(services)}
              {renderPager(safeServicePage, servicePages, (value) => setServicePage(value), serviceSectionLabel)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default AgentsClient;
