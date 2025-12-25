import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AgentDocument = HydratedDocument<Agent>;

@Schema({ timestamps: true })
export class Agent extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, enum: ['seller', 'service'], required: true })
  agentType: 'seller' | 'service';

  @Prop({ type: String, enum: ['social', 'material'] })
  providerType?: 'social' | 'material';

  @Prop({ type: String })
  displayName?: string;

  @Prop({ type: String })
  avatarUrl?: string;

  @Prop({ type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' })
  verificationStatus: 'pending' | 'verified' | 'rejected';

  @Prop({ type: String })
  faceIdImageUrl?: string;

  @Prop({ type: [String], default: [] })
  servicesOffered: string[];

  @Prop({ type: String })
  location?: string;

  @Prop({ type: Number })
  rating?: number;

  @Prop({ type: Number, default: 0 })
  ratingCount?: number;

  @Prop({
    type: {
      completed: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
    },
    _id: false,
  })
  stats?: {
    completed: number;
    likes: number;
    shares: number;
    followers: number;
  };

  @Prop({
    type: {
      country: { type: String },
      city: { type: String },
      lat: { type: Number },
      lng: { type: Number },
    },
    _id: false,
  })
  locationBase?: {
    country?: string;
    city?: string;
    lat?: number;
    lng?: number;
  };

  @Prop({ type: [String], default: [] })
  languages?: string[];

  @Prop({ type: Number })
  responseTimeMinutes?: number;

  @Prop({ type: Boolean, default: false })
  blocked?: boolean;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);
