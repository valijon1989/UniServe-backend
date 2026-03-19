import mongoose, { Document, Schema } from "mongoose";

export interface IBuyerConfirmation extends Document {
  orderId: mongoose.Types.ObjectId;
  sourceModel: "Order" | "ServiceOrder";
  buyerUserId: mongoose.Types.ObjectId;
  confirmationType: "ACCEPTED" | "REJECTED" | "PARTIAL_ACCEPTANCE";
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const BuyerConfirmationSchema = new Schema<IBuyerConfirmation>(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, index: true, refPath: "sourceModel" },
    sourceModel: { type: String, enum: ["Order", "ServiceOrder"], default: "Order", index: true },
    buyerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    confirmationType: { type: String, enum: ["ACCEPTED", "REJECTED", "PARTIAL_ACCEPTANCE"], required: true, index: true },
    notes: { type: String, trim: true, default: null }
  },
  { timestamps: true, collection: "buyer_confirmations" }
);

BuyerConfirmationSchema.index({ orderId: 1, sourceModel: 1, createdAt: -1 });

export const BuyerConfirmation = mongoose.model<IBuyerConfirmation>("BuyerConfirmation", BuyerConfirmationSchema);
