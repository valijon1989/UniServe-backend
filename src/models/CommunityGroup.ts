import mongoose, { Document, Schema } from "mongoose";

export interface CommunityGroupReview {
  userId: mongoose.Types.ObjectId;
  userName: string;
  username?: string;
  role?: string;
  avatarUrl?: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface CommunityGroup extends Document {
  title: string;
  description: string;
  category: string;
  tags: string[];
  members: number;
  rating: number;
  ratingVotes: number;
  spamReports: number;
  groupType: "group" | "channel";
  channelType: "group" | "channel";
  isActive: boolean;
  privacy: "public" | "private" | "secret";
  requiresApproval: boolean;
  pendingApprovals: number;
  isVerified: boolean;
  lastActivity: Date;
  reviews: CommunityGroupReview[];
  createdBy?: mongoose.Types.ObjectId;
  slug?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommunityGroupSchema = new Schema<CommunityGroup>(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, required: true },
    tags: [{ type: String }],
    members: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    ratingVotes: { type: Number, default: 0 },
    spamReports: { type: Number, default: 0 },
    groupType: { type: String, enum: ["group", "channel"], default: "group" },
    channelType: { type: String, enum: ["group", "channel"], default: "group" },
    isActive: { type: Boolean, default: true },
    privacy: { type: String, enum: ["public", "private", "secret"], default: "public" },
    requiresApproval: { type: Boolean, default: false },
    pendingApprovals: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: true },
    lastActivity: { type: Date, default: Date.now },
    reviews: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        userName: { type: String, required: true },
        username: { type: String },
        role: { type: String },
        avatarUrl: { type: String },
        rating: { type: Number, required: true },
        comment: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    slug: { type: String, unique: true, sparse: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

CommunityGroupSchema.pre("save", function (next) {
  if (!this.groupType && this.channelType) {
    this.groupType = this.channelType;
  }
  if (!this.channelType && this.groupType) {
    this.channelType = this.groupType;
  }
  if (!this.lastActivity) {
    this.lastActivity = new Date();
  }
  next();
});
CommunityGroupSchema.index({ category: 1 });
CommunityGroupSchema.index({ slug: 1 }, { unique: true, sparse: true });

export const CommunityGroupModel = mongoose.model<CommunityGroup>("CommunityGroup", CommunityGroupSchema);
