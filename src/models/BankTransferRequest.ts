import mongoose, { Document, Schema } from "mongoose";
import {
  BANK_TRANSFER_STATUS_VALUES,
  type BankTransferStatus
} from "../types/paymentDomain";

export interface IBankTransferRequest extends Document {
  paymentIntentId: mongoose.Types.ObjectId;
  invoiceId?: mongoose.Types.ObjectId | null;
  userId: mongoose.Types.ObjectId;
  referenceCode: string;
  status: BankTransferStatus;
  bankDetails: Record<string, unknown>;
  instructionText: string;
  receiptUrl?: string | null;
  receiptUploadedAt?: Date | null;
  expiresAt?: Date | null;
  confirmedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BankTransferRequestSchema = new Schema<IBankTransferRequest>(
  {
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referenceCode: { type: String, required: true, unique: true, trim: true, index: true },
    status: { type: String, enum: [...BANK_TRANSFER_STATUS_VALUES], default: "AWAITING_TRANSFER", index: true },
    bankDetails: { type: Schema.Types.Mixed, required: true },
    instructionText: { type: String, required: true },
    receiptUrl: { type: String, default: null, trim: true },
    receiptUploadedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
    confirmedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export const BankTransferRequest = mongoose.model<IBankTransferRequest>("BankTransferRequest", BankTransferRequestSchema);
