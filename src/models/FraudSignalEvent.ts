import mongoose, { Document, Schema } from "mongoose";
import { RISK_SEVERITY_VALUES, RISK_TARGET_TYPE_VALUES, type RiskSeverity, type RiskTargetType } from "../types/paymentDomain";

export interface IFraudSignalEvent extends Document {
  targetType: RiskTargetType;
  targetId: mongoose.Types.ObjectId;
  entityType?: string | null;
  entityId?: mongoose.Types.ObjectId | null;
  signalKey: string;
  severity: RiskSeverity;
  score: number;
  summary: string;
  reasons: string[];
  actionRecommendation?: string | null;
  metadata?: Record<string, unknown> | null;
  status: "OPEN" | "REVIEWED" | "RESOLVED";
  createdAt: Date;
  updatedAt: Date;
}

const FraudSignalEventSchema = new Schema<IFraudSignalEvent>(
  {
    targetType: { type: String, enum: [...RISK_TARGET_TYPE_VALUES], required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    entityType: { type: String, trim: true, default: null, index: true },
    entityId: { type: Schema.Types.ObjectId, default: null, index: true },
    signalKey: { type: String, required: true, trim: true, index: true },
    severity: { type: String, enum: [...RISK_SEVERITY_VALUES], required: true, index: true },
    score: { type: Number, default: 0, min: 0 },
    summary: { type: String, required: true, trim: true },
    reasons: { type: [String], default: [] },
    actionRecommendation: { type: String, trim: true, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    status: { type: String, enum: ["OPEN", "REVIEWED", "RESOLVED"], default: "OPEN", index: true }
  },
  { timestamps: true, collection: "fraud_signal_events" }
);

FraudSignalEventSchema.index({ targetType: 1, targetId: 1, signalKey: 1, createdAt: -1 });

export const FraudSignalEvent = mongoose.model<IFraudSignalEvent>("FraudSignalEvent", FraudSignalEventSchema);
