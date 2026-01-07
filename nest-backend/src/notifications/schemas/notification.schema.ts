import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type NotificationType =
  | 'AGENT_APPLICATION_APPROVED'
  | 'AGENT_APPLICATION_REJECTED'
  | 'AGENT_APPLICATION_ESCALATED';

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  meta?: Record<string, any>;

  @Prop({ default: false })
  isRead: boolean;
}

export type NotificationDocument = Notification & Document;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
