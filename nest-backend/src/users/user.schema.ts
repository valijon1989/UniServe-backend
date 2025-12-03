import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export type UserRole = 'USER' | 'AGENT' | 'ADMIN';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ type: String, unique: true, required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, required: true })
  passwordHash: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  username: string;

  @Prop({ type: String, enum: ['USER', 'AGENT', 'ADMIN'], default: 'USER' })
  role: UserRole;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean;

  @Prop({ type: Boolean, default: false })
  isPrivate: boolean;

  @Prop({ type: String })
  avatarUrl?: string;

  @Prop({ type: String })
  bio?: string;

  @Prop({ type: String })
  region?: string;

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'User' }])
  followers: MongooseSchema.Types.ObjectId[];

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'User' }])
  following: MongooseSchema.Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);
