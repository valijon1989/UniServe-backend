import mongoose, { Document, Schema } from "mongoose";
import { PAYOUT_STATUS_VALUES, SETTLEMENT_CATEGORY_VALUES, type PayoutStatus, type SettlementCategory } from "../types/paymentDomain";

export interface IPayoutRequest extends Document {
  sellerId: mongoose.Types.ObjectId;
  payoutAccountId?: mongoose.Types.ObjectId | null;
  paymentIds: mongoose.Types.ObjectId[];
  bucketKey: string;
  categoryKey: SettlementCategory;
  amount: number;
  requestedAmountMinor?: number | null;
  currency: string;
  status: PayoutStatus;
  payoutMethod: string;
  payoutAccountSnapshot?: string;
  requestedAt: Date;
  approvedAt?: Date;
  processedAt?: Date;
  reviewedAt?: Date;
  transferredAt?: Date;
  holdReason?: string;
  failureReason?: string;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutRequestSchema = new Schema<IPayoutRequest>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    payoutAccountId: { type: Schema.Types.ObjectId, ref: "SellerPayoutAccount", default: null, index: true },
    paymentIds: { type: [Schema.Types.ObjectId], ref: "Payment", default: [] },
    bucketKey: { type: String, required: true, trim: true, index: true },
    categoryKey: { type: String, enum: [...SETTLEMENT_CATEGORY_VALUES], required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    requestedAmountMinor: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: [...PAYOUT_STATUS_VALUES], default: "PENDING", index: true },
    payoutMethod: { type: String, default: "MANUAL_BANK", trim: true },
    payoutAccountSnapshot: { type: String, trim: true },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    processedAt: { type: Date },
    reviewedAt: { type: Date },
    transferredAt: { type: Date },
    holdReason: { type: String, trim: true },
    failureReason: { type: String, trim: true },
    adminNote: { type: String, trim: true }
  },
  { timestamps: true }
);

export const PayoutRequest = mongoose.model<IPayoutRequest>("PayoutRequest", PayoutRequestSchema);
