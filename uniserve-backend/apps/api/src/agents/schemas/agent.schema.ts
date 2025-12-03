import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type AgentDocument = HydratedDocument<Agent>;

@Schema({ timestamps: true })
export class Agent extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, enum: ['seller', 'service'], required: true })
  agentType: 'seller' | 'service';

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

  @Prop({ type: Boolean, default: false })
  blocked?: boolean;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);
