import * as assert from "node:assert/strict";
import { test } from "node:test";
import { buildListingFilterSchema } from "../src/services/sharedFilters";

test("shared filter schema exposes category-aware vertical filters", () => {
  const productFilters = buildListingFilterSchema("products", "en");
  const translationFilters = buildListingFilterSchema("services", "en", "translation");
  const legalFilters = buildListingFilterSchema("services", "en", "legal_services");

  assert.ok(productFilters.some((item) => item.key === "brand"));
  assert.ok(productFilters.some((item) => item.key === "condition"));
  assert.ok(productFilters.some((item) => item.key === "stock"));
  assert.ok(translationFilters.some((item) => item.key === "delivery_time"));
  assert.ok(translationFilters.some((item) => item.key === "language"));
  assert.ok(legalFilters.some((item) => item.key === "jurisdiction"));
  assert.ok(legalFilters.some((item) => item.key === "privacy"));
});
