import crypto from "crypto";
import mongoose from "mongoose";
import { BankTransferRequest } from "../models/BankTransferRequest";
import { Invoice } from "../models/Invoice";
import { Payment } from "../models/Payment";
import { PaymentAttempt } from "../models/PaymentAttempt";
import { PaymentIntent } from "../models/PaymentIntent";
import { PaymentMethodSelection } from "../models/PaymentMethodSelection";
import { PaymentProviderEvent } from "../models/PaymentProviderEvent";
import { SmsPaymentRequest } from "../models/SmsPaymentRequest";
import { TransactionReference } from "../models/TransactionReference";
import { Order } from "../models/Order";
import { ServiceOrder } from "../models/ServiceOrder";
import { User } from "../models/User";
import { confirmEscrowPayment } from "./paymentEngine";
import {
  appendTimelineEntries,
  buildEscrowHeldState,
  buildTimelineEntry,
  getBuyerLifecycleLabel,
  mapCollectionStatusToStatePatch
} from "./marketplaceStateMachine";
import { resolveCategoryPaymentPolicy } from "./paymentPolicy";
import { createSystemNotification } from "./paymentNotifications";
import { resolvePaymentMethod, listPaymentMethods, type PaymentMethodDefinition } from "./paymentMethodCatalog";
import type {
  BankTransferStatus,
  InvoiceKind,
  PaymentCollectionStatus,
  PaymentMethodCode,
  PaymentNextActionType,
  PaymentSourceType,
  ProviderEventStatus,
  SmsPaymentType,
  SmsVerificationState
} from "../types/paymentDomain";
import type { AppLocale } from "../i18n";
import { formatCurrencyForLocale, formatDateTimeForLocale, t } from "../i18n";

const DEFAULT_EXPIRY_HOURS = 24;
const TERMINAL_INTENT_STATUSES = new Set<PaymentCollectionStatus>([
  "HELD_IN_ESCROW",
  "PAYMENT_FAILED",
  "PAYMENT_EXPIRED",
  "CANCELLED"
]);

const normalizeText = (value: unknown) => String(value || "").trim();

const toObjectId = (value: mongoose.Types.ObjectId | string | null | undefined) => {
  const raw = String(value || "").trim();
  return raw && mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
};

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);
const toMinorUnits = (amount: number) => Math.max(0, Math.round(Number(amount || 0) * 100));

const makeReferenceCode = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

const makeSecureLinkToken = () => crypto.randomBytes(16).toString("hex");

const maskPhone = (phone: string) => {
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, Math.max(0, phone.length - 4)).replace(/[0-9]/g, "*")}${phone.slice(-4)}`;
};

const buildInstantRedirectUrl = (provider: string, paymentIntentId: mongoose.Types.ObjectId, orderId: mongoose.Types.ObjectId) =>
  `https://payments.uniserve.local/${provider.toLowerCase()}/pay?intent=${String(paymentIntentId)}&order=${String(orderId)}`;

const buildSecurePaymentLink = (paymentIntentId: mongoose.Types.ObjectId, token: string) =>
  `https://pay.uniserve.local/intent/${String(paymentIntentId)}?token=${token}`;

const getSmsVerificationState = (phoneVerified: boolean): SmsVerificationState => (phoneVerified ? "VERIFIED" : "OTP_READY");

const buildSmsMessage = (params: {
  orderCode: string;
  amount: number;
  currency: string;
  expiry: Date;
  referenceCode: string;
  phone: string;
  secureLinkUrl?: string | null;
  bankInstruction?: string | null;
  locale?: AppLocale;
}) => {
  const action = params.secureLinkUrl
    ? `Pay: ${params.secureLinkUrl}`
    : params.bankInstruction
      ? `Bank: ${params.bankInstruction}`
      : "";
  return [
    t(params.locale, "payments.collection.sms_body.text", {
      orderCode: params.orderCode,
      amount: formatCurrencyForLocale(params.amount, params.currency, params.locale),
      expiry: formatDateTimeForLocale(params.expiry, params.locale),
      referenceCode: params.referenceCode,
      action
    }),
    t(params.locale, "payments.collection.security_note.text")
  ].join(" ");
};

const getBankDetails = (currency: string, locale?: AppLocale) => ({
  bankName: "UniServe Settlement Bank",
  accountName: "UniServe Marketplace Holdings",
  accountNumber: currency === "KRW" ? "110-9988-221100" : currency === "UZS" ? "2020-4000-9988-1100" : "US00UNISERVE11009988",
  swiftCode: "UNISKRSE",
  routingNote: t(locale, "payments.instructions.routing_note.text")
});

const isInstantMethod = (method: PaymentMethodDefinition) =>
  method.group === "INSTANT_ONLINE" || method.group === "PLATFORM_LINKED" || method.group === "FUTURE_MODERN";

const isSmsMethod = (method: PaymentMethodDefinition) => method.group === "SMS_LINK" || method.group === "SMS_INVOICE";

const isManualTransferMethod = (method: PaymentMethodDefinition) => method.group === "MANUAL_BANK_TRANSFER";

type CheckoutSourceContext = {
  orderId: mongoose.Types.ObjectId;
  sourceType: PaymentSourceType;
  sourceId: mongoose.Types.ObjectId;
  sourceModel: string;
  buyerId: mongoose.Types.ObjectId;
  sellerId?: mongoose.Types.ObjectId | null;
  rawCategory?: string | null;
  amount: number;
  currency: string;
  phone?: string | null;
  metadata?: Record<string, unknown>;
};

const syncOrderCollectionState = async (
  sourceType: PaymentSourceType,
  sourceId: mongoose.Types.ObjectId,
  patch: Record<string, unknown>
) => {
  if (sourceType === "SERVICE_ORDER") {
    const current = await ServiceOrder.findById(sourceId).lean();
    const timelinePatch = Array.isArray((patch as any).stateTimeline)
      ? appendTimelineEntries((current as any)?.stateTimeline, (patch as any).stateTimeline)
      : undefined;
    await ServiceOrder.updateOne(
      { _id: sourceId },
      { $set: { ...patch, ...(timelinePatch ? { stateTimeline: timelinePatch } : {}) } }
    );
    return;
  }
  const current = await Order.findById(sourceId).lean();
  const timelinePatch = Array.isArray((patch as any).stateTimeline)
    ? appendTimelineEntries((current as any)?.stateTimeline, (patch as any).stateTimeline)
    : undefined;
  await Order.updateOne(
    { _id: sourceId },
    { $set: { ...patch, ...(timelinePatch ? { stateTimeline: timelinePatch } : {}) } }
  );
};

const loadSourcePaymentSummary = async (intent: any) => {
  const [invoice, smsRequest, bankTransfer, payment] = await Promise.all([
    intent.invoiceId ? Invoice.findById(intent.invoiceId).lean() : Promise.resolve(null),
    intent.smsPaymentRequestId ? SmsPaymentRequest.findById(intent.smsPaymentRequestId).lean() : Promise.resolve(null),
    intent.bankTransferRequestId ? BankTransferRequest.findById(intent.bankTransferRequestId).lean() : Promise.resolve(null),
    intent.paymentId ? Payment.findById(intent.paymentId).lean() : Promise.resolve(null)
  ]);

  return {
    invoice: invoice
      ? {
          id: String(invoice._id),
          kind: invoice.kind,
          status: invoice.status,
          referenceCode: invoice.referenceCode,
          secureLinkUrl: invoice.secureLinkUrl || null,
          bankDetails: invoice.bankDetails || null,
          instructionText: invoice.instructionText || null,
          expiresAt: invoice.expiresAt || null,
          sentAt: invoice.sentAt || null
        }
      : null,
    smsRequest: smsRequest
      ? {
          id: String(smsRequest._id),
          type: smsRequest.smsType,
          phoneMasked: maskPhone(smsRequest.phone),
          verificationState: smsRequest.verificationState,
          deliveryStatus: smsRequest.deliveryStatus,
          referenceCode: smsRequest.referenceCode,
          resendCount: smsRequest.resendCount,
          sentAt: smsRequest.sentAt || null,
          expiresAt: smsRequest.expiresAt || null
        }
      : null,
    bankTransfer: bankTransfer
      ? {
          id: String(bankTransfer._id),
          status: bankTransfer.status,
          referenceCode: bankTransfer.referenceCode,
          bankDetails: bankTransfer.bankDetails,
          instructionText: bankTransfer.instructionText,
          expiresAt: bankTransfer.expiresAt || null,
          receiptUrl: bankTransfer.receiptUrl || null
        }
      : null,
    payment: payment
      ? {
          id: String(payment._id),
          status: payment.status,
          workflowStatus: payment.workflowStatus,
          transactionId: payment.transactionId || null,
          heldAmount: Number(payment.escrowHeldAmount || 0)
        }
      : null
  };
};

export const toPaymentCollectionDto = async (intent: any, locale?: AppLocale) => {
  const related = await loadSourcePaymentSummary(intent);
  const resolvedLocale = locale || (normalizeText(intent?.metadata?.locale) as AppLocale | "");
  return {
    id: String(intent._id),
    orderId: String(intent.orderId),
    paymentId: intent.paymentId ? String(intent.paymentId) : null,
    sourceType: intent.sourceType,
    sourceId: intent.sourceId ? String(intent.sourceId) : null,
    sourceModel: intent.sourceModel || null,
    status: intent.status,
    statusLabel:
      intent.statusLabelCache ||
      getBuyerLifecycleLabel(mapCollectionStatusToStatePatch(intent.status, "buyer").lifecycleState, resolvedLocale || undefined) ||
      null,
    amount: Number(intent.amount || 0),
    amountMinor: Number(intent.amountMinor || 0),
    currency: intent.currency || "USD",
    referenceCode: intent.referenceCode || null,
    providerReference: intent.providerReference || null,
    methodCode: intent.methodCode,
    methodGroup: intent.methodGroup,
    provider: intent.provider,
    displayName: intent.displayName,
    nextActionType: intent.nextActionType,
    nextActionLabel: intent.nextActionLabel || null,
    redirectUrl: intent.redirectUrl || null,
    phone: intent.phone || null,
    phoneVerified: Boolean(intent.phoneVerified),
    expiresAt: intent.expiresAt || null,
    paidAt: intent.paidAt || null,
    escrowHeldAt: intent.escrowHeldAt || null,
    cancelledAt: intent.cancelledAt || null,
    failureReason: intent.failureReason || null,
    metadata: intent.metadata || null,
    ...related
  };
};

const createPaymentAttempt = async (params: {
  paymentIntentId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  methodCode: PaymentMethodCode;
  provider: string;
  status: PaymentCollectionStatus;
  errorCode?: string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string | null;
}) => {
  const attemptNumber = (await PaymentAttempt.countDocuments({ paymentIntentId: params.paymentIntentId })) + 1;
  const timestamp = new Date();
  await PaymentAttempt.create({
    paymentIntentId: params.paymentIntentId,
    orderId: params.orderId,
    userId: params.userId,
    methodCode: params.methodCode,
    provider: params.provider,
    attemptNumber,
    status: params.status,
    errorCode: normalizeText(params.errorCode) || null,
    requestPayload: params.requestPayload || null,
    responsePayload: params.responsePayload || null,
    errorMessage: params.errorMessage || null,
    startedAt: timestamp,
    finishedAt: timestamp
  });
};

const createReference = async (paymentIntentId: mongoose.Types.ObjectId, orderId: mongoose.Types.ObjectId, expiresAt: Date) => {
  const referenceCode = makeReferenceCode("UNI");
  const reference = await TransactionReference.create({
    paymentIntentId,
    orderId,
    referenceCode,
    merchantReference: `ORD-${String(orderId).slice(-8).toUpperCase()}`,
    expiresAt
  });
  return reference;
};

const createSmsArtifacts = async (params: {
  paymentIntentId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  phone: string;
  amount: number;
  currency: string;
  expiresAt: Date;
  referenceCode: string;
  verificationState: SmsVerificationState;
  smsType: SmsPaymentType;
  secureLinkUrl?: string | null;
  bankInstruction?: string | null;
  locale?: AppLocale;
}) => {
  const messageBody = buildSmsMessage({
    orderCode: String(params.orderId).slice(-8).toUpperCase(),
    amount: params.amount,
    currency: params.currency,
    expiry: params.expiresAt,
    referenceCode: params.referenceCode,
    phone: params.phone,
    secureLinkUrl: params.secureLinkUrl,
    bankInstruction: params.bankInstruction,
    locale: params.locale
  });
  const sms = await SmsPaymentRequest.create({
    paymentIntentId: params.paymentIntentId,
    userId: params.userId,
    phone: params.phone,
    smsType: params.smsType,
    verificationState: params.verificationState,
    deliveryStatus: "SENT",
    messageBody,
    referenceCode: params.referenceCode,
    resendCount: 0,
    sentAt: new Date(),
    lastSentAt: new Date(),
    expiresAt: params.expiresAt
  });
  return sms;
};

const resolveUserPhoneState = async (buyerId: mongoose.Types.ObjectId, phone?: string | null) => {
  const normalizedPhone = normalizeText(phone);
  if (!normalizedPhone) return { phone: null, phoneVerified: false, verificationState: "OTP_REQUIRED" as SmsVerificationState };
  const buyer = await User.findById(buyerId).select("isVerified").lean().catch(() => null);
  const phoneVerified = Boolean(buyer?.isVerified);
  return {
    phone: normalizedPhone,
    phoneVerified,
    verificationState: getSmsVerificationState(phoneVerified)
  };
};

export const listCheckoutPaymentMethods = async (sourceType: PaymentSourceType, locale?: AppLocale) => {
  const methods = await listPaymentMethods(sourceType, locale);
  return methods.map((method) => ({
    code: method.code,
    displayName: method.displayName,
    group: method.group,
    provider: method.provider,
    checkoutDescription: method.checkoutDescription
  }));
};

export const initiatePaymentCollection = async (
  context: CheckoutSourceContext,
  options: {
    methodCode: string;
    phone?: string | null;
    successUrl?: string | null;
    cancelUrl?: string | null;
    metadata?: Record<string, unknown>;
    locale?: AppLocale;
  }
) => {
  const method = await resolvePaymentMethod(context.sourceType, options.methodCode, options.locale);
  const { categoryKey, policy } = await resolveCategoryPaymentPolicy({
    sourceType: context.sourceType,
    rawCategory: context.rawCategory
  });
  const expiresAt = addHours(new Date(), DEFAULT_EXPIRY_HOURS);
  const phoneState = await resolveUserPhoneState(context.buyerId, options.phone || context.phone);

  const existing = await PaymentIntent.findOne({
    orderId: context.orderId,
    methodCode: method.code,
    status: { $nin: [...TERMINAL_INTENT_STATUSES] }
  }).sort({ createdAt: -1 });
  if (existing) {
    return existing;
  }

  const baseStatus: PaymentCollectionStatus = isInstantMethod(method)
    ? "AWAITING_PAYMENT"
    : method.group === "SMS_LINK" || method.group === "SMS_INVOICE"
      ? "PAYMENT_LINK_SENT"
      : "AWAITING_MANUAL_TRANSFER";
  const nextActionType: PaymentNextActionType = isInstantMethod(method)
    ? method.supportsRedirect
      ? "REDIRECT"
      : "OPEN_MODAL"
    : method.group === "SMS_LINK"
      ? "SMS_SENT"
      : method.group === "SMS_INVOICE"
        ? "SHOW_INVOICE"
        : "SHOW_BANK_DETAILS";

  const paymentIntent = await PaymentIntent.create({
    orderId: context.orderId,
    sourceType: context.sourceType,
    sourceId: context.sourceId,
    sourceModel: context.sourceModel,
    userId: context.buyerId,
    sellerId: context.sellerId || null,
    categoryKey,
    bucketKey: policy.bucketKey,
    methodCode: method.code,
    methodGroup: method.group,
    provider: method.provider,
    displayName: method.displayName,
    status: baseStatus,
    statusLabelCache: getBuyerLifecycleLabel(mapCollectionStatusToStatePatch(baseStatus, "buyer").lifecycleState, options.locale),
    amount: context.amount,
    amountMinor: toMinorUnits(context.amount),
    currency: context.currency,
    phone: phoneState.phone,
    phoneVerified: phoneState.phoneVerified,
    nextActionType,
    nextActionLabel:
      nextActionType === "REDIRECT"
        ? t(options.locale, "payments.intent.continue.cta")
        : nextActionType === "SMS_SENT"
          ? t(options.locale, "payments.intent.sms_link_sent.status")
          : nextActionType === "SHOW_INVOICE"
            ? t(options.locale, "payments.intent.sms_invoice_sent.status")
            : nextActionType === "SHOW_BANK_DETAILS"
              ? t(options.locale, "payments.intent.bank_details_ready.status")
              : t(options.locale, "payments.intent.info_ready.status"),
    expiresAt,
    metadata: {
      successUrl: options.successUrl || null,
      cancelUrl: options.cancelUrl || null,
      locale: options.locale || null,
      ...(context.metadata || {}),
      ...(options.metadata || {})
    }
  });

  const paymentMethodSelection = await PaymentMethodSelection.create({
    orderId: context.orderId,
    paymentIntentId: paymentIntent._id,
    selectedMethod: method.code,
    selectedGroup: method.group,
    phoneUsed: phoneState.phone,
    invoiceDeliveryChannel: isSmsMethod(method) ? "SMS" : null
  });
  paymentIntent.paymentMethodSelectionId = paymentMethodSelection._id;

  const reference = await createReference(paymentIntent._id, context.orderId, expiresAt);
  paymentIntent.transactionReferenceId = reference._id;
  paymentIntent.referenceCode = reference.referenceCode;
  paymentIntent.providerReference = reference.merchantReference;
  let invoiceKind: InvoiceKind | null = null;
  let invoice: any = null;
  let smsRequest: any = null;
  let bankTransfer: any = null;

  if (isInstantMethod(method)) {
    paymentIntent.redirectUrl = buildInstantRedirectUrl(method.provider, paymentIntent._id, context.orderId);
  }

  if (method.group === "SMS_LINK") {
    invoiceKind = "PAYMENT_LINK";
    const secureLinkUrl = buildSecurePaymentLink(paymentIntent._id, makeSecureLinkToken());
    invoice = await Invoice.create({
      paymentIntentId: paymentIntent._id,
      orderId: context.orderId,
      userId: context.buyerId,
      kind: invoiceKind,
      status: "SENT",
      amount: context.amount,
      currency: context.currency,
      referenceCode: reference.referenceCode,
      secureLinkUrl,
      instructionText: t(options.locale, "payments.instructions.sms_link.text"),
      expiresAt,
      sentAt: new Date()
    });
    smsRequest = await createSmsArtifacts({
      paymentIntentId: paymentIntent._id,
      orderId: context.orderId,
      userId: context.buyerId,
      phone: phoneState.phone || "",
      amount: context.amount,
      currency: context.currency,
      expiresAt,
      referenceCode: reference.referenceCode,
      verificationState: phoneState.verificationState,
      smsType: "PAYMENT_LINK",
      secureLinkUrl,
      locale: options.locale
    });
  }

  if (method.group === "SMS_INVOICE") {
    invoiceKind = "SMS_INVOICE";
    const bankDetails = getBankDetails(context.currency, options.locale);
    invoice = await Invoice.create({
      paymentIntentId: paymentIntent._id,
      orderId: context.orderId,
      userId: context.buyerId,
      kind: invoiceKind,
      status: "SENT",
      amount: context.amount,
      currency: context.currency,
      referenceCode: reference.referenceCode,
      bankDetails,
      instructionText: t(options.locale, "payments.instructions.sms_invoice.text"),
      expiresAt,
      sentAt: new Date()
    });
    const bankInstruction = `${String((bankDetails as any).bankName)} ${String((bankDetails as any).accountNumber)}`;
    smsRequest = await createSmsArtifacts({
      paymentIntentId: paymentIntent._id,
      orderId: context.orderId,
      userId: context.buyerId,
      phone: phoneState.phone || "",
      amount: context.amount,
      currency: context.currency,
      expiresAt,
      referenceCode: reference.referenceCode,
      verificationState: phoneState.verificationState,
      smsType: "INVOICE",
      bankInstruction,
      locale: options.locale
    });
  }

  if (isManualTransferMethod(method)) {
    invoiceKind = "MANUAL_BANK_TRANSFER";
    const bankDetails = getBankDetails(context.currency, options.locale);
    invoice = await Invoice.create({
      paymentIntentId: paymentIntent._id,
      orderId: context.orderId,
      userId: context.buyerId,
      kind: invoiceKind,
      status: "AWAITING_TRANSFER",
      amount: context.amount,
      currency: context.currency,
      referenceCode: reference.referenceCode,
      bankDetails,
      instructionText: t(options.locale, "payments.instructions.manual_transfer.text"),
      expiresAt
    });
    bankTransfer = await BankTransferRequest.create({
      paymentIntentId: paymentIntent._id,
      invoiceId: invoice._id,
      userId: context.buyerId,
      referenceCode: reference.referenceCode,
      status: "AWAITING_TRANSFER" as BankTransferStatus,
      bankDetails,
      instructionText: t(options.locale, "payments.instructions.manual_transfer_bank.text"),
      expiresAt
    });
  }

  if (invoice) paymentIntent.invoiceId = invoice._id;
  if (smsRequest) paymentIntent.smsPaymentRequestId = smsRequest._id;
  if (bankTransfer) paymentIntent.bankTransferRequestId = bankTransfer._id;
  await paymentIntent.save();

  const collectionStatePatch = mapCollectionStatusToStatePatch(paymentIntent.status, "buyer");

  await syncOrderCollectionState(context.sourceType, context.sourceId, {
    paymentIntentId: paymentIntent._id,
    paymentCollectionStatus: paymentIntent.status,
    paymentCollectionMethod: paymentIntent.methodCode,
    statusLabelCache: paymentIntent.statusLabelCache,
    paymentCollectionExpiresAt: paymentIntent.expiresAt,
    paymentReferenceCode: reference.referenceCode,
    settlementCategory: categoryKey,
    settlementBucketKey: policy.bucketKey,
    trustMessage: policy.trustCopy,
    lifecycleState: collectionStatePatch.lifecycleState,
    paymentState: collectionStatePatch.paymentState,
    ...(collectionStatePatch.settlementState ? { settlementState: collectionStatePatch.settlementState } : {}),
    ...((collectionStatePatch as any).disputeState ? { disputeState: (collectionStatePatch as any).disputeState } : {}),
    ...(collectionStatePatch.timeline ? { stateTimeline: collectionStatePatch.timeline } : {})
  });

  await createPaymentAttempt({
    paymentIntentId: paymentIntent._id,
    orderId: context.orderId,
    userId: context.buyerId,
    methodCode: paymentIntent.methodCode,
    provider: paymentIntent.provider,
    status: paymentIntent.status,
    requestPayload: {
      sourceType: context.sourceType,
      methodCode: paymentIntent.methodCode,
      phoneMasked: paymentIntent.phone ? maskPhone(paymentIntent.phone) : null
    },
    responsePayload: {
      nextActionType: paymentIntent.nextActionType,
      invoiceId: paymentIntent.invoiceId ? String(paymentIntent.invoiceId) : null
    }
  });

  const notificationAction = isInstantMethod(method)
    ? t(options.locale, "payments.collection.instant.message")
    : method.group === "SMS_LINK"
      ? t(options.locale, "payments.collection.sms_link.message")
      : method.group === "SMS_INVOICE"
        ? t(options.locale, "payments.collection.sms_invoice.message")
        : t(options.locale, "payments.collection.manual_transfer.message");
  await createSystemNotification(
    context.buyerId,
    `Checkout payment prepared for order ${String(context.orderId).slice(-8).toUpperCase()}. ${notificationAction}`
  );

  return paymentIntent;
};

export const confirmPaymentCollection = async (
  paymentIntentId: mongoose.Types.ObjectId | string,
  options?: {
    transactionId?: string | null;
    providerReference?: string | null;
    note?: string | null;
    verifiedBy?: string | null;
  }
) => {
  const intent = await PaymentIntent.findById(paymentIntentId);
  if (!intent) throw new Error(t(undefined, "payments.intent.lookup.not_found.message"));
  if (intent.status === "HELD_IN_ESCROW" && intent.paymentId) return intent;
  if (["PAYMENT_EXPIRED", "CANCELLED"].includes(intent.status)) {
    throw new Error(`Payment intent is ${intent.status.toLowerCase()}`);
  }

  const existingPayment = intent.paymentId ? await Payment.findById(intent.paymentId) : null;
  const transactionId =
    normalizeText(options?.transactionId || existingPayment?.transactionId) || makeReferenceCode("TXN");

  const payment =
    existingPayment ||
    (await confirmEscrowPayment({
      orderId: intent.orderId,
      buyerId: intent.userId,
      sellerId: intent.sellerId,
      sourceType: intent.sourceType,
      sourceId: intent.sourceId,
      sourceModel: intent.sourceModel,
      rawCategory: intent.categoryKey,
      provider: intent.provider,
      method: intent.methodCode,
      amount: intent.amount,
      currency: intent.currency,
      transactionId,
      metadata: {
        paymentIntentId: String(intent._id),
        collectionStatus: intent.status,
        note: normalizeText(options?.note)
      }
    }));

  payment.collectionStatus = "HELD_IN_ESCROW";
  payment.collectionMethod = intent.methodCode;
  payment.paymentIntentId = intent._id;
  if (normalizeText(options?.providerReference)) {
    payment.metadata = {
      ...(payment.metadata || {}),
      providerReference: normalizeText(options?.providerReference)
    };
  }
  await payment.save();

  intent.paymentId = payment._id;
  intent.status = "HELD_IN_ESCROW";
  const locale = normalizeText(intent.metadata?.locale) as AppLocale | "";
  intent.statusLabelCache = getBuyerLifecycleLabel(buildEscrowHeldState("system").lifecycleState, locale || undefined);
  intent.paidAt = intent.paidAt || new Date();
  intent.escrowHeldAt = new Date();
  intent.failureReason = null;
  intent.providerReference = normalizeText(options?.providerReference || intent.providerReference) || null;
  await intent.save();

  const heldState = buildEscrowHeldState("system");

  await syncOrderCollectionState(intent.sourceType, intent.sourceId || intent.orderId, {
    paymentId: payment._id,
    paymentIntentId: intent._id,
    paymentCollectionStatus: "HELD_IN_ESCROW",
    paymentWorkflowStatus: "HELD_IN_ESCROW",
    paymentCollectionMethod: intent.methodCode,
    statusLabelCache: intent.statusLabelCache,
    lifecycleState: heldState.lifecycleState,
    paymentState: heldState.paymentState,
    settlementState: heldState.settlementState,
    stateTimeline: heldState.timeline
  });

  if (intent.invoiceId) {
    await Invoice.updateOne({ _id: intent.invoiceId }, { $set: { status: "PAID", paidAt: new Date() } });
  }
  if (intent.bankTransferRequestId) {
    await BankTransferRequest.updateOne(
      { _id: intent.bankTransferRequestId },
      { $set: { status: "CONFIRMED", confirmedAt: new Date() } }
    );
  }
  if (intent.transactionReferenceId && normalizeText(options?.providerReference)) {
    await TransactionReference.updateOne(
      { _id: intent.transactionReferenceId },
      { $set: { providerReference: normalizeText(options?.providerReference) } }
    );
  }

  await createPaymentAttempt({
    paymentIntentId: intent._id,
    orderId: intent.orderId,
    userId: intent.userId,
    methodCode: intent.methodCode,
    provider: intent.provider,
    status: "HELD_IN_ESCROW",
    responsePayload: {
      paymentId: String(payment._id),
      transactionId,
      providerReference: normalizeText(options?.providerReference) || null
    }
  });

  await createSystemNotification(
    intent.userId,
    `Order ${String(intent.orderId).slice(-8).toUpperCase()}: ${t(locale || undefined, "payments.collection.instant.message")}`
  );

  return intent;
};

export const expirePaymentCollection = async (paymentIntentId: mongoose.Types.ObjectId | string, reason?: string | null) => {
  const intent = await PaymentIntent.findById(paymentIntentId);
  if (!intent) throw new Error(t(undefined, "payments.intent.lookup.not_found.message"));
  if (TERMINAL_INTENT_STATUSES.has(intent.status)) return intent;

  const locale = normalizeText(intent.metadata?.locale) as AppLocale | "";
  intent.status = "PAYMENT_EXPIRED";
  intent.statusLabelCache = getBuyerLifecycleLabel(mapCollectionStatusToStatePatch("PAYMENT_EXPIRED", "system").lifecycleState, locale || undefined);
  intent.failureReason = normalizeText(reason) || t(locale || undefined, "payments.failures.expired.message");
  await intent.save();

  const expiredPatch = mapCollectionStatusToStatePatch("PAYMENT_EXPIRED", "system");

  await syncOrderCollectionState(intent.sourceType, intent.sourceId || intent.orderId, {
    paymentCollectionStatus: "PAYMENT_EXPIRED",
    statusLabelCache: intent.statusLabelCache,
    lifecycleState: expiredPatch.lifecycleState,
    paymentState: expiredPatch.paymentState,
    stateTimeline: expiredPatch.timeline
  });
  if (intent.invoiceId) await Invoice.updateOne({ _id: intent.invoiceId }, { $set: { status: "EXPIRED" } });
  if (intent.smsPaymentRequestId) {
    await SmsPaymentRequest.updateOne({ _id: intent.smsPaymentRequestId }, { $set: { deliveryStatus: "EXPIRED" } });
  }
  if (intent.bankTransferRequestId) {
    await BankTransferRequest.updateOne({ _id: intent.bankTransferRequestId }, { $set: { status: "EXPIRED" } });
  }
  await createSystemNotification(
    intent.userId,
    `Order ${String(intent.orderId).slice(-8).toUpperCase()}: ${t(locale || undefined, "payments.failures.expired.message")}`
  );
  return intent;
};

export const cancelPaymentCollection = async (paymentIntentId: mongoose.Types.ObjectId | string, reason?: string | null) => {
  const intent = await PaymentIntent.findById(paymentIntentId);
  if (!intent) throw new Error(t(undefined, "payments.intent.lookup.not_found.message"));
  if (TERMINAL_INTENT_STATUSES.has(intent.status)) return intent;

  const locale = normalizeText(intent.metadata?.locale) as AppLocale | "";
  intent.status = "CANCELLED";
  intent.statusLabelCache = getBuyerLifecycleLabel("cancelled", locale || undefined);
  intent.cancelledAt = new Date();
  intent.failureReason = normalizeText(reason) || t(locale || undefined, "payments.failures.cancelled.message");
  await intent.save();

  const cancelledTimeline = [
    buildTimelineEntry({
      group: "lifecycle",
      from: null,
      to: "cancelled",
      actorType: "buyer",
      note: intent.failureReason
    }),
    buildTimelineEntry({
      group: "payment",
      from: "awaiting_payment",
      to: "payment_expired",
      actorType: "buyer",
      note: intent.failureReason
    })
  ];

  await syncOrderCollectionState(intent.sourceType, intent.sourceId || intent.orderId, {
    paymentCollectionStatus: "CANCELLED",
    statusLabelCache: intent.statusLabelCache,
    lifecycleState: "cancelled",
    paymentState: "payment_expired",
    fulfillmentState: "cancelled",
    stateTimeline: cancelledTimeline
  });
  if (intent.invoiceId) await Invoice.updateOne({ _id: intent.invoiceId }, { $set: { status: "CANCELLED" } });
  if (intent.smsPaymentRequestId) {
    await SmsPaymentRequest.updateOne({ _id: intent.smsPaymentRequestId }, { $set: { deliveryStatus: "CANCELLED" } });
  }
  if (intent.bankTransferRequestId) {
    await BankTransferRequest.updateOne({ _id: intent.bankTransferRequestId }, { $set: { status: "CANCELLED" } });
  }
  return intent;
};

export const resendSmsPaymentCollection = async (paymentIntentId: mongoose.Types.ObjectId | string) => {
  const intent = await PaymentIntent.findById(paymentIntentId);
  if (!intent) throw new Error(t(undefined, "payments.intent.lookup.not_found.message"));
  if (!intent.smsPaymentRequestId) throw new Error(t(undefined, "payments.sms.not_configured.message"));

  const sms = await SmsPaymentRequest.findById(intent.smsPaymentRequestId);
  if (!sms) throw new Error(t(undefined, "payments.sms.lookup.not_found.message"));
  const now = new Date();
  sms.resendCount += 1;
  sms.lastSentAt = now;
  sms.sentAt = sms.sentAt || now;
  sms.deliveryStatus = "SENT";
  await sms.save();

  await createSystemNotification(
    intent.userId,
    `Payment SMS was resent to ${maskPhone(sms.phone)} for order ${String(intent.orderId).slice(-8).toUpperCase()}.`
  );

  return intent;
};

export const markPaymentCollectionPendingVerification = async (
  paymentIntentId: mongoose.Types.ObjectId | string,
  options?: {
    reason?: string | null;
    receiptUrl?: string | null;
  }
) => {
  const intent = await PaymentIntent.findById(paymentIntentId);
  if (!intent) throw new Error(t(undefined, "payments.intent.lookup.not_found.message"));
  if (TERMINAL_INTENT_STATUSES.has(intent.status)) return intent;

  const locale = normalizeText(intent.metadata?.locale) as AppLocale | "";
  intent.status = "PAYMENT_PENDING_VERIFICATION";
  intent.statusLabelCache = getBuyerLifecycleLabel(
    mapCollectionStatusToStatePatch("PAYMENT_PENDING_VERIFICATION", "system").lifecycleState,
    locale || undefined
  );
  intent.failureReason = normalizeText(options?.reason) || null;
  intent.metadata = {
    ...(intent.metadata || {}),
    ...(normalizeText(options?.receiptUrl) ? { receiptUrl: normalizeText(options?.receiptUrl) } : {})
  };
  await intent.save();

  const patch = mapCollectionStatusToStatePatch("PAYMENT_PENDING_VERIFICATION", "system");
  await syncOrderCollectionState(intent.sourceType, intent.sourceId || intent.orderId, {
    paymentCollectionStatus: intent.status,
    statusLabelCache: intent.statusLabelCache,
    lifecycleState: patch.lifecycleState,
    paymentState: patch.paymentState,
    stateTimeline: patch.timeline
  });

  return intent;
};

export const failPaymentCollection = async (paymentIntentId: mongoose.Types.ObjectId | string, reason?: string | null) => {
  const intent = await PaymentIntent.findById(paymentIntentId);
  if (!intent) throw new Error(t(undefined, "payments.intent.lookup.not_found.message"));
  if (TERMINAL_INTENT_STATUSES.has(intent.status)) return intent;

  const locale = normalizeText(intent.metadata?.locale) as AppLocale | "";
  intent.status = "PAYMENT_FAILED";
  intent.statusLabelCache = getBuyerLifecycleLabel(mapCollectionStatusToStatePatch("PAYMENT_FAILED", "system").lifecycleState, locale || undefined);
  intent.failedAt = new Date();
  intent.failureReason = normalizeText(reason) || t(locale || undefined, "payments.failures.verification_failed.message");
  await intent.save();

  const patch = mapCollectionStatusToStatePatch("PAYMENT_FAILED", "system");
  await syncOrderCollectionState(intent.sourceType, intent.sourceId || intent.orderId, {
    paymentCollectionStatus: intent.status,
    statusLabelCache: intent.statusLabelCache,
    lifecycleState: patch.lifecycleState,
    paymentState: patch.paymentState,
    stateTimeline: patch.timeline
  });
  if (intent.bankTransferRequestId) {
    await BankTransferRequest.updateOne({ _id: intent.bankTransferRequestId }, { $set: { status: "FAILED" } });
  }
  return intent;
};

export const getPaymentCollectionIntent = async (paymentIntentId: mongoose.Types.ObjectId | string) => {
  return PaymentIntent.findById(paymentIntentId).lean();
};

export const findLatestPaymentCollectionForSource = async (sourceType: PaymentSourceType, sourceId: mongoose.Types.ObjectId | string) => {
  const normalizedSourceId = toObjectId(sourceId);
  if (!normalizedSourceId) return null;
  return PaymentIntent.findOne({ sourceType, sourceId: normalizedSourceId }).sort({ createdAt: -1 }).lean();
};

export const logPaymentProviderEvent = async (payload: {
  provider: string;
  eventType: string;
  eventId?: string | null;
  paymentIntentId?: mongoose.Types.ObjectId | string | null;
  paymentId?: mongoose.Types.ObjectId | string | null;
  externalReference?: string | null;
  payload?: Record<string, unknown>;
  verified?: boolean;
  status?: ProviderEventStatus;
  failureReason?: string | null;
}) => {
  return PaymentProviderEvent.create({
    provider: normalizeText(payload.provider) || "UNKNOWN",
    eventType: normalizeText(payload.eventType) || "unknown",
    eventId: normalizeText(payload.eventId) || null,
    paymentIntentId: toObjectId(payload.paymentIntentId),
    paymentId: toObjectId(payload.paymentId),
    externalReference: normalizeText(payload.externalReference) || null,
    payload: payload.payload || null,
    rawPayloadJson: payload.payload || null,
    verified: Boolean(payload.verified),
    processed: payload.status === "PROCESSED",
    status: payload.status || "RECEIVED",
    processedAt: payload.status === "PROCESSED" ? new Date() : null,
    failureReason: normalizeText(payload.failureReason) || null
  });
};
