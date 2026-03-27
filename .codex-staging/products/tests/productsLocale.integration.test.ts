import test from "node:test";
import assert from "node:assert/strict";
import { getCatalogMessage } from "../src/lib/i18nCatalog";
import { buildProductSpecSnippet } from "../src/data/shopTaxonomy";
import {
  formatProductPaginationSummary,
  formatProductRelativeTime,
  formatProductResultCount,
  getLocalizedProductSearchChips,
  getProductAudienceLabel,
  getProductConditionLabel,
  getProductDeliveryLabel,
  getProductSeasonLabel
} from "../src/lib/productsPresentation";
import type { SupportedLocale } from "../src/lib/localization";

const REQUIRED_KEYS = [
  "products.page.title",
  "products.page.subtitle",
  "products.page.description",
  "products.page.searchPlaceholder",
  "products.sidebar.foodTitle",
  "products.sidebar.electronicsTitle",
  "products.sidebar.beautyTitle",
  "products.filters.quickTitle",
  "products.filters.search",
  "products.filters.category",
  "products.filters.priceMin",
  "products.filters.priceMax",
  "products.filters.brand",
  "products.filters.delivery",
  "products.filters.condition",
  "products.filters.fastOnly",
  "products.filters.clear",
  "products.filters.sort",
  "products.pagination.previous",
  "products.pagination.next",
  "products.pagination.page",
  "products.tags.topSearch",
  "products.tags.fastDelivery",
  "products.card.action.buy_now",
  "products.card.action.quickView",
  "products.card.action.save",
  "products.card.badge.new",
  "products.card.badge.fastShipping",
  "products.card.price.contact",
  "products.states.empty",
  "products.states.loading",
  "products.states.error",
  "common.all",
  "common.bestMatch"
] as const;

const translate = (locale: SupportedLocale, key: string, fallback: string) =>
  getCatalogMessage(locale, key) || fallback;

const buildSnapshot = (locale: SupportedLocale) => ({
  title: translate(locale, "products.page.title", "Products"),
  search: translate(locale, "products.page.searchPlaceholder", "Search products"),
  filters: translate(locale, "products.filters.quickTitle", "Quick filters"),
  sort: translate(locale, "common.bestMatch", "Best match"),
  food: translate(locale, "products.sidebar.foodTitle", "Food section"),
  next: translate(locale, "products.pagination.next", "Next"),
  buy: translate(locale, "products.card.action.buy_now", "Buy now"),
  save: translate(locale, "products.card.action.save", "Save product"),
  chip: getLocalizedProductSearchChips(locale).find((item) => item.query === "Powerbank")?.label,
  delivery: getProductDeliveryLabel("fast", locale),
  condition: getProductConditionLabel("used", locale),
  audience: getProductAudienceLabel("women", locale),
  season: getProductSeasonLabel("winter", locale),
  summary: formatProductPaginationSummary(24, 2, locale),
  count: formatProductResultCount(24, locale),
  relativeTime: formatProductRelativeTime(
    "2026-03-11T00:00:00.000Z",
    locale,
    Date.parse("2026-03-20T00:00:00.000Z")
  )
});

test("products locale snapshot updates across uz, en, and ko", () => {
  const uz = buildSnapshot("uz");
  const en = buildSnapshot("en");
  const ko = buildSnapshot("ko");

  assert.equal(uz.title, "Mahsulotlar");
  assert.equal(en.title, "Products");
  assert.equal(ko.title, "상품");

  assert.equal(uz.food, "Oziq-ovqat bo'limi");
  assert.equal(en.food, "Food section");
  assert.equal(ko.food, "식품 섹션");

  assert.equal(uz.next, "Keyingi");
  assert.equal(en.next, "Next");
  assert.equal(ko.next, "다음");

  assert.equal(uz.buy, "Hozir sotib olish");
  assert.equal(en.buy, "Buy now");
  assert.equal(ko.buy, "바로 구매");

  assert.equal(uz.delivery, "Tez yetkazish");
  assert.equal(en.delivery, "Fast delivery");
  assert.equal(ko.delivery, "빠른 배송");

  assert.equal(uz.condition, "Ishlatilgan");
  assert.equal(en.condition, "Used");
  assert.equal(ko.condition, "중고");

  assert.equal(uz.relativeTime, "9 kun oldin");
  assert.equal(en.relativeTime, "9 days ago");
  assert.equal(ko.relativeTime, "9일 전");

  assert.notDeepEqual(uz, en);
  assert.notDeepEqual(en, ko);
});

test("products translation catalog contains required keys for all supported locales", () => {
  const locales: SupportedLocale[] = ["uz", "en", "ru", "ko"];

  for (const locale of locales) {
    for (const key of REQUIRED_KEYS) {
      assert.ok(getCatalogMessage(locale, key), `Missing translation for ${locale}:${key}`);
    }
  }
});

test("product locale helpers localize dynamic chips and category snippets", () => {
  const fashionProduct = {
    category: "fashion",
    size: "M",
    season: "winter",
    audience: "women",
    brand: "Atelier"
  } as any;

  const electronicsProduct = {
    category: "electronics",
    brand: "Nova",
    storage: "1TB",
    condition: "used"
  } as any;

  const uzFashion = buildProductSpecSnippet(fashionProduct, "uz").join(" | ");
  const enFashion = buildProductSpecSnippet(fashionProduct, "en").join(" | ");
  const koElectronics = buildProductSpecSnippet(electronicsProduct, "ko").join(" | ");

  assert.match(uzFashion, /Qishki/);
  assert.match(uzFashion, /Ayollar/);
  assert.match(enFashion, /Winter/);
  assert.match(enFashion, /Women/);
  assert.match(koElectronics, /중고/);

  assert.equal(
    getLocalizedProductSearchChips("ko").find((item) => item.query === "Powerbank")?.label,
    "보조배터리"
  );
});
