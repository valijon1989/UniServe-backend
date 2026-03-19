import mongoose, { Document, Schema } from "mongoose";
import {
  PAYMENT_METHOD_CODE_VALUES,
  PAYMENT_METHOD_GROUP_VALUES,
  type PaymentMethodCode,
  type PaymentMethodGroup
} from "../types/paymentDomain";

export interface IPaymentMethod extends Document {
  code: PaymentMethodCode;
  displayName: string;
  group: PaymentMethodGroup;
  provider: string;
  enabled: boolean;
  supportsProducts: boolean;
  supportsServices: boolean;
  supportsRedirect: boolean;
  supportsSms: boolean;
  supportsManualVerification: boolean;
  currencies: string[];
  minAmount?: number | null;
  maxAmount?: number | null;
  checkoutDescription?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>(
  {
    code: { type: String, enum: [...PAYMENT_METHOD_CODE_VALUES], required: true, unique: true, index: true },
    displayName: { type: String, required: true, trim: true },
    group: { type: String, enum: [...PAYMENT_METHOD_GROUP_VALUES], required: true, index: true },
    provider: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true, index: true },
    supportsProducts: { type: Boolean, default: true },
    supportsServices: { type: Boolean, default: true },
    supportsRedirect: { type: Boolean, default: false },
    supportsSms: { type: Boolean, default: false },
    supportsManualVerification: { type: Boolean, default: false },
    currencies: { type: [String], default: ["USD"] },
    minAmount: { type: Number, default: null, min: 0 },
    maxAmount: { type: Number, default: null, min: 0 },
    checkoutDescription: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

export const PaymentMethod = mongoose.model<IPaymentMethod>("PaymentMethod", PaymentMethodSchema);
