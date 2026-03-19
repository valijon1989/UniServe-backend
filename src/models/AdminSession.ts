import mongoose, { Document, Schema } from "mongoose";

export interface IAdminSession extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  deviceFingerprint?: string;
  ip?: string;
  userAgent?: string;
  lastSeenAt: Date;
  adminModeUntil: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSessionSchema = new Schema<IAdminSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: String, required: true, unique: true, trim: true },
    deviceFingerprint: { type: String, trim: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    lastSeenAt: { type: Date, default: Date.now },
    adminModeUntil: { type: Date, required: true },
    revokedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

AdminSessionSchema.index({ userId: 1, revokedAt: 1, createdAt: -1 });

export const AdminSession = mongoose.model<IAdminSession>("AdminSession", AdminSessionSchema);
