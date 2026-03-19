import * as assert from "node:assert/strict";
import { test } from "node:test";
import { BuyerConfirmation } from "../src/models/BuyerConfirmation";
import { CheckoutSession } from "../src/models/CheckoutSession";
import { DisputeEvidenceRecord } from "../src/models/DisputeEvidence";
import { EscrowHold } from "../src/models/EscrowHold";
import { LedgerAccount } from "../src/models/LedgerAccount";
import { NotificationEvent } from "../src/models/NotificationEvent";
import { OrderAddress } from "../src/models/OrderAddress";
import { OrderFulfillmentDetail } from "../src/models/OrderFulfillmentDetail";
import { OrderFulfillmentEvent } from "../src/models/OrderFulfillmentEvent";
import { OrderItemRecord } from "../src/models/OrderItem";
import { PaymentIntent } from "../src/models/PaymentIntent";
import { PaymentMethodSelection } from "../src/models/PaymentMethodSelection";
import { RefundRequest } from "../src/models/RefundRequest";
import { SellerPayoutAccount } from "../src/models/SellerPayoutAccount";
import mongoose from "mongoose";

test("payment intent schema checkout collection metadata maydonlarini saqlaydi", () => {
  assert.ok(PaymentIntent.schema.path("paymentMethodSelectionId"));
  assert.ok(PaymentIntent.schema.path("amountMinor"));
  assert.ok(PaymentIntent.schema.path("referenceCode"));
  assert.ok(PaymentIntent.schema.path("providerReference"));
  assert.ok(PaymentIntent.schema.path("statusLabelCache"));
});

test("payment method selection schema null invoice channel bilan ham card checkoutni bloklamaydi", () => {
  const selection = new PaymentMethodSelection({
    orderId: new mongoose.Types.ObjectId(),
    paymentIntentId: new mongoose.Types.ObjectId(),
    selectedMethod: "CARD",
    selectedGroup: "INSTANT_ONLINE",
    phoneUsed: "998901234567",
    invoiceDeliveryChannel: null
  });

  const validation = selection.validateSync();

  assert.equal(validation, undefined);
  assert.equal(selection.invoiceDeliveryChannel, undefined);
});

test("checkout session schema payment-intentgacha session state ni saqlaydi", () => {
  assert.equal(CheckoutSession.collection.name, "checkout_sessions");
  assert.ok(CheckoutSession.schema.path("sourceType"));
  assert.ok(CheckoutSession.schema.path("paymentMethodSelection"));
  assert.ok(CheckoutSession.schema.path("shippingAddress"));
});

test("ledger va escrow collectionlari audit-friendly fieldlarga ega", () => {
  assert.equal(LedgerAccount.collection.name, "ledger_accounts");
  assert.ok(LedgerAccount.schema.path("balanceMinor"));
  assert.ok(LedgerAccount.schema.path("heldBalanceMinor"));
  assert.equal(EscrowHold.collection.name, "escrow_holds");
  assert.ok(EscrowHold.schema.path("grossAmountMinor"));
  assert.ok(EscrowHold.schema.path("netHeldAmountMinor"));
});

test("core order companion tables order address, fulfillment detail va item snapshotni qo'llaydi", () => {
  assert.equal(OrderAddress.collection.name, "order_addresses");
  assert.ok(OrderAddress.schema.path("sourceModel"));
  assert.equal(OrderFulfillmentDetail.collection.name, "order_fulfillment_details");
  assert.ok(OrderFulfillmentDetail.schema.path("sourceModel"));
  assert.equal(OrderFulfillmentEvent.collection.name, "order_fulfillment_events");
  assert.ok(OrderFulfillmentEvent.schema.path("sourceModel"));
  assert.equal(BuyerConfirmation.collection.name, "buyer_confirmations");
  assert.ok(BuyerConfirmation.schema.path("sourceModel"));
  assert.equal(OrderItemRecord.collection.name, "order_items");
  assert.ok(OrderItemRecord.schema.path("unitPriceMinor"));
  assert.ok(OrderItemRecord.schema.path("lineTotalMinor"));
});

test("refund, payout va notification schemas explicit state fields bilan yaratilgan", () => {
  assert.equal(RefundRequest.collection.name, "refund_requests");
  assert.ok(RefundRequest.schema.path("requestedAmountMinor"));
  assert.equal(NotificationEvent.collection.name, "notification_events");
  assert.ok(NotificationEvent.schema.path("deliveryStatus"));
  assert.equal(SellerPayoutAccount.collection.name, "seller_payout_accounts");
  assert.ok(SellerPayoutAccount.schema.path("encryptedPayload"));
});

test("dispute evidence collection alohida audit trail sifatida mavjud", () => {
  assert.equal(DisputeEvidenceRecord.collection.name, "dispute_evidence");
  assert.ok(DisputeEvidenceRecord.schema.path("evidenceType"));
  assert.ok(DisputeEvidenceRecord.schema.path("uploadedByUserId"));
});
