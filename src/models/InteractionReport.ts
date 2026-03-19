import mongoose, { Document, Schema } from "mongoose";

export type InteractionReportTargetType = "PRODUCT" | "SERVICE";
export type InteractionReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

export interface IInteractionReport extends Document {
  targetType: InteractionReportTargetType;
  targetId?: mongoose.Types.ObjectId | null;
  targetIdentifier?: string | null;
  targetTitle?: string | null;
  ownerId?: mongoose.Types.ObjectId | null;
  reporterId: mongoose.Types.ObjectId;
  reason: string;
  note?: string | null;
  status: InteractionReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

const InteractionReportSchema = new Schema<IInteractionReport>(
  {
    targetType: { type: String, enum: ["PRODUCT", "SERVICE"], required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, default: null, index: true },
    targetIdentifier: { type: String, trim: true, default: null, index: true },
    targetTitle: { type: String, trim: true, default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: null },
    status: { type: String, enum: ["OPEN", "RESOLVED", "DISMISSED"], default: "OPEN", index: true }
  },
  { timestamps: true }
);

InteractionReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1, targetIdentifier: 1, status: 1 });

export const InteractionReport = mongoose.model<IInteractionReport>("InteractionReport", InteractionReportSchema);
