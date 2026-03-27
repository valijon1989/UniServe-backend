import type { SupportedLocale } from "./localization";

type TranslateWithFallback = (key: string, fallback: string) => string;

const LOCALE_FORMAT_MAP: Record<SupportedLocale, string> = {
  en: "en-US",
  uz: "uz-UZ",
  ru: "ru-RU",
  ko: "ko-KR"
};

const PROFILE_LANGUAGE_KEY_MAP: Record<string, string> = {
  uz: "profile.languages.uz",
  uzbek: "profile.languages.uz",
  "o'zbek": "profile.languages.uz",
  ozbek: "profile.languages.uz",
  en: "profile.languages.en",
  eng: "profile.languages.en",
  english: "profile.languages.en",
  ru: "profile.languages.ru",
  rus: "profile.languages.ru",
  russian: "profile.languages.ru",
  русский: "profile.languages.ru",
  ko: "profile.languages.ko",
  kor: "profile.languages.ko",
  korean: "profile.languages.ko",
  한국어: "profile.languages.ko"
};

const AGENT_KIND_KEY_MAP: Record<string, string> = {
  SERVICE: "profile.agent.kinds.service",
  SELLER: "profile.agent.kinds.seller"
};

const AGENT_CATEGORY_KEY_MAP: Record<string, string> = {
  language: "profile.agent.categories.language",
  translation: "profile.agent.categories.translation",
  consulting: "profile.agent.categories.consulting",
  legal: "profile.agent.categories.legal",
  delivery: "profile.agent.categories.delivery",
  taxi: "profile.agent.categories.taxi",
  repair: "profile.agent.categories.repair",
  education: "profile.agent.categories.education",
  construction: "profile.agent.categories.construction",
  logistics: "profile.agent.categories.logistics",
  moving: "profile.agent.categories.moving",
  cleaning: "profile.agent.categories.cleaning",
  psychology: "profile.agent.categories.psychology",
  sports: "profile.agent.categories.sports",
  sport: "profile.agent.categories.sports",
  products: "profile.agent.categories.products",
  product: "profile.agent.categories.products",
  platform: "profile.agent.categories.platform"
};

export const humanizeSlug = (value: string) =>
  value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const resolveSafeMessage = (
  translate: (key: string) => string,
  key: string,
  fallback: string
) => {
  const value = translate(key);
  return value && value !== key ? value : fallback;
};

export const normalizeProfileLanguages = (value: string | string[] | null | undefined) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  return [] as string[];
};

export const formatProfileCount = (value: number | null | undefined, locale: SupportedLocale) =>
  new Intl.NumberFormat(LOCALE_FORMAT_MAP[locale]).format(Number(value || 0));

export const getProfileRoleLabel = (role: string | null | undefined, translate: TranslateWithFallback) => {
  const normalized = String(role || "USER").trim().toUpperCase();
  if (normalized === "ADMIN") return translate("profile.roles.admin", "Admin");
  if (normalized === "AGENT") return translate("profile.roles.agent", "Agent");
  return translate("profile.roles.user", "User");
};

export const getAgentKindLabel = (kind: string | null | undefined, translate: TranslateWithFallback) => {
  const normalized = String(kind || "SERVICE").trim().toUpperCase();
  const key = AGENT_KIND_KEY_MAP[normalized];
  return key ? translate(key, humanizeSlug(normalized.toLowerCase())) : humanizeSlug(normalized.toLowerCase());
};

export const getAgentCategoryLabel = (category: string | null | undefined, translate: TranslateWithFallback) => {
  const normalized = String(category || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (!normalized) return translate("profile.common.notProvided", "Not provided");
  const key = AGENT_CATEGORY_KEY_MAP[normalized];
  return key ? translate(key, humanizeSlug(normalized)) : humanizeSlug(normalized);
};

export const getProfileLanguageLabel = (value: string, translate: TranslateWithFallback) => {
  const normalized = value.trim().toLowerCase();
  const key = PROFILE_LANGUAGE_KEY_MAP[normalized];
  return key ? translate(key, value.trim()) : value.trim();
};

export const formatProfileLanguageChips = (
  value: string | string[] | null | undefined,
  translate: TranslateWithFallback
) =>
  normalizeProfileLanguages(value).map((item) => getProfileLanguageLabel(item, translate));
