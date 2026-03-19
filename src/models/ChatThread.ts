import mongoose, { Document, Schema } from "mongoose";

export interface IChatThread extends Document {
  participants: mongoose.Types.ObjectId[];
  participantSignature: string;
  agentId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  targetType?: "PRODUCT" | "SERVICE" | null;
  targetId?: mongoose.Types.ObjectId | null;
  targetIdentifier?: string | null;
  targetTitle?: string | null;
  serviceId?: mongoose.Types.ObjectId | null;
  serviceIdentifier?: string | null;
  serviceTitle?: string | null;
  lastMessageText?: string | null;
  lastMessageAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatThreadSchema = new Schema<IChatThread>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    participantSignature: { type: String, required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: { type: String, enum: ["PRODUCT", "SERVICE"], default: null, index: true },
    targetId: { type: Schema.Types.ObjectId, default: null, index: true },
    targetIdentifier: { type: String, trim: true, default: null },
    targetTitle: { type: String, trim: true, default: null },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", default: null, index: true },
    serviceIdentifier: { type: String, trim: true, default: null },
    serviceTitle: { type: String, trim: true, default: null },
    lastMessageText: { type: String, trim: true, default: null },
    lastMessageAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

ChatThreadSchema.index({ customerId: 1, agentId: 1, serviceId: 1 }, { unique: true, sparse: true });
ChatThreadSchema.index({ customerId: 1, agentId: 1, serviceIdentifier: 1 }, { sparse: true });
ChatThreadSchema.index({ customerId: 1, agentId: 1, targetType: 1, targetId: 1 }, { sparse: true });
ChatThreadSchema.index({ customerId: 1, agentId: 1, targetType: 1, targetIdentifier: 1 }, { sparse: true });

export const ChatThread = mongoose.model<IChatThread>("ChatThread", ChatThreadSchema);
