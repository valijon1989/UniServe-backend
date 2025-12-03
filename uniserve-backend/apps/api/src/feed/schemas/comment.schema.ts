import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Comment extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Post', required: true })
  post: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  author: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  text: string;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
