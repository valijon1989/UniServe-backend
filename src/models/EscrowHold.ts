import mongoose, { Document, Schema } from "mongoose";

export interface IEscrowHold extends Document {
  orderId: mongoose.Types.ObjectId;
  paymentIntentId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId | null;
  bucketAccountId: mongoose.Types.ObjectId;
  currency: string;
  grossAmountMinor: number;
  platformFeeAmountMinor: number;
  netHeldAmountMinor: number;
  holdStatus:
    | "ACTIVE"
    | "RELEASE_PENDING"
    | "PARTIALLY_RELEASED"
    | "RELEASED"
    | "REFUND_PENDING"
    | "REFUNDED"
    | "CANCELLED";
  heldAt: Date;
  releaseDueAt?: Date | null;
  releasedAt?: Date | null;
  refundedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EscrowHoldSchema = new Schema<IEscrowHold>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    bucketAccountId: { type: Schema.Types.ObjectId, ref: "LedgerAccount", required: true, index: true },
    currency: { type: String, default: "USD", trim: true },
    grossAmountMinor: { type: Number, required: true, min: 0 },
    platformFeeAmountMinor: { type: Number, required: true, default: 0, min: 0 },
    netHeldAmountMinor: { type: Number, required: true, min: 0 },
    holdStatus: {
      type: String,
      enum: ["ACTIVE", "RELEASE_PENDING", "PARTIALLY_RELEASED", "RELEASED", "REFUND_PENDING", "REFUNDED", "CANCELLED"],
      default: "ACTIVE",
      index: true
    },
    heldAt: { type: Date, default: Date.now },
    releaseDueAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: "escrow_holds" }
);

EscrowHoldSchema.index({ orderId: 1, paymentIntentId: 1 }, { unique: true });

export const EscrowHold = mongoose.model<IEscrowHold>("EscrowHold", EscrowHoldSchema);
