import type { AgentListItem } from "../api/agent";
import type { SupportedLocale } from "./localization";

const LOCALE_TAGS: Record<SupportedLocale, string> = {
  en: "en-US",
  uz: "uz-UZ",
  ru: "ru-RU",
  ko: "ko-KR"
};

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeToken = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const CATEGORY_ALIASES: Record<string, string> = {
  seller: "product-sales",
  "seller-agent": "product-sales",
  product: "product-sales",
  products: "product-sales",
  "product-sales": "product-sales",
  "product-sales-agent": "product-sales",
  electronics: "electronics-resale",
  resale: "electronics-resale",
  "electronics-resale": "electronics-resale",
  "electronics-reseller": "electronics-resale",
  marketplace: "electronics-resale",
  language: "education",
  "language-teaching": "education",
  "language-teacher": "education",
  teaching: "education",
  course: "education",
  courses: "education",
  tutoring: "education",
  tutor: "education",
  "translation-official": "translation",
  "translation-education": "translation",
  "translation-visa": "translation",
  "translation-business": "translation",
  "translation-medical": "translation",
  "translation-technical": "translation",
  "translation-oral": "translation",
  "translation-personal": "translation",
  sport: "sports",
  "repair-services": "repair",
  technical: "repair",
  "technical-services": "repair",
  renovation: "construction",
  builder: "construction",
  builders: "construction",
  platform: "platform-help",
  "platform-help": "platform-help",
  help: "platform-help"
};

export const formatAgentNumber = (value: number, locale: SupportedLocale) =>
  new Intl.NumberFormat(LOCALE_TAGS[locale]).format(Math.max(0, Number(value) || 0));

export const normalizeAgentCategoryKey = (value: unknown) => {
  const token = normalizeToken(value);
  if (!token) return "";
  return CATEGORY_ALIASES[token] || token;
};

export const getAgentStatusKey = (
  agent:
    | Pick<AgentListItem, "status" | "onlineStatus" | "availability">
    | (Pick<AgentListItem, "status" | "onlineStatus" | "availability"> & Record<string, unknown>)
) => {
  const raw = agent.status ?? agent.onlineStatus ?? agent.availability;
  if (typeof raw === "string") {
    const value = raw.toLowerCase();
    if (["online", "available", "active"].includes(value)) return "online" as const;
    if (["busy", "band"].includes(value)) return "busy" as const;
    if (["offline", "away"].includes(value)) return "offline" as const;
  }
  if (raw === true) return "online" as const;
  return "offline" as const;
};

const parseTimestamp = (value: unknown) => {
  const raw = normalizeText(value);
  if (!raw) return 0;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const getAgentSortTimestamp = (agent: AgentListItem & Record<string, unknown>) =>
  parseTimestamp(
    agent.lastActiveAt ||
      agent.lastActive ||
      agent.updatedAt ||
      agent.createdAt ||
      agent.user?.updatedAt ||
      agent.user?.createdAt
  );

export const formatAgentRelativeTime = (
  value: unknown,
  locale: SupportedLocale,
  now = Date.now()
) => {
  const timestamp = parseTimestamp(value);
  if (!timestamp) return "—";

  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const formatter = new Intl.RelativeTimeFormat(LOCALE_TAGS[locale], { numeric: "always" });

  if (diffMinutes < 60) return formatter.format(-diffMinutes, "minute");

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return formatter.format(-diffHours, "hour");

  const diffDays = Math.max(1, Math.floor(diffHours / 24));
  return formatter.format(-diffDays, "day");
};
