import mongoose, { Schema, Document } from "mongoose";

export type ProductStatus = "ACTIVE" | "SOLD" | "BLOCKED";

export interface IProduct extends Document {
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  category: string;
  status: ProductStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    images: [{ type: String }],
    category: { type: String },
    status: { type: String, enum: ["ACTIVE", "SOLD", "BLOCKED"], default: "ACTIVE" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
