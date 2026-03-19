import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAgentKindLabel,
  getCategoryDisplay,
  getPostTypeLabel,
  localizeKeywordList,
  resolveLocalizedArrayField,
  resolveLocalizedTextField
} from "../src/services/localizedContent";

test("localized text fields prefer active locale and fallback safely", () => {
  const record = {
    titleI18n: {
      uz: "Tarjima xizmati",
      en: "Translation Service",
      ko: "번역 서비스"
    },
    description: "fallback"
  };

  assert.equal(resolveLocalizedTextField(record, "title", "ko"), "번역 서비스");
  assert.equal(resolveLocalizedTextField(record, "title", "ru"), "Tarjima xizmati");
  assert.equal(resolveLocalizedTextField(record, "description", "en"), "fallback");
});

test("localized array fields and keyword chips use locale aware labels", () => {
  const record = {
    tagsI18n: {
      uz: ["visa", "documents"],
      en: ["visa", "documents"]
    }
  };

  assert.deepEqual(resolveLocalizedArrayField(record, "tags", "en"), ["visa", "documents"]);
  assert.deepEqual(localizeKeywordList(["business", "korea", "verified"], "ru"), ["Бизнес", "Корея", "Проверено"]);
});

test("category and enum labels expose localized display text", () => {
  assert.equal(getCategoryDisplay("translation", "en", "services").label, "Translation");
  assert.equal(getCategoryDisplay("technology", "ko").label, "기술 강좌");
  assert.equal(getAgentKindLabel("SELLER", "ru"), "Агент продавца");
  assert.equal(getPostTypeLabel("question", "uz"), "Savol");
});
