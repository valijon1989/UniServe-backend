import mongoose, { Document, Schema } from "mongoose";

export interface ISearchHistory extends Document {
  userId: mongoose.Types.ObjectId;
  locale?: string | null;
  normalizedQuery: string;
  queryText: string;
  correctedQuery?: string | null;
  intent?: string | null;
  resultCount: number;
  searchCount: number;
  lastSearchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SearchHistorySchema = new Schema<ISearchHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    locale: { type: String, trim: true, lowercase: true, default: null, index: true },
    normalizedQuery: { type: String, trim: true, required: true, index: true },
    queryText: { type: String, trim: true, required: true },
    correctedQuery: { type: String, trim: true, default: null },
    intent: { type: String, trim: true, default: null, index: true },
    resultCount: { type: Number, default: 0, min: 0 },
    searchCount: { type: Number, default: 1, min: 1 },
    lastSearchedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true, collection: "search_history" }
);

SearchHistorySchema.index({ userId: 1, normalizedQuery: 1 }, { unique: true });
SearchHistorySchema.index({ userId: 1, lastSearchedAt: -1 });

export const SearchHistory = mongoose.model<ISearchHistory>("SearchHistory", SearchHistorySchema);
