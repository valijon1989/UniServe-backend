import mongoose, { Document, Schema } from "mongoose";

export interface IPosition extends Document {
  name: string;
  departmentId: mongoose.Types.ObjectId;
  rank: number;
  createdAt: Date;
  updatedAt: Date;
}

const PositionSchema = new Schema<IPosition>(
  {
    name: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    rank: { type: Number, default: 1 }
  },
  { timestamps: true }
);

PositionSchema.index({ departmentId: 1, name: 1 }, { unique: true });
PositionSchema.index({ departmentId: 1, rank: 1 });

export const Position = mongoose.model<IPosition>("Position", PositionSchema);
