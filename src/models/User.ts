import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "USER" | "AGENT" | "ADMIN";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  resetPasswordTokenHash?: string;
  resetPasswordExpiresAt?: Date;
  name: string;
  username: string;
  displayName?: string;
  role: UserRole;
  tokenVersion: number;
  isVerified: boolean;
  isPrivate: boolean;
  avatarUrl?: string;
  bio?: string;
  region?: string;
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

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
    tokenVersion: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    avatarUrl: { type: String, default: "" },
    bio: { type: String },
    region: { type: String },
    followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

UserSchema.index({ username: 1 }, { unique: true });

export const User = mongoose.model<IUser>("User", UserSchema);
