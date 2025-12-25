import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ServiceDocument = HydratedDocument<Service>;

@Schema({ timestamps: true })
export class Service extends Document {
  @Prop({ type: String, unique: true, sparse: true })
  slug?: string;

  @Prop({ type: String, enum: ['social', 'material'] })
  tab?: 'social' | 'material';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Agent', required: true })
  agent: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ServiceCategory', required: true })
  category: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ServiceCategory' })
  subCategory?: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({
    type: [
      {
        type: { type: String, enum: ['image', 'video'], required: true },
        url: { type: String, required: true },
      },
    ],
    default: [],
    _id: false,
  })
  media: { type: 'image' | 'video'; url: string }[];

  @Prop({ type: Number })
  price?: number;

  @Prop({ type: String })
  currency?: string;

  @Prop({ type: String, enum: ['hourly', 'fixed', 'package'] })
  pricingType?: 'hourly' | 'fixed' | 'package';

  @Prop({ type: Number })
  priceMin?: number;

  @Prop({ type: Number })
  priceMax?: number;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ type: String, enum: ['online', 'offline', 'both'], default: 'both' })
  deliveryMode?: 'online' | 'offline' | 'both';

  @Prop({
    type: {
      country: { type: String },
      city: { type: String },
      lat: { type: Number },
      lng: { type: Number },
      radiusKm: { type: Number },
    },
    _id: false,
  })
  serviceArea?: {
    country?: string;
    city?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  };

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: Boolean, default: false })
  termsAccepted: boolean;

  @Prop({
    type: [
      {
        label: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    default: [],
    _id: false,
  })
  credentials: { label: string; url: string }[];

  @Prop({ type: { avg: { type: Number, default: 0 }, count: { type: Number, default: 0 } }, _id: false })
  rating: {
    avg: number;
    count: number;
  };

  @Prop({
    type: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      usages: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      orders: { type: Number, default: 0 },
    },
    _id: false,
  })
  stats: {
    views: number;
    likes: number;
    shares: number;
    usages: number;
    saves: number;
    orders: number;
  };

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  usedBy: MongooseSchema.Types.ObjectId[];

  @Prop({ type: String })
  location?: string;

  @Prop({ type: String, enum: ['active', 'inactive', 'banned'], default: 'active' })
  status: 'active' | 'inactive' | 'banned';
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

ServiceSchema.index({ category: 1 });
ServiceSchema.index({ subCategory: 1 });
ServiceSchema.index({ agent: 1 });
ServiceSchema.index({ status: 1 });
ServiceSchema.index({ tab: 1 });
ServiceSchema.index({ priceMin: 1 });
ServiceSchema.index({ 'rating.avg': -1 });
ServiceSchema.index({ createdAt: -1 });
ServiceSchema.index({ title: 'text', description: 'text', tags: 'text' });
ServiceSchema.index({ 'stats.usages': -1 });
