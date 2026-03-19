import mongoose, { Document, Schema } from "mongoose";
import { SETTLEMENT_CATEGORY_VALUES, type SettlementCategory } from "../types/paymentDomain";

export interface IEscrowBucket extends Document {
  bucketKey: string;
  categoryKey: SettlementCategory;
  masterSettlementRef: string;
  availableBalance: number;
  heldBalance: number;
  pendingPayoutBalance: number;
  transferredBalance: number;
  refundedBalance: number;
  chargebackBalance: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EscrowBucketSchema = new Schema<IEscrowBucket>(
  {
    bucketKey: { type: String, required: true, unique: true, trim: true, index: true },
    categoryKey: { type: String, enum: [...SETTLEMENT_CATEGORY_VALUES], required: true, index: true },
    masterSettlementRef: { type: String, required: true, trim: true, default: "UNISERVE_MASTER_SETTLEMENT" },
    availableBalance: { type: Number, default: 0, min: 0 },
    heldBalance: { type: Number, default: 0, min: 0 },
    pendingPayoutBalance: { type: Number, default: 0, min: 0 },
    transferredBalance: { type: Number, default: 0, min: 0 },
    refundedBalance: { type: Number, default: 0, min: 0 },
    chargebackBalance: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

export const EscrowBucket = mongoose.model<IEscrowBucket>("EscrowBucket", EscrowBucketSchema);

