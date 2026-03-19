import * as assert from "node:assert/strict";
import { test } from "node:test";
import { inferSettlementCategory, listDefaultCategoryPaymentPolicies } from "../src/services/paymentPolicy";
import { toEscrowBucketKey } from "../src/types/paymentDomain";

test("product orders shopping escrow bucketga tushadi", () => {
  const category = inferSettlementCategory("PRODUCT_ORDER", "electronics");
  assert.equal(category, "shopping");
  assert.equal(toEscrowBucketKey(category), "shopping_held");
});

test("service vertical kategoriyalar category-aware mapping oladi", () => {
  assert.equal(inferSettlementCategory("SERVICE_ORDER", "translation"), "translation");
  assert.equal(inferSettlementCategory("SERVICE_ORDER", "legal consultation"), "legal");
  assert.equal(inferSettlementCategory("SERVICE_ORDER", "psychology"), "psychology");
  assert.equal(inferSettlementCategory("COURSE_ENROLLMENT", "english course"), "education");
  assert.equal(inferSettlementCategory("CONSULTING_REQUEST", "growth consulting"), "consulting");
  assert.equal(inferSettlementCategory("SERVICE_ORDER", "sport coaching"), "sport");
});

test("default policies escrow trust copy va bucket key beradi", () => {
  const policies = listDefaultCategoryPaymentPolicies();
  const shopping = policies.find((item) => item.categoryKey === "shopping");
  const legal = policies.find((item) => item.categoryKey === "legal");

  assert.ok(shopping);
  assert.equal(shopping?.bucketKey, "shopping_held");
  assert.match(shopping?.trustCopy || "", /escrow/i);

  assert.ok(legal);
  assert.equal(legal?.privacySafeCompletion, true);
  assert.ok((legal?.proofRequirements || []).includes("consultation_marker"));
});
