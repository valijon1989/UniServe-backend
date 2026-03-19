import mongoose, { Document, Schema } from "mongoose";
import {
  DISPUTE_DESIRED_RESOLUTION_VALUES,
  DISPUTE_OUTCOME_VALUES,
  DISPUTE_STATUS_VALUES,
  PAYMENT_SOURCE_TYPE_VALUES,
  SETTLEMENT_CATEGORY_VALUES,
  type DisputeDesiredResolution,
  type DisputeOutcome,
  type DisputeStatus,
  type PaymentSourceType,
  type SettlementCategory
} from "../types/paymentDomain";

export interface IDisputeEvidence {
  uploadedBy: mongoose.Types.ObjectId;
  type: "FILE" | "IMAGE" | "TEXT" | "LINK";
  label: string;
  url?: string;
  note?: string;
  createdAt: Date;
}

export interface IDisputeTimelineEntry {
  actorId?: mongoose.Types.ObjectId | null;
  actorRole: "BUYER" | "SELLER" | "ADMIN" | "SYSTEM";
  kind: string;
  message: string;
  createdAt: Date;
}

export interface IDispute extends Document {
  sourceType: PaymentSourceType;
  sourceId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId | null;
  orderId?: mongoose.Types.ObjectId | null;
  categoryKey: SettlementCategory;
  bucketKey: string;
  buyerId: mongoose.Types.ObjectId;
  sellerId?: mongoose.Types.ObjectId | null;
  status: DisputeStatus;
  reasonCode: string;
  explanation: string;
  riskScoreSnapshot?: number | null;
  desiredResolution: DisputeDesiredResolution;
  buyerEvidence: IDisputeEvidence[];
  sellerResponse?: string;
  sellerEvidence: IDisputeEvidence[];
  outcome?: DisputeOutcome;
  decisionReason?: string;
  resolutionAmount?: number;
  timeline: IDisputeTimelineEntry[];
  openedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DisputeEvidenceSchema = new Schema<IDisputeEvidence>(
  {
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["FILE", "IMAGE", "TEXT", "LINK"], default: "TEXT" },
    label: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    note: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const DisputeTimelineSchema = new Schema<IDisputeTimelineEntry>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, enum: ["BUYER", "SELLER", "ADMIN", "SYSTEM"], required: true },
    kind: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const DisputeSchema = new Schema<IDispute>(
  {
    sourceType: { type: String, enum: [...PAYMENT_SOURCE_TYPE_VALUES], required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    categoryKey: { type: String, enum: [...SETTLEMENT_CATEGORY_VALUES], required: true, index: true },
    bucketKey: { type: String, required: true, trim: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    status: { type: String, enum: [...DISPUTE_STATUS_VALUES], default: "OPEN", index: true },
    reasonCode: { type: String, required: true, trim: true },
    explanation: { type: String, required: true, trim: true },
    riskScoreSnapshot: { type: Number, default: null, min: 0 },
    desiredResolution: {
      type: String,
      enum: [...DISPUTE_DESIRED_RESOLUTION_VALUES],
      required: true
    },
    buyerEvidence: { type: [DisputeEvidenceSchema], default: [] },
    sellerResponse: { type: String, trim: true },
    sellerEvidence: { type: [DisputeEvidenceSchema], default: [] },
    outcome: { type: String, enum: [...DISPUTE_OUTCOME_VALUES] },
    decisionReason: { type: String, trim: true },
    resolutionAmount: { type: Number, min: 0 },
    timeline: { type: [DisputeTimelineSchema], default: [] },
    openedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date }
  },
  { timestamps: true }
);

export const Dispute = mongoose.model<IDispute>("Dispute", DisputeSchema);
