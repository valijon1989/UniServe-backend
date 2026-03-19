import mongoose, { Document, Schema } from "mongoose";

export interface IProductView extends Document {
  productId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  anonId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProductViewSchema = new Schema<IProductView>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    anonId: { type: String, trim: true }
  },
  { timestamps: true }
);

ProductViewSchema.index(
  { productId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true } } }
);
ProductViewSchema.index(
  { productId: 1, anonId: 1 },
  { unique: true, partialFilterExpression: { anonId: { $exists: true } } }
);
ProductViewSchema.index({ productId: 1, createdAt: -1 });

export const ProductView = mongoose.model<IProductView>("ProductView", ProductViewSchema);
