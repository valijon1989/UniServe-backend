import mongoose, { Document, Schema } from "mongoose";
import {
  SMS_DELIVERY_STATUS_VALUES,
  SMS_PAYMENT_TYPE_VALUES,
  SMS_VERIFICATION_STATE_VALUES,
  type SmsDeliveryStatus,
  type SmsPaymentType,
  type SmsVerificationState
} from "../types/paymentDomain";

export interface ISmsPaymentRequest extends Document {
  paymentIntentId: mongoose.Types.ObjectId;
  invoiceId?: mongoose.Types.ObjectId | null;
  userId: mongoose.Types.ObjectId;
  phone: string;
  smsType: SmsPaymentType;
  verificationState: SmsVerificationState;
  deliveryStatus: SmsDeliveryStatus;
  messageBody: string;
  referenceCode: string;
  resendCount: number;
  sentAt?: Date | null;
  lastSentAt?: Date | null;
  expiresAt?: Date | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SmsPaymentRequestSchema = new Schema<ISmsPaymentRequest>(
  {
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    phone: { type: String, required: true, trim: true },
    smsType: { type: String, enum: [...SMS_PAYMENT_TYPE_VALUES], required: true, index: true },
    verificationState: { type: String, enum: [...SMS_VERIFICATION_STATE_VALUES], default: "OTP_READY", index: true },
    deliveryStatus: { type: String, enum: [...SMS_DELIVERY_STATUS_VALUES], default: "QUEUED", index: true },
    messageBody: { type: String, required: true },
    referenceCode: { type: String, required: true, trim: true, index: true },
    resendCount: { type: Number, default: 0, min: 0 },
    sentAt: { type: Date, default: null },
    lastSentAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
    failureReason: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

export const SmsPaymentRequest = mongoose.model<ISmsPaymentRequest>("SmsPaymentRequest", SmsPaymentRequestSchema);
