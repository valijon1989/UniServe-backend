import mongoose, { Schema, Document } from "mongoose";

export type TaxiListingStatus = "active" | "paused";

export interface ITaxiListing extends Document {
  agentId: mongoose.Types.ObjectId;
  title?: string;
  city?: string;
  serviceArea?: string;
  carType?: string;
  vehicleModel?: string;
  options?: string[];
  plateNumber?: string;
  interiorImages?: string[];
  exteriorImages?: string[];
  capacity?: number;
  pricePerHour?: number;
  currency?: string;
  rating?: number;
  ratingCount?: number;
  usedCount?: number;
  passengersMax?: number;
  priceNote?: string;
  availableHours?: string;
  languages?: string[];
  phoneOrKakao?: string;
  description?: string;
  images?: string[];
  status: TaxiListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TaxiListingSchema = new Schema<ITaxiListing>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String },
    city: { type: String },
    serviceArea: { type: String },
    carType: { type: String },
    vehicleModel: { type: String },
    options: [{ type: String }],
    plateNumber: { type: String },
    interiorImages: [{ type: String }],
    exteriorImages: [{ type: String }],
    capacity: { type: Number },
    pricePerHour: { type: Number },
    currency: { type: String, default: "UZS" },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 },
    passengersMax: { type: Number },
    priceNote: { type: String },
    availableHours: { type: String },
    languages: [{ type: String }],
    phoneOrKakao: { type: String },
    description: { type: String },
    images: [{ type: String }],
    status: { type: String, enum: ["active", "paused"], default: "active" }
  },
  { timestamps: true }
);

TaxiListingSchema.index({ city: 1, status: 1, createdAt: -1 });

export const TaxiListing = mongoose.model<ITaxiListing>("TaxiListing", TaxiListingSchema);
