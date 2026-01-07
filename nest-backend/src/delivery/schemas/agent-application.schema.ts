import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { AgentApplicationStatus, AgentType, DeliveryMode } from '../../common/types/agent';

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

@Schema({ timestamps: true })
export class AgentApplication {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true, unique: true })
  user: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' })
  status: AgentApplicationStatus;

  @Prop({ type: [String], enum: ['LOCAL', 'INTERNATIONAL'], required: true })
  requestedTypes: AgentType[];

  @Prop({ required: true })
  phoneNumber: string;

  @Prop()
  email?: string;

  @Prop()
  telegramHandle?: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  idDocumentUrl: string;

  @Prop({ required: true })
  selfieUrl: string;

  @Prop()
  faceMatchScore?: number;

  @Prop({ default: false })
  faceVerified: boolean;

  @Prop({ required: true })
  paymentAccountNumber: string;

  @Prop()
  vehiclePlate?: string;

  @Prop()
  smsCode?: string;

  @Prop({ default: false })
  smsVerified: boolean;

  @Prop({ type: [String] })
  serviceRegions?: string[];

  @Prop()
  baseFee?: number;

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
  reviewDeadlineAt?: Date;

  @Prop()
  escalationAt?: Date;

  @Prop()
  escalatedAt?: Date;

  @Prop()
  adminNote?: string;
}

export type AgentApplicationDocument = AgentApplication & Document;
export const AgentApplicationSchema = SchemaFactory.createForClass(AgentApplication);
