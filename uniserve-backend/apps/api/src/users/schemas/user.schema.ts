import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = HydratedDocument<User>;
export type UserRole = 'USER' | 'AGENT' | 'ADMIN';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: String, enum: ['USER', 'AGENT', 'ADMIN'], default: 'USER' })
  role: UserRole;

  @Prop({ type: String })
  avatarUrl?: string;

  @Prop({ type: String })
  bio?: string;

  @Prop({ type: String, enum: ['public', 'private'], default: 'public' })
  profileVisibility: 'public' | 'private';

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'User' }])
  followers: MongooseSchema.Types.ObjectId[];

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'User' }])
  following: MongooseSchema.Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre<UserDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.index({ email: 1 }, { unique: true });
