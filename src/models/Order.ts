import mongoose, { Document, Schema } from "mongoose";
import {
  MARKETPLACE_DISPUTE_STATE_VALUES,
  MARKETPLACE_FULFILLMENT_STATE_VALUES,
  MARKETPLACE_LIFECYCLE_STATE_VALUES,
  MARKETPLACE_PAYMENT_STATE_VALUES,
  MARKETPLACE_SETTLEMENT_STATE_VALUES,
  PAYMENT_COLLECTION_STATUS_VALUES,
  PAYMENT_METHOD_CODE_VALUES,
  PAYMENT_WORKFLOW_STATUS_VALUES,
  SETTLEMENT_CATEGORY_VALUES,
  STATE_TIMELINE_ACTOR_VALUES,
  STATE_TIMELINE_GROUP_VALUES,
  type MarketplaceDisputeState,
  type MarketplaceFulfillmentState,
  type MarketplaceLifecycleState,
  type MarketplacePaymentState,
  type MarketplaceSettlementState,
  type PaymentCollectionStatus,
  type PaymentMethodCode,
  type PaymentWorkflowStatus,
  type SettlementCategory
} from "../types/paymentDomain";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED"
  | "REFUNDED";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  sellerId?: mongoose.Types.ObjectId;
  qty: number;
  unitPrice: number;
  titleSnapshot: string;
  imageSnapshot?: string;
  categoryKey?: SettlementCategory;
  settlementBucketKey?: string;
}

export interface IShippingAddress {
  name: string;
  phone: string;
  address1: string;
  address2?: string;
  postalCode?: string;
}

export interface IOrderPayment {
  method: string;
  provider?: string;
  transactionId?: string;
  paidAt?: Date;
}

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  agentId?: mongoose.Types.ObjectId;
  kind: "PRODUCT" | "SERVICE";
  status: OrderStatus;
  lifecycleState: MarketplaceLifecycleState;
  paymentState: MarketplacePaymentState;
  fulfillmentState: MarketplaceFulfillmentState;
  settlementState: MarketplaceSettlementState;
  disputeState: MarketplaceDisputeState;
  paymentWorkflowStatus: PaymentWorkflowStatus;
  paymentCollectionStatus: PaymentCollectionStatus;
  paymentCollectionMethod?: PaymentMethodCode | null;
  statusLabelCache?: string | null;
  settlementCategory: SettlementCategory;
  settlementBucketKey: string;
  source: "CART" | "BUY_NOW";
  items: IOrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  currency: string;
  deliveryOption?: string;
  shippingAddress: IShippingAddress;
  payment: IOrderPayment;
  paymentIntentId?: mongoose.Types.ObjectId | null;
  paymentId?: mongoose.Types.ObjectId | null;
  paymentCollectionExpiresAt?: Date | null;
  paymentReferenceCode?: string | null;
  disputeReason?: string;
  refundReason?: string;
  bookingAt?: Date;
  buyerReviewEndsAt?: Date | null;
  releaseScheduledAt?: Date | null;
  deliveredAt?: Date | null;
  completedAt?: Date | null;
  trustMessage?: string;
  fulfillmentProofs?: Array<{ type: string; note?: string; url?: string; createdAt: Date }>;
  stateTimeline?: Array<{
    group: string;
    from?: string | null;
    to: string;
    actorType: string;
    actorId?: mongoose.Types.ObjectId | string | null;
    note?: string | null;
    createdAt: Date;
  }>;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User" },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    titleSnapshot: { type: String, required: true, trim: true },
    imageSnapshot: { type: String, trim: true },
    categoryKey: { type: String, enum: [...SETTLEMENT_CATEGORY_VALUES], default: "shopping" },
    settlementBucketKey: { type: String, trim: true, default: "shopping_held" }
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address1: { type: String, required: true, trim: true },
    address2: { type: String, trim: true },
    postalCode: { type: String, trim: true }
  },
  { _id: false }
);

const PaymentSchema = new Schema<IOrderPayment>(
  {
    method: { type: String, required: true, trim: true },
    provider: { type: String, trim: true },
    transactionId: { type: String, trim: true },
    paidAt: { type: Date }
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    kind: { type: String, enum: ["PRODUCT", "SERVICE"], default: "PRODUCT", index: true },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "PAID", "PROCESSING", "CONFIRMED", "COMPLETED", "CANCELLED", "DISPUTED", "REFUNDED"],
      default: "PENDING_PAYMENT",
      index: true
    },
    lifecycleState: { type: String, enum: [...MARKETPLACE_LIFECYCLE_STATE_VALUES], default: "awaiting_payment", index: true },
    paymentState: { type: String, enum: [...MARKETPLACE_PAYMENT_STATE_VALUES], default: "awaiting_payment", index: true },
    fulfillmentState: { type: String, enum: [...MARKETPLACE_FULFILLMENT_STATE_VALUES], default: "pending", index: true },
    settlementState: { type: String, enum: [...MARKETPLACE_SETTLEMENT_STATE_VALUES], default: "none", index: true },
    disputeState: { type: String, enum: [...MARKETPLACE_DISPUTE_STATE_VALUES], default: "none", index: true },
    paymentWorkflowStatus: {
      type: String,
      enum: [...PAYMENT_WORKFLOW_STATUS_VALUES],
      default: "INITIATED",
      index: true
    },
    paymentCollectionStatus: {
      type: String,
      enum: [...PAYMENT_COLLECTION_STATUS_VALUES],
      default: "DRAFT",
      index: true
    },
    paymentCollectionMethod: { type: String, enum: [...PAYMENT_METHOD_CODE_VALUES], default: null, index: true },
    statusLabelCache: { type: String, default: null, trim: true },
    settlementCategory: { type: String, enum: [...SETTLEMENT_CATEGORY_VALUES], default: "shopping", index: true },
    settlementBucketKey: { type: String, default: "shopping_held", trim: true, index: true },
    source: { type: String, enum: ["CART", "BUY_NOW"], required: true },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    deliveryOption: { type: String, trim: true, default: "standard" },
    shippingAddress: { type: ShippingAddressSchema, required: true },
    payment: { type: PaymentSchema, required: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", default: null, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    paymentCollectionExpiresAt: { type: Date, default: null },
    paymentReferenceCode: { type: String, default: null, trim: true, index: true },
    disputeReason: { type: String },
    refundReason: { type: String },
    bookingAt: { type: Date },
    buyerReviewEndsAt: { type: Date, default: null },
    releaseScheduledAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    trustMessage: { type: String, default: "Funds are held securely until delivery or completion is confirmed." },
    fulfillmentProofs: {
      type: [
        new Schema(
          {
            type: { type: String, required: true, trim: true },
            note: { type: String, trim: true },
            url: { type: String, trim: true },
            createdAt: { type: Date, default: Date.now }
          },
          { _id: false }
        )
      ],
      default: []
    },
    stateTimeline: {
      type: [
        new Schema(
          {
            group: { type: String, enum: [...STATE_TIMELINE_GROUP_VALUES], required: true },
            from: { type: String, default: null },
            to: { type: String, required: true },
            actorType: { type: String, enum: [...STATE_TIMELINE_ACTOR_VALUES], required: true },
            actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
            note: { type: String, default: null },
            createdAt: { type: Date, default: Date.now }
          },
          { _id: false }
        )
      ],
      default: []
    },
    note: { type: String }
  },
  { timestamps: true }
);

OrderSchema.index({ userId: 1, createdAt: -1 });

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
