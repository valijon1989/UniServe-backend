import * as assert from "node:assert/strict";
import { test } from "node:test";
import { PaymentMethod } from "../src/models/PaymentMethod";
import { listPaymentMethods, resolvePaymentMethod } from "../src/services/paymentMethodCatalog";

test("payment method catalog default fallback SMS va manual methodlarni beradi", async () => {
  const originalFind = PaymentMethod.find;
  (PaymentMethod as any).find = () => ({
    lean: () => Promise.reject(new Error("mocked catalog unavailable"))
  });

  try {
    const methods = await listPaymentMethods("PRODUCT_ORDER");
    const codes = methods.map((item) => item.code);

    assert.ok(codes.includes("CARD"));
    assert.ok(codes.includes("SMS_PAYMENT_LINK"));
    assert.ok(codes.includes("SMS_INVOICE"));
    assert.ok(codes.includes("MANUAL_BANK_TRANSFER"));
  } finally {
    (PaymentMethod as any).find = originalFind;
  }
});

test("resolvePaymentMethod method group va provider mappingni qaytaradi", async () => {
  const originalFind = PaymentMethod.find;
  (PaymentMethod as any).find = () => ({
    lean: () => Promise.reject(new Error("mocked catalog unavailable"))
  });

  try {
    const card = await resolvePaymentMethod("PRODUCT_ORDER", "card");
    assert.equal(card.group, "INSTANT_ONLINE");
    assert.equal(card.provider, "MOCK_CARD");

    const sms = await resolvePaymentMethod("SERVICE_ORDER", "sms_payment_link");
    assert.equal(sms.group, "SMS_LINK");
    assert.equal(sms.supportsServices, true);
  } finally {
    (PaymentMethod as any).find = originalFind;
  }
});
