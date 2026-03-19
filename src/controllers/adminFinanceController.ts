import mongoose from "mongoose";
import { Request, Response } from "express";
import { BankTransferRequest } from "../models/BankTransferRequest";
import { CategoryPaymentPolicy } from "../models/CategoryPaymentPolicy";
import { Dispute } from "../models/Dispute";
import { EscrowBucket } from "../models/EscrowBucket";
import { FraudSignalEvent } from "../models/FraudSignalEvent";
import { PaymentIntent } from "../models/PaymentIntent";
import { PayoutRequest } from "../models/PayoutRequest";
import { RefundRequest } from "../models/RefundRequest";
import { RiskFlag } from "../models/RiskFlag";
import { decideDisputeCase } from "../services/disputeEngine";
import {
  buildFraudReviewQueue,
  evaluatePaymentTransactionRisk,
  evaluatePayoutRequestRisk,
  evaluateRefundAbuseRisk
} from "../services/fraudMonitoring";
import { reviewPayoutRequest } from "../services/paymentEngine";
import { confirmPaymentCollection, failPaymentCollection, getPaymentCollectionIntent, markPaymentCollectionPendingVerification, toPaymentCollectionDto } from "../services/paymentCollection";
import { t } from "../i18n";

const normalizeText = (value: unknown) => String(value || "").trim();

const parseObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
  const raw = normalizeText(value);
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

export const listEscrowBucketsAdmin = async (_req: Request, res: Response) => {
  try {
    const items = await EscrowBucket.find().sort({ categoryKey: 1 }).lean();
    return res.json({ items });
  } catch (error) {
    console.error("listEscrowBucketsAdmin error", error);
    return res.status(500).json({ message: t(_req, "common.errors.server.message") });
  }
};

export const listPaymentReviewsAdmin = async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {
      status: { $in: ["PAYMENT_PENDING_VERIFICATION", "AWAITING_MANUAL_TRANSFER", "PAYMENT_LINK_SENT"] }
    };
    const status = normalizeText(req.query.status).toUpperCase();
    const provider = normalizeText(req.query.provider);
    const categoryKey = normalizeText(req.query.category || req.query.categoryKey).toLowerCase();
    const buyer = parseObjectId(req.query.buyer);
    const orderId = parseObjectId(req.query.order_id || req.query.orderId);
    if (status) filter.status = status;
    if (provider) filter.provider = provider;
    if (categoryKey) filter.categoryKey = categoryKey;
    if (buyer) filter.userId = buyer;
    if (orderId) filter.orderId = orderId;
    const items = await PaymentIntent.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    console.error("listPaymentReviewsAdmin error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getPaymentReviewDetailAdmin = async (req: Request, res: Response) => {
  try {
    const id = parseObjectId(req.params.reviewId || req.params.intentId || req.params.id);
    if (!id) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const intent = await getPaymentCollectionIntent(id);
    if (!intent) return res.status(404).json({ message: t(req, "payments.intent.lookup.not_found.message") });
    const bankTransfer = (intent as any).bankTransferRequestId
      ? await BankTransferRequest.findById((intent as any).bankTransferRequestId).lean()
      : null;
    return res.json({
      paymentReview: await toPaymentCollectionDto(intent),
      bankTransfer
    });
  } catch (error) {
    console.error("getPaymentReviewDetailAdmin error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const verifyPaymentReviewAdmin = async (req: Request, res: Response) => {
  try {
    const id = parseObjectId(req.params.intentId || req.params.id);
    if (!id) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const updated = await confirmPaymentCollection(id, {
      transactionId: normalizeText(req.body.transactionId),
      providerReference: normalizeText(req.body.providerReference),
      note: normalizeText(req.body.reason || req.body.note || "Payment verified by admin."),
      verifiedBy: req.user?._id || null
    });
    return res.json({ paymentReview: await toPaymentCollectionDto(updated) });
  } catch (error) {
    console.error("verifyPaymentReviewAdmin error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const rejectPaymentReviewAdmin = async (req: Request, res: Response) => {
  try {
    const id = parseObjectId(req.params.intentId || req.params.id);
    if (!id) return res.status(400).json({ message: t(req, "payments.validation.intent_id.message") });
    const updated = await failPaymentCollection(id, normalizeText(req.body.reason || req.body.note || "Payment verification rejected by admin."));
    return res.json({ paymentReview: await toPaymentCollectionDto(updated) });
  } catch (error) {
    console.error("rejectPaymentReviewAdmin error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const listCategoryPaymentPoliciesAdmin = async (_req: Request, res: Response) => {
  try {
    const items = await CategoryPaymentPolicy.find().sort({ categoryKey: 1 }).lean();
    return res.json({ items });
  } catch (error) {
    console.error("listCategoryPaymentPoliciesAdmin error", error);
    return res.status(500).json({ message: t(_req, "common.errors.server.message") });
  }
};

export const listDisputesAdmin = async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    const status = normalizeText(req.query.status).toUpperCase();
    const categoryKey = normalizeText(req.query.categoryKey).toLowerCase();
    if (status) filter.status = status;
    if (categoryKey) filter.categoryKey = categoryKey;
    const items = await Dispute.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    console.error("listDisputesAdmin error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getDisputeDetailAdmin = async (req: Request, res: Response) => {
  try {
    const id = parseObjectId(req.params.disputeId || req.params.id);
    if (!id) return res.status(400).json({ message: t(req, "disputes.validation.invalid_id.message") });
    const item = await Dispute.findById(id).lean();
    if (!item) return res.status(404).json({ message: t(req, "disputes.lookup.not_found.message") });
    return res.json({ item });
  } catch (error) {
    console.error("getDisputeDetailAdmin error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const decideDisputeAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const id = parseObjectId(req.params.id || req.params.disputeId);
    if (!id) return res.status(400).json({ message: t(req, "disputes.validation.invalid_id.message") });
    const dispute = await decideDisputeCase({
      disputeId: id,
      adminUserId: req.user._id,
      outcome: normalizeText(req.body.outcome).toUpperCase() as any,
      reason: normalizeText(req.body.reason || req.body.note),
      resolutionAmount: Number(req.body.resolutionAmount || 0),
      buyerMessage: normalizeText(req.body.buyerMessage) || undefined,
      sellerMessage: normalizeText(req.body.sellerMessage) || undefined,
      holdExtensionHours: Number(req.body.holdExtensionHours || 0)
    });
    return res.json({ item: dispute });
  } catch (error) {
    console.error("decideDisputeAdmin error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const listPayoutRequestsAdmin = async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    const status = normalizeText(req.query.status).toUpperCase();
    if (status) filter.status = status;
    const items = await PayoutRequest.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    console.error("listPayoutRequestsAdmin error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getPayoutRequestDetailAdmin = async (req: Request, res: Response) => {
  try {
    const id = parseObjectId(req.params.requestId || req.params.id);
    if (!id) return res.status(400).json({ message: t(req, "payouts.validation.request_id.message") });
    const item = await PayoutRequest.findById(id).lean();
    if (!item) return res.status(404).json({ message: t(req, "payouts.lookup.not_found.message") });
    return res.json({ item });
  } catch (error) {
    console.error("getPayoutRequestDetailAdmin error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const reviewPayoutRequestAdmin = async (req: Request, res: Response) => {
  try {
    const id = parseObjectId(req.params.id || req.params.requestId);
    if (!id) return res.status(400).json({ message: t(req, "payouts.validation.request_id.message") });
    const item = await reviewPayoutRequest({
      payoutRequestId: id,
      action: normalizeText(req.body.action).toLowerCase() as any,
      reason: normalizeText(req.body.reason || req.body.note) || undefined
    });
    return res.json({ item });
  } catch (error) {
    console.error("reviewPayoutRequestAdmin error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const listRiskFlagsAdmin = async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    const targetType = normalizeText(req.query.targetType).toUpperCase();
    const status = normalizeText(req.query.status).toUpperCase();
    if (targetType) filter.targetType = targetType;
    if (status) filter.status = status;
    const items = await RiskFlag.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    console.error("listRiskFlagsAdmin error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getFraudOverviewAdmin = async (_req: Request, res: Response) => {
  try {
    const [recentRefundCandidates, recentPayoutCandidates, recentPaymentCandidates] = await Promise.all([
      RefundRequest.find({ status: { $in: ["REQUESTED", "UNDER_REVIEW", "APPROVED"] } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      PayoutRequest.find({ status: { $in: ["PENDING", "UNDER_REVIEW", "HELD"] } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      PaymentIntent.find({
        status: { $in: ["PAYMENT_PENDING_VERIFICATION", "AWAITING_MANUAL_TRANSFER", "PAYMENT_LINK_SENT"] }
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    await Promise.allSettled([
      ...recentRefundCandidates.map((refund) => evaluateRefundAbuseRisk(refund.requestedByUserId)),
      ...recentPayoutCandidates.map((payout) => evaluatePayoutRequestRisk(payout._id as mongoose.Types.ObjectId)),
      ...recentPaymentCandidates
        .filter((paymentIntent) => paymentIntent.paymentId)
        .map((paymentIntent: any) => evaluatePaymentTransactionRisk(paymentIntent.paymentId))
    ]);

    const queue = await buildFraudReviewQueue();
    const recentEvents = await FraudSignalEvent.find({ status: { $in: ["OPEN", "REVIEWED"] } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({
      summary: queue.summary,
      items: queue.items,
      flags: queue.flags,
      recentEvents: recentEvents.map((event) => ({
        id: String(event._id),
        targetType: event.targetType,
        targetId: String(event.targetId),
        signalKey: event.signalKey,
        severity: event.severity,
        score: event.score,
        summary: event.summary,
        reasons: event.reasons,
        actionRecommendation: event.actionRecommendation || null,
        status: event.status,
        createdAt: event.createdAt
      }))
    });
  } catch (error) {
    console.error("getFraudOverviewAdmin error", error);
    return res.status(500).json({ message: t(_req, "common.errors.server.message") });
  }
};

export const createRiskFlagAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const targetId = parseObjectId(req.body.targetId || req.body.subjectId);
    if (!targetId) return res.status(400).json({ message: t(req, "admin.risk.validation.target_id_required.message") });
    const item = await RiskFlag.create({
      subjectType: normalizeText(req.body.subjectType || req.body.targetType || "").toUpperCase() || null,
      subjectId: targetId,
      targetType: normalizeText(req.body.targetType).toUpperCase(),
      targetId,
      flagKey: normalizeText(req.body.flagKey || req.body.signalKey) || null,
      signalKey: normalizeText(req.body.signalKey || req.body.flagKey),
      severity: normalizeText(req.body.severity || "LOW").toUpperCase(),
      score: Number(req.body.score || 0),
      summary: normalizeText(req.body.summary || req.body.notes || "Manual risk flag"),
      details: normalizeText(req.body.details) || undefined,
      notes: normalizeText(req.body.notes) || undefined,
      createdByAdminId: new mongoose.Types.ObjectId(req.user._id),
      isActive: true
    });
    return res.status(201).json({ item });
  } catch (error) {
    console.error("createRiskFlagAdmin error", error);
    return res.status(500).json({ message: (error as Error)?.message || t(req, "common.errors.server.message") });
  }
};

export const updateCategoryPaymentPolicyAdmin = async (req: Request, res: Response) => {
  try {
    const id = parseObjectId(req.params.policyId || req.params.id);
    if (!id) return res.status(400).json({ message: t(req, "admin.payments.validation.policy_id_invalid.message") });
    const item = await CategoryPaymentPolicy.findById(id);
    if (!item) return res.status(404).json({ message: t(req, "admin.payments.lookup.policy_not_found.message") });

    if (typeof req.body.displayName !== "undefined") item.displayName = normalizeText(req.body.displayName) || item.displayName;
    if (typeof req.body.bucketKey !== "undefined") item.bucketKey = normalizeText(req.body.bucketKey) || item.bucketKey;
    if (typeof req.body.reviewWindowHours !== "undefined") item.reviewWindowHours = Math.max(0, Number(req.body.reviewWindowHours || 0));
    if (typeof req.body.autoReleaseHours !== "undefined") item.autoReleaseHours = Math.max(0, Number(req.body.autoReleaseHours || 0));
    if (typeof req.body.autoReleaseEnabled !== "undefined") item.autoReleaseEnabled = Boolean(req.body.autoReleaseEnabled);
    if (typeof req.body.manualReviewRequired !== "undefined") item.manualReviewRequired = Boolean(req.body.manualReviewRequired);
    if (typeof req.body.refundPolicyMode !== "undefined") item.refundPolicyMode = normalizeText(req.body.refundPolicyMode).toUpperCase() as any;
    if (typeof req.body.supportsPartialRefund !== "undefined") item.supportsPartialRefund = Boolean(req.body.supportsPartialRefund);
    if (typeof req.body.supportsMilestoneRelease !== "undefined") item.supportsMilestoneRelease = Boolean(req.body.supportsMilestoneRelease);
    if (typeof req.body.trustCopy !== "undefined") item.trustCopy = normalizeText(req.body.trustCopy) || item.trustCopy;
    if (Array.isArray(req.body.proofRequirements)) item.proofRequirements = req.body.proofRequirements.map((value: unknown) => normalizeText(value)).filter(Boolean);
    if (typeof req.body.policyJson !== "undefined") item.policyJson = req.body.policyJson || null;
    await item.save();
    return res.json({ item });
  } catch (error) {
    console.error("updateCategoryPaymentPolicyAdmin error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
