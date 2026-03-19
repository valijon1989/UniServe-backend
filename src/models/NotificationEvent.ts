import mongoose, { Document, Schema } from "mongoose";
import {
  NOTIFICATION_CHANNEL_VALUES,
  NOTIFICATION_DELIVERY_STATUS_VALUES,
  type NotificationChannel,
  type NotificationDeliveryStatus
} from "../types/paymentDomain";

export interface INotificationEvent extends Document {
  userId: mongoose.Types.ObjectId;
  eventKey: string;
  channel: NotificationChannel;
  payload?: Record<string, unknown> | null;
  sentAt?: Date | null;
  deliveryStatus: NotificationDeliveryStatus;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationEventSchema = new Schema<INotificationEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventKey: { type: String, required: true, trim: true, index: true },
    channel: { type: String, enum: [...NOTIFICATION_CHANNEL_VALUES], required: true, index: true },
    payload: { type: Schema.Types.Mixed, default: null },
    sentAt: { type: Date, default: null },
    deliveryStatus: { type: String, enum: [...NOTIFICATION_DELIVERY_STATUS_VALUES], default: "PENDING", index: true }
  },
  { timestamps: true, collection: "notification_events" }
);

export const NotificationEvent = mongoose.model<INotificationEvent>("NotificationEvent", NotificationEventSchema);
