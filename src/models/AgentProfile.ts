import mongoose, { Schema, Document } from "mongoose";

export type AgentKind = "SELLER" | "SERVICE";

export interface IAgentProfile extends Document {
  user: mongoose.Types.ObjectId;
  kind: AgentKind;
  socialServices: string[];
  materialServices: string[];
  rating: number;
  verifiedByAdmin: boolean;
  faceIdVerified: boolean;
  serviceCategory?: "language" | "translation" | "consulting" | "legal" | "delivery" | "taxi" | "repair";
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
    }
  },
  { timestamps: true }
);

export const AgentProfile = mongoose.model<IAgentProfile>("AgentProfile", AgentProfileSchema);
