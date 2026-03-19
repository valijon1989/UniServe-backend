import mongoose, { Document, Schema } from "mongoose";

export interface IDisputeMessage extends Document {
  disputeId: mongoose.Types.ObjectId;
  authorUserId: mongoose.Types.ObjectId;
  authorRole: "BUYER" | "SELLER" | "AGENT" | "ADMIN";
  messageText: string;
  isInternalAdminNote: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DisputeMessageSchema = new Schema<IDisputeMessage>(
  {
    disputeId: { type: Schema.Types.ObjectId, ref: "Dispute", required: true, index: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorRole: { type: String, enum: ["BUYER", "SELLER", "AGENT", "ADMIN"], required: true, index: true },
    messageText: { type: String, required: true, trim: true },
    isInternalAdminNote: { type: Boolean, default: false, index: true }
  },
  { timestamps: true, collection: "dispute_messages" }
);

export const DisputeMessage = mongoose.model<IDisputeMessage>("DisputeMessage", DisputeMessageSchema);
