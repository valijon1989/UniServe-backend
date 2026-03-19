import mongoose, { Document, Schema } from "mongoose";
import {
  PAYMENT_COLLECTION_STATUS_VALUES,
  PAYMENT_METHOD_CODE_VALUES,
  PAYMENT_SOURCE_TYPE_VALUES,
  PAYMENT_WORKFLOW_STATUS_VALUES,
  SETTLEMENT_CATEGORY_VALUES,
  type PaymentCollectionStatus,
  type PaymentMethodCode,
  type PaymentSourceType,
  type PaymentWorkflowStatus,
  type SettlementCategory
} from "../types/paymentDomain";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "FLAGGED";

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sellerId?: mongoose.Types.ObjectId | null;
  kind: "PAYMENT" | "PAYOUT" | "REFUND";
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | null;
  sourceModel?: string;
  categoryKey: SettlementCategory;
  bucketKey: string;
  provider: string;
  collectionStatus?: PaymentCollectionStatus | null;
  collectionMethod?: PaymentMethodCode | null;
  paymentIntentId?: mongoose.Types.ObjectId | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  workflowStatus: PaymentWorkflowStatus;
  escrowHeldAmount: number;
  releasedAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  sellerPendingPayoutAmount: number;
  reviewWindowEndsAt?: Date | null;
  releaseScheduledAt?: Date | null;
  releasedAt?: Date | null;
  autoReleaseEnabled: boolean;
  payoutBlockedReason?: string | null;
  payoutRequestId?: mongoose.Types.ObjectId | null;
  payoutTransferredAt?: Date | null;
  disputeId?: mongoose.Types.ObjectId | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  financeStatus: "OPEN" | "REVIEWED" | "ESCALATED";
  note?: string;
  decisionReason?: string;
  metadata?: Record<string, unknown>;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    kind: { type: String, enum: ["PAYMENT", "PAYOUT", "REFUND"], default: "PAYMENT", index: true },
    sourceType: { type: String, enum: [...PAYMENT_SOURCE_TYPE_VALUES], default: "PRODUCT_ORDER", index: true },
    sourceId: { type: Schema.Types.ObjectId, default: null, index: true },
    sourceModel: { type: String, trim: true, default: "Order" },
    categoryKey: { type: String, enum: [...SETTLEMENT_CATEGORY_VALUES], default: "shopping", index: true },
    bucketKey: { type: String, default: "shopping_held", trim: true, index: true },
    provider: { type: String, required: true, trim: true },
    collectionStatus: { type: String, enum: [...PAYMENT_COLLECTION_STATUS_VALUES], default: null, index: true },
    collectionMethod: { type: String, enum: [...PAYMENT_METHOD_CODE_VALUES], default: null, index: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", default: null, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED", "FLAGGED"], default: "PENDING", index: true },
    workflowStatus: {
      type: String,
      enum: [...PAYMENT_WORKFLOW_STATUS_VALUES],
      default: "INITIATED",
      index: true
    },
    escrowHeldAmount: { type: Number, default: 0, min: 0 },
    releasedAmount: { type: Number, default: 0, min: 0 },
    refundedAmount: { type: Number, default: 0, min: 0 },
    chargebackAmount: { type: Number, default: 0, min: 0 },
    sellerPendingPayoutAmount: { type: Number, default: 0, min: 0 },
    reviewWindowEndsAt: { type: Date, default: null },
    releaseScheduledAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    autoReleaseEnabled: { type: Boolean, default: true },
    payoutBlockedReason: { type: String, default: null },
    payoutRequestId: { type: Schema.Types.ObjectId, ref: "PayoutRequest", default: null, index: true },
    payoutTransferredAt: { type: Date, default: null },
    disputeId: { type: Schema.Types.ObjectId, ref: "Dispute", default: null, index: true },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW", index: true },
    financeStatus: { type: String, enum: ["OPEN", "REVIEWED", "ESCALATED"], default: "OPEN", index: true },
    note: { type: String },
    decisionReason: { type: String },
    metadata: { type: Schema.Types.Mixed, default: null },
    transactionId: { type: String, trim: true }
  },
  { timestamps: true }
);

PaymentSchema.index({ orderId: 1, transactionId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ sellerId: 1, workflowStatus: 1, categoryKey: 1 });

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
