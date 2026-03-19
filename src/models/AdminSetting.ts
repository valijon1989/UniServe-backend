import mongoose, { Document, Schema } from "mongoose";

export interface IAdminSetting extends Document {
  key: string;
  section: string;
  value: Record<string, unknown>;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSettingSchema = new Schema<IAdminSetting>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    section: { type: String, required: true, trim: true, index: true },
    value: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

export const AdminSetting = mongoose.model<IAdminSetting>("AdminSetting", AdminSettingSchema);
