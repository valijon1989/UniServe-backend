import mongoose, { Document, Schema } from "mongoose";

export interface IOrderItemRecord extends Document {
  orderId: mongoose.Types.ObjectId;
  sourceModel: "Order" | "ServiceOrder";
  itemType: "PRODUCT" | "SERVICE" | "COURSE" | "SESSION" | "BOOKING";
  targetType: string;
  targetId?: mongoose.Types.ObjectId | null;
  sellerOrAgentUserId?: mongoose.Types.ObjectId | null;
  titleSnapshot: string;
  categorySnapshot?: string | null;
  subcategorySnapshot?: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  currency: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemRecordSchema = new Schema<IOrderItemRecord>(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, index: true, refPath: "sourceModel" },
    sourceModel: { type: String, enum: ["Order", "ServiceOrder"], default: "Order", index: true },
    itemType: { type: String, enum: ["PRODUCT", "SERVICE", "COURSE", "SESSION", "BOOKING"], required: true, index: true },
    targetType: { type: String, required: true, trim: true, index: true },
    targetId: { type: Schema.Types.ObjectId, default: null, index: true },
    sellerOrAgentUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    titleSnapshot: { type: String, required: true, trim: true },
    categorySnapshot: { type: String, trim: true, default: null, index: true },
    subcategorySnapshot: { type: String, trim: true, default: null, index: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", trim: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true, collection: "order_items" }
);

OrderItemRecordSchema.index({ orderId: 1, sourceModel: 1, createdAt: 1 });

export const OrderItemRecord = mongoose.model<IOrderItemRecord>("OrderItemRecord", OrderItemRecordSchema);
