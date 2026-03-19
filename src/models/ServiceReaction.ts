import mongoose, { Document, Schema } from "mongoose";

export type ServiceReactionKind = "LIKE" | "DISLIKE";

export interface IServiceReaction extends Document {
  serviceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  reaction: ServiceReactionKind;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceReactionSchema = new Schema<IServiceReaction>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reaction: { type: String, enum: ["LIKE", "DISLIKE"], required: true }
  },
  { timestamps: true }
);

ServiceReactionSchema.index({ serviceId: 1, userId: 1 }, { unique: true });

export const ServiceReaction = mongoose.model<IServiceReaction>("ServiceReaction", ServiceReactionSchema);
