import mongoose, { Document, Schema } from "mongoose";

export interface IOrderFulfillmentDetail extends Document {
  orderId: mongoose.Types.ObjectId;
  sourceModel: "Order" | "ServiceOrder";
  fulfillmentMode:
    | "SHIPPING"
    | "PICKUP"
    | "ONLINE_SERVICE"
    | "OFFLINE_SERVICE"
    | "COURSE_ACCESS"
    | "SESSION_BOOKING";
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  deliveryType?: string | null;
  buyerNote?: string | null;
  serviceNote?: string | null;
  expectedCompletionAt?: Date | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderFulfillmentDetailSchema = new Schema<IOrderFulfillmentDetail>(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, index: true, refPath: "sourceModel" },
    sourceModel: { type: String, enum: ["Order", "ServiceOrder"], default: "Order", index: true },
    fulfillmentMode: {
      type: String,
      enum: ["SHIPPING", "PICKUP", "ONLINE_SERVICE", "OFFLINE_SERVICE", "COURSE_ACCESS", "SESSION_BOOKING"],
      required: true,
      index: true
    },
    scheduledDate: { type: String, trim: true, default: null },
    scheduledTime: { type: String, trim: true, default: null },
    deliveryType: { type: String, trim: true, default: null },
    buyerNote: { type: String, trim: true, default: null },
    serviceNote: { type: String, trim: true, default: null },
    expectedCompletionAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true, collection: "order_fulfillment_details" }
);

OrderFulfillmentDetailSchema.index({ orderId: 1, sourceModel: 1 }, { unique: true });

export const OrderFulfillmentDetail = mongoose.model<IOrderFulfillmentDetail>(
  "OrderFulfillmentDetail",
  OrderFulfillmentDetailSchema
);
