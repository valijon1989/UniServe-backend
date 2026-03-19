import mongoose, { Document, Schema } from "mongoose";
import { REFUND_REQUEST_STATUS_VALUES, type RefundRequestStatus } from "../types/paymentDomain";

export interface IRefundRequest extends Document {
  disputeId?: mongoose.Types.ObjectId | null;
  orderId: mongoose.Types.ObjectId;
  paymentIntentId?: mongoose.Types.ObjectId | null;
  requestedByUserId: mongoose.Types.ObjectId;
  refundType: "FULL" | "PARTIAL";
  requestedAmountMinor: number;
  currency: string;
  reasonText: string;
  status: RefundRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const RefundRequestSchema = new Schema<IRefundRequest>(
  {
    disputeId: { type: Schema.Types.ObjectId, ref: "Dispute", default: null, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", default: null, index: true },
    requestedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refundType: { type: String, enum: ["FULL", "PARTIAL"], required: true, index: true },
    requestedAmountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", trim: true },
    reasonText: { type: String, required: true, trim: true },
    status: { type: String, enum: [...REFUND_REQUEST_STATUS_VALUES], default: "REQUESTED", index: true }
  },
  { timestamps: true, collection: "refund_requests" }
);

export const RefundRequest = mongoose.model<IRefundRequest>("RefundRequest", RefundRequestSchema);
