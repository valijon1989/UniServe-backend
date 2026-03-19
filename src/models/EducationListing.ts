import mongoose, { Schema, Document } from "mongoose";

export type EducationCategory = string;
export type EducationFormat = "online" | "offline";
export type EducationDurationUnit = "days" | "weeks" | "months";

export interface IEducationListing extends Document {
  agentId: mongoose.Types.ObjectId;
  title: string;
  category: EducationCategory;
  subcategory: string;
  description: string;
  weeklyHours?: number;
  weeklyDays?: number;
  totalDurationValue?: number;
  totalDurationUnit?: EducationDurationUnit;
  format: EducationFormat;
  onlineSchedule?: {
    days?: string[];
    time?: string;
    durationMinutes?: number;
  };
  offlineLocation?: {
    address?: string;
    building?: string;
    room?: string;
    schedule?: string;
  };
  languageOfInstruction?: string;
  outcomes?: string;
  certificates?: string[];
  images?: string[];
  studentsCount?: number;
  status?: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const EducationListingSchema = new Schema<IEducationListing>(
  {
    agentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    category: { type: String, required: true, trim: true, index: true },
    subcategory: { type: String, required: true },
    description: { type: String, required: true },
    weeklyHours: { type: Number },
    weeklyDays: { type: Number },
    totalDurationValue: { type: Number },
    totalDurationUnit: { type: String, enum: ["days", "weeks", "months"] },
    format: { type: String, enum: ["online", "offline"], required: true },
    onlineSchedule: {
      days: [{ type: String }],
      time: { type: String },
      durationMinutes: { type: Number }
    },
    offlineLocation: {
      address: { type: String },
      building: { type: String },
      room: { type: String },
      schedule: { type: String }
    },
    languageOfInstruction: { type: String },
    outcomes: { type: String },
    certificates: [{ type: String }],
    images: [{ type: String }],
    studentsCount: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

EducationListingSchema.index({ agentId: 1, createdAt: -1 });
EducationListingSchema.index({ category: 1, subcategory: 1, format: 1 });

export const EducationListing = mongoose.model<IEducationListing>("EducationListing", EducationListingSchema);
