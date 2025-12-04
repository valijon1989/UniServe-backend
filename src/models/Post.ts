import mongoose, { Schema, Document } from "mongoose";

export interface IComment {
  user: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface IPost extends Document {
  author: mongoose.Types.ObjectId;
  content?: string;
  text?: string;
  images: string[];
  videoUrl?: string;
  category?: string;
  type?: string;
  likes: mongoose.Types.ObjectId[];
  comments: IComment[];
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const PostSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    text: { type: String, default: "" },
    images: [{ type: String }],
    videoUrl: { type: String },
    category: { type: String, default: "" },
    type: { type: String, default: "" },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: [CommentSchema]
  },
  { timestamps: true }
);

export const Post = mongoose.model<IPost>("Post", PostSchema);
