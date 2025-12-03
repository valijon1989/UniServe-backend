import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';

export type ServiceCategoryDocument = HydratedDocument<ServiceCategory>;

@Schema({ timestamps: true })
export class ServiceCategory extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, enum: ['social', 'material'], required: true })
  type: 'social' | 'material';

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  icon?: string;
}

export const ServiceCategorySchema = SchemaFactory.createForClass(ServiceCategory);
