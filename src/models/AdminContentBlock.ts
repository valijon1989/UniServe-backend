import mongoose, { Document, Schema } from "mongoose";

export interface IAdminContentBlock extends Document {
  key: string;
  title: string;
  kind: "banner" | "homepage_section" | "featured_content" | "announcement" | "static_page";
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  audience?: string;
  priority: number;
  payload: Record<string, unknown>;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AdminContentBlockSchema = new Schema<IAdminContentBlock>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ["banner", "homepage_section", "featured_content", "announcement", "static_page"],
      required: true,
      index: true
    },
    status: { type: String, enum: ["ACTIVE", "DRAFT", "ARCHIVED"], default: "DRAFT", index: true },
    audience: { type: String, trim: true },
    priority: { type: Number, default: 0 },
    payload: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

AdminContentBlockSchema.index({ kind: 1, status: 1, priority: -1 });

export const AdminContentBlock = mongoose.model<IAdminContentBlock>("AdminContentBlock", AdminContentBlockSchema);
