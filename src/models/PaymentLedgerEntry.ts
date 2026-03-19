import mongoose, { Document, Schema } from "mongoose";
import {
  ESCROW_BUCKET_ACCOUNT_TYPES,
  LEDGER_DIRECTION_VALUES,
  LEDGER_ENTRY_TYPE_VALUES,
  PAYMENT_SOURCE_TYPE_VALUES,
  type EscrowBucketAccountType,
  type LedgerDirection,
  type LedgerEntryType,
  type PaymentSourceType
} from "../types/paymentDomain";

export interface IPaymentLedgerEntry extends Document {
  paymentId?: mongoose.Types.ObjectId | null;
  paymentIntentId?: mongoose.Types.ObjectId | null;
  orderId?: mongoose.Types.ObjectId | null;
  disputeId?: mongoose.Types.ObjectId | null;
  payoutRequestId?: mongoose.Types.ObjectId | null;
  refundRequestId?: mongoose.Types.ObjectId | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | null;
  sellerId?: mongoose.Types.ObjectId | null;
  buyerId?: mongoose.Types.ObjectId | null;
  bucketKey: string;
  debitAccountId?: mongoose.Types.ObjectId | null;
  creditAccountId?: mongoose.Types.ObjectId | null;
  accountType: EscrowBucketAccountType;
  direction: LedgerDirection;
  entryType: LedgerEntryType;
  amount: number;
  amountMinor?: number | null;
  currency: string;
  description?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentLedgerEntrySchema = new Schema<IPaymentLedgerEntry>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", default: null, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    disputeId: { type: Schema.Types.ObjectId, ref: "Dispute", default: null, index: true },
    payoutRequestId: { type: Schema.Types.ObjectId, ref: "PayoutRequest", default: null, index: true },
    refundRequestId: { type: Schema.Types.ObjectId, ref: "RefundRequest", default: null, index: true },
    sourceType: { type: String, enum: [...PAYMENT_SOURCE_TYPE_VALUES], required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, default: null, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    bucketKey: { type: String, required: true, trim: true, index: true },
    debitAccountId: { type: Schema.Types.ObjectId, ref: "LedgerAccount", default: null, index: true },
    creditAccountId: { type: Schema.Types.ObjectId, ref: "LedgerAccount", default: null, index: true },
    accountType: { type: String, enum: [...ESCROW_BUCKET_ACCOUNT_TYPES], required: true },
    direction: { type: String, enum: [...LEDGER_DIRECTION_VALUES], required: true },
    entryType: { type: String, enum: [...LEDGER_ENTRY_TYPE_VALUES], required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    amountMinor: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "USD" },
    description: { type: String, trim: true },
    note: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

export const PaymentLedgerEntry = mongoose.model<IPaymentLedgerEntry>("PaymentLedgerEntry", PaymentLedgerEntrySchema);
