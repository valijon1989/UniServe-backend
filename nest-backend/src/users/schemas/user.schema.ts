import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { AgentType } from '../../common/types/agent';

export type UserRole = 'USER' | 'AGENT' | 'ADMIN';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username: string;

  @Prop({ type: String, enum: ['USER', 'AGENT', 'ADMIN'], default: 'USER' })
  role: UserRole;

  @Prop({ type: [String], enum: ['LOCAL', 'INTERNATIONAL'], default: [] })
  agentIntent?: AgentType[];

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop()
  avatarUrl?: string;

  @Prop()
  bio?: string;

  @Prop()
  region?: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }] })
  followers: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }] })
  following: MongooseSchema.Types.ObjectId[];
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
