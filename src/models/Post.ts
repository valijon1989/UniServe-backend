import mongoose, { Schema, Document } from "mongoose";

export interface IPostMedia {
  url: string;
  type: "image" | "video";
  width?: number;
  height?: number;
  duration?: number;
}

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
  authorId?: mongoose.Types.ObjectId;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  text?: string;
  media: IPostMedia[];
  images: string[];
  videoUrl?: string;
  category: string;
  type: string;
  linkUrl?: string;
  location?: string;
  language?: string;
  sourceUrl?: string;
  attachments: { type: string; url: string; name?: string }[];
  isFeatured: boolean;
  isActive: boolean;
  status: "active" | "blocked" | "pending";
  views: number;
  likes: mongoose.Types.ObjectId[];
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  shareCount: number;
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
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    title: { type: String, default: "" },
    slug: { type: String, unique: true, sparse: true },
    excerpt: { type: String, default: "" },
    content: { type: String, default: "" },
    text: { type: String, default: "" },
    media: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "video"], required: true },
        width: { type: Number },
        height: { type: Number },
        duration: { type: Number }
      }
    ],
    images: [{ type: String }],
    videoUrl: { type: String },
    category: { type: String, default: "social" },
    type: { type: String, default: "social" },
    linkUrl: { type: String },
    location: { type: String },
    language: { type: String, default: "Uzbek" },
    sourceUrl: { type: String },
    communityGroup: { type: Schema.Types.ObjectId, ref: "CommunityGroup" },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ["active", "blocked", "pending"], default: "active" },
    views: { type: Number, default: 0 },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    likeCount: { type: Number, default: 0 },
    dislikeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    shareCount: { type: Number, default: 0 },
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
PostSchema.index({ type: 1, createdAt: 1 });

PostSchema.pre("validate", function (next) {
  if (!this.authorId && this.author) {
    this.authorId = this.author;
  }
  if (!this.author && this.authorId) {
    this.author = this.authorId;
  }
  next();
});

export const Post = mongoose.model<IPost>("Post", PostSchema);
