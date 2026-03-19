import * as assert from "node:assert/strict";
import { test } from "node:test";
import { createProductListingQueryState, serializeProductCard } from "../src/services/productCard";

test("product card serializer returns locale-aware normalized commerce payload", () => {
  const createdAt = new Date();
  const card = serializeProductCard(
    {
      _id: "65f000000000000000000111",
      slug: "galaxy-s24-ultra",
      titleI18n: {
        uz: "Galaxy S24 Ultra",
        ko: "갤럭시 S24 울트라"
      },
      shortTitleI18n: {
        ko: "갤럭시 S24"
      },
      brandI18n: {
        en: "Samsung",
        ko: "삼성"
      },
      category: "electronics",
      subCategory: "mobile_accessories",
      price: 1200,
      salePrice: 990,
      currency: "USD",
      images: ["/images/phone-main.png", "/images/phone-hover.png"],
      delivery: {
        type: "fast",
        fee: 0
      },
      ratingAvg: 4.8,
      ratingCount: 42,
      purchaseCount: 19,
      stock: 7,
      isFeatured: true,
      createdBy: {
        _id: "65f000000000000000000222",
        name: "Samsung Store",
        role: "AGENT",
        isVerified: true
      },
      createdAt
    },
    "ko",
    { savedProductIds: new Set(["65f000000000000000000111"]) }
  );

  assert.equal(card.id, "65f000000000000000000111");
  assert.equal(card.identity.category, "electronics");
  assert.equal(card.identity.subcategory, "mobile_accessories");
  assert.equal(card.identity.brand, "삼성");
  assert.equal(card.display.title, "갤럭시 S24 울트라");
  assert.equal(card.display.shortTitle, "갤럭시 S24");
  assert.equal(card.display.values.category, "전자제품");
  assert.equal(card.display.values.subcategory, "모바일 액세서리");
  assert.equal(card.pricing.currentPrice, 990);
  assert.equal(card.pricing.oldPrice, 1200);
  assert.equal(card.pricing.discountPercent, 18);
  assert.equal(card.logistics.fastShipping, true);
  assert.equal(card.logistics.freeShipping, true);
  assert.equal(card.trust.verifiedSeller, true);
  assert.equal(card.actions.isSavedByCurrentUser, true);
  assert.equal(card.media.galleryPreview.length, 2);
  assert.ok(card.badges.list.some((badge) => badge.key === "featured"));
  assert.ok(card.badges.list.some((badge) => badge.key === "discount"));
});

test("product card serializer keeps safe defaults when optional blocks are missing", () => {
  const card = serializeProductCard(
    {
      _id: "65f000000000000000000333",
      title: "Fallback product",
      category: "fashion",
      price: 0,
      status: "ACTIVE"
    },
    "en"
  );

  assert.equal(card.media.primaryImage.includes("fallback-product.png"), true);
  assert.equal(card.media.galleryPreview.length, 1);
  assert.equal(card.pricing.currentPrice, null);
  assert.equal(card.logistics.stockCount, 1);
  assert.equal(card.logistics.stockStatus, "in_stock");
  assert.equal(card.actions.canAddToCart, false);
  assert.equal(card.display.values.category, "Fashion");
});

test("product listing query state normalizes listing filters for card payload queries", () => {
  const state = createProductListingQueryState({
    page: "2",
    limit: "12",
    category: "electronics",
    subcategory: "mobile_accessories",
    brand: "Samsung",
    stock: "in_stock",
    minPrice: "100",
    maxPrice: "1500",
    rating: "4",
    sort: "price_desc"
  });

  assert.equal(state.page, 2);
  assert.equal(state.limit, 12);
  assert.equal(state.categoryKey, "electronics");
  assert.equal(state.subcategoryKey, "mobile_accessories");
  assert.equal(state.brand, "Samsung");
  assert.equal(state.stock, "in_stock");
  assert.equal(state.minPrice, 100);
  assert.equal(state.maxPrice, 1500);
  assert.equal(state.ratingMin, 4);
  assert.equal(state.sortValue, "price_desc");
});
