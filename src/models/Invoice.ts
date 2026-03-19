import mongoose, { Document, Schema } from "mongoose";
import {
  INVOICE_KIND_VALUES,
  INVOICE_STATUS_VALUES,
  type InvoiceKind,
  type InvoiceStatus
} from "../types/paymentDomain";

export interface IInvoice extends Document {
  paymentIntentId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  kind: InvoiceKind;
  status: InvoiceStatus;
  amount: number;
  currency: string;
  referenceCode: string;
  secureLinkUrl?: string | null;
  bankDetails?: Record<string, unknown> | null;
  instructionText?: string | null;
  expiresAt?: Date | null;
  sentAt?: Date | null;
  paidAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: [...INVOICE_KIND_VALUES], required: true, index: true },
    status: { type: String, enum: [...INVOICE_STATUS_VALUES], default: "OPEN", index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", trim: true },
    referenceCode: { type: String, required: true, unique: true, trim: true, index: true },
    secureLinkUrl: { type: String, default: null, trim: true },
    bankDetails: { type: Schema.Types.Mixed, default: null },
    instructionText: { type: String, default: null },
    expiresAt: { type: Date, default: null, index: true },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

export const Invoice = mongoose.model<IInvoice>("Invoice", InvoiceSchema);
