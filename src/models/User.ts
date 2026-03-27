import mongoose, { Schema, Document } from "mongoose";
import {
  ADMIN_DEPARTMENT_VALUES,
  ADMIN_LEVELS,
  ADMIN_MFA_METHODS,
  ADMIN_PERMISSION_KEYS,
  ADMIN_SCOPE_MODULES,
  type AdminDepartment,
  type AdminLevel,
  type AdminMfaMethod,
  type AdminPermissionKey,
  type AdminScope,
  type AdminScopeModule
} from "../services/adminBlueprint";

export type UserRole = "USER" | "AGENT" | "ADMIN";
export type AdminAccessStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "REVOKED";
export type { AdminLevel, AdminMfaMethod, AdminDepartment, AdminScopeModule, AdminScope };

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  resetPasswordTokenHash?: string;
  resetPasswordExpiresAt?: Date;
  name: string;
  username: string;
  displayName?: string;
  role: UserRole;
  isAdmin: boolean;
  adminAccessStatus?: AdminAccessStatus;
  adminLevel?: AdminLevel;
  adminApprovedBy?: mongoose.Types.ObjectId | null;
  adminApprovedAt?: Date | null;
  department?: AdminDepartment | null;
  position?: string | null;
  departmentId?: mongoose.Types.ObjectId | null;
  positionId?: mongoose.Types.ObjectId | null;
  adminScopes: AdminScope[];
  adminAssignedPermissions: AdminPermissionKey[];
  tokenVersion: number;
  isVerified: boolean;
  isPrivate: boolean;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  location?: string;
  languages: string[];
  region?: string;
  accountStatus: "ACTIVE" | "WARNED" | "RESTRICTED" | "SUSPENDED" | "BANNED";
  warningCount: number;
  reportCount: number;
  restrictionReason?: string | null;
  restrictedUntil?: Date | null;
  internalNotes?: string | null;
  lastAdminActionAt?: Date | null;
  mfaEnabled: boolean;
  mfaMethods: AdminMfaMethod[];
  mfaTotpSecret?: string;
  mfaPendingSecret?: string;
  mfaRecoveryCodeHashes?: string[];
  mfaEmailOtpHash?: string;
  mfaEmailOtpExpiresAt?: Date;
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const AdminScopeSchema = new Schema<AdminScope>(
  {
    module: {
      type: String,
      enum: [...ADMIN_SCOPE_MODULES],
      required: true,
      trim: true
    },
    region: { type: String, trim: true },
    countryCode: { type: String, trim: true, uppercase: true },
    categoryId: { type: String, trim: true },
    subcategoryId: { type: String, trim: true }
  },
  { _id: false }
);

const isValidAdminDepartment = (value: unknown) => {
  if (value === null || value === undefined || value === "") return true;
  return ADMIN_DEPARTMENT_VALUES.includes(String(value) as AdminDepartment);
};

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    resetPasswordTokenHash: { type: String },
    resetPasswordExpiresAt: { type: Date },
    name: { type: String, required: true },
    username: { type: String, required: true, lowercase: true, trim: true },
    displayName: { type: String, trim: true },
    role: { type: String, enum: ["USER", "AGENT", "ADMIN"], default: "USER" },
    isAdmin: { type: Boolean, default: false },
    adminAccessStatus: { type: String, enum: ["PENDING", "APPROVED", "SUSPENDED", "REVOKED"] },
    adminLevel: { type: String, enum: [...ADMIN_LEVELS] },
    adminApprovedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    adminApprovedAt: { type: Date, default: null },
    department: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: isValidAdminDepartment,
        message: (props: { value: unknown }) => `\`${String(props.value)}\` is not a valid admin department.`
      }
    },
    position: { type: String, trim: true, default: null },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    positionId: { type: Schema.Types.ObjectId, ref: "Position", default: null },
    adminScopes: { type: [AdminScopeSchema], default: [] },
    adminAssignedPermissions: { type: [{ type: String, enum: [...ADMIN_PERMISSION_KEYS], trim: true }], default: [] },
    tokenVersion: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    avatarUrl: { type: String, default: "" },
    bio: { type: String },
    phone: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    languages: { type: [String], default: [] },
    region: { type: String },
    accountStatus: {
      type: String,
      enum: ["ACTIVE", "WARNED", "RESTRICTED", "SUSPENDED", "BANNED"],
      default: "ACTIVE",
      index: true
    },
    warningCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    restrictionReason: { type: String, default: null },
    restrictedUntil: { type: Date, default: null },
    internalNotes: { type: String, default: null },
    lastAdminActionAt: { type: Date, default: null },
    mfaEnabled: { type: Boolean, default: false },
    mfaMethods: { type: [String], enum: [...ADMIN_MFA_METHODS], default: [] },
    mfaTotpSecret: { type: String },
    mfaPendingSecret: { type: String },
    mfaRecoveryCodeHashes: { type: [String], default: [] },
    mfaEmailOtpHash: { type: String },
    mfaEmailOtpExpiresAt: { type: Date },
    followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ adminLevel: 1 }, { unique: true, partialFilterExpression: { adminLevel: "PRIMARY" } });

export const User = mongoose.model<IUser>("User", UserSchema);
