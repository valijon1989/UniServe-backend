import mongoose, { Document, Schema } from "mongoose";

export interface IDepartment extends Document {
  name: string;
  parentId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Department", default: null }
  },
  { timestamps: true }
);

DepartmentSchema.index({ name: 1, parentId: 1 }, { unique: true });

export const Department = mongoose.model<IDepartment>("Department", DepartmentSchema);
