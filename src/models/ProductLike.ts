import mongoose, { Document, Schema } from "mongoose";

export interface IProductLike extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductLikeSchema = new Schema<IProductLike>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

ProductLikeSchema.index({ productId: 1, userId: 1 }, { unique: true });

export const ProductLike = mongoose.model<IProductLike>("ProductLike", ProductLikeSchema);
