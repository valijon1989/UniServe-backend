import mongoose, { Schema, Document } from "mongoose";

export type NewsType = "article" | "tip" | "event" | "deal" | "question";
export type NewsStatus = "published" | "pending" | "blocked";

export interface INewsPost extends Document {
  author: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  location?: string;
  category: string;
  type: NewsType;
  language: "Uzbek" | "Korean" | "Russian" | "English";
  sourceUrl?: string;
  isFeatured: boolean;
  status: NewsStatus;
  views: number;
  likes: mongoose.Types.ObjectId[];
  reports: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NewsPostSchema = new Schema<INewsPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, default: "" },
    content: { type: String, default: "" },
    coverImage: { type: String },
    location: { type: String },
    category: { type: String, required: true },
    type: { type: String, enum: ["article", "tip", "event", "deal", "question"], default: "tip" },
    language: { type: String, enum: ["Uzbek", "Korean", "Russian", "English"], default: "Uzbek" },
    sourceUrl: { type: String },
    isFeatured: { type: Boolean, default: false },
    status: { type: String, enum: ["published", "pending", "blocked"], default: "pending" },
    views: { type: Number, default: 0 },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    reports: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

NewsPostSchema.index({ slug: 1 });
NewsPostSchema.index({ category: 1, language: 1, isFeatured: 1 });

export const NewsPost = mongoose.model<INewsPost>("NewsPost", NewsPostSchema);
