import mongoose from "mongoose";
import { AdminDecision } from "../models/AdminDecision";
import { DisputeEvidenceRecord } from "../models/DisputeEvidence";
import { Dispute, type IDisputeEvidence } from "../models/Dispute";
import { DisputeMessage } from "../models/DisputeMessage";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { RefundRequest } from "../models/RefundRequest";
import { ServiceOrder } from "../models/ServiceOrder";
import {
  appendTimelineEntries,
  buildDisputeOpenState,
  buildDisputeReviewState,
  buildReleaseApprovedState,
  buildRemediationRequiredState
} from "./marketplaceStateMachine";
import { evaluateBuyerDisputeRisk, evaluateSellerDisputeRisk } from "./riskEngine";
import { approveRefundOnPayment, releasePaymentToSellerPending } from "./paymentEngine";
import { notifyDisputeState, notifyRefundDecision } from "./paymentNotifications";
import { recordLifecycleMarker } from "./paymentLedger";
import type { DisputeDesiredResolution, DisputeOutcome } from "../types/paymentDomain";
import { t } from "../i18n";

const normalizeText = (value: unknown) => String(value || "").trim();
const toObjectId = (value?: mongoose.Types.ObjectId | string | null) => {
  const raw = String(value || "").trim();
  return raw && mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
};

const mapEvidenceTypeToRecordType = (type: IDisputeEvidence["type"]) => {
  if (type === "IMAGE") return "IMAGE" as const;
  if (type === "FILE") return "DOCUMENT" as const;
  if (type === "LINK") return "LINK" as const;
  return "TEXT" as const;
};

const buildEvidence = (
  uploadedBy: mongoose.Types.ObjectId,
  evidence: Array<{ type?: string; label?: string; url?: string; note?: string }> | undefined
): IDisputeEvidence[] =>
  Array.isArray(evidence)
    ? evidence
        .map((item) => ({
          uploadedBy,
          type: (normalizeText(item.type).toUpperCase() as IDisputeEvidence["type"]) || "TEXT",
          label: normalizeText(item.label) || "Evidence",
          url: normalizeText(item.url) || undefined,
          note: normalizeText(item.note) || undefined,
          createdAt: new Date()
        }))
        .filter((item) => item.label)
    : [];

const persistEvidenceRecords = async (disputeId: mongoose.Types.ObjectId, evidence: IDisputeEvidence[]) => {
  if (!evidence.length) return;
  await DisputeEvidenceRecord.insertMany(
    evidence.map((item) => ({
      disputeId,
      uploadedByUserId: item.uploadedBy,
      evidenceType: mapEvidenceTypeToRecordType(item.type),
      fileUrl: item.url || null,
      description: item.label,
      metadata: {
        note: item.note || null,
        createdAt: item.createdAt
      }
    }))
  );
};

export const createDisputeCase = async (payload: {
  paymentId: mongoose.Types.ObjectId | string;
  buyerId: mongoose.Types.ObjectId | string;
  reasonCode: string;
  explanation: string;
  desiredResolution: DisputeDesiredResolution;
  evidence?: Array<{ type?: string; label?: string; url?: string; note?: string }>;
}) => {
  const payment = await Payment.findById(payload.paymentId);
  if (!payment) throw new Error("Payment not found");
  const buyerId = toObjectId(payload.buyerId);
  if (!buyerId) throw new Error("Invalid buyer id");
  if (String(payment.userId) !== String(buyerId)) throw new Error("Only the buyer can open a dispute");

  const existing = await Dispute.findOne({
    paymentId: payment._id,
    status: { $in: ["OPEN", "UNDER_REVIEW", "WAITING_BUYER_RESPONSE", "WAITING_SELLER_RESPONSE", "HOLD_EXTENDED"] }
  });
  if (existing) return existing;

  const buyerEvidence = buildEvidence(buyerId, payload.evidence);
  const dispute = await Dispute.create({
    sourceType: payment.sourceType,
    sourceId: payment.sourceId || payment.orderId,
    paymentId: payment._id,
    orderId: payment.orderId,
    categoryKey: payment.categoryKey,
    bucketKey: payment.bucketKey,
    buyerId,
    sellerId: payment.sellerId || null,
    status: "OPEN",
    reasonCode: normalizeText(payload.reasonCode) || "other",
    explanation: normalizeText(payload.explanation),
    desiredResolution: payload.desiredResolution,
    buyerEvidence,
    timeline: [
      {
        actorId: buyerId,
        actorRole: "BUYER",
        kind: "dispute_opened",
        message: normalizeText(payload.explanation) || t(undefined, "disputes.activity.buyer_opened.text"),
        createdAt: new Date()
      }
    ]
  });

  await Promise.all([
    DisputeMessage.create({
      disputeId: dispute._id,
      authorUserId: buyerId,
      authorRole: "BUYER",
      messageText: dispute.explanation,
      isInternalAdminNote: false
    }),
    persistEvidenceRecords(dispute._id, buyerEvidence),
    ...(payload.desiredResolution === "FULL_REFUND" || payload.desiredResolution === "PARTIAL_REFUND"
      ? [
          RefundRequest.create({
            disputeId: dispute._id,
            orderId: payment.orderId,
            paymentIntentId: payment.paymentIntentId || null,
            requestedByUserId: buyerId,
            refundType: payload.desiredResolution === "FULL_REFUND" ? "FULL" : "PARTIAL",
            requestedAmountMinor:
              payload.desiredResolution === "FULL_REFUND"
                ? Math.round(Math.max(0, payment.amount - payment.releasedAmount) * 100)
                : Math.round(Math.max(0, (payment.amount - payment.releasedAmount) * 0.5) * 100),
            currency: payment.currency,
            reasonText: dispute.explanation,
            status: "REQUESTED"
          })
        ]
      : [])
  ]);

  payment.disputeId = dispute._id;
  payment.workflowStatus = "DISPUTE_OPENED";
  payment.payoutBlockedReason = "Open dispute";
  await payment.save();
  const disputeOpenState = buildDisputeOpenState("buyer", dispute.explanation || t(undefined, "disputes.activity.buyer_opened.text"));

  if (payment.sourceType === "SERVICE_ORDER" && payment.sourceId) {
    const serviceOrder = await ServiceOrder.findById(payment.sourceId);
    if (serviceOrder) {
      serviceOrder.paymentWorkflowStatus = "DISPUTE_OPENED";
      serviceOrder.lifecycleState = disputeOpenState.lifecycleState;
      serviceOrder.disputeState = disputeOpenState.disputeState;
      serviceOrder.note = "Dispute opened on this service order.";
      serviceOrder.stateTimeline = appendTimelineEntries(serviceOrder.stateTimeline as any, disputeOpenState.timeline as any) as any;
      await serviceOrder.save();
    }
  } else {
    const order = await Order.findById(payment.sourceId || payment.orderId);
    if (order) {
      order.paymentWorkflowStatus = "DISPUTE_OPENED";
      order.status = "DISPUTED";
      order.disputeReason = dispute.explanation;
      order.lifecycleState = disputeOpenState.lifecycleState;
      order.disputeState = disputeOpenState.disputeState;
      order.stateTimeline = appendTimelineEntries(order.stateTimeline as any, disputeOpenState.timeline as any) as any;
      await order.save();
    }
  }

  await recordLifecycleMarker({
    paymentId: payment._id,
    orderId: payment.orderId,
    sourceType: payment.sourceType,
    sourceId: payment.sourceId,
    bucketKey: payment.bucketKey,
    sellerId: payment.sellerId,
    buyerId: payment.userId,
    currency: payment.currency,
    entryType: "DISPUTE_HOLD",
    note: `Dispute opened: ${dispute.reasonCode}`
  });

  await Promise.all([
    evaluateBuyerDisputeRisk(buyerId),
    payment.sellerId ? evaluateSellerDisputeRisk(payment.sellerId) : Promise.resolve()
  ]);

  await notifyDisputeState({
    buyerId: payment.userId,
    sellerId: payment.sellerId,
    buyerMessage: "Dispute qabul qilindi. UniServe review jarayonida buyer va seller dalillarini tekshiradi.",
    sellerMessage: "Buyer ushbu to'lov bo'yicha dispute ochdi. Iltimos, o'z vaqtida proof va javob yuboring."
  });

  return dispute;
};

export const respondToDisputeCase = async (payload: {
  disputeId: mongoose.Types.ObjectId | string;
  sellerId: mongoose.Types.ObjectId | string;
  response: string;
  evidence?: Array<{ type?: string; label?: string; url?: string; note?: string }>;
}) => {
  const dispute = await Dispute.findById(payload.disputeId);
  if (!dispute) throw new Error("Dispute not found");
  const sellerId = toObjectId(payload.sellerId);
  if (!sellerId) throw new Error("Invalid seller id");
  if (dispute.sellerId && String(dispute.sellerId) !== String(sellerId)) throw new Error("Only the dispute seller can respond");

  const evidence = buildEvidence(sellerId, payload.evidence);
  dispute.sellerResponse = normalizeText(payload.response);
  dispute.sellerEvidence = [...(dispute.sellerEvidence || []), ...evidence];
  dispute.status = "UNDER_REVIEW";
  dispute.timeline = [
    ...(dispute.timeline || []),
    {
      actorId: sellerId,
      actorRole: "SELLER",
      kind: "seller_response",
      message: dispute.sellerResponse || t(undefined, "disputes.activity.seller_responded.text"),
      createdAt: new Date()
    }
  ];
  await dispute.save();
  await Promise.all([
    DisputeMessage.create({
      disputeId: dispute._id,
      authorUserId: sellerId,
      authorRole: "SELLER",
      messageText: dispute.sellerResponse || t(undefined, "disputes.activity.seller_responded.text"),
      isInternalAdminNote: false
    }),
    persistEvidenceRecords(dispute._id, evidence)
  ]);

  const payment = dispute.paymentId ? await Payment.findById(dispute.paymentId) : null;
  if (payment) {
    payment.workflowStatus = "UNDER_REVIEW";
    await payment.save();
  }
  const reviewState = buildDisputeReviewState("admin", "Dispute moved to review.");

  if (payment?.sourceType === "SERVICE_ORDER" && payment.sourceId) {
    const serviceOrder = await ServiceOrder.findById(payment.sourceId);
    if (serviceOrder) {
      serviceOrder.lifecycleState = reviewState.lifecycleState;
      serviceOrder.disputeState = reviewState.disputeState;
      serviceOrder.stateTimeline = appendTimelineEntries(serviceOrder.stateTimeline as any, reviewState.timeline as any) as any;
      await serviceOrder.save();
    }
  } else if (payment) {
    const order = await Order.findById(payment.sourceId || payment.orderId);
    if (order) {
      order.lifecycleState = reviewState.lifecycleState;
      order.disputeState = reviewState.disputeState;
      order.stateTimeline = appendTimelineEntries(order.stateTimeline as any, reviewState.timeline as any) as any;
      await order.save();
    }
  }

  if (payment) {
    await notifyDisputeState({
      buyerId: payment.userId,
      sellerId: payment.sellerId,
      buyerMessage: "Seller dispute bo'yicha javob va proof yubordi. UniServe admin review jarayoni davom etmoqda.",
      sellerMessage: "Sizning javobingiz qabul qilindi va dispute admin review bosqichiga o'tdi."
    });
  }

  return dispute;
};

export const decideDisputeCase = async (payload: {
  disputeId: mongoose.Types.ObjectId | string;
  adminUserId: mongoose.Types.ObjectId | string;
  outcome: DisputeOutcome;
  reason: string;
  resolutionAmount?: number;
  buyerMessage?: string;
  sellerMessage?: string;
  holdExtensionHours?: number;
}) => {
  const dispute = await Dispute.findById(payload.disputeId);
  if (!dispute) throw new Error("Dispute not found");
  const payment = dispute.paymentId ? await Payment.findById(dispute.paymentId) : null;
  if (!payment) throw new Error("Linked payment not found");

  const reason = normalizeText(payload.reason) || t(undefined, "payments.reviews.decision.recorded.text");
  const resolutionAmount = Math.max(0, Number(payload.resolutionAmount || 0));

  if (payload.outcome === "FULL_REFUND") {
    await approveRefundOnPayment(payment._id, payment.amount - payment.refundedAmount - payment.releasedAmount, reason);
  } else if (payload.outcome === "PARTIAL_REFUND" || payload.outcome === "SPLIT_DECISION") {
    const partialAmount = resolutionAmount > 0 ? resolutionAmount : Math.max(0, payment.amount * 0.5);
    await approveRefundOnPayment(payment._id, partialAmount, reason);
    const refreshed = await Payment.findById(payment._id);
    if (refreshed && Math.max(0, refreshed.amount - refreshed.refundedAmount - refreshed.releasedAmount) > 0) {
      await releasePaymentToSellerPending(refreshed._id, `${reason} Remaining funds released after partial refund decision.`);
    }
  } else if (payload.outcome === "RELEASE_TO_SELLER" || payload.outcome === "NO_ACTION") {
    await releasePaymentToSellerPending(payment._id, reason);
    const releaseState = buildReleaseApprovedState("admin", reason);
    if (payment.sourceType === "SERVICE_ORDER" && payment.sourceId) {
      const serviceOrder = await ServiceOrder.findById(payment.sourceId);
      if (serviceOrder) {
        serviceOrder.lifecycleState = releaseState.lifecycleState;
        serviceOrder.disputeState = releaseState.disputeState;
        serviceOrder.stateTimeline = appendTimelineEntries(serviceOrder.stateTimeline as any, releaseState.timeline as any) as any;
        await serviceOrder.save();
      }
    } else {
      const order = await Order.findById(payment.sourceId || payment.orderId);
      if (order) {
        order.lifecycleState = releaseState.lifecycleState;
        order.disputeState = releaseState.disputeState;
        order.stateTimeline = appendTimelineEntries(order.stateTimeline as any, releaseState.timeline as any) as any;
        await order.save();
      }
    }
    await notifyRefundDecision({
      buyerId: payment.userId,
      sellerId: payment.sellerId,
      amount: payment.amount,
      currency: payment.currency,
      sourceLabel: "Dispute decision",
      approved: false,
      reason
    });
  } else if (payload.outcome === "HOLD_EXTENSION" || payload.outcome === "REWORK" || payload.outcome === "REDELIVERY") {
    const extensionHours = Math.max(1, Number(payload.holdExtensionHours || 48));
    payment.workflowStatus = "UNDER_REVIEW";
    payment.releaseScheduledAt = new Date(Date.now() + extensionHours * 60 * 60 * 1000);
    payment.reviewWindowEndsAt = payment.releaseScheduledAt;
    await payment.save();
    const remediationState = buildRemediationRequiredState("admin", `${payload.outcome} approved.`);
    if (payment.sourceType === "SERVICE_ORDER" && payment.sourceId) {
      const serviceOrder = await ServiceOrder.findById(payment.sourceId);
      if (serviceOrder) {
        serviceOrder.paymentWorkflowStatus = "UNDER_REVIEW";
        serviceOrder.releaseScheduledAt = payment.releaseScheduledAt;
        serviceOrder.buyerReviewEndsAt = payment.reviewWindowEndsAt;
        serviceOrder.lifecycleState = remediationState.lifecycleState;
        serviceOrder.disputeState = remediationState.disputeState;
        serviceOrder.stateTimeline = appendTimelineEntries(serviceOrder.stateTimeline as any, remediationState.timeline as any) as any;
        await serviceOrder.save();
      }
    } else {
      const order = await Order.findById(payment.sourceId || payment.orderId);
      if (order) {
        order.paymentWorkflowStatus = "UNDER_REVIEW";
        order.releaseScheduledAt = payment.releaseScheduledAt;
        order.buyerReviewEndsAt = payment.reviewWindowEndsAt;
        order.lifecycleState = remediationState.lifecycleState;
        order.disputeState = remediationState.disputeState;
        order.stateTimeline = appendTimelineEntries(order.stateTimeline as any, remediationState.timeline as any) as any;
        await order.save();
      }
    }
    await recordLifecycleMarker({
      paymentId: payment._id,
      orderId: payment.orderId,
      sourceType: payment.sourceType,
      sourceId: payment.sourceId,
      bucketKey: payment.bucketKey,
      sellerId: payment.sellerId,
      buyerId: payment.userId,
      currency: payment.currency,
      entryType: "DISPUTE_EXTENSION",
      note: `${payload.outcome} approved. Hold extended by ${extensionHours} hours.`
    });
  }

  dispute.status = payload.outcome === "HOLD_EXTENSION" || payload.outcome === "REWORK" || payload.outcome === "REDELIVERY" ? "HOLD_EXTENDED" : "DECIDED";
  dispute.outcome = payload.outcome;
  dispute.decisionReason = reason;
  dispute.resolutionAmount = resolutionAmount > 0 ? resolutionAmount : undefined;
  dispute.closedAt = dispute.status === "DECIDED" ? new Date() : undefined;
  dispute.timeline = [
    ...(dispute.timeline || []),
    {
      actorId: toObjectId(payload.adminUserId),
      actorRole: "ADMIN",
      kind: "decision",
      message: reason,
      createdAt: new Date()
    }
  ];
  await dispute.save();

  await Promise.all([
    DisputeMessage.create({
      disputeId: dispute._id,
      authorUserId: toObjectId(payload.adminUserId) || payment.userId,
      authorRole: "ADMIN",
      messageText: reason,
      isInternalAdminNote: false
    }),
    RefundRequest.updateMany(
      { disputeId: dispute._id },
      {
        $set: {
          status:
            payload.outcome === "FULL_REFUND" || payload.outcome === "PARTIAL_REFUND" || payload.outcome === "SPLIT_DECISION"
              ? "APPROVED"
              : payload.outcome === "RELEASE_TO_SELLER" || payload.outcome === "NO_ACTION"
                ? "REJECTED"
                : "UNDER_REVIEW"
        }
      }
    )
  ]);

  await AdminDecision.create({
    decisionContextType: "DISPUTE",
    decisionContextId: dispute._id,
    module: "DISPUTE",
    action:
      payload.outcome === "FULL_REFUND"
        ? "APPROVE_REFUND"
        : payload.outcome === "PARTIAL_REFUND" || payload.outcome === "SPLIT_DECISION"
          ? "PARTIAL_SETTLEMENT"
          : payload.outcome === "RELEASE_TO_SELLER" || payload.outcome === "NO_ACTION"
            ? "APPROVE_RELEASE"
            : payload.outcome === "HOLD_EXTENSION"
              ? "EXTEND_HOLD"
              : "REQUEST_REWORK",
    adminUserId: toObjectId(payload.adminUserId) || undefined,
    paymentId: payment._id,
    disputeId: dispute._id,
    reason,
    customerMessage: normalizeText(payload.buyerMessage) || undefined,
    sellerMessage: normalizeText(payload.sellerMessage) || undefined,
    decisionPayloadJson: {
      outcome: payload.outcome,
      resolutionAmount: resolutionAmount || null
    },
    metadata: {
      outcome: payload.outcome,
      resolutionAmount: resolutionAmount || null
    }
  });

  await notifyDisputeState({
    buyerId: payment.userId,
    sellerId: payment.sellerId,
    buyerMessage:
      normalizeText(payload.buyerMessage) ||
      `Dispute qarori: ${payload.outcome}. Sabab: ${reason}`,
    sellerMessage:
      normalizeText(payload.sellerMessage) ||
      `Dispute qarori: ${payload.outcome}. Sabab: ${reason}`
  });

  return dispute;
};
