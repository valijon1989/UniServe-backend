import mongoose, { Schema, Document } from "mongoose";

export type TaxiOrderStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";

export interface ITaxiOrder extends Document {
  listingId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  pickup: {
    address: string;
    lat?: number;
    lng?: number;
  };
  dropoff: {
    address: string;
    lat?: number;
    lng?: number;
  };
  rideTime?: Date | string;
  note?: string;
  pricingType: "negotiation";
  agreedPrice?: number;
  status: TaxiOrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema(
  {
    address: { type: String, required: true },
    lat: { type: Number },
    lng: { type: Number }
  },
  { _id: false }
);

const TaxiOrderSchema = new Schema<ITaxiOrder>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "TaxiListing", required: true },
    agentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pickup: { type: LocationSchema, required: true },
    dropoff: { type: LocationSchema, required: true },
    rideTime: { type: Schema.Types.Mixed },
    note: { type: String },
    pricingType: { type: String, enum: ["negotiation"], default: "negotiation" },
    agreedPrice: { type: Number },
    status: { type: String, enum: ["pending", "accepted", "rejected", "cancelled", "completed"], default: "pending" }
  },
  { timestamps: true }
);

TaxiOrderSchema.index({ customerId: 1, createdAt: -1 });
TaxiOrderSchema.index({ agentId: 1, createdAt: -1 });

export const TaxiOrder = mongoose.model<ITaxiOrder>("TaxiOrder", TaxiOrderSchema);
