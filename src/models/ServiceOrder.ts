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

export type ServiceOrderStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED";

export interface IServiceOrder extends Document {
  serviceId: mongoose.Types.ObjectId;
  serviceIdentifier: string;
  serviceTitle: string;
  agentId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  destinationAddress?: string;
  note?: string;
  status: ServiceOrderStatus;
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
  paymentIntentId?: mongoose.Types.ObjectId | null;
  paymentId?: mongoose.Types.ObjectId | null;
  paymentCollectionExpiresAt?: Date | null;
  paymentReferenceCode?: string | null;
  buyerReviewEndsAt?: Date | null;
  releaseScheduledAt?: Date | null;
  completedAt?: Date | null;
  trustMessage?: string;
  completionProofs?: Array<{ type: string; note?: string; url?: string; createdAt: Date }>;
  stateTimeline?: Array<{
    group: string;
    from?: string | null;
    to: string;
    actorType: string;
    actorId?: mongoose.Types.ObjectId | string | null;
    note?: string | null;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceOrderSchema = new Schema<IServiceOrder>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true, index: true },
    serviceIdentifier: { type: String, required: true, trim: true },
    serviceTitle: { type: String, required: true, trim: true },
    agentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerAddress: { type: String, required: true, trim: true },
    destinationAddress: { type: String, trim: true },
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED"],
      default: "PENDING",
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
    settlementCategory: { type: String, enum: [...SETTLEMENT_CATEGORY_VALUES], default: "services", index: true },
    settlementBucketKey: { type: String, default: "services_held", trim: true, index: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", default: null, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    paymentCollectionExpiresAt: { type: Date, default: null },
    paymentReferenceCode: { type: String, default: null, trim: true, index: true },
    buyerReviewEndsAt: { type: Date, default: null },
    releaseScheduledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    trustMessage: { type: String, default: "Funds are held securely until completion is confirmed." },
    completionProofs: {
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
    }
  },
  { timestamps: true }
);

ServiceOrderSchema.index({ customerId: 1, createdAt: -1 });
ServiceOrderSchema.index({ agentId: 1, createdAt: -1 });

export const ServiceOrder = mongoose.model<IServiceOrder>("ServiceOrder", ServiceOrderSchema);
