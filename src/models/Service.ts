import mongoose, { Schema, Document } from "mongoose";

export type ServiceKind = "SOCIAL" | "MATERIAL";

export interface IService extends Document {
  title: string;
  description: string;
  kind: ServiceKind;
  category: string;
  hourlyRate?: number;
  currency: string;
  location?: string;
  likes?: number;
  views?: number;
  orders?: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    title: { type: String, required: true },
    description: { type: String },
    kind: { type: String, enum: ["SOCIAL", "MATERIAL"], required: true },
    category: { type: String, required: true },
    hourlyRate: { type: Number },
    currency: { type: String, default: "USD" },
    location: { type: String },
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const Service = mongoose.model<IService>("Service", ServiceSchema);
