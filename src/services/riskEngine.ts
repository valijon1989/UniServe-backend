import mongoose from "mongoose";
import { Dispute } from "../models/Dispute";
import { RiskFlag } from "../models/RiskFlag";
import { type RiskSeverity, type RiskTargetType } from "../types/paymentDomain";

const toObjectId = (value: mongoose.Types.ObjectId | string) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

const daysAgo = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value;
};

export const createOrUpdateRiskFlag = async (payload: {
  targetType: RiskTargetType;
  targetId: mongoose.Types.ObjectId | string;
  signalKey: string;
  severity: RiskSeverity;
  score: number;
  summary: string;
  details?: string;
}) =>
  RiskFlag.findOneAndUpdate(
    {
      targetType: payload.targetType,
      targetId: toObjectId(payload.targetId),
      signalKey: payload.signalKey,
      status: { $in: ["OPEN", "REVIEWED"] }
    },
    {
      $set: {
        severity: payload.severity,
        score: payload.score,
        summary: payload.summary,
        details: payload.details || null
      },
      $setOnInsert: {
        targetType: payload.targetType,
        targetId: toObjectId(payload.targetId),
        signalKey: payload.signalKey,
        status: "OPEN"
      }
    },
    { new: true, upsert: true }
  );

export const countOpenRiskFlags = async (
  targetType: RiskTargetType,
  targetId: mongoose.Types.ObjectId | string,
  severities?: RiskSeverity[]
) =>
  RiskFlag.countDocuments({
    targetType,
    targetId: toObjectId(targetId),
    status: { $in: ["OPEN", "REVIEWED"] },
    ...(severities?.length ? { severity: { $in: severities } } : {})
  });

export const evaluateBuyerDisputeRisk = async (buyerId: mongoose.Types.ObjectId | string) => {
  const targetId = toObjectId(buyerId);
  const [recentCount, releaseCount] = await Promise.all([
    Dispute.countDocuments({ buyerId: targetId, createdAt: { $gte: daysAgo(90) } }),
    Dispute.countDocuments({
      buyerId: targetId,
      createdAt: { $gte: daysAgo(180) },
      outcome: { $in: ["RELEASE_TO_SELLER", "NO_ACTION"] }
    })
  ]);

  if (recentCount >= 4 || releaseCount >= 2) {
    await createOrUpdateRiskFlag({
      targetType: "BUYER",
      targetId,
      signalKey: "repeat_weak_refund_claims",
      severity: releaseCount >= 3 ? "HIGH" : "MEDIUM",
      score: recentCount * 10 + releaseCount * 20,
      summary: "Buyer has repeated disputes with weak or denied refund outcomes.",
      details: `Recent disputes: ${recentCount}. Seller-favoring outcomes: ${releaseCount}.`
    });
  }
};

export const evaluateSellerDisputeRisk = async (sellerId: mongoose.Types.ObjectId | string) => {
  const targetId = toObjectId(sellerId);
  const [recentCount, refundCount] = await Promise.all([
    Dispute.countDocuments({ sellerId: targetId, createdAt: { $gte: daysAgo(90) } }),
    Dispute.countDocuments({
      sellerId: targetId,
      createdAt: { $gte: daysAgo(180) },
      outcome: { $in: ["FULL_REFUND", "PARTIAL_REFUND", "SPLIT_DECISION"] }
    })
  ]);

  if (recentCount >= 4 || refundCount >= 2) {
    await createOrUpdateRiskFlag({
      targetType: "SELLER",
      targetId,
      signalKey: "repeated_delivery_failures",
      severity: refundCount >= 3 ? "HIGH" : "MEDIUM",
      score: recentCount * 8 + refundCount * 20,
      summary: "Seller/agent shows repeated complaint or refund patterns.",
      details: `Recent disputes: ${recentCount}. Refund-heavy outcomes: ${refundCount}.`
    });
  }
};

export const shouldHoldSellerPayout = async (sellerId: mongoose.Types.ObjectId | string) => {
  const openHighFlags = await countOpenRiskFlags("SELLER", sellerId, ["HIGH", "CRITICAL"]);
  return openHighFlags > 0;
};

