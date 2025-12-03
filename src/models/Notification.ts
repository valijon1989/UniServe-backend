import mongoose, { Schema, Document } from "mongoose";

export type NotificationType = "FOLLOW" | "LIKE" | "COMMENT" | "SYSTEM";

export interface INotification extends Document {
  user: mongoose.Types.ObjectId; // receiver
  from?: mongoose.Types.ObjectId; // actor
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    from: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["FOLLOW", "LIKE", "COMMENT", "SYSTEM"], default: "SYSTEM" },
    message: { type: String, required: true },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);
