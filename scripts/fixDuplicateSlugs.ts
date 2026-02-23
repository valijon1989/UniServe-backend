import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { slugify } from "../src/utils/slug";

type SlugDoc = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  slug?: string;
};

const ensureUnique = (base: string, used: Set<string>): string => {
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
};

async function fixModel(
  label: "products" | "services",
  Model: {
    find: (query: Record<string, unknown>) => { select: (s: string) => { sort: (o: Record<string, 1 | -1>) => { lean: () => Promise<SlugDoc[]> } } };
    updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => Promise<unknown>;
  }
) {
  const docs = await Model.find({})
    .select("_id title slug")
    .sort({ createdAt: 1 })
    .lean();

  const used = new Set<string>();
  let updated = 0;

  for (const doc of docs) {
    const current = typeof doc.slug === "string" ? slugify(doc.slug) : "";
    const base = current || slugify(String(doc.title || "")) || label.slice(0, -1);
    const next = ensureUnique(base, used);
    used.add(next);

    if (current !== next) {
      await Model.updateOne({ _id: doc._id }, { $set: { slug: next } });
      updated += 1;
    }
  }

  return { scanned: docs.length, updated };
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");
  await connectDb(mongoUrl);

  const [products, services] = await Promise.all([fixModel("products", Product), fixModel("services", Service)]);
  console.log(JSON.stringify({ products, services }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("fixDuplicateSlugs failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
