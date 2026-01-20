import mongoose, { Schema, Document } from "mongoose";

export interface IAgentReview extends Document {
  agentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AgentReviewSchema = new Schema<IAgentReview>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String }
  },
  { timestamps: true }
);

AgentReviewSchema.index({ agentId: 1, createdAt: -1 });
AgentReviewSchema.index({ agentId: 1, userId: 1 }, { unique: true });

export const AgentReview = mongoose.model<IAgentReview>("AgentReview", AgentReviewSchema);
