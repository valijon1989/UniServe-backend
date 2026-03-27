import * as assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeServiceSort, resolveServiceCategoryFilter, resolveServiceUiCategoryKey } from "../src/controllers/serviceController";
import { buildListingFilterSchema } from "../src/services/sharedFilters";

test("service filter schema exposes localized category labels instead of price fallback", () => {
  const filters = buildListingFilterSchema("services", "uz");
  const category = filters.find((item) => item.key === "category");
  const subcategory = filters.find((item) => item.key === "subcategory");

  assert.equal(category?.label, "Kategoriya");
  assert.equal(category?.icon.icon, "LayoutGrid");
  assert.equal(subcategory?.label, "Subkategoriya");
  assert.equal(subcategory?.icon.icon, "FolderTree");
});

test("service query normalization keeps main services page unfiltered but preserves ui category", () => {
  assert.equal(resolveServiceCategoryFilter({ category: "services" }), null);
  assert.equal(resolveServiceUiCategoryKey({ category: "services" }), "services");
  assert.equal(resolveServiceCategoryFilter({ category: "legal" }), "legal_services");
  assert.equal(resolveServiceCategoryFilter({ subCategory: "translation" }), "translation");
});

test("service sort normalization supports frontend legacy sort values", () => {
  assert.equal(normalizeServiceSort("new"), "newest");
  assert.equal(normalizeServiceSort("rating"), "top_rated");
  assert.equal(normalizeServiceSort("price_low"), "price_asc");
  assert.equal(normalizeServiceSort("price_high"), "price_desc");
  assert.equal(normalizeServiceSort("best_match"), "popular");
});
