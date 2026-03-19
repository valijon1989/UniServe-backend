import mongoose, { Document, Schema } from "mongoose";

export interface IRecommendationSnapshotItem {
  entityType: "PRODUCT" | "SERVICE" | "AGENT" | "COURSE" | "COMMUNITY_GROUP" | "NEWS";
  entityId?: mongoose.Types.ObjectId | null;
  entityIdentifier?: string | null;
  score: number;
  reasonKey?: string | null;
}

export interface IRecommendationSnapshot extends Document {
  cacheKey: string;
  surface: "HOME" | "DETAIL" | "CART" | "CHECKOUT" | "ORDER_SUCCESS";
  locale: string;
  region?: string | null;
  userId?: mongoose.Types.ObjectId | null;
  sessionId?: string | null;
  entityType?: string | null;
  entityId?: mongoose.Types.ObjectId | null;
  modules: Array<{
    id: string;
    titleKey: string;
    reasonKey?: string | null;
    items: IRecommendationSnapshotItem[];
  }>;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RecommendationSnapshotItemSchema = new Schema<IRecommendationSnapshotItem>(
  {
    entityType: {
      type: String,
      enum: ["PRODUCT", "SERVICE", "AGENT", "COURSE", "COMMUNITY_GROUP", "NEWS"],
      required: true
    },
    entityId: { type: Schema.Types.ObjectId, default: null },
    entityIdentifier: { type: String, trim: true, default: null },
    score: { type: Number, default: 0 },
    reasonKey: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const RecommendationSnapshotSchema = new Schema<IRecommendationSnapshot>(
  {
    cacheKey: { type: String, required: true, unique: true, trim: true, index: true },
    surface: { type: String, enum: ["HOME", "DETAIL", "CART", "CHECKOUT", "ORDER_SUCCESS"], required: true, index: true },
    locale: { type: String, required: true, trim: true, lowercase: true, index: true },
    region: { type: String, trim: true, default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    sessionId: { type: String, trim: true, default: null, index: true },
    entityType: { type: String, trim: true, default: null, index: true },
    entityId: { type: Schema.Types.ObjectId, default: null, index: true },
    modules: {
      type: [
        new Schema(
          {
            id: { type: String, required: true, trim: true },
            titleKey: { type: String, required: true, trim: true },
            reasonKey: { type: String, trim: true, default: null },
            items: { type: [RecommendationSnapshotItemSchema], default: [] }
          },
          { _id: false }
        )
      ],
      default: []
    },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true, collection: "recommendation_snapshots" }
);

RecommendationSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RecommendationSnapshot = mongoose.model<IRecommendationSnapshot>("RecommendationSnapshot", RecommendationSnapshotSchema);
