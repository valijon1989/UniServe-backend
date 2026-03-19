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
  ratingCount: number;
  profileViews: number;
  profileLikes: number;
  verifiedByAdmin: boolean;
  faceIdVerified: boolean;
  gender?: "male" | "female" | "other";
  phone?: string;
  telegram?: string;
  verificationEmail?: string;
  verificationDocument?: string;
  verificationHomeAddress?: string;
  verificationFaceId?: string;
  verificationRequestedAt?: Date | null;
  verificationReviewedAt?: Date | null;
  verificationRejectionReason?: string | null;
  serviceCategory?: string;
  educationCategories?: string[];
  educationLanguages?: string[];
  educationSkills?: string[];
  educationSpecialties?: string[];
  constructionAreas?: string[];
  constructionServices?: string[];
  serviceOfficeAddress?: string;
  serviceQualification?: string;
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
  adminStatus: "ACTIVE" | "PENDING" | "SUSPENDED";
  complaintCount: number;
  responseRate: number;
  badge?: string;
  internalNotes?: string;
  lastModeratedAt?: Date;
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
    ratingCount: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    profileLikes: { type: Number, default: 0 },
    verifiedByAdmin: { type: Boolean, default: false },
    faceIdVerified: { type: Boolean, default: false },
    gender: { type: String, enum: ["male", "female", "other"] },
    phone: { type: String },
    telegram: { type: String },
    verificationEmail: { type: String, trim: true, lowercase: true, default: null },
    verificationDocument: { type: String, trim: true, default: null },
    verificationHomeAddress: { type: String, trim: true, default: null },
    verificationFaceId: { type: String, trim: true, default: null },
    verificationRequestedAt: { type: Date, default: null },
    verificationReviewedAt: { type: Date, default: null },
    verificationRejectionReason: { type: String, trim: true, default: null },
    serviceCategory: {
      type: String,
      trim: true,
      lowercase: true
    },
    educationCategories: [{ type: String }],
    educationLanguages: [{ type: String }],
    educationSkills: [{ type: String }],
    educationSpecialties: [{ type: String }],
    constructionAreas: [{ type: String }],
    constructionServices: [{ type: String }],
    serviceOfficeAddress: { type: String },
    serviceQualification: { type: String },
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
    payoutAccount: { type: String },
    adminStatus: { type: String, enum: ["ACTIVE", "PENDING", "SUSPENDED"], default: "PENDING", index: true },
    complaintCount: { type: Number, default: 0 },
    responseRate: { type: Number, default: 0 },
    badge: { type: String },
    internalNotes: { type: String },
    lastModeratedAt: { type: Date }
  },
  { timestamps: true }
);

AgentProfileSchema.index({ taxiLocation: "2dsphere" });

export const AgentProfile = mongoose.model<IAgentProfile>("AgentProfile", AgentProfileSchema);
