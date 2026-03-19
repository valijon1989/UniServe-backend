import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCategoryMeta,
  buildMarketplaceLanding,
  listMarketplaceSections,
  normalizeMarketplaceCategory,
  resolveMarketplaceTaxonomy
} from "../src/services/categoryTaxonomy";
import { TaxonomyNode } from "../src/models/TaxonomyNode";

test("digital services category uses hyphenated public routes", () => {
  const [category] = listMarketplaceSections(["digital_services"], "en");

  assert.equal(category.slug, "digital_services");
  assert.equal(category.route, "/digital-services");
  assert.equal(category.displayName, "Digital Services");
  assert.equal(category.subcategories[0]?.route, "/digital-services/website-development");
});

test("taxonomy resolver keeps stored slugs stable while returning localized routes", () => {
  const resolved = resolveMarketplaceTaxonomy("huquqiy-xizmatlar", "en", "services");
  const meta = buildCategoryMeta("legal_services", "en", "services");

  assert.equal(resolved?.main.slug, "services");
  assert.equal(resolved?.subcategory?.slug, "legal_services");
  assert.equal(resolved?.subcategory?.route, "/services/legal");
  assert.equal(meta?.displayName, "Legal Services");
  assert.equal(meta?.route, "/services/legal");
  assert.equal(normalizeMarketplaceCategory("huquqiy-xizmatlar", "services"), "legal_services");
});

test("main category slugs resolve without leaking underscore routes", () => {
  const meta = buildCategoryMeta("digital_services", "ko");

  assert.equal(meta?.mainCategory, "digital_services");
  assert.equal(meta?.categorySlug, "digital_services");
  assert.equal(meta?.route, "/digital-services");
  assert.equal(meta?.displayName, "디지털 서비스");
  assert.equal(normalizeMarketplaceCategory("digital_services"), "digital_services");
});

test("taxonomy nodes support localized database names", () => {
  assert.ok(TaxonomyNode.schema.path("name.uz"));
  assert.ok(TaxonomyNode.schema.path("name.en"));
  assert.ok(TaxonomyNode.schema.path("name.ru"));
  assert.ok(TaxonomyNode.schema.path("name.ko"));
});

test("category landing exposes breadcrumbs, filter schema and sort options", () => {
  const landing = buildMarketplaceLanding("services", "translation", "en");

  assert.equal(landing?.category.slug, "services");
  assert.equal(landing?.subcategory?.slug, "translation");
  assert.deepEqual(
    landing?.breadcrumbs.map((item) => item.label),
    ["Home", "Professional Services", "Translation"]
  );
  assert.ok(landing?.filterSchema.some((item) => item.key === "language"));
  assert.ok(landing?.filterSchema.some((item) => item.icon.icon === "Languages"));
  assert.ok(landing?.sortOptions.some((item) => item.value === "best_match"));
});
