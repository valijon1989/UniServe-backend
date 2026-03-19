import mongoose, { Document, Schema } from "mongoose";
import {
  PROVIDER_EVENT_STATUS_VALUES,
  type ProviderEventStatus
} from "../types/paymentDomain";

export interface IPaymentProviderEvent extends Document {
  provider: string;
  eventType: string;
  eventId?: string | null;
  paymentIntentId?: mongoose.Types.ObjectId | null;
  paymentId?: mongoose.Types.ObjectId | null;
  externalReference?: string | null;
  verified: boolean;
  processed: boolean;
  status: ProviderEventStatus;
  payload?: Record<string, unknown> | null;
  rawPayloadJson?: Record<string, unknown> | null;
  processedAt?: Date | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentProviderEventSchema = new Schema<IPaymentProviderEvent>(
  {
    provider: { type: String, required: true, trim: true, index: true },
    eventType: { type: String, required: true, trim: true, index: true },
    eventId: { type: String, default: null, trim: true, index: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", default: null, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    externalReference: { type: String, default: null, trim: true, index: true },
    verified: { type: Boolean, default: false, index: true },
    processed: { type: Boolean, default: false, index: true },
    status: { type: String, enum: [...PROVIDER_EVENT_STATUS_VALUES], default: "RECEIVED", index: true },
    payload: { type: Schema.Types.Mixed, default: null },
    rawPayloadJson: { type: Schema.Types.Mixed, default: null },
    processedAt: { type: Date, default: null },
    failureReason: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

export const PaymentProviderEvent = mongoose.model<IPaymentProviderEvent>("PaymentProviderEvent", PaymentProviderEventSchema);
