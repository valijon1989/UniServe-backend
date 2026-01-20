import mongoose, { Schema, Document } from "mongoose";

export type ConstructionCategory = "interior" | "exterior";

export interface IConstructionListing extends Document {
  agentId: mongoose.Types.ObjectId;
  title: string;
  category: ConstructionCategory;
  subcategory: string;
  description: string;
  location?: string;
  priceFrom?: number;
  priceTo?: number;
  currency?: string;
  images?: string[];
  status?: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const ConstructionListingSchema = new Schema<IConstructionListing>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    category: { type: String, enum: ["interior", "exterior"], required: true },
    subcategory: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String },
    priceFrom: { type: Number },
    priceTo: { type: Number },
    currency: { type: String, default: "UZS" },
    images: [{ type: String }],
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

ConstructionListingSchema.index({ agentId: 1, createdAt: -1 });
ConstructionListingSchema.index({ category: 1, subcategory: 1, status: 1 });

export const ConstructionListing = mongoose.model<IConstructionListing>(
  "ConstructionListing",
  ConstructionListingSchema
);
