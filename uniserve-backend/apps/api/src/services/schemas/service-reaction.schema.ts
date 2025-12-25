import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ServiceReactionDocument = HydratedDocument<ServiceReaction>;

@Schema({ timestamps: true })
export class ServiceReaction extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Service', required: true })
  serviceId: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, enum: ['like', 'save'], required: true })
  type: 'like' | 'save';
}

export const ServiceReactionSchema = SchemaFactory.createForClass(ServiceReaction);

ServiceReactionSchema.index({ userId: 1, serviceId: 1, type: 1 }, { unique: true });
