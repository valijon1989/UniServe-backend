import mongoose, { Document, Schema } from "mongoose";

export type CommunityActivityAction = "join" | "leave" | "rate" | "report";

export interface CommunityGroupActivity extends Document {
  group: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  action: CommunityActivityAction;
  rating?: number;
  comment?: string;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityGroupActivitySchema = new Schema<CommunityGroupActivity>(
  {
    group: { type: Schema.Types.ObjectId, ref: "CommunityGroup", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: ["join", "leave", "rate", "report"], required: true },
    rating: { type: Number },
    comment: { type: String },
    reason: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

CommunityGroupActivitySchema.index({ group: 1, action: 1, createdAt: -1 });

export const CommunityGroupActivityModel = mongoose.model<CommunityGroupActivity>(
  "CommunityGroupActivity",
  CommunityGroupActivitySchema
);
