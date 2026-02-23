import mongoose, { Schema, Document } from "mongoose";

export interface IComment {
  user: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  isAgent?: boolean;
  isVerifiedAgent?: boolean;
  isBestAnswer?: boolean;
  _id?: mongoose.Types.ObjectId;
}

export interface IPost extends Document {
  author: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  text?: string;
  images: string[];
  videoUrl?: string;
  category: string;
  type: string;
  location?: string;
  language?: string;
  sourceUrl?: string;
  attachments: { type: string; url: string; name?: string }[];
  isFeatured: boolean;
  isActive: boolean;
  status: "active" | "blocked" | "pending";
  views: number;
  likes: mongoose.Types.ObjectId[];
  reports: number;
  bestAnswerId?: mongoose.Types.ObjectId;
  comments: IComment[];
  communityGroup?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    isAgent: { type: Boolean, default: false },
    isVerifiedAgent: { type: Boolean, default: false },
    isBestAnswer: { type: Boolean, default: false }
  },
  { _id: true }
);

const PostSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, default: "" },
    content: { type: String, default: "" },
    text: { type: String, default: "" },
    images: [{ type: String }],
    videoUrl: { type: String },
    category: { type: String, default: "community" },
    type: { type: String, default: "question" },
    location: { type: String },
    language: { type: String, default: "Uzbek" },
    sourceUrl: { type: String },
    communityGroup: { type: Schema.Types.ObjectId, ref: "CommunityGroup" },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "blocked", "pending"], default: "active" },
    views: { type: Number, default: 0 },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    reports: { type: Number, default: 0 },
    bestAnswerId: { type: Schema.Types.ObjectId },
    comments: [CommentSchema],
    attachments: [
      {
        type: { type: String },
        url: { type: String },
        name: { type: String }
      }
    ]
  },
  { timestamps: true }
);

PostSchema.index({ slug: 1 });
PostSchema.index({ category: 1, type: 1, isFeatured: 1 });

export const Post = mongoose.model<IPost>("Post", PostSchema);
