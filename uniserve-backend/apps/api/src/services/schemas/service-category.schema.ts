import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ServiceCategoryDocument = HydratedDocument<ServiceCategory>;

@Schema({ timestamps: true })
export class ServiceCategory extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true, unique: true, sparse: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ type: String, enum: ['social', 'material'], required: true })
  type: 'social' | 'material';

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  icon?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ServiceCategory', default: null })
  parentId?: MongooseSchema.Types.ObjectId | null;

  @Prop({ type: Number, default: 0 })
  order?: number;

  @Prop({ type: Boolean, default: true })
  isActive?: boolean;
}

export const ServiceCategorySchema = SchemaFactory.createForClass(ServiceCategory);

ServiceCategorySchema.index({ slug: 1 }, { unique: true, sparse: true });
ServiceCategorySchema.index({ parentId: 1, order: 1 });
