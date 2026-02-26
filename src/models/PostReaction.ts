import mongoose, { Document, Schema } from "mongoose";

export type ReactionValue = "like" | "dislike";

export interface IPostReaction extends Document {
  postId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  value: ReactionValue;
  createdAt: Date;
  updatedAt: Date;
}

const PostReactionSchema = new Schema<IPostReaction>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    value: { type: String, enum: ["like", "dislike"], required: true }
  },
  { timestamps: true }
);

PostReactionSchema.index({ postId: 1, userId: 1 }, { unique: true });
PostReactionSchema.index({ postId: 1, value: 1 });

export const PostReaction = mongoose.model<IPostReaction>("PostReaction", PostReactionSchema);
