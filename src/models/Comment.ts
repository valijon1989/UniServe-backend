import mongoose, { Document, Schema } from "mongoose";

export interface IComment extends Document {
  postId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 }
  },
  { timestamps: true }
);

CommentSchema.index({ postId: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>("Comment", CommentSchema);
