import mongoose, { Document, Schema } from "mongoose";

export interface ITransactionReference extends Document {
  paymentIntentId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  referenceCode: string;
  providerReference?: string | null;
  merchantReference?: string | null;
  bankReference?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionReferenceSchema = new Schema<ITransactionReference>(
  {
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, index: true },
    referenceCode: { type: String, required: true, unique: true, trim: true, index: true },
    providerReference: { type: String, default: null, trim: true, index: true },
    merchantReference: { type: String, default: null, trim: true, index: true },
    bankReference: { type: String, default: null, trim: true, index: true },
    expiresAt: { type: Date, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

export const TransactionReference = mongoose.model<ITransactionReference>(
  "TransactionReference",
  TransactionReferenceSchema
);
