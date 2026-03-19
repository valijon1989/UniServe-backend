import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDeliveredState,
  buildEscrowHeldState,
  buildInitialMarketplaceStates,
  getBuyerLifecycleLabel,
  getSellerLifecycleLabel,
  mapCollectionStatusToStatePatch,
  resolveCompletionMode
} from "../src/services/marketplaceStateMachine";

test("initial marketplace states checkoutdan awaiting_payment bilan boshlanadi", () => {
  const initial = buildInitialMarketplaceStates();
  assert.equal(initial.lifecycleState, "awaiting_payment");
  assert.equal(initial.paymentState, "awaiting_payment");
  assert.equal(initial.fulfillmentState, "pending");
  assert.equal(initial.settlementState, "none");
  assert.equal(initial.disputeState, "none");
});

test("collection status held_in_escrow settlement held holatini beradi", () => {
  const held = mapCollectionStatusToStatePatch("HELD_IN_ESCROW");
  assert.equal(held.lifecycleState, "held_in_escrow");
  assert.equal(held.paymentState, "held_in_escrow");
  assert.equal(held.settlementState, "held");
});

test("category-aware completion mode translation va psychology uchun farq qiladi", () => {
  assert.equal(resolveCompletionMode("PRODUCT_ORDER", "shopping"), "delivery_based");
  assert.equal(resolveCompletionMode("SERVICE_ORDER", "translation"), "file_delivery");
  assert.equal(resolveCompletionMode("SERVICE_ORDER", "psychology"), "privacy_safe_session_completion");
});

test("delivered state buyer review mavjud bo'lsa awaiting_buyer_confirmation ga o'tadi", () => {
  const delivered = buildDeliveredState({ awaitingBuyerConfirmation: true });
  assert.equal(delivered.lifecycleState, "awaiting_buyer_confirmation");
  assert.equal(delivered.fulfillmentState, "awaiting_buyer_confirmation");
  assert.equal(delivered.settlementState, "release_pending");
});

test("buyer va seller labels trust-first matnlarni qaytaradi", () => {
  assert.match(getBuyerLifecycleLabel("held_in_escrow"), /escrow/i);
  assert.match(getSellerLifecycleLabel("payout_completed"), /hisobingizga/i);
  assert.match(getBuyerLifecycleLabel("payment_link_sent"), /havola/i);
});
