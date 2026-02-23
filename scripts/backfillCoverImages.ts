import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { ensureAbsoluteUrl } from "../src/utils/imageHelpers";

const pickCoverFromImages = (images: unknown): string | null => {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (typeof first === "string" && first.trim()) return first.trim();
  if (first && typeof first === "object" && typeof (first as { url?: unknown }).url === "string") {
    const url = String((first as { url: string }).url).trim();
    return url || null;
  }
  return null;
};

const hasValue = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;
const isPlaceholder = (value: unknown): boolean =>
  typeof value === "string" && /\/static\/placeholders\//i.test(value);

async function backfillModel(
  Model: {
    find: (query: Record<string, unknown>) => {
      select: (fields: string) => {
        lean: () => Promise<Array<{ _id: mongoose.Types.ObjectId; images?: unknown; coverImage?: unknown; coverImageUrl?: unknown }>>;
      };
    };
    updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => Promise<unknown>;
  }
): Promise<{ scanned: number; updated: number }> {
  const query = {
    $or: [
      { coverImageUrl: { $exists: false } },
      { coverImageUrl: null },
      { coverImageUrl: "" },
      { coverImageUrl: { $regex: "/static/placeholders/", $options: "i" } }
    ]
  };

  const docs = await Model.find(query).select("_id images coverImage coverImageUrl").lean();
  let updated = 0;

  for (const doc of docs) {
    if (hasValue((doc as { coverImageUrl?: unknown }).coverImageUrl) && !isPlaceholder((doc as { coverImageUrl?: unknown }).coverImageUrl)) {
      continue;
    }
    const coverImageRaw = pickCoverFromImages((doc as { images?: unknown }).images);
    const coverImageUrl = coverImageRaw ? ensureAbsoluteUrl(coverImageRaw) || coverImageRaw : null;
    if (!coverImageUrl) continue;
    const updates: Record<string, unknown> = { coverImageUrl };
    if (!hasValue((doc as { coverImage?: unknown }).coverImage)) {
      updates.coverImage = coverImageUrl;
    }
    await Model.updateOne({ _id: doc._id }, { $set: updates });
    updated += 1;
  }

  return { scanned: docs.length, updated };
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");

  await connectDb(mongoUrl);

  const [products, services] = await Promise.all([
    backfillModel(Product),
    backfillModel(Service)
  ]);

  console.log(
    JSON.stringify({
      productScanned: products.scanned,
      productUpdated: products.updated,
      serviceScanned: services.scanned,
      serviceUpdated: services.updated
    })
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Failed to backfill cover images:", err);
  await mongoose.disconnect();
  process.exit(1);
});
