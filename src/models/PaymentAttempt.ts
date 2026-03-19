import mongoose, { Document, Schema } from "mongoose";
import {
  PAYMENT_COLLECTION_STATUS_VALUES,
  PAYMENT_METHOD_CODE_VALUES,
  type PaymentCollectionStatus,
  type PaymentMethodCode
} from "../types/paymentDomain";

export interface IPaymentAttempt extends Document {
  paymentIntentId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  methodCode: PaymentMethodCode;
  provider: string;
  attemptNumber: number;
  status: PaymentCollectionStatus;
  errorCode?: string | null;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAttemptSchema = new Schema<IPaymentAttempt>(
  {
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    methodCode: { type: String, enum: [...PAYMENT_METHOD_CODE_VALUES], required: true, index: true },
    provider: { type: String, required: true, trim: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    status: { type: String, enum: [...PAYMENT_COLLECTION_STATUS_VALUES], required: true, index: true },
    errorCode: { type: String, default: null, trim: true, index: true },
    requestPayload: { type: Schema.Types.Mixed, default: null },
    responsePayload: { type: Schema.Types.Mixed, default: null },
    errorMessage: { type: String, default: null, trim: true },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

PaymentAttemptSchema.index({ paymentIntentId: 1, attemptNumber: 1 }, { unique: true });

export const PaymentAttempt = mongoose.model<IPaymentAttempt>("PaymentAttempt", PaymentAttemptSchema);
