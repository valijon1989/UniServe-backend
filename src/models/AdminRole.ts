import mongoose, { Document, Schema } from "mongoose";

export interface IAdminRole extends Document {
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AdminRoleSchema = new Schema<IAdminRole>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    isSystem: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const AdminRole = mongoose.model<IAdminRole>("AdminRole", AdminRoleSchema);
