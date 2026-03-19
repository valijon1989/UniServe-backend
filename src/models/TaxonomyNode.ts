import mongoose, { Document, Schema } from "mongoose";

export interface ITaxonomyNodeName {
  uz?: string;
  ru?: string;
  en?: string;
  ko?: string;
}

export interface ITaxonomyNode extends Document {
  module: string;
  kind: "category" | "subcategory" | "tag" | "filter" | "attribute";
  key: string;
  label: string;
  name?: ITaxonomyNodeName;
  slug?: string;
  parentId?: mongoose.Types.ObjectId | null;
  status: "ACTIVE" | "HIDDEN";
  sortOrder: number;
  metadata?: Record<string, unknown>;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const TaxonomyNodeNameSchema = new Schema<ITaxonomyNodeName>(
  {
    uz: { type: String, trim: true },
    ru: { type: String, trim: true },
    en: { type: String, trim: true },
    ko: { type: String, trim: true }
  },
  { _id: false }
);

const TaxonomyNodeSchema = new Schema<ITaxonomyNode>(
  {
    module: { type: String, required: true, trim: true, index: true },
    kind: { type: String, enum: ["category", "subcategory", "tag", "filter", "attribute"], required: true, index: true },
    key: { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true },
    name: { type: TaxonomyNodeNameSchema, default: undefined },
    slug: { type: String, trim: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: "TaxonomyNode", default: null },
    status: { type: String, enum: ["ACTIVE", "HIDDEN"], default: "ACTIVE", index: true },
    sortOrder: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

TaxonomyNodeSchema.pre("validate", function (next) {
  if (!this.label) {
    const fallback =
      this.name?.uz ||
      this.name?.en ||
      this.name?.ru ||
      this.name?.ko ||
      "";
    this.label = String(fallback).trim();
  }
  next();
});

TaxonomyNodeSchema.index({ module: 1, kind: 1, parentId: 1, sortOrder: 1 });

export const TaxonomyNode = mongoose.model<ITaxonomyNode>("TaxonomyNode", TaxonomyNodeSchema);
