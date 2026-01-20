import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type JobListingDocument = HydratedDocument<JobListing>;

@Schema({ timestamps: true })
export class JobListing extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  employer: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: String, enum: ['doimiy-ishlar', 'vaqtinchalik-ishlar'], required: true })
  categorySlug: 'doimiy-ishlar' | 'vaqtinchalik-ishlar';

  @Prop({ type: String, required: true })
  jobType: string;

  @Prop({ type: String, required: true })
  workAddress: string;

  @Prop({
    type: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined },
    },
    _id: false,
  })
  locationGeo?: { type: 'Point'; coordinates: [number, number] };

  @Prop({ type: String })
  workTime?: string;

  @Prop({ type: String, enum: ['hourly', 'daily', 'weekly', 'monthly'], required: true })
  payType: 'hourly' | 'daily' | 'weekly' | 'monthly';

  @Prop({ type: Number, required: true })
  payAmount: number;

  @Prop({ type: String, default: 'KRW' })
  currency: string;

  @Prop({ type: Boolean, default: false })
  housingProvided: boolean;

  @Prop({ type: Boolean, default: false })
  mealsProvided: boolean;

  @Prop({ type: [String], default: [] })
  requirements: string[];

  @Prop({ type: [String], default: [] })
  visaTypes: string[];

  @Prop({ type: String, enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';
}

export const JobListingSchema = SchemaFactory.createForClass(JobListing);

JobListingSchema.index({ locationGeo: '2dsphere' });
JobListingSchema.index({ categorySlug: 1, createdAt: -1 });
JobListingSchema.index({ title: 'text', description: 'text', jobType: 'text', requirements: 'text' });
