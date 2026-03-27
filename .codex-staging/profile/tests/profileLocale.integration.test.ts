import test from "node:test";
import assert from "node:assert/strict";
import { getCatalogMessage } from "../src/lib/i18nCatalog";
import {
  formatProfileLanguageChips,
  getAgentCategoryLabel,
  getAgentKindLabel,
  getProfileRoleLabel
} from "../src/lib/profilePresentation";
import type { SupportedLocale } from "../src/lib/localization";

const REQUIRED_KEYS = [
  "profile.sidebar.profile",
  "profile.sidebar.security",
  "profile.sidebar.listings",
  "profile.sidebar.wallet",
  "profile.sidebar.notifications",
  "profile.form.title",
  "profile.form.languages",
  "profile.summary.title",
  "profile.contact.title",
  "profile.agent.upgradeTitle",
  "profile.agent.kinds.service",
  "profile.agent.categories.translation",
  "profile.security.title",
  "profile.notifications.title",
  "profile.toast.profileSaved",
  "profile.public.title",
  "profile.languages.uz",
  "profile.languages.en",
  "profile.languages.ko"
] as const;

const translate = (locale: SupportedLocale, key: string, fallback: string) =>
  getCatalogMessage(locale, key) || fallback;

const buildSnapshot = (locale: SupportedLocale) => {
  const tx = (key: string, fallback: string) => translate(locale, key, fallback);
  return {
    sidebar: tx("profile.sidebar.profile", "Profile"),
    security: tx("profile.security.title", "Security and access"),
    form: tx("profile.form.title", "Update your profile"),
    summary: tx("profile.summary.title", "Public account snapshot"),
    contact: tx("profile.contact.title", "Contact and visibility"),
    upgrade: tx("profile.agent.upgradeTitle", "Become an agent"),
    role: getProfileRoleLabel("AGENT", tx),
    kind: getAgentKindLabel("SERVICE", tx),
    category: getAgentCategoryLabel("translation", tx),
    languages: formatProfileLanguageChips(["uz", "en", "ko"], tx).join(" | ")
  };
};

test("profile locale snapshot updates across uz, en, and ko", () => {
  const uz = buildSnapshot("uz");
  const en = buildSnapshot("en");
  const ko = buildSnapshot("ko");

  assert.equal(uz.sidebar, "Profil");
  assert.equal(en.sidebar, "Profile");
  assert.equal(ko.sidebar, "프로필");

  assert.equal(uz.form, "Profilni yangilang");
  assert.equal(en.form, "Update your profile");
  assert.equal(ko.form, "프로필 업데이트");

  assert.equal(uz.upgrade, "Agent bo'lish");
  assert.equal(en.upgrade, "Become an agent");
  assert.equal(ko.upgrade, "에이전트 되기");

  assert.equal(uz.category, "Tarjima");
  assert.equal(en.category, "Translation");
  assert.equal(ko.category, "번역");

  assert.equal(uz.languages, "O'zbek | Ingliz tili | Koreys tili");
  assert.equal(en.languages, "Uzbek | English | Korean");
  assert.equal(ko.languages, "우즈베크어 | 영어 | 한국어");

  assert.notDeepEqual(uz, en);
  assert.notDeepEqual(en, ko);
});

test("profile translation catalog contains required keys for all supported locales", () => {
  const locales: SupportedLocale[] = ["uz", "en", "ru", "ko"];

  for (const locale of locales) {
    for (const key of REQUIRED_KEYS) {
      assert.ok(getCatalogMessage(locale, key), `Missing translation for ${locale}:${key}`);
    }
  }
});
