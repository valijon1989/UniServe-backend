import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";

type BaseDoc = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  category?: string;
  price?: number;
  hourlyRate?: number;
  createdAt: Date;
};

const normalizeText = (value: unknown): string => String(value || "").trim().toLowerCase();
const normalizePrice = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const logicalKey = (doc: BaseDoc): string => {
  const price = normalizePrice(doc.price ?? doc.hourlyRate);
  return `${normalizeText(doc.title)}::${normalizeText(doc.category)}::${price}`;
};

async function removeDuplicatesForModel(
  label: "products" | "services",
  Model: {
    find: (query: Record<string, unknown>) => {
      select: (fields: string) => { sort: (s: Record<string, 1 | -1>) => { lean: () => Promise<BaseDoc[]> } };
    };
    deleteMany: (query: Record<string, unknown>) => Promise<{ deletedCount?: number }>;
  }
) {
  const docs = await Model.find({})
    .select("_id title category price hourlyRate createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const keepByKey = new Map<string, mongoose.Types.ObjectId>();
  const toDelete: mongoose.Types.ObjectId[] = [];

  for (const doc of docs) {
    const key = logicalKey(doc);
    if (!keepByKey.has(key)) {
      keepByKey.set(key, doc._id);
      continue;
    }
    toDelete.push(doc._id);
  }

  let deleted = 0;
  if (toDelete.length) {
    const result = await Model.deleteMany({ _id: { $in: toDelete } });
    deleted = result.deletedCount || 0;
  }

  return {
    label,
    scanned: docs.length,
    removed: deleted,
    remaining: docs.length - deleted
  };
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");
  await connectDb(mongoUrl);

  const [products, services] = await Promise.all([
    removeDuplicatesForModel("products", Product),
    removeDuplicatesForModel("services", Service)
  ]);

  console.log(
    JSON.stringify(
      {
        products,
        services
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("removeDuplicateListings failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
