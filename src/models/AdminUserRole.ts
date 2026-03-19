import mongoose, { Document, Schema } from "mongoose";

export interface IAdminUserRole extends Document {
  userId: mongoose.Types.ObjectId;
  roleId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserRoleSchema = new Schema<IAdminUserRole>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roleId: { type: Schema.Types.ObjectId, ref: "AdminRole", required: true }
  },
  { timestamps: true }
);

AdminUserRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });

export const AdminUserRole = mongoose.model<IAdminUserRole>("AdminUserRole", AdminUserRoleSchema);
