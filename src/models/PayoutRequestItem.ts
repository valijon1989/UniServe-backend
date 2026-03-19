import mongoose, { Document, Schema } from "mongoose";

export interface IPayoutRequestItem extends Document {
  payoutRequestId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  escrowHoldId?: mongoose.Types.ObjectId | null;
  amountMinor: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutRequestItemSchema = new Schema<IPayoutRequestItem>(
  {
    payoutRequestId: { type: Schema.Types.ObjectId, ref: "PayoutRequest", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    escrowHoldId: { type: Schema.Types.ObjectId, ref: "EscrowHold", default: null, index: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", trim: true }
  },
  { timestamps: true, collection: "payout_request_items" }
);

export const PayoutRequestItem = mongoose.model<IPayoutRequestItem>("PayoutRequestItem", PayoutRequestItemSchema);
