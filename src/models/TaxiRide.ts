import mongoose, { Schema, Document } from "mongoose";
import { TaxiClass } from "./AgentProfile";

export type TaxiRideStatus =
  | "SEARCHING"
  | "ASSIGNED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface ITaxiRide extends Document {
  rider: mongoose.Types.ObjectId;
  agent?: mongoose.Types.ObjectId;
  status: TaxiRideStatus;
  pickupLocation: {
    type: "Point";
    coordinates: number[];
  };
  dropoffLocation?: {
    type: "Point";
    coordinates: number[];
  };
  pickupAddress?: string;
  dropoffAddress?: string;
  distanceKm?: number;
  estimatedFare?: number;
  offeredFare?: number;
  finalFare?: number;
  currency: string;
  seatCount?: number;
  taxiClass?: TaxiClass;
  searchRadiusKm?: number;
  platformFeeRate: number;
  platformFeeAmount?: number;
  payoutAmount?: number;
  requestedAt: Date;
  acceptedAt?: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaxiRideSchema = new Schema<ITaxiRide>(
  {
    rider: { type: Schema.Types.ObjectId, ref: "User", required: true },
    agent: { type: Schema.Types.ObjectId, ref: "AgentProfile" },
    status: {
      type: String,
      enum: ["SEARCHING", "ASSIGNED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "SEARCHING"
    },
    pickupLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }
    },
    dropoffLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number] }
    },
    pickupAddress: { type: String },
    dropoffAddress: { type: String },
    distanceKm: { type: Number },
    estimatedFare: { type: Number },
    offeredFare: { type: Number },
    finalFare: { type: Number },
    currency: { type: String, default: "UZS" },
    seatCount: { type: Number },
    taxiClass: { type: String, enum: ["standard", "comfort", "business", "limousine"] },
    searchRadiusKm: { type: Number, default: 50 },
    platformFeeRate: { type: Number, default: 0.001 },
    platformFeeAmount: { type: Number },
    payoutAmount: { type: Number },
    requestedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
    confirmedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date }
  },
  { timestamps: true }
);

TaxiRideSchema.index({ pickupLocation: "2dsphere" });

export const TaxiRide = mongoose.model<ITaxiRide>("TaxiRide", TaxiRideSchema);
