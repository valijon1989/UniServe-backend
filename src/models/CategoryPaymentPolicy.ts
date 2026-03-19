import mongoose, { Document, Schema } from "mongoose";
import { SETTLEMENT_CATEGORY_VALUES, type SettlementCategory } from "../types/paymentDomain";

export interface ICategoryPaymentPolicy extends Document {
  categoryKey: SettlementCategory;
  subcategoryKey?: string | null;
  displayName: string;
  bucketKey: string;
  paymentCollectionMode?: string | null;
  workflowKind: "PRODUCT_DELIVERY" | "SERVICE_COMPLETION" | "FILE_DELIVERY" | "SESSION_COMPLETION" | "ENROLLMENT";
  reviewWindowHours: number;
  autoReleaseHours: number;
  autoReleaseEnabled: boolean;
  manualReviewRequired: boolean;
  disputeWindowHours: number;
  refundPolicyMode: "DISPUTE_ONLY" | "POLICY_AWARE";
  supportsPartialRefund: boolean;
  supportsMilestoneRelease: boolean;
  privacySafeCompletion: boolean;
  trustCopy: string;
  proofRequirements: string[];
  policyJson?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryPaymentPolicySchema = new Schema<ICategoryPaymentPolicy>(
  {
    categoryKey: { type: String, enum: [...SETTLEMENT_CATEGORY_VALUES], required: true, unique: true, index: true },
    subcategoryKey: { type: String, default: null, trim: true, index: true },
    displayName: { type: String, required: true, trim: true },
    bucketKey: { type: String, required: true, trim: true, index: true },
    paymentCollectionMode: { type: String, default: null, trim: true },
    workflowKind: {
      type: String,
      enum: ["PRODUCT_DELIVERY", "SERVICE_COMPLETION", "FILE_DELIVERY", "SESSION_COMPLETION", "ENROLLMENT"],
      required: true
    },
    reviewWindowHours: { type: Number, default: 72, min: 0 },
    autoReleaseHours: { type: Number, default: 72, min: 0 },
    autoReleaseEnabled: { type: Boolean, default: true },
    manualReviewRequired: { type: Boolean, default: false },
    disputeWindowHours: { type: Number, default: 72, min: 0 },
    refundPolicyMode: { type: String, enum: ["DISPUTE_ONLY", "POLICY_AWARE"], default: "DISPUTE_ONLY" },
    supportsPartialRefund: { type: Boolean, default: true },
    supportsMilestoneRelease: { type: Boolean, default: false },
    privacySafeCompletion: { type: Boolean, default: false },
    trustCopy: { type: String, required: true, trim: true },
    proofRequirements: { type: [String], default: [] },
    policyJson: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

export const CategoryPaymentPolicy = mongoose.model<ICategoryPaymentPolicy>(
  "CategoryPaymentPolicy",
  CategoryPaymentPolicySchema
);
