import mongoose from "mongoose";
import { AgentProfile } from "../models/AgentProfile";
import { EscrowHold } from "../models/EscrowHold";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { PayoutRequest } from "../models/PayoutRequest";
import { PayoutRequestItem } from "../models/PayoutRequestItem";
import { Product } from "../models/Product";
import { ServiceOrder } from "../models/ServiceOrder";
import { Dispute } from "../models/Dispute";
import {
  appendTimelineEntries,
  buildDeliveredState,
  buildFulfillmentStartedState,
  buildPayoutState,
  buildRefundState,
  buildReleasePendingPayoutState
} from "./marketplaceStateMachine";
import { notifyAwaitingBuyerReview, notifyFundsReleasedToSeller, notifyPaymentHeld, notifyPayoutStatus, notifyRefundDecision } from "./paymentNotifications";
import type { AppLocale } from "../i18n";
import { recordEscrowCapture, recordLifecycleMarker, recordPayoutRequested, recordPayoutTransferred, recordRefundFromEscrow, recordReleaseToSellerPending } from "./paymentLedger";
import { resolveCategoryPaymentPolicy } from "./paymentPolicy";
import { shouldHoldSellerPayout } from "./riskEngine";
import type { IPayment } from "../models/Payment";
import type { PaymentSourceType } from "../types/paymentDomain";
import { t } from "../i18n";

const toObjectId = (value?: mongoose.Types.ObjectId | string | null) => {
  const raw = String(value || "").trim();
  return raw && mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
};

const normalizeText = (value: unknown) => String(value || "").trim();
const resolvePaymentLocale = (payment: { metadata?: Record<string, unknown> | null }) =>
  (normalizeText(payment?.metadata?.locale) as AppLocale | "") || undefined;

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);

const getSourceLabel = (sourceType: PaymentSourceType, locale?: AppLocale) => {
  switch (sourceType) {
    case "PRODUCT_ORDER":
      return t(locale, "payments.source.product_order.label");
    case "SERVICE_ORDER":
      return t(locale, "payments.source.service_order.label");
    case "COURSE_ENROLLMENT":
      return t(locale, "payments.source.course_enrollment.label");
    case "SESSION_PACKAGE":
      return t(locale, "payments.source.session_package.label");
    case "CONSULTING_REQUEST":
      return t(locale, "payments.source.consulting_request.label");
    default:
      return t(locale, "payments.source.default.label");
  }
};

const syncProductOrderState = async (payment: IPayment, patch: Partial<Record<string, unknown>> & { status?: string }) => {
  if (payment.sourceType !== "PRODUCT_ORDER") return;
  const sourceId = payment.sourceId || payment.orderId;
  if (!sourceId) return;
  const current = await Order.findById(sourceId).lean();
  const timeline = Array.isArray((patch as any).stateTimeline)
    ? appendTimelineEntries(current?.stateTimeline as any, (patch as any).stateTimeline)
    : undefined;
  await Order.updateOne({ _id: sourceId }, { $set: { ...patch, ...(timeline ? { stateTimeline: timeline } : {}) } });
};

const syncServiceOrderState = async (payment: IPayment, patch: Partial<Record<string, unknown>> & { status?: string }) => {
  if (payment.sourceType !== "SERVICE_ORDER") return;
  if (!payment.sourceId) return;
  const current = await ServiceOrder.findById(payment.sourceId).lean();
  const timeline = Array.isArray((patch as any).stateTimeline)
    ? appendTimelineEntries(current?.stateTimeline as any, (patch as any).stateTimeline)
    : undefined;
  await ServiceOrder.updateOne({ _id: payment.sourceId }, { $set: { ...patch, ...(timeline ? { stateTimeline: timeline } : {}) } });
};

export const confirmEscrowPayment = async (payload: {
  orderId: mongoose.Types.ObjectId | string;
  buyerId: mongoose.Types.ObjectId | string;
  sellerId?: mongoose.Types.ObjectId | string | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | string | null;
  sourceModel?: string;
  rawCategory?: string | null;
  provider: string;
  method: string;
  paymentIntentId?: mongoose.Types.ObjectId | string | null;
  collectionStatus?: string | null;
  amount: number;
  currency?: string;
  transactionId: string;
  metadata?: Record<string, unknown>;
}) => {
  const orderId = toObjectId(payload.orderId);
  const buyerId = toObjectId(payload.buyerId);
  const sellerId = toObjectId(payload.sellerId);
  if (!orderId || !buyerId) throw new Error("Invalid escrow payment identifiers");

  const existing = await Payment.findOne({
    orderId,
    transactionId: payload.transactionId
  });
  if (existing) return existing;

  const { categoryKey, policy } = await resolveCategoryPaymentPolicy({
    sourceType: payload.sourceType,
    rawCategory: payload.rawCategory
  });

  const payment = await Payment.create({
    orderId,
    userId: buyerId,
    sellerId,
    sourceType: payload.sourceType,
    sourceId: toObjectId(payload.sourceId) || orderId,
    sourceModel: payload.sourceModel || (payload.sourceType === "SERVICE_ORDER" ? "ServiceOrder" : "Order"),
    categoryKey,
    bucketKey: policy.bucketKey,
    provider: normalizeText(payload.provider) || "MOCK",
    collectionStatus: normalizeText(payload.collectionStatus) || "HELD_IN_ESCROW",
    collectionMethod: normalizeText(payload.method) || "CARD",
    paymentIntentId: toObjectId(payload.paymentIntentId),
    kind: "PAYMENT",
    amount: Math.max(0, Number(payload.amount || 0)),
    currency: normalizeText(payload.currency) || "USD",
    status: "SUCCESS",
    workflowStatus: "HELD_IN_ESCROW",
    escrowHeldAmount: Math.max(0, Number(payload.amount || 0)),
    releasedAmount: 0,
    refundedAmount: 0,
    chargebackAmount: 0,
    sellerPendingPayoutAmount: 0,
    autoReleaseEnabled: Boolean(policy.autoReleaseEnabled),
    note: `Escrow hold created via ${normalizeText(payload.method) || "CARD"}`,
    metadata: {
      paymentMethod: normalizeText(payload.method) || "CARD",
      ...(payload.metadata || {})
    },
    transactionId: payload.transactionId
  });

  await recordEscrowCapture({
    paymentId: payment._id,
    paymentIntentId: payment.paymentIntentId,
    orderId,
    sourceType: payload.sourceType,
    sourceId: payment.sourceId,
    categoryKey,
    bucketKey: policy.bucketKey,
    sellerId,
    buyerId,
    amount: payment.amount,
    currency: payment.currency,
    note: "Buyer payment captured and moved into escrow."
  });

  const trustMessage = policy.trustCopy;
  if (payload.sourceType === "SERVICE_ORDER") {
    await syncServiceOrderState(payment, {
      paymentId: payment._id,
      paymentWorkflowStatus: "HELD_IN_ESCROW",
      settlementCategory: categoryKey,
      settlementBucketKey: policy.bucketKey,
      trustMessage
    });
  } else {
    await syncProductOrderState(payment, {
      paymentId: payment._id,
      paymentWorkflowStatus: "HELD_IN_ESCROW",
      status: "PAID",
      settlementCategory: categoryKey,
      settlementBucketKey: policy.bucketKey,
      trustMessage
    });
  }

  await notifyPaymentHeld({
    buyerId,
    sellerId,
    amount: payment.amount,
    currency: payment.currency,
    trustCopy: trustMessage,
    sourceLabel: getSourceLabel(payload.sourceType, resolvePaymentLocale(payment)),
    locale: resolvePaymentLocale(payment)
  });

  return payment;
};

export const markEscrowSourceInProgress = async (paymentId: mongoose.Types.ObjectId | string, note?: string) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error("Payment not found");
  if (["REFUNDED", "RELEASED_TO_AGENT"].includes(payment.workflowStatus)) return payment;
  payment.workflowStatus = "IN_PROGRESS";
  if (note) payment.note = note;
  await payment.save();
  await recordLifecycleMarker({
    paymentId: payment._id,
    paymentIntentId: payment.paymentIntentId,
    orderId: payment.orderId,
    sourceType: payment.sourceType,
    sourceId: payment.sourceId,
    bucketKey: payment.bucketKey,
    sellerId: payment.sellerId,
    buyerId: payment.userId,
    currency: payment.currency,
    entryType: "ORDER_MARKED_IN_PROGRESS",
    note: note || "Work started."
  });
  const next = buildFulfillmentStartedState("seller", note || "Work started.");
  const patch = {
    paymentWorkflowStatus: "IN_PROGRESS",
    lifecycleState: next.lifecycleState,
    fulfillmentState: next.fulfillmentState,
    stateTimeline: next.timeline
  };
  if (payment.sourceType === "SERVICE_ORDER") await syncServiceOrderState(payment, patch);
  if (payment.sourceType === "PRODUCT_ORDER") await syncProductOrderState(payment, { ...patch, status: "PROCESSING" });
  return payment;
};

export const markEscrowSourceDelivered = async (paymentId: mongoose.Types.ObjectId | string, options?: {
  proofType?: string;
  proofNote?: string;
  proofUrl?: string;
}) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error("Payment not found");

  const { policy } = await resolveCategoryPaymentPolicy({
    sourceType: payment.sourceType,
    rawCategory: payment.categoryKey
  });
  const now = new Date();
  const reviewWindowEndsAt = addHours(now, Math.max(0, Number(policy.reviewWindowHours || 0)));

  payment.workflowStatus = policy.reviewWindowHours > 0 ? "AWAITING_BUYER_CONFIRMATION" : "DELIVERED";
  payment.reviewWindowEndsAt = reviewWindowEndsAt;
  payment.releaseScheduledAt = reviewWindowEndsAt;
  await payment.save();

  const proofPayload = {
    type: normalizeText(options?.proofType) || "completion_proof",
    note: normalizeText(options?.proofNote) || undefined,
    url: normalizeText(options?.proofUrl) || undefined,
    createdAt: now
  };
  const deliveredState = buildDeliveredState({
    awaitingBuyerConfirmation: (policy.reviewWindowHours || 0) > 0,
    actorType: "seller",
    note: proofPayload.note || "Completion proof recorded."
  });

  if (payment.sourceType === "SERVICE_ORDER") {
    const serviceOrder = await ServiceOrder.findById(payment.sourceId);
    if (serviceOrder) {
      serviceOrder.completedAt = now;
      serviceOrder.buyerReviewEndsAt = reviewWindowEndsAt;
      serviceOrder.releaseScheduledAt = reviewWindowEndsAt;
      serviceOrder.paymentWorkflowStatus = payment.workflowStatus;
      serviceOrder.status = "COMPLETED";
      serviceOrder.lifecycleState = deliveredState.lifecycleState;
      serviceOrder.fulfillmentState = deliveredState.fulfillmentState;
      serviceOrder.settlementState = deliveredState.settlementState;
      serviceOrder.stateTimeline = appendTimelineEntries(serviceOrder.stateTimeline as any, deliveredState.timeline as any) as any;
      serviceOrder.completionProofs = [...(serviceOrder.completionProofs || []), proofPayload];
      await serviceOrder.save();
    }
  } else {
    const order = await Order.findById(payment.sourceId || payment.orderId);
    if (order) {
      order.deliveredAt = now;
      order.completedAt = now;
      order.buyerReviewEndsAt = reviewWindowEndsAt;
      order.releaseScheduledAt = reviewWindowEndsAt;
      order.paymentWorkflowStatus = payment.workflowStatus;
      order.status = "CONFIRMED";
      order.lifecycleState = deliveredState.lifecycleState;
      order.fulfillmentState = deliveredState.fulfillmentState;
      order.settlementState = deliveredState.settlementState;
      order.stateTimeline = appendTimelineEntries(order.stateTimeline as any, deliveredState.timeline as any) as any;
      order.fulfillmentProofs = [...(order.fulfillmentProofs || []), proofPayload];
      await order.save();
    }
  }

  await recordLifecycleMarker({
    paymentId: payment._id,
    paymentIntentId: payment.paymentIntentId,
    orderId: payment.orderId,
    sourceType: payment.sourceType,
    sourceId: payment.sourceId,
    bucketKey: payment.bucketKey,
    sellerId: payment.sellerId,
    buyerId: payment.userId,
    currency: payment.currency,
    entryType: payment.sourceType === "PRODUCT_ORDER" ? "DELIVERY_CONFIRMED" : "SERVICE_COMPLETED",
    note: proofPayload.note || "Completion proof recorded."
  });

  await notifyAwaitingBuyerReview({
    buyerId: payment.userId,
    sellerId: payment.sellerId,
    sourceLabel: getSourceLabel(payment.sourceType),
    reviewWindowEndsAt,
    locale: resolvePaymentLocale(payment)
  });

  if ((policy.reviewWindowHours || 0) <= 0) {
    await releasePaymentToSellerPending(payment._id, "No review window configured for this category.");
  }

  return payment;
};

export const releasePaymentToSellerPending = async (
  paymentId: mongoose.Types.ObjectId | string,
  reason: string
) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.workflowStatus === "RELEASED_TO_AGENT") return payment;
  if (!payment.sellerId) throw new Error("Seller is missing for payout release");

  const openDispute = payment.disputeId
    ? await Dispute.countDocuments({ _id: payment.disputeId, status: { $in: ["OPEN", "UNDER_REVIEW", "HOLD_EXTENDED", "WAITING_BUYER_RESPONSE", "WAITING_SELLER_RESPONSE"] } })
    : 0;
  if (openDispute > 0) throw new Error("Payment has an open dispute and cannot be released");

  const releasable = Math.max(0, payment.amount - payment.refundedAmount - payment.releasedAmount);
  if (releasable <= 0) return payment;

  payment.workflowStatus = "RELEASED_TO_AGENT";
  payment.releasedAmount += releasable;
  payment.escrowHeldAmount = Math.max(0, payment.escrowHeldAmount - releasable);
  payment.sellerPendingPayoutAmount += releasable;
  payment.releasedAt = new Date();
  payment.decisionReason = reason;
  await payment.save();
  const releaseState = buildReleasePendingPayoutState("system", reason);

  await recordReleaseToSellerPending({
    paymentId: payment._id,
    paymentIntentId: payment.paymentIntentId,
    orderId: payment.orderId,
    sourceType: payment.sourceType,
    sourceId: payment.sourceId,
    categoryKey: payment.categoryKey,
    bucketKey: payment.bucketKey,
    sellerId: payment.sellerId,
    buyerId: payment.userId,
    amount: releasable,
    currency: payment.currency,
    note: reason
  });

  if (payment.sourceType === "SERVICE_ORDER") {
    await syncServiceOrderState(payment, {
      paymentWorkflowStatus: "RELEASED_TO_AGENT",
      lifecycleState: releaseState.lifecycleState,
      settlementState: releaseState.settlementState,
      disputeState: releaseState.disputeState,
      stateTimeline: releaseState.timeline
    });
  } else {
    await syncProductOrderState(payment, {
      paymentWorkflowStatus: "RELEASED_TO_AGENT",
      status: "COMPLETED",
      lifecycleState: releaseState.lifecycleState,
      settlementState: releaseState.settlementState,
      disputeState: releaseState.disputeState,
      stateTimeline: releaseState.timeline
    });
  }

  await notifyFundsReleasedToSeller({
    buyerId: payment.userId,
    sellerId: payment.sellerId,
    amount: releasable,
    currency: payment.currency,
    sourceLabel: getSourceLabel(payment.sourceType),
    reason,
    locale: resolvePaymentLocale(payment)
  });

  return payment;
};

export const maybeAutoReleasePayment = async (paymentId: mongoose.Types.ObjectId | string) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error("Payment not found");
  if (!payment.autoReleaseEnabled) return { released: false, reason: "Auto release disabled" };
  if (payment.workflowStatus !== "AWAITING_BUYER_CONFIRMATION") {
    return { released: false, reason: `Payment is ${payment.workflowStatus}` };
  }
  if (payment.disputeId) {
    const openDispute = await Dispute.countDocuments({
      _id: payment.disputeId,
      status: { $in: ["OPEN", "UNDER_REVIEW", "HOLD_EXTENDED", "WAITING_BUYER_RESPONSE", "WAITING_SELLER_RESPONSE"] }
    });
    if (openDispute > 0) return { released: false, reason: "Open dispute exists" };
  }
  if (payment.releaseScheduledAt && payment.releaseScheduledAt.getTime() > Date.now()) {
    return { released: false, reason: "Review window still active" };
  }
  await releasePaymentToSellerPending(payment._id, "Auto release window completed without a valid dispute.");
  return { released: true };
};

export const approveRefundOnPayment = async (paymentId: mongoose.Types.ObjectId | string, amount: number, reason: string) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error("Payment not found");
  const refundable = Math.max(0, payment.amount - payment.refundedAmount - payment.releasedAmount);
  const refundAmount = Math.max(0, Math.min(refundable, amount));
  if (refundAmount <= 0) throw new Error("No refundable amount remains");

  payment.refundedAmount += refundAmount;
  payment.escrowHeldAmount = Math.max(0, payment.escrowHeldAmount - refundAmount);
  payment.workflowStatus = refundAmount >= payment.amount - payment.releasedAmount ? "REFUNDED" : "REFUND_APPROVED";
  if (payment.workflowStatus === "REFUNDED") {
    payment.status = "REFUNDED";
  }
  payment.decisionReason = reason;
  await payment.save();
  const refundState = buildRefundState("admin", reason);

  await recordRefundFromEscrow({
    paymentId: payment._id,
    paymentIntentId: payment.paymentIntentId,
    orderId: payment.orderId,
    sourceType: payment.sourceType,
    sourceId: payment.sourceId,
    categoryKey: payment.categoryKey,
    bucketKey: payment.bucketKey,
    sellerId: payment.sellerId,
    buyerId: payment.userId,
    amount: refundAmount,
    currency: payment.currency,
    note: reason
  });

  if (payment.sourceType === "SERVICE_ORDER") {
    await syncServiceOrderState(payment, {
      paymentWorkflowStatus: payment.workflowStatus,
      lifecycleState: refundState.lifecycleState,
      paymentState: refundState.paymentState,
      settlementState: refundState.settlementState,
      disputeState: refundState.disputeState,
      stateTimeline: refundState.timeline
    });
  } else {
    await syncProductOrderState(payment, {
      paymentWorkflowStatus: payment.workflowStatus,
      status: payment.workflowStatus === "REFUNDED" ? "REFUNDED" : "DISPUTED",
      refundReason: reason,
      lifecycleState: refundState.lifecycleState,
      paymentState: refundState.paymentState,
      settlementState: refundState.settlementState,
      disputeState: refundState.disputeState,
      stateTimeline: refundState.timeline
    });
  }

  await notifyRefundDecision({
    buyerId: payment.userId,
    sellerId: payment.sellerId,
    amount: refundAmount,
    currency: payment.currency,
    sourceLabel: getSourceLabel(payment.sourceType),
    approved: true,
    reason,
    locale: resolvePaymentLocale(payment)
  });

  return payment;
};

export const requestSellerPayout = async (payload: {
  sellerId: mongoose.Types.ObjectId | string;
  categoryKey?: string;
  payoutMethod?: string;
  payoutAccountId?: mongoose.Types.ObjectId | string | null;
}) => {
  const sellerId = toObjectId(payload.sellerId);
  if (!sellerId) throw new Error("Invalid seller id");

  const filter: Record<string, unknown> = {
    sellerId,
    workflowStatus: "RELEASED_TO_AGENT",
    sellerPendingPayoutAmount: { $gt: 0 },
    payoutRequestId: null
  };
  if (payload.categoryKey) filter.categoryKey = payload.categoryKey;

  const eligiblePayments = await Payment.find(filter).sort({ createdAt: 1 });
  if (!eligiblePayments.length) throw new Error("No released payments available for payout");

  const amount = eligiblePayments.reduce((sum, payment) => sum + Number(payment.sellerPendingPayoutAmount || 0), 0);
  const first = eligiblePayments[0];
  const hold = await shouldHoldSellerPayout(sellerId);
  const profile = await AgentProfile.findOne({ user: sellerId }).select("payoutAccount").lean();

  const request = await PayoutRequest.create({
    sellerId,
    paymentIds: eligiblePayments.map((payment) => payment._id),
    bucketKey: first.bucketKey,
    categoryKey: first.categoryKey,
    amount,
    currency: first.currency,
    status: hold ? "ON_HOLD" : "PENDING",
    payoutMethod: normalizeText(payload.payoutMethod) || "MANUAL_BANK",
    payoutAccountId: toObjectId(payload.payoutAccountId) || null,
    payoutAccountSnapshot: normalizeText((profile as { payoutAccount?: string } | null)?.payoutAccount)
  });

  await Payment.updateMany(
    { _id: { $in: eligiblePayments.map((payment) => payment._id) } },
    { $set: { payoutRequestId: request._id, payoutBlockedReason: hold ? "Risk review hold" : null } }
  );

  const escrowHolds = await EscrowHold.find({
    orderId: { $in: eligiblePayments.map((payment) => payment.orderId) }
  })
    .select("_id orderId paymentIntentId")
    .lean();
  const escrowHoldByKey = new Map(
    escrowHolds.map((hold) => [`${String(hold.orderId)}:${String(hold.paymentIntentId || "")}`, hold])
  );
  await PayoutRequestItem.insertMany(
    eligiblePayments.map((payment) => ({
      payoutRequestId: request._id,
      orderId: payment.orderId,
      escrowHoldId: escrowHoldByKey.get(`${String(payment.orderId)}:${String(payment.paymentIntentId || "")}`)?._id || null,
      amountMinor: Math.round(Math.max(0, Number(payment.sellerPendingPayoutAmount || 0)) * 100),
      currency: payment.currency
    }))
  );

  await recordPayoutRequested({
    paymentId: eligiblePayments[0]._id,
    paymentIntentId: eligiblePayments[0].paymentIntentId,
    orderId: eligiblePayments[0].orderId,
    sourceType: eligiblePayments[0].sourceType,
    sourceId: eligiblePayments[0].sourceId,
    bucketKey: request.bucketKey,
    sellerId,
    buyerId: eligiblePayments[0].userId,
    currency: request.currency,
    note: hold ? "Payout request created and placed on hold for risk review." : "Payout request created."
  });

  await notifyPayoutStatus({
    sellerId,
    amount,
    currency: request.currency,
    status: request.status,
    reason: hold ? "Risk review is required before transfer." : "Pending admin payout approval.",
    locale: resolvePaymentLocale(first)
  });

  return request;
};

export const reviewPayoutRequest = async (payload: {
  payoutRequestId: mongoose.Types.ObjectId | string;
  action: "approve" | "hold" | "transfer" | "fail";
  reason?: string;
}) => {
  const request = await PayoutRequest.findById(payload.payoutRequestId);
  if (!request) throw new Error("Payout request not found");

  const reason = normalizeText(payload.reason) || undefined;
  if (payload.action === "hold") {
    request.status = "ON_HOLD";
    request.holdReason = reason || "Admin hold";
    request.reviewedAt = new Date();
    await request.save();
    await Payment.updateMany({ payoutRequestId: request._id }, { $set: { payoutBlockedReason: request.holdReason } });
    await notifyPayoutStatus({
      sellerId: request.sellerId,
      amount: request.amount,
      currency: request.currency,
      status: request.status,
      reason: request.holdReason
    });
    return request;
  }

  if (payload.action === "fail") {
    request.status = "FAILED";
    request.failureReason = reason || "Payout transfer failed";
    request.reviewedAt = new Date();
    await request.save();
    await Payment.updateMany({ payoutRequestId: request._id }, { $set: { payoutRequestId: null, payoutBlockedReason: request.failureReason } });
    await notifyPayoutStatus({
      sellerId: request.sellerId,
      amount: request.amount,
      currency: request.currency,
      status: request.status,
      reason: request.failureReason
    });
    return request;
  }

  if (payload.action === "approve") {
    request.status = "APPROVED";
    request.reviewedAt = new Date();
    if (reason) request.adminNote = reason;
    await request.save();
    const payments = await Payment.find({ _id: { $in: request.paymentIds } });
    const payoutState = buildPayoutState("payout_processing", "admin", reason || "Payout approved and moved into processing.");
    for (const payment of payments) {
      if (payment.sourceType === "SERVICE_ORDER") {
        await syncServiceOrderState(payment, {
          lifecycleState: payoutState.lifecycleState,
          settlementState: payoutState.settlementState,
          stateTimeline: payoutState.timeline
        });
      } else {
        await syncProductOrderState(payment, {
          lifecycleState: payoutState.lifecycleState,
          settlementState: payoutState.settlementState,
          stateTimeline: payoutState.timeline
        });
      }
    }
    await notifyPayoutStatus({
      sellerId: request.sellerId,
      amount: request.amount,
      currency: request.currency,
      status: request.status,
      reason
    });
    return request;
  }

  if (request.status !== "APPROVED" && request.status !== "PENDING") {
    throw new Error(`Payout request cannot be transferred from status ${request.status}`);
  }

  const payments = await Payment.find({ _id: { $in: request.paymentIds } });
  const payoutCompletedState = buildPayoutState("payout_completed", "system", reason || "Payout transfer completed.");
  for (const payment of payments) {
    const transferAmount = Math.max(0, payment.sellerPendingPayoutAmount || 0);
    if (transferAmount <= 0) continue;
    await recordPayoutTransferred({
      paymentId: payment._id,
      paymentIntentId: payment.paymentIntentId,
      orderId: payment.orderId,
      sourceType: payment.sourceType,
      sourceId: payment.sourceId,
      categoryKey: payment.categoryKey,
      bucketKey: payment.bucketKey,
      sellerId: payment.sellerId,
      buyerId: payment.userId,
      amount: transferAmount,
      currency: payment.currency,
      note: reason || "Payout transferred."
    });
    payment.sellerPendingPayoutAmount = 0;
    payment.payoutTransferredAt = new Date();
    payment.payoutBlockedReason = null;
    await payment.save();
    if (payment.sourceType === "SERVICE_ORDER") {
      await syncServiceOrderState(payment, {
        lifecycleState: payoutCompletedState.lifecycleState,
        settlementState: payoutCompletedState.settlementState,
        stateTimeline: payoutCompletedState.timeline
      });
    } else {
      await syncProductOrderState(payment, {
        lifecycleState: payoutCompletedState.lifecycleState,
        settlementState: payoutCompletedState.settlementState,
        stateTimeline: payoutCompletedState.timeline
      });
    }
  }

  request.status = "TRANSFERRED";
  request.reviewedAt = request.reviewedAt || new Date();
  request.transferredAt = new Date();
  if (reason) request.adminNote = reason;
  await request.save();

  await notifyPayoutStatus({
    sellerId: request.sellerId,
    amount: request.amount,
    currency: request.currency,
    status: request.status,
    reason
  });

  return request;
};
