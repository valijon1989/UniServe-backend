import mongoose, { Document, Schema } from "mongoose";

export type ProductFeedbackValue = "HELPFUL" | "UNHELPFUL";

export interface IProductFeedback extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  feedback: ProductFeedbackValue;
  createdAt: Date;
  updatedAt: Date;
}

const ProductFeedbackSchema = new Schema<IProductFeedback>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    feedback: { type: String, enum: ["HELPFUL", "UNHELPFUL"], required: true }
  },
  { timestamps: true }
);

ProductFeedbackSchema.index({ productId: 1, userId: 1 }, { unique: true });

export const ProductFeedback = mongoose.model<IProductFeedback>("ProductFeedback", ProductFeedbackSchema);
