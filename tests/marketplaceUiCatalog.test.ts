import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFilterUiSchema,
  getUiIconSpec,
  listMarketplaceSortOptions,
  UI_ICON_LIBRARY
} from "../src/services/marketplaceUiCatalog";

test("ui icon catalog returns consistent icon library metadata", () => {
  const cart = getUiIconSpec("cart", "en");

  assert.equal(cart.library, UI_ICON_LIBRARY);
  assert.equal(cart.icon, "ShoppingCart");
  assert.equal(cart.symbol, "🛒");
  assert.equal(cart.tooltip, "Cart");
  assert.equal(cart.ariaLabel, "Cart");
});

test("filter schema and sort options are localized and icon-based", () => {
  const filters = buildFilterUiSchema(["price", "rating", "stock", "language"], "ko");
  const sorts = listMarketplaceSortOptions("ru");

  assert.deepEqual(
    filters.map((item) => item.label),
    ["가격", "평점", "재고", "언어"]
  );
  assert.equal(filters[0]?.icon.icon, "BadgeDollarSign");
  assert.equal(filters[2]?.icon.icon, "PackageCheck");
  assert.ok(sorts.some((item) => item.label === "Лучшее совпадение"));
  assert.ok(sorts.some((item) => item.icon.icon === "Sparkles"));
});
