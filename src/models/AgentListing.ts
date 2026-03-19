import mongoose, { Document, Schema } from "mongoose";

export type AgentListingStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

export interface AgentListingMedia {
  id?: string;
  url: string;
}

export interface IAgentListing extends Document {
  ownerId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category?: string;
  type?: string;
  price?: number;
  currency?: string;
  location?: string;
  tags: string[];
  images: AgentListingMedia[];
  status: AgentListingStatus;
  isDeleted: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<AgentListingMedia>(
  {
    id: { type: String, trim: true },
    url: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const AgentListingSchema = new Schema<IAgentListing>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true },
    type: { type: String, trim: true },
    price: { type: Number },
    currency: { type: String, trim: true, default: "USD" },
    location: { type: String, trim: true },
    tags: { type: [String], default: [] },
    images: { type: [mediaSchema], default: [] },
    status: { type: String, enum: ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"], default: "DRAFT" },
    isDeleted: { type: Boolean, default: false },
    publishedAt: { type: Date }
  },
  { timestamps: true }
);

AgentListingSchema.index({ ownerId: 1, status: 1, updatedAt: -1 });

export const AgentListing = mongoose.model<IAgentListing>("AgentListing", AgentListingSchema);
