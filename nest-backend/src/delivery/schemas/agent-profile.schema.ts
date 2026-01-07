import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { AgentStatus, AgentType, DeliveryMode } from '../../common/types/agent';

@Schema({ _id: false })
export class Route {
  @Prop({ required: true })
  fromCountry: string;

  @Prop()
  fromRegion?: string;

  @Prop({ required: true })
  toCountry: string;

  @Prop()
  toRegion?: string;
}

const RouteSchema = SchemaFactory.createForClass(Route);

@Schema({ _id: false })
export class LocalProfile {
  @Prop()
  vehiclePlate?: string;

  @Prop({ type: [String] })
  serviceRegions?: string[];

  @Prop()
  baseFee?: number;

  @Prop()
  idDocumentUrl?: string;

  @Prop()
  faceImageUrl?: string;

  @Prop({ default: false })
  faceVerified: boolean;

  @Prop({ default: false })
  smsVerified: boolean;
}

const LocalProfileSchema = SchemaFactory.createForClass(LocalProfile);

@Schema({ _id: false })
export class InternationalProfile {
  @Prop({ type: [RouteSchema], default: [] })
  routes?: Route[];

  @Prop()
  maxWeightKg?: number;

  @Prop({ type: [String] })
  productTypes?: string[];

  @Prop({ type: [String], enum: ['DOOR_TO_DOOR', 'DOOR_TO_AIRPORT', 'AIRPORT_TO_DOOR', 'AIRPORT_TO_AIRPORT'] })
  deliveryModes?: DeliveryMode[];

  @Prop({ type: [String] })
  departureDates?: string[];

  @Prop()
  idDocumentUrl?: string;

  @Prop()
  faceImageUrl?: string;

  @Prop({ default: false })
  faceVerified: boolean;
}

const InternationalProfileSchema = SchemaFactory.createForClass(InternationalProfile);

@Schema({ timestamps: true })
export class AgentProfile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true, unique: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ type: [String], enum: ['LOCAL', 'INTERNATIONAL'], default: [] })
  types: AgentType[];

  @Prop({ type: String, enum: ['PENDING', 'ACTIVE', 'BLOCKED', 'INACTIVE', 'DELETED'], default: 'PENDING' })
  status: AgentStatus;

  @Prop({ default: 0 })
  ratingAvg: number;

  @Prop({ default: 0 })
  ratingCount: number;

  @Prop({ default: 0 })
  completedServices: number;

  @Prop()
  lastActiveAt?: Date;

  @Prop({ required: true })
  paymentAccountNumber: string;

  @Prop()
  phoneNumber?: string;

  @Prop()
  email?: string;

  @Prop()
  telegramHandle?: string;

  @Prop()
  address?: string;

  @Prop({ type: LocalProfileSchema })
  localProfile?: LocalProfile;

  @Prop({ type: InternationalProfileSchema })
  internationalProfile?: InternationalProfile;
}

export type AgentProfileDocument = AgentProfile & Document;
export const AgentProfileSchema = SchemaFactory.createForClass(AgentProfile);
