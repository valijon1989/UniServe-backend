import mongoose, { Document, Schema } from "mongoose";

export interface IChargebackEvent extends Document {
  paymentId: mongoose.Types.ObjectId;
  paymentIntentId?: mongoose.Types.ObjectId | null;
  providerKey?: string | null;
  providerEventId?: string;
  providerCaseId?: string | null;
  amount: number;
  amountMinor?: number | null;
  currency: string;
  reasonCode?: string;
  note?: string;
  status: "FLAGGED" | "REVIEWING" | "RESOLVED";
  rawPayloadJson?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChargebackEventSchema = new Schema<IChargebackEvent>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", default: null, index: true },
    providerKey: { type: String, trim: true, default: null, index: true },
    providerEventId: { type: String, trim: true, index: true },
    providerCaseId: { type: String, trim: true, default: null, index: true },
    amount: { type: Number, required: true, min: 0 },
    amountMinor: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "USD" },
    reasonCode: { type: String, trim: true },
    note: { type: String, trim: true },
    status: { type: String, enum: ["FLAGGED", "REVIEWING", "RESOLVED"], default: "FLAGGED", index: true },
    rawPayloadJson: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

export const ChargebackEvent = mongoose.model<IChargebackEvent>("ChargebackEvent", ChargebackEventSchema);
