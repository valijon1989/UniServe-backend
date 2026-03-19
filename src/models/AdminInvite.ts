import mongoose, { Document, Schema } from "mongoose";
import { AdminDepartment, AdminLevel, AdminScope } from "./User";
import { ADMIN_DEPARTMENT_VALUES, ADMIN_LEVELS } from "../services/adminBlueprint";

export type AdminInviteStatus = "PENDING" | "ACCEPTED" | "REVOKED";

export interface IAdminInvite extends Document {
  email?: string;
  userId?: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  status: AdminInviteStatus;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  requestedAdminLevel: AdminLevel;
  requestedDepartment?: AdminDepartment;
  requestedPosition?: string;
  requestedDepartmentId?: mongoose.Types.ObjectId | null;
  requestedPositionId?: mongoose.Types.ObjectId | null;
  requestedScopes: AdminScope[];
  createdAt: Date;
  updatedAt: Date;
}

const AdminScopeSchema = new Schema<AdminScope>(
  {
    module: { type: String, required: true, trim: true },
    categoryId: { type: String, trim: true },
    subcategoryId: { type: String, trim: true }
  },
  { _id: false }
);

const AdminInviteSchema = new Schema<IAdminInvite>(
  {
    email: { type: String, trim: true, lowercase: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "REVOKED"], default: "PENDING" },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    requestedAdminLevel: { type: String, enum: [...ADMIN_LEVELS], default: "STAFF" },
    requestedDepartment: {
      type: String,
      enum: [...ADMIN_DEPARTMENT_VALUES],
      trim: true
    },
    requestedPosition: { type: String, trim: true },
    requestedDepartmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    requestedPositionId: { type: Schema.Types.ObjectId, ref: "Position", default: null },
    requestedScopes: { type: [AdminScopeSchema], default: [] }
  },
  { timestamps: true }
);

AdminInviteSchema.index({ status: 1, expiresAt: 1 });

export const AdminInvite = mongoose.model<IAdminInvite>("AdminInvite", AdminInviteSchema);
