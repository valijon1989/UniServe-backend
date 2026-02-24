import mongoose, { Schema, Document } from "mongoose";

export type ProductStatus = "ACTIVE" | "SOLD" | "BLOCKED";

export interface IProduct extends Document {
  slug?: string;
  title: string;
  description: string;
  price: number;
  oldPrice?: number;
  salePrice?: number;
  discountPercent?: number;
  currency: string;
  images: string[];
  image?: string;
  imageUrl?: string;
  thumbnail?: string;
  coverImage?: string;
  coverImageUrl?: string;
  cardImageUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
  category: string;
  status: ProductStatus;
  likes?: number;
  views?: number;
  orders?: number;
  likes_7d?: number;
  views_7d?: number;
  orders_7d?: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    title: { type: String, required: true },
    slug: { type: String, trim: true, lowercase: true, index: true },
    description: { type: String },
    price: { type: Number, required: true },
    oldPrice: { type: Number },
    salePrice: { type: Number },
    discountPercent: { type: Number },
    currency: { type: String, default: "USD" },
    images: [{ type: String }],
    image: { type: String },
    imageUrl: { type: String },
    thumbnail: { type: String },
    coverImage: { type: String },
    coverImageUrl: { type: String },
    cardImageUrl: { type: String },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    category: { type: String },
    status: { type: String, enum: ["ACTIVE", "SOLD", "BLOCKED"], default: "ACTIVE" },
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    likes_7d: { type: Number, default: 0 },
    views_7d: { type: Number, default: 0 },
    orders_7d: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

ProductSchema.index({ slug: 1 }, { unique: true, sparse: true });

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
