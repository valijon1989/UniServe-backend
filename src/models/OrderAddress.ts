import mongoose, { Document, Schema } from "mongoose";

export interface IOrderAddress extends Document {
  orderId: mongoose.Types.ObjectId;
  sourceModel: "Order" | "ServiceOrder";
  addressType: "SHIPPING" | "BILLING";
  country?: string | null;
  region?: string | null;
  city?: string | null;
  district?: string | null;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  postalCode?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderAddressSchema = new Schema<IOrderAddress>(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, index: true, refPath: "sourceModel" },
    sourceModel: { type: String, enum: ["Order", "ServiceOrder"], default: "Order", index: true },
    addressType: { type: String, enum: ["SHIPPING", "BILLING"], required: true, index: true },
    country: { type: String, trim: true, default: null },
    region: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },
    district: { type: String, trim: true, default: null },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: null },
    landmark: { type: String, trim: true, default: null },
    postalCode: { type: String, trim: true, default: null },
    contactName: { type: String, trim: true, default: null },
    contactPhone: { type: String, trim: true, default: null }
  },
  { timestamps: true, collection: "order_addresses" }
);

OrderAddressSchema.index({ orderId: 1, sourceModel: 1, addressType: 1 }, { unique: true });

export const OrderAddress = mongoose.model<IOrderAddress>("OrderAddress", OrderAddressSchema);
