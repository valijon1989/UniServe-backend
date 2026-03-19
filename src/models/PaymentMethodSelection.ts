import mongoose, { Document, Schema } from "mongoose";
import { PAYMENT_METHOD_CODE_VALUES, PAYMENT_METHOD_GROUP_VALUES, type PaymentMethodCode, type PaymentMethodGroup } from "../types/paymentDomain";

export interface IPaymentMethodSelection extends Document {
  orderId: mongoose.Types.ObjectId;
  paymentIntentId?: mongoose.Types.ObjectId | null;
  selectedMethod: PaymentMethodCode;
  selectedGroup: PaymentMethodGroup;
  phoneUsed?: string | null;
  invoiceDeliveryChannel?: "SMS" | "EMAIL" | "TELEGRAM" | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSelectionSchema = new Schema<IPaymentMethodSelection>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", default: null, index: true },
    selectedMethod: { type: String, enum: [...PAYMENT_METHOD_CODE_VALUES], required: true, index: true },
    selectedGroup: { type: String, enum: [...PAYMENT_METHOD_GROUP_VALUES], required: true, index: true },
    phoneUsed: { type: String, trim: true, default: null },
    invoiceDeliveryChannel: {
      type: String,
      enum: ["SMS", "EMAIL", "TELEGRAM"],
      default: undefined,
      set: (value: unknown) => {
        const normalized = String(value ?? "").trim().toUpperCase();
        return normalized || undefined;
      }
    }
  },
  { timestamps: true, collection: "payment_method_selections" }
);

export const PaymentMethodSelection = mongoose.model<IPaymentMethodSelection>(
  "PaymentMethodSelection",
  PaymentMethodSelectionSchema
);
