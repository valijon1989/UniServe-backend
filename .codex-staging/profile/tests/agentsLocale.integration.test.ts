import test from "node:test";
import assert from "node:assert/strict";
import { getCatalogMessage } from "../src/lib/i18nCatalog";
import {
  formatAgentRelativeTime,
  getAgentStatusKey,
  normalizeAgentCategoryKey
} from "../src/lib/agentsPresentation";
import type { SupportedLocale } from "../src/lib/localization";

const REQUIRED_KEYS = [
  "agents.page.title",
  "agents.page.subtitle",
  "agents.page.description",
  "agents.sections.allActive",
  "agents.sections.allActiveSubtitle",
  "agents.sections.sellerAgents",
  "agents.sections.serviceAgents",
  "agents.filters.searchPlaceholder",
  "agents.filters.sort",
  "agents.filters.rating",
  "agents.filters.pageSize",
  "agents.filters.verified",
  "agents.pagination.previous",
  "agents.pagination.next",
  "agents.card.negotiable",
  "agents.card.translation",
  "agents.states.loading",
  "agents.states.empty",
  "agents.states.error",
  "common.verified",
  "common.all",
  "common.bestMatch"
] as const;

const translate = (locale: SupportedLocale, key: string, fallback: string) =>
  getCatalogMessage(locale, key) || fallback;

const buildSnapshot = (locale: SupportedLocale) => ({
  header: translate(locale, "agents.page.title", "Agents roster"),
  section: translate(locale, "agents.sections.allActive", "All active agents"),
  search: translate(locale, "agents.filters.searchPlaceholder", "Search agents"),
  sort: translate(locale, "common.bestMatch", "Best match"),
  seller: translate(locale, "agents.sections.sellerAgents", "Seller agents"),
  service: translate(locale, "agents.sections.serviceAgents", "Service agents"),
  next: translate(locale, "agents.pagination.next", "Next"),
  previous: translate(locale, "agents.pagination.previous", "Previous"),
  negotiable: translate(locale, "agents.card.negotiable", "Negotiable"),
  category: translate(locale, "agents.card.translation", "Translation"),
  loading: translate(locale, "agents.states.loading", "Loading..."),
  relativeTime: formatAgentRelativeTime(
    "2026-03-11T00:00:00.000Z",
    locale,
    Date.parse("2026-03-20T00:00:00.000Z")
  )
});

test("agents locale snapshot updates across uz, en, and ko", () => {
  const uz = buildSnapshot("uz");
  const en = buildSnapshot("en");
  const ko = buildSnapshot("ko");

  assert.equal(uz.header, "Agentlar ro'yxati");
  assert.equal(en.header, "Agents roster");
  assert.equal(ko.header, "에이전트 목록");

  assert.equal(uz.section, "Barcha aktiv agentlar");
  assert.equal(en.section, "All active agents");
  assert.equal(ko.section, "전체 활성 에이전트");

  assert.equal(uz.next, "Keyingi");
  assert.equal(en.next, "Next");
  assert.equal(ko.next, "다음");

  assert.equal(uz.negotiable, "Kelishiladi");
  assert.equal(en.negotiable, "Negotiable");
  assert.equal(ko.negotiable, "협의 가능");

  assert.equal(uz.relativeTime, "9 kun oldin");
  assert.equal(en.relativeTime, "9 days ago");
  assert.equal(ko.relativeTime, "9일 전");

  assert.notDeepEqual(uz, en);
  assert.notDeepEqual(en, ko);
});

test("agents translation catalog contains required keys for all supported locales", () => {
  const locales: SupportedLocale[] = ["uz", "en", "ru", "ko"];

  for (const locale of locales) {
    for (const key of REQUIRED_KEYS) {
      assert.ok(getCatalogMessage(locale, key), `Missing translation for ${locale}:${key}`);
    }
  }
});

test("agent locale helpers normalize API values for translation-aware cards", () => {
  assert.equal(normalizeAgentCategoryKey("translation_official"), "translation");
  assert.equal(normalizeAgentCategoryKey("electronics"), "electronics-resale");
  assert.equal(normalizeAgentCategoryKey("course"), "education");
  assert.equal(getAgentStatusKey({ status: "busy" }), "busy");
  assert.equal(getAgentStatusKey({ status: "online" }), "online");
  assert.equal(getAgentStatusKey({ status: "offline" }), "offline");
});
