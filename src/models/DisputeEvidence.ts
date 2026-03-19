import mongoose, { Document, Schema } from "mongoose";

export interface IDisputeEvidenceRecord extends Document {
  disputeId: mongoose.Types.ObjectId;
  uploadedByUserId: mongoose.Types.ObjectId;
  evidenceType: "IMAGE" | "DOCUMENT" | "VIDEO" | "CHAT_REFERENCE" | "TRACKING_PROOF" | "SERVICE_OUTPUT" | "RECEIPT" | "TEXT" | "LINK";
  fileUrl?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const DisputeEvidenceRecordSchema = new Schema<IDisputeEvidenceRecord>(
  {
    disputeId: { type: Schema.Types.ObjectId, ref: "Dispute", required: true, index: true },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    evidenceType: {
      type: String,
      enum: ["IMAGE", "DOCUMENT", "VIDEO", "CHAT_REFERENCE", "TRACKING_PROOF", "SERVICE_OUTPUT", "RECEIPT", "TEXT", "LINK"],
      required: true,
      index: true
    },
    fileUrl: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true, collection: "dispute_evidence" }
);

export const DisputeEvidenceRecord = mongoose.model<IDisputeEvidenceRecord>(
  "DisputeEvidenceRecord",
  DisputeEvidenceRecordSchema
);
