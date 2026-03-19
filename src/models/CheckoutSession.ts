import mongoose, { Document, Schema } from "mongoose";
import {
  PAYMENT_METHOD_CODE_VALUES,
  PAYMENT_SOURCE_TYPE_VALUES,
  type PaymentMethodCode,
  type PaymentSourceType
} from "../types/paymentDomain";

export interface ICheckoutSessionItem {
  itemType: "PRODUCT" | "SERVICE";
  targetId?: mongoose.Types.ObjectId | null;
  titleSnapshot: string;
  imageSnapshot?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  metadata?: Record<string, unknown> | null;
}

export interface ICheckoutSession extends Document {
  buyerUserId: mongoose.Types.ObjectId;
  sourceType: PaymentSourceType;
  sourceModel: "Order" | "ServiceOrder";
  status: "OPEN" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  draftOrderId?: mongoose.Types.ObjectId | null;
  cartId?: mongoose.Types.ObjectId | null;
  currency: string;
  items: ICheckoutSessionItem[];
  subtotalAmount: number;
  deliveryAmount: number;
  totalAmount: number;
  phone?: string | null;
  buyerNote?: string | null;
  paymentMethodSelection?: PaymentMethodCode | null;
  shippingAddress?: {
    name?: string | null;
    phone?: string | null;
    address1?: string | null;
    address2?: string | null;
    postalCode?: string | null;
    country?: string | null;
    region?: string | null;
    city?: string | null;
    district?: string | null;
    landmark?: string | null;
  } | null;
  fulfillmentDetails?: {
    deliveryType?: string | null;
    fulfillmentMode?: string | null;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    location?: string | null;
  } | null;
  trustNotice?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CheckoutSessionItemSchema = new Schema<ICheckoutSessionItem>(
  {
    itemType: { type: String, enum: ["PRODUCT", "SERVICE"], required: true },
    targetId: { type: Schema.Types.ObjectId, default: null, index: true },
    titleSnapshot: { type: String, required: true, trim: true },
    imageSnapshot: { type: String, trim: true, default: null },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const CheckoutSessionSchema = new Schema<ICheckoutSession>(
  {
    buyerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourceType: { type: String, enum: [...PAYMENT_SOURCE_TYPE_VALUES], required: true, index: true },
    sourceModel: { type: String, enum: ["Order", "ServiceOrder"], default: "Order", index: true },
    status: { type: String, enum: ["OPEN", "COMPLETED", "CANCELLED", "EXPIRED"], default: "OPEN", index: true },
    draftOrderId: { type: Schema.Types.ObjectId, default: null, index: true, refPath: "sourceModel" },
    cartId: { type: Schema.Types.ObjectId, ref: "Cart", default: null, index: true },
    currency: { type: String, default: "USD", trim: true },
    items: { type: [CheckoutSessionItemSchema], default: [] },
    subtotalAmount: { type: Number, required: true, min: 0 },
    deliveryAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    phone: { type: String, trim: true, default: null },
    buyerNote: { type: String, trim: true, default: null },
    paymentMethodSelection: { type: String, enum: [...PAYMENT_METHOD_CODE_VALUES], default: null, index: true },
    shippingAddress: { type: Schema.Types.Mixed, default: null },
    fulfillmentDetails: { type: Schema.Types.Mixed, default: null },
    trustNotice: { type: String, trim: true, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, default: null, index: true }
  },
  { timestamps: true, collection: "checkout_sessions" }
);

CheckoutSessionSchema.index({ buyerUserId: 1, status: 1, createdAt: -1 });

export const CheckoutSession = mongoose.model<ICheckoutSession>("CheckoutSession", CheckoutSessionSchema);
