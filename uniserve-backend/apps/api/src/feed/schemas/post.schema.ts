import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Post extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  author: MongooseSchema.Types.ObjectId;

  @Prop({ type: String })
  text?: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: String })
  videoUrl?: string;

  @Prop({ type: String, enum: ['public', 'followers'], default: 'public' })
  visibility: 'public' | 'followers';

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'User' }])
  likes: MongooseSchema.Types.ObjectId[];
}

export const PostSchema = SchemaFactory.createForClass(Post);
