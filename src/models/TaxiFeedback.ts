import mongoose, { Schema, Document } from "mongoose";

export type TaxiFeedbackType = "thanks" | "complaint";

export interface ITaxiFeedback extends Document {
  listingId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  type: TaxiFeedbackType;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaxiFeedbackSchema = new Schema<ITaxiFeedback>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "TaxiListing", required: true },
    agentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["thanks", "complaint"], required: true },
    message: { type: String }
  },
  { timestamps: true }
);

TaxiFeedbackSchema.index({ listingId: 1, createdAt: -1 });
TaxiFeedbackSchema.index({ agentId: 1, createdAt: -1 });

export const TaxiFeedback = mongoose.model<ITaxiFeedback>("TaxiFeedback", TaxiFeedbackSchema);
