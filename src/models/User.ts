import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "USER" | "AGENT" | "ADMIN";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  username: string;
  role: UserRole;
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
    name: { type: String, required: true },
    username: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["USER", "AGENT", "ADMIN"], default: "USER" },
    isVerified: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    avatarUrl: { type: String },
    bio: { type: String },
    region: { type: String },
    followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

UserSchema.index({ username: 1 }, { unique: true });

export const User = mongoose.model<IUser>("User", UserSchema);
