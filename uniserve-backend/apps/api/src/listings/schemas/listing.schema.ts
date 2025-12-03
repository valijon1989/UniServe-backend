import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ListingDocument = HydratedDocument<Listing>;

@Schema({ timestamps: true })
export class Listing extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Agent', required: true })
  agent: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: String, enum: ['new', 'used'], required: true })
  condition: 'new' | 'used';

  @Prop({ type: Number, default: 0 })
  stock: number;

  @Prop({ type: String, enum: ['active', 'sold', 'deleted'], default: 'active' })
  status: 'active' | 'sold' | 'deleted';

  @Prop({ type: String })
  location?: string;
}

export const ListingSchema = SchemaFactory.createForClass(Listing);
