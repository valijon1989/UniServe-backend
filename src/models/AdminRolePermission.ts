import mongoose, { Document, Schema } from "mongoose";

export interface IAdminRolePermission extends Document {
  roleId: mongoose.Types.ObjectId;
  permissionId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AdminRolePermissionSchema = new Schema<IAdminRolePermission>(
  {
    roleId: { type: Schema.Types.ObjectId, ref: "AdminRole", required: true },
    permissionId: { type: Schema.Types.ObjectId, ref: "AdminPermission", required: true }
  },
  { timestamps: true }
);

AdminRolePermissionSchema.index({ roleId: 1, permissionId: 1 }, { unique: true });

export const AdminRolePermission = mongoose.model<IAdminRolePermission>(
  "AdminRolePermission",
  AdminRolePermissionSchema
);
