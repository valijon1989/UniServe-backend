import mongoose from "mongoose";
import { RefundRequest } from "../models/RefundRequest";
import { PayoutRequest } from "../models/PayoutRequest";
import { Payment } from "../models/Payment";
import { RiskFlag } from "../models/RiskFlag";
import { FraudSignalEvent } from "../models/FraudSignalEvent";
import { createOrUpdateRiskFlag } from "./riskEngine";
import { type RiskSeverity, type RiskTargetType } from "../types/paymentDomain";

const normalizeText = (value: unknown) => String(value ?? "").trim();
const toObjectId = (value: string | mongoose.Types.ObjectId) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

export const severityFromScore = (score: number): RiskSeverity => {
  if (score >= 85) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
};

const daysAgo = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value;
};

export const recordFraudSignalEvent = async (payload: {
  targetType: RiskTargetType;
  targetId: string | mongoose.Types.ObjectId;
  entityType?: string | null;
  entityId?: string | mongoose.Types.ObjectId | null;
  signalKey: string;
  score: number;
  summary: string;
  reasons: string[];
  actionRecommendation?: string | null;
  metadata?: Record<string, unknown> | null;
}) => {
  const severity = severityFromScore(payload.score);
  const event = await FraudSignalEvent.create({
    targetType: payload.targetType,
    targetId: toObjectId(payload.targetId),
    entityType: payload.entityType || null,
    entityId: payload.entityId && mongoose.Types.ObjectId.isValid(String(payload.entityId)) ? toObjectId(payload.entityId) : null,
    signalKey: payload.signalKey,
    severity,
    score: payload.score,
    summary: payload.summary,
    reasons: payload.reasons,
    actionRecommendation: payload.actionRecommendation || null,
    metadata: payload.metadata || null
  });

  await createOrUpdateRiskFlag({
    targetType: payload.targetType,
    targetId: toObjectId(payload.targetId),
    signalKey: payload.signalKey,
    severity,
    score: payload.score,
    summary: payload.summary,
    details: payload.reasons.join(" | ")
  });

  return event;
};

export const evaluateRefundAbuseRisk = async (userId: string | mongoose.Types.ObjectId) => {
  const targetId = toObjectId(userId);
  const recentRefunds = await RefundRequest.find({
    requestedByUserId: targetId,
    createdAt: { $gte: daysAgo(90) }
  }).lean();

  if (!recentRefunds.length) return null;

  const approvedOrProcessed = recentRefunds.filter((item) => ["APPROVED", "PROCESSED"].includes(String(item.status))).length;
  const largeRequests = recentRefunds.filter((item) => Number(item.requestedAmountMinor || 0) >= 500_000).length;
  const reasons = [];
  let score = recentRefunds.length * 8 + approvedOrProcessed * 10 + largeRequests * 8;

  if (recentRefunds.length >= 3) reasons.push(`Repeated refund requests in 90d: ${recentRefunds.length}`);
  if (approvedOrProcessed >= 2) reasons.push(`Approved or processed refund volume: ${approvedOrProcessed}`);
  if (largeRequests >= 2) reasons.push(`Large refund requests detected: ${largeRequests}`);

  if (!reasons.length) return null;
  score = Math.min(score, 100);

  return recordFraudSignalEvent({
    targetType: "BUYER",
    targetId,
    signalKey: "refund_abuse_pattern",
    score,
    summary: "Repeated refund behavior needs manual review.",
    reasons,
    actionRecommendation: score >= 60 ? "manual_refund_review" : "soft_hold"
  });
};

export const evaluatePayoutRequestRisk = async (payoutRequestId: string | mongoose.Types.ObjectId) => {
  const payoutRequest = await PayoutRequest.findById(toObjectId(payoutRequestId)).lean();
  if (!payoutRequest) return null;

  const recentSellerPayouts = await PayoutRequest.find({
    sellerId: payoutRequest.sellerId,
    createdAt: { $gte: daysAgo(30) }
  }).lean();

  const reasons = [];
  let score = 0;
  if (recentSellerPayouts.length >= 4) {
    score += 35;
    reasons.push(`High payout frequency in 30d: ${recentSellerPayouts.length}`);
  }
  if (Number(payoutRequest.amount || 0) >= 5_000_000) {
    score += 30;
    reasons.push(`Large payout amount: ${payoutRequest.amount}`);
  }
  if (normalizeText(payoutRequest.payoutAccountSnapshot).length <= 6) {
    score += 10;
    reasons.push("Payout destination snapshot is incomplete.");
  }

  if (!reasons.length) return null;

  return recordFraudSignalEvent({
    targetType: "PAYOUT",
    targetId: payoutRequest._id as mongoose.Types.ObjectId,
    entityType: "PAYOUT_REQUEST",
    entityId: payoutRequest._id as mongoose.Types.ObjectId,
    signalKey: "payout_risk_pattern",
    score: Math.min(score, 100),
    summary: "Payout request requires finance review.",
    reasons,
    actionRecommendation: score >= 60 ? "delay_payout" : "manual_review",
    metadata: {
      sellerId: String(payoutRequest.sellerId),
      amount: payoutRequest.amount,
      status: payoutRequest.status
    }
  });
};

export const evaluatePaymentTransactionRisk = async (paymentId: string | mongoose.Types.ObjectId) => {
  const payment = await Payment.findById(toObjectId(paymentId)).lean();
  if (!payment) return null;

  const recentPayments = await Payment.find({
    userId: payment.userId,
    createdAt: { $gte: daysAgo(14) }
  }).lean();

  const failedCount = recentPayments.filter((item) => item.status === "FAILED").length;
  const flaggedCount = recentPayments.filter((item) => item.status === "FLAGGED").length;
  const reasons = [];
  let score = 0;

  if (Number(payment.amount || 0) >= 10_000_000) {
    score += 35;
    reasons.push(`Unusually large payment amount: ${payment.amount}`);
  }
  if (failedCount >= 3) {
    score += 25;
    reasons.push(`Repeated failed transactions in 14d: ${failedCount}`);
  }
  if (flaggedCount >= 1) {
    score += 20;
    reasons.push(`Historical flagged payments in 14d: ${flaggedCount}`);
  }
  if (payment.workflowStatus === "CHARGEBACK_FLAGGED") {
    score += 35;
    reasons.push("Chargeback workflow flag is active.");
  }

  if (!reasons.length) return null;

  return recordFraudSignalEvent({
    targetType: "PAYMENT",
    targetId: payment._id as mongoose.Types.ObjectId,
    entityType: "PAYMENT",
    entityId: payment._id as mongoose.Types.ObjectId,
    signalKey: "payment_transaction_risk",
    score: Math.min(score, 100),
    summary: "Payment transaction shows abnormal behavior.",
    reasons,
    actionRecommendation: score >= 60 ? "manual_payment_review" : "observe"
  });
};

export const evaluateDisputeAbuseRisk = async (disputeId: string | mongoose.Types.ObjectId) => {
  const openFlags = await RiskFlag.find({
    targetType: "DISPUTE",
    targetId: toObjectId(disputeId),
    status: { $in: ["OPEN", "REVIEWED"] }
  }).lean();
  if (openFlags.length) return null;
  return null;
};

export const buildFraudReviewQueue = async () => {
  const [events, flags, refunds, payouts, payments] = await Promise.all([
    FraudSignalEvent.find({ status: { $in: ["OPEN", "REVIEWED"] } }).sort({ score: -1, createdAt: -1 }).limit(50).lean(),
    RiskFlag.find({ status: { $in: ["OPEN", "REVIEWED"] } }).sort({ score: -1, createdAt: -1 }).limit(50).lean(),
    RefundRequest.countDocuments({ status: { $in: ["REQUESTED", "UNDER_REVIEW"] } }),
    PayoutRequest.countDocuments({ status: { $in: ["PENDING", "UNDER_REVIEW", "HELD"] } }),
    Payment.countDocuments({ financeStatus: { $in: ["OPEN", "ESCALATED"] } })
  ]);

  const summary = {
    openFraudEvents: events.length,
    openRiskFlags: flags.length,
    refundReviewQueue: refunds,
    payoutReviewQueue: payouts,
    financeReviewQueue: payments,
    criticalFlags: flags.filter((item) => item.severity === "CRITICAL").length,
    highRiskEvents: events.filter((item) => ["HIGH", "CRITICAL"].includes(item.severity)).length
  };

  const items = events.map((event) => ({
    id: String(event._id),
    targetType: event.targetType,
    targetId: String(event.targetId),
    entityType: event.entityType || null,
    entityId: event.entityId ? String(event.entityId) : null,
    signalKey: event.signalKey,
    severity: event.severity,
    score: event.score,
    summary: event.summary,
    reasons: event.reasons || [],
    actionRecommendation: event.actionRecommendation || null,
    createdAt: event.createdAt,
    status: event.status
  }));

  return { summary, items, flags };
};
