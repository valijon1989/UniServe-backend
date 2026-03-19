import mongoose, { Document, Schema } from "mongoose";
import { RISK_SEVERITY_VALUES, RISK_STATUS_VALUES, RISK_TARGET_TYPE_VALUES, type RiskSeverity, type RiskStatus, type RiskTargetType } from "../types/paymentDomain";

export interface IRiskFlag extends Document {
  subjectType?: RiskTargetType;
  subjectId?: mongoose.Types.ObjectId;
  targetType: RiskTargetType;
  targetId: mongoose.Types.ObjectId;
  flagKey?: string;
  signalKey: string;
  severity: RiskSeverity;
  score: number;
  status: RiskStatus;
  summary: string;
  details?: string;
  notes?: string;
  createdByAdminId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RiskFlagSchema = new Schema<IRiskFlag>(
  {
    subjectType: { type: String, enum: [...RISK_TARGET_TYPE_VALUES], default: null, index: true },
    subjectId: { type: Schema.Types.ObjectId, default: null, index: true },
    targetType: { type: String, enum: [...RISK_TARGET_TYPE_VALUES], required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    flagKey: { type: String, trim: true, default: null, index: true },
    signalKey: { type: String, required: true, trim: true, index: true },
    severity: { type: String, enum: [...RISK_SEVERITY_VALUES], default: "LOW", index: true },
    score: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: [...RISK_STATUS_VALUES], default: "OPEN", index: true },
    summary: { type: String, required: true, trim: true },
    details: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdByAdminId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

export const RiskFlag = mongoose.model<IRiskFlag>("RiskFlag", RiskFlagSchema);
