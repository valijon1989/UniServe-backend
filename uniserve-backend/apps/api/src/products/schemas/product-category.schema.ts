import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ProductCategoryDocument = HydratedDocument<ProductCategory>;

@Schema({ timestamps: true })
export class ProductCategory extends Document {
  @Prop({ type: String, required: true, unique: true })
  name: string;

  @Prop({ type: String, required: true, unique: true })
  slug: string;

  @Prop({ type: String })
  icon?: string;

  @Prop({ type: String })
  backgroundColor?: string;

  @Prop({ type: String })
  accentColor?: string;

  @Prop({ type: Number, default: 0 })
  order?: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ProductCategory', default: null })
  parent?: MongooseSchema.Types.ObjectId | null;
}

export const ProductCategorySchema = SchemaFactory.createForClass(ProductCategory);

ProductCategorySchema.index({ slug: 1 });
ProductCategorySchema.index({ parent: 1 });
