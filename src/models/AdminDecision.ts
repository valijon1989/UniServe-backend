import mongoose, { Document, Schema } from "mongoose";
import {
  ADMIN_DECISION_ACTION_VALUES,
  ADMIN_DECISION_MODULE_VALUES,
  type AdminDecisionAction,
  type AdminDecisionModule
} from "../types/paymentDomain";

export interface IAdminDecision extends Document {
  decisionContextType?: "DISPUTE" | "REFUND" | "PAYMENT_VERIFICATION" | "PAYOUT" | null;
  decisionContextId?: mongoose.Types.ObjectId | null;
  module: AdminDecisionModule;
  action: AdminDecisionAction;
  adminUserId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId | null;
  disputeId?: mongoose.Types.ObjectId | null;
  payoutRequestId?: mongoose.Types.ObjectId | null;
  riskFlagId?: mongoose.Types.ObjectId | null;
  reason: string;
  customerMessage?: string;
  sellerMessage?: string;
  decisionPayloadJson?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AdminDecisionSchema = new Schema<IAdminDecision>(
  {
    decisionContextType: {
      type: String,
      enum: ["DISPUTE", "REFUND", "PAYMENT_VERIFICATION", "PAYOUT"],
      default: null,
      index: true
    },
    decisionContextId: { type: Schema.Types.ObjectId, default: null, index: true },
    module: { type: String, enum: [...ADMIN_DECISION_MODULE_VALUES], required: true, index: true },
    action: { type: String, enum: [...ADMIN_DECISION_ACTION_VALUES], required: true, index: true },
    adminUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    disputeId: { type: Schema.Types.ObjectId, ref: "Dispute", default: null, index: true },
    payoutRequestId: { type: Schema.Types.ObjectId, ref: "PayoutRequest", default: null, index: true },
    riskFlagId: { type: Schema.Types.ObjectId, ref: "RiskFlag", default: null, index: true },
    reason: { type: String, required: true, trim: true },
    customerMessage: { type: String, trim: true },
    sellerMessage: { type: String, trim: true },
    decisionPayloadJson: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

export const AdminDecision = mongoose.model<IAdminDecision>("AdminDecision", AdminDecisionSchema);
