import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ServiceDocument = HydratedDocument<Service>;

@Schema({ timestamps: true })
export class Service extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Agent', required: true })
  agent: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ServiceCategory', required: true })
  category: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: Number })
  price?: number;

  @Prop({ type: String })
  currency?: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: String })
  location?: string;

  @Prop({ type: String, enum: ['active', 'inactive', 'banned'], default: 'active' })
  status: 'active' | 'inactive' | 'banned';
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
