import { PaymentMethod, type IPaymentMethod } from "../models/PaymentMethod";
import type { PaymentMethodCode, PaymentMethodGroup, PaymentSourceType } from "../types/paymentDomain";
import type { AppLocale } from "../i18n";
import { t } from "../i18n";

export interface PaymentMethodDefinition {
  code: PaymentMethodCode;
  displayName: string;
  group: PaymentMethodGroup;
  provider: string;
  enabled: boolean;
  supportsProducts: boolean;
  supportsServices: boolean;
  supportsRedirect: boolean;
  supportsSms: boolean;
  supportsManualVerification: boolean;
  currencies: string[];
  checkoutDescription: string;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethodDefinition[] = [
  {
    code: "CARD",
    displayName: "Card",
    group: "INSTANT_ONLINE",
    provider: "MOCK_CARD",
    enabled: true,
    supportsProducts: true,
    supportsServices: true,
    supportsRedirect: true,
    supportsSms: false,
    supportsManualVerification: false,
    currencies: ["USD", "KRW", "UZS"],
    checkoutDescription: "Instant online card payment routed through UniServe escrow."
  },
  {
    code: "PAYME",
    displayName: "Payme",
    group: "PLATFORM_LINKED",
    provider: "PAYME",
    enabled: true,
    supportsProducts: true,
    supportsServices: true,
    supportsRedirect: true,
    supportsSms: false,
    supportsManualVerification: false,
    currencies: ["UZS", "USD"],
    checkoutDescription: "Continue through Payme and hold funds in UniServe escrow after confirmation."
  },
  {
    code: "CLICK",
    displayName: "Click",
    group: "PLATFORM_LINKED",
    provider: "CLICK",
    enabled: true,
    supportsProducts: true,
    supportsServices: true,
    supportsRedirect: true,
    supportsSms: false,
    supportsManualVerification: false,
    currencies: ["UZS", "USD"],
    checkoutDescription: "Redirect to Click and confirm the payment back into UniServe escrow."
  },
  {
    code: "KAKAOPAY",
    displayName: "KakaoPay",
    group: "PLATFORM_LINKED",
    provider: "KAKAOPAY",
    enabled: true,
    supportsProducts: true,
    supportsServices: true,
    supportsRedirect: true,
    supportsSms: false,
    supportsManualVerification: false,
    currencies: ["KRW", "USD"],
    checkoutDescription: "Fast wallet payment routed through UniServe-controlled escrow."
  },
  {
    code: "SMS_PAYMENT_LINK",
    displayName: "SMS payment link",
    group: "SMS_LINK",
    provider: "UNISERVE_SMS",
    enabled: true,
    supportsProducts: true,
    supportsServices: true,
    supportsRedirect: false,
    supportsSms: true,
    supportsManualVerification: false,
    currencies: ["USD", "UZS", "KRW"],
    checkoutDescription: "Send a secure payment link to the buyer phone and activate after payment confirmation."
  },
  {
    code: "SMS_INVOICE",
    displayName: "SMS invoice",
    group: "SMS_INVOICE",
    provider: "UNISERVE_SMS",
    enabled: true,
    supportsProducts: true,
    supportsServices: true,
    supportsRedirect: false,
    supportsSms: true,
    supportsManualVerification: true,
    currencies: ["USD", "UZS", "KRW"],
    checkoutDescription: "Send invoice requisites and reference code over SMS for later payment."
  },
  {
    code: "MANUAL_BANK_TRANSFER",
    displayName: "Manual bank transfer",
    group: "MANUAL_BANK_TRANSFER",
    provider: "UNISERVE_BANK",
    enabled: true,
    supportsProducts: true,
    supportsServices: true,
    supportsRedirect: false,
    supportsSms: false,
    supportsManualVerification: true,
    currencies: ["USD", "UZS", "KRW"],
    checkoutDescription: "Show bank requisites and hold the order until transfer verification completes."
  },
  {
    code: "FUTURE_PSP",
    displayName: "Future PSP",
    group: "FUTURE_MODERN",
    provider: "FUTURE_PSP",
    enabled: true,
    supportsProducts: true,
    supportsServices: true,
    supportsRedirect: true,
    supportsSms: false,
    supportsManualVerification: false,
    currencies: ["USD"],
    checkoutDescription: "Reserved modern payment option for future PSP integrations."
  }
];

const PAYMENT_METHOD_TEXT_KEYS: Record<
  PaymentMethodCode,
  { name: Parameters<typeof t>[1]; description: Parameters<typeof t>[1] }
> = {
  CARD: {
    name: "payments.methods.card.name",
    description: "payments.methods.card.description"
  },
  PAYME: {
    name: "payments.methods.payme.name",
    description: "payments.methods.payme.description"
  },
  CLICK: {
    name: "payments.methods.click.name",
    description: "payments.methods.click.description"
  },
  KAKAOPAY: {
    name: "payments.methods.kakaopay.name",
    description: "payments.methods.kakaopay.description"
  },
  SMS_PAYMENT_LINK: {
    name: "payments.methods.sms_payment_link.name",
    description: "payments.methods.sms_payment_link.description"
  },
  SMS_INVOICE: {
    name: "payments.methods.sms_invoice.name",
    description: "payments.methods.sms_invoice.description"
  },
  MANUAL_BANK_TRANSFER: {
    name: "payments.methods.manual_bank_transfer.name",
    description: "payments.methods.manual_bank_transfer.description"
  },
  FUTURE_PSP: {
    name: "payments.methods.future_psp.name",
    description: "payments.methods.future_psp.description"
  }
};

const toDefinition = (item: Partial<IPaymentMethod> | PaymentMethodDefinition): PaymentMethodDefinition => ({
  code: item.code as PaymentMethodCode,
  displayName: String(item.displayName || item.code),
  group: item.group as PaymentMethodGroup,
  provider: String(item.provider || item.code || "MOCK"),
  enabled: item.enabled !== false,
  supportsProducts: item.supportsProducts !== false,
  supportsServices: item.supportsServices !== false,
  supportsRedirect: Boolean(item.supportsRedirect),
  supportsSms: Boolean(item.supportsSms),
  supportsManualVerification: Boolean(item.supportsManualVerification),
  currencies: Array.isArray(item.currencies) && item.currencies.length ? item.currencies.map(String) : ["USD"],
  checkoutDescription: String(item.checkoutDescription || "UniServe escrow payment method.")
});

const isServiceSource = (sourceType: PaymentSourceType) => sourceType !== "PRODUCT_ORDER";

const localizeMethod = (method: PaymentMethodDefinition, locale?: AppLocale): PaymentMethodDefinition => {
  const keys = PAYMENT_METHOD_TEXT_KEYS[method.code];
  if (!keys) return method;
  return {
    ...method,
    displayName: t(locale, keys.name),
    checkoutDescription: t(locale, keys.description)
  };
};

export const listPaymentMethods = async (sourceType: PaymentSourceType, locale?: AppLocale): Promise<PaymentMethodDefinition[]> => {
  const stored = await PaymentMethod.find({ enabled: true }).lean().catch(() => []);
  const catalog = stored.length ? stored.map((item) => toDefinition(item)) : DEFAULT_PAYMENT_METHODS.map((item) => toDefinition(item));
  const serviceSource = isServiceSource(sourceType);
  return catalog
    .filter((item) => (serviceSource ? item.supportsServices : item.supportsProducts))
    .map((item) => localizeMethod(item, locale));
};

export const resolvePaymentMethod = async (
  sourceType: PaymentSourceType,
  methodCode: string,
  locale?: AppLocale
): Promise<PaymentMethodDefinition> => {
  const normalizedCode = String(methodCode || "").trim().toUpperCase();
  const catalog = await listPaymentMethods(sourceType, locale);
  const method = catalog.find((item) => item.code === normalizedCode);
  if (!method) {
    throw new Error(`Unsupported payment method: ${normalizedCode || "UNKNOWN"}`);
  }
  return method;
};
