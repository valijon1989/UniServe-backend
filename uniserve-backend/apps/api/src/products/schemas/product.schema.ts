import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, unique: true, sparse: true })
  slug?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Agent', required: true })
  vendor: MongooseSchema.Types.ObjectId;

  @Prop({ type: String })
  vendorName?: string;

  @Prop({ type: String })
  brand?: string;

  @Prop({ type: String, required: true })
  category: string;

  @Prop({ type: String })
  subCategory?: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: String })
  thumbnail?: string;

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: Number })
  oldPrice?: number;

  @Prop({ type: Number })
  discountPercent?: number;

  @Prop({ type: Number, default: 0 })
  stock: number;

  @Prop({ type: { avg: { type: Number, default: 0 }, count: { type: Number, default: 0 } }, _id: false })
  rating: {
    avg: number;
    count: number;
  };

  @Prop({
    type: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      purchases: { type: Number, default: 0 },
    },
    _id: false,
  })
  stats: {
    views: number;
    likes: number;
    purchases: number;
  };

  @Prop({ type: String })
  description?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  specifications?: Record<string, any>;

  @Prop({ type: String, enum: ['new', 'used'], default: 'new' })
  condition?: 'new' | 'used';
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ category: 1 });
ProductSchema.index({ vendor: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ 'rating.avg': -1 });
ProductSchema.index({ 'stats.views': -1 });
ProductSchema.index({ name: 'text', description: 'text', vendorName: 'text' });
