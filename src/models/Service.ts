import mongoose, { Schema, Document } from "mongoose";

export type ServiceKind = "SOCIAL" | "MATERIAL";
export type ServiceStatus = "ACTIVE" | "BLOCKED" | "PENDING";

export interface IService extends Document {
  slug?: string;
  title: string;
  description: string;
  kind: ServiceKind;
  category: string;
  status: ServiceStatus;
  price?: number;
  hourlyRate?: number;
  oldPrice?: number;
  salePrice?: number;
  discountPercent?: number;
  currency: string;
  location?: string;
  images: string[];
  image?: string;
  imageUrl?: string;
  coverImage?: string;
  coverImageUrl?: string;
  banner?: string;
  cardImageUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
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

const ServiceSchema = new Schema<IService>(
  {
    title: { type: String, required: true },
    slug: { type: String, trim: true, lowercase: true, index: true },
    description: { type: String },
    kind: { type: String, enum: ["SOCIAL", "MATERIAL"], required: true },
    category: { type: String, required: true },
    status: { type: String, enum: ["ACTIVE", "BLOCKED", "PENDING"], default: "PENDING", index: true },
    price: { type: Number },
    hourlyRate: { type: Number },
    oldPrice: { type: Number },
    salePrice: { type: Number },
    discountPercent: { type: Number },
    currency: { type: String, default: "USD" },
    location: { type: String },
    images: { type: [String], default: [] },
    image: { type: String },
    imageUrl: { type: String },
    coverImage: { type: String },
    coverImageUrl: { type: String },
    banner: { type: String },
    cardImageUrl: { type: String },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
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

ServiceSchema.index({ slug: 1 }, { unique: true, sparse: true });

export const Service = mongoose.model<IService>("Service", ServiceSchema);
