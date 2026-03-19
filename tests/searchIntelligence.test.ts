import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildEmptySearchSuggestions,
  detectSearchIntent,
  levenshteinDistance,
  normalizeSearchQuery,
  rankTextMatch,
  suggestCorrectedQuery
} from "../src/services/searchIntelligence";

test("search intelligence normalizes queries and catches common typos", () => {
  assert.equal(normalizeSearchQuery("  Transltion Service  "), "transltion service");
  assert.equal(suggestCorrectedQuery("transltion"), "translation");
  assert.equal(suggestCorrectedQuery("psycology"), "psychology");
  assert.equal(levenshteinDistance("samsung", "samsng"), 1);
});

test("search intent detection and ranking prefer direct matches", () => {
  assert.equal(detectSearchIntent("korean translation"), "service");
  assert.equal(detectSearchIntent("startup mentor"), "agent");
  assert.ok(rankTextMatch("translation", "translation service") > rankTextMatch("translation", "legal review"));
});

test("empty search suggestions surface localized marketplace categories", () => {
  const suggestions = buildEmptySearchSuggestions("transl", "en");
  assert.ok(suggestions.some((item) => item.route === "/services/translation"));
});
