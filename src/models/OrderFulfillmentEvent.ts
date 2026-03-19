import mongoose, { Document, Schema } from "mongoose";

export interface IOrderFulfillmentEvent extends Document {
  orderId: mongoose.Types.ObjectId;
  sourceModel: "Order" | "ServiceOrder";
  orderItemId?: mongoose.Types.ObjectId | null;
  eventType:
    | "PACKED"
    | "SHIPPED"
    | "DELIVERED"
    | "SERVICE_STARTED"
    | "SERVICE_COMPLETED"
    | "FILE_UPLOADED"
    | "SESSION_HELD"
    | "COURSE_ACCESS_GRANTED";
  actorUserId?: mongoose.Types.ObjectId | null;
  notes?: string | null;
  proofType?: string | null;
  proofUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderFulfillmentEventSchema = new Schema<IOrderFulfillmentEvent>(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, index: true, refPath: "sourceModel" },
    sourceModel: { type: String, enum: ["Order", "ServiceOrder"], default: "Order", index: true },
    orderItemId: { type: Schema.Types.ObjectId, default: null, index: true },
    eventType: {
      type: String,
      enum: ["PACKED", "SHIPPED", "DELIVERED", "SERVICE_STARTED", "SERVICE_COMPLETED", "FILE_UPLOADED", "SESSION_HELD", "COURSE_ACCESS_GRANTED"],
      required: true,
      index: true
    },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    notes: { type: String, trim: true, default: null },
    proofType: { type: String, trim: true, default: null },
    proofUrl: { type: String, trim: true, default: null },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true, collection: "order_fulfillment_events" }
);

OrderFulfillmentEventSchema.index({ orderId: 1, sourceModel: 1, createdAt: 1 });

export const OrderFulfillmentEvent = mongoose.model<IOrderFulfillmentEvent>(
  "OrderFulfillmentEvent",
  OrderFulfillmentEventSchema
);
