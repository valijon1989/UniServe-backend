import mongoose, { Document, Schema } from "mongoose";

export type RecommendationEntityType =
  | "QUERY"
  | "PRODUCT"
  | "SERVICE"
  | "AGENT"
  | "COURSE"
  | "COMMUNITY_GROUP"
  | "NEWS";

export type RecommendationSignalAction =
  | "VIEW"
  | "CLICK"
  | "SEARCH"
  | "LIKE"
  | "DISLIKE"
  | "SAVE"
  | "CART_ADD"
  | "CART_REMOVE"
  | "PURCHASE"
  | "ORDER_COMPLETED"
  | "CONTACT"
  | "RATE"
  | "JOIN_COMMUNITY";

export interface IRecommendationSignal extends Document {
  userId?: mongoose.Types.ObjectId | null;
  sessionId?: string | null;
  entityType: RecommendationEntityType;
  entityId?: mongoose.Types.ObjectId | null;
  entityIdentifier?: string | null;
  action: RecommendationSignalAction;
  queryText?: string | null;
  categoryKey?: string | null;
  subcategoryKey?: string | null;
  locale?: string | null;
  languagePreference?: string | null;
  region?: string | null;
  location?: string | null;
  weight: number;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const RecommendationSignalSchema = new Schema<IRecommendationSignal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    sessionId: { type: String, trim: true, default: null, index: true },
    entityType: {
      type: String,
      enum: ["QUERY", "PRODUCT", "SERVICE", "AGENT", "COURSE", "COMMUNITY_GROUP", "NEWS"],
      required: true,
      index: true
    },
    entityId: { type: Schema.Types.ObjectId, default: null, index: true },
    entityIdentifier: { type: String, trim: true, default: null, index: true },
    action: {
      type: String,
      enum: ["VIEW", "CLICK", "SEARCH", "LIKE", "DISLIKE", "SAVE", "CART_ADD", "CART_REMOVE", "PURCHASE", "ORDER_COMPLETED", "CONTACT", "RATE", "JOIN_COMMUNITY"],
      required: true,
      index: true
    },
    queryText: { type: String, trim: true, default: null },
    categoryKey: { type: String, trim: true, lowercase: true, default: null, index: true },
    subcategoryKey: { type: String, trim: true, lowercase: true, default: null },
    locale: { type: String, trim: true, lowercase: true, default: null, index: true },
    languagePreference: { type: String, trim: true, default: null },
    region: { type: String, trim: true, default: null, index: true },
    location: { type: String, trim: true, default: null },
    weight: { type: Number, default: 1, min: 0 },
    metadata: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true, collection: "recommendation_signals" }
);

RecommendationSignalSchema.index({ userId: 1, createdAt: -1 });
RecommendationSignalSchema.index({ sessionId: 1, createdAt: -1 });
RecommendationSignalSchema.index({ entityType: 1, entityId: 1, action: 1, createdAt: -1 });

export const RecommendationSignal = mongoose.model<IRecommendationSignal>("RecommendationSignal", RecommendationSignalSchema);
