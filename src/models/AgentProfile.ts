import mongoose, { Schema, Document } from "mongoose";

export type AgentKind = "SELLER" | "SERVICE";
export type TaxiClass = "standard" | "comfort" | "business" | "limousine";
export type TaxiStatus = "OFFLINE" | "AVAILABLE" | "BUSY";

export interface IAgentProfile extends Document {
  user: mongoose.Types.ObjectId;
  kind: AgentKind;
  socialServices: string[];
  materialServices: string[];
  rating: number;
  verifiedByAdmin: boolean;
  faceIdVerified: boolean;
  serviceCategory?: "language" | "translation" | "consulting" | "legal" | "delivery" | "taxi" | "repair";
  taxi?: {
    vehicleModel?: string;
    seatCapacity?: number;
    class?: TaxiClass;
    features?: string[];
  };
  taxiStatus?: TaxiStatus;
  taxiLocation?: {
    type: "Point";
    coordinates: number[];
  };
  taxiLastSeenAt?: Date;
  payoutAccount?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AgentProfileSchema = new Schema<IAgentProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    kind: { type: String, enum: ["SELLER", "SERVICE"], required: true },
    socialServices: [{ type: String }],
    materialServices: [{ type: String }],
    rating: { type: Number, default: 0 },
    verifiedByAdmin: { type: Boolean, default: false },
    faceIdVerified: { type: Boolean, default: false },
    serviceCategory: {
      type: String,
      enum: ["language", "translation", "consulting", "legal", "delivery", "taxi", "repair"]
    },
    taxi: {
      vehicleModel: { type: String },
      seatCapacity: { type: Number },
      class: { type: String, enum: ["standard", "comfort", "business", "limousine"] },
      features: [{ type: String }]
    },
    taxiStatus: { type: String, enum: ["OFFLINE", "AVAILABLE", "BUSY"], default: "OFFLINE" },
    taxiLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }
    },
    taxiLastSeenAt: { type: Date },
    payoutAccount: { type: String }
  },
  { timestamps: true }
);

AgentProfileSchema.index({ taxiLocation: "2dsphere" });

export const AgentProfile = mongoose.model<IAgentProfile>("AgentProfile", AgentProfileSchema);
