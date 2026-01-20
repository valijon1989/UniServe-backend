import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type JobInquiryDocument = HydratedDocument<JobInquiry>;

@Schema({ timestamps: true })
export class JobInquiry extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'JobListing', required: true })
  job: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  sender: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  message: string;
}

export const JobInquirySchema = SchemaFactory.createForClass(JobInquiry);

JobInquirySchema.index({ job: 1, createdAt: -1 });
JobInquirySchema.index({ sender: 1, createdAt: -1 });
