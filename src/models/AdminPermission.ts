import mongoose, { Document, Schema } from "mongoose";

export interface IAdminPermission extends Document {
  key: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminPermissionSchema = new Schema<IAdminPermission>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true }
  },
  { timestamps: true }
);

export const AdminPermission = mongoose.model<IAdminPermission>("AdminPermission", AdminPermissionSchema);
