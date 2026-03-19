import * as assert from "node:assert/strict";
import { test } from "node:test";
import { getRecommendationModuleTitle, getRecommendationReasonLabel } from "../src/services/recommendationEngine";

test("recommendation labels are localized for module titles and reasons", () => {
  assert.equal(getRecommendationModuleTitle("products_for_you", "en"), "Products for you");
  assert.equal(getRecommendationModuleTitle("groups_for_you", "ko"), "추천 그룹");
  assert.equal(getRecommendationReasonLabel("popular_area", "ru"), "Популярно рядом с вами");
});
