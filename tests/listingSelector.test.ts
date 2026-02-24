import * as assert from "node:assert/strict";
import { test } from "node:test";
import { HomeSelectableListing, resolveDealSaleMeta, selectSaleListings, selectWeeklyTopListings } from "../src/services/listingSelector";

const buildListing = (
  overrides: Partial<HomeSelectableListing> & Pick<HomeSelectableListing, "_id" | "title" | "type">
): HomeSelectableListing => ({
  _id: overrides._id,
  type: overrides.type,
  slug: overrides.slug ?? `${overrides.type}-${overrides._id}`,
  title: overrides.title,
  description: overrides.description ?? "test listing",
  price: overrides.price ?? 100,
  originalPrice: overrides.originalPrice ?? overrides.price ?? 100,
  salePrice: overrides.salePrice ?? null,
  discountPercent: overrides.discountPercent ?? null,
  isSale: overrides.isSale ?? false,
  category: overrides.category ?? "test",
  ratingAvg: overrides.ratingAvg ?? 0,
  ratingCount: overrides.ratingCount ?? 0,
  stats: overrides.stats ?? {
    likes: 0,
    views: 0,
    orders: 0,
    likes_7d: 0,
    views_7d: 0,
    orders_7d: 0
  },
  createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
  coverImageUrl: overrides.coverImageUrl ?? "/static/test.jpg",
  images: overrides.images ?? ["/static/test.jpg"]
});

test("sale filter faqat sale itemlarni qaytaradi", () => {
  const saleA = buildListing({ _id: "1", type: "product", title: "sale-a", isSale: true, discountPercent: 20, salePrice: 80 });
  const saleB = buildListing({ _id: "2", type: "service", title: "sale-b", isSale: true, discountPercent: 15, salePrice: 85 });
  const normal = buildListing({ _id: "3", type: "product", title: "normal", isSale: false });

  const result = selectSaleListings([saleA, normal, saleB], [normal], 10);
  assert.equal(result.length, 2);
  assert.ok(result.every((item) => item.isSale));
  assert.deepEqual(
    new Set(result.map((item) => item._id)),
    new Set(["1", "2"])
  );
});

test("weekly top metric bo‘yicha to‘g‘ri tartiblanadi", () => {
  const a = buildListing({
    _id: "a",
    type: "product",
    title: "A",
    stats: { likes: 20, views: 200, orders: 10, likes_7d: 2, views_7d: 100, orders_7d: 5 }
  });
  const b = buildListing({
    _id: "b",
    type: "product",
    title: "B",
    stats: { likes: 20, views: 200, orders: 10, likes_7d: 10, views_7d: 1000, orders_7d: 3 }
  });
  const c = buildListing({
    _id: "c",
    type: "service",
    title: "C",
    stats: { likes: 20, views: 200, orders: 10, likes_7d: 1, views_7d: 200, orders_7d: 8 }
  });

  const ranked = selectWeeklyTopListings([a, b, c], [], 3);
  assert.deepEqual(
    ranked.map((item) => item._id),
    ["b", "c", "a"]
  );
});

test("limit parametri ishlaydi", () => {
  const items = [
    buildListing({ _id: "1", type: "product", title: "one", isSale: true, discountPercent: 10 }),
    buildListing({ _id: "2", type: "product", title: "two", isSale: true, discountPercent: 20 }),
    buildListing({ _id: "3", type: "service", title: "three", isSale: true, discountPercent: 30 })
  ];
  const limited = selectSaleListings(items, [], 2);
  assert.equal(limited.length, 2);
});

test("deal sale util discountPercent ni price/salePrice dan hisoblaydi", () => {
  const sale = resolveDealSaleMeta({ price: 100, salePrice: 74, discountPercent: null });
  assert.equal(sale.isOnSale, true);
  assert.equal(sale.discountPercent, 26);
  assert.equal(sale.salePrice, 74);
});

test("deal sale util discountPercent mavjud bo'lsa salePrice ni hisoblaydi", () => {
  const sale = resolveDealSaleMeta({ price: 100, salePrice: null, discountPercent: 15 });
  assert.equal(sale.isOnSale, true);
  assert.equal(sale.discountPercent, 15);
  assert.equal(sale.salePrice, 85);
});
