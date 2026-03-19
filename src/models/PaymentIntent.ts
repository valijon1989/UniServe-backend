import mongoose, { Document, Schema } from "mongoose";
import {
  PAYMENT_COLLECTION_STATUS_VALUES,
  PAYMENT_METHOD_CODE_VALUES,
  PAYMENT_METHOD_GROUP_VALUES,
  PAYMENT_NEXT_ACTION_TYPE_VALUES,
  PAYMENT_SOURCE_TYPE_VALUES,
  SETTLEMENT_CATEGORY_VALUES,
  type PaymentCollectionStatus,
  type PaymentMethodCode,
  type PaymentMethodGroup,
  type PaymentNextActionType,
  type PaymentSourceType,
  type SettlementCategory
} from "../types/paymentDomain";

export interface IPaymentIntent extends Document {
  orderId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId | null;
  paymentMethodSelectionId?: mongoose.Types.ObjectId | null;
  sourceType: PaymentSourceType;
  sourceId?: mongoose.Types.ObjectId | null;
  sourceModel?: string;
  userId: mongoose.Types.ObjectId;
  sellerId?: mongoose.Types.ObjectId | null;
  categoryKey: SettlementCategory;
  bucketKey: string;
  methodCode: PaymentMethodCode;
  methodGroup: PaymentMethodGroup;
  provider: string;
  displayName: string;
  status: PaymentCollectionStatus;
  statusLabelCache?: string | null;
  amount: number;
  amountMinor?: number | null;
  currency: string;
  referenceCode?: string | null;
  providerReference?: string | null;
  phone?: string | null;
  phoneVerified: boolean;
  nextActionType: PaymentNextActionType;
  nextActionLabel?: string | null;
  redirectUrl?: string | null;
  modalConfig?: Record<string, unknown> | null;
  invoiceId?: mongoose.Types.ObjectId | null;
  smsPaymentRequestId?: mongoose.Types.ObjectId | null;
  bankTransferRequestId?: mongoose.Types.ObjectId | null;
  transactionReferenceId?: mongoose.Types.ObjectId | null;
  expiresAt?: Date | null;
  paidAt?: Date | null;
  escrowHeldAt?: Date | null;
  cancelledAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentIntentSchema = new Schema<IPaymentIntent>(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    paymentMethodSelectionId: { type: Schema.Types.ObjectId, ref: "PaymentMethodSelection", default: null, index: true },
    sourceType: { type: String, enum: [...PAYMENT_SOURCE_TYPE_VALUES], required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, default: null, index: true },
    sourceModel: { type: String, trim: true, default: "Order" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    categoryKey: { type: String, enum: [...SETTLEMENT_CATEGORY_VALUES], required: true, index: true },
    bucketKey: { type: String, required: true, trim: true, index: true },
    methodCode: { type: String, enum: [...PAYMENT_METHOD_CODE_VALUES], required: true, index: true },
    methodGroup: { type: String, enum: [...PAYMENT_METHOD_GROUP_VALUES], required: true, index: true },
    provider: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    status: { type: String, enum: [...PAYMENT_COLLECTION_STATUS_VALUES], default: "DRAFT", index: true },
    statusLabelCache: { type: String, default: null, trim: true },
    amount: { type: Number, required: true, min: 0 },
    amountMinor: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "USD", trim: true },
    referenceCode: { type: String, default: null, trim: true, index: true },
    providerReference: { type: String, default: null, trim: true, index: true },
    phone: { type: String, default: null, trim: true },
    phoneVerified: { type: Boolean, default: false },
    nextActionType: { type: String, enum: [...PAYMENT_NEXT_ACTION_TYPE_VALUES], default: "NONE" },
    nextActionLabel: { type: String, default: null, trim: true },
    redirectUrl: { type: String, default: null, trim: true },
    modalConfig: { type: Schema.Types.Mixed, default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
    smsPaymentRequestId: { type: Schema.Types.ObjectId, ref: "SmsPaymentRequest", default: null, index: true },
    bankTransferRequestId: { type: Schema.Types.ObjectId, ref: "BankTransferRequest", default: null, index: true },
    transactionReferenceId: { type: Schema.Types.ObjectId, ref: "TransactionReference", default: null, index: true },
    expiresAt: { type: Date, default: null, index: true },
    paidAt: { type: Date, default: null },
    escrowHeldAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

PaymentIntentSchema.index({ orderId: 1, status: 1, createdAt: -1 });
PaymentIntentSchema.index({ sourceType: 1, sourceId: 1, createdAt: -1 });

export const PaymentIntent = mongoose.model<IPaymentIntent>("PaymentIntent", PaymentIntentSchema);
