import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { ensureAbsoluteUrl } from "../src/utils/imageHelpers";
import { isUnstableImageUrl } from "../src/utils/listingImage";

type Doc = {
  _id: mongoose.Types.ObjectId;
  images?: unknown;
  coverImageUrl?: unknown;
  coverImage?: unknown;
};

const toNormalized = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  if (isUnstableImageUrl(value)) return null;
  const normalized = ensureAbsoluteUrl(value);
  return normalized || null;
};

const sanitizeImages = (images: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images
    .map((item) => {
      if (typeof item === "string") return toNormalized(item);
      if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
        return toNormalized((item as { url: string }).url);
      }
      return null;
    })
    .filter(Boolean) as string[];
};

async function fixModel(
  Model: {
    find: (filter: Record<string, unknown>) => { select: (fields: string) => { lean: () => Promise<Doc[]> } };
    updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => Promise<unknown>;
  }
) {
  const docs = await Model.find({}).select("_id images coverImageUrl coverImage").lean();
  let updated = 0;

  for (const doc of docs) {
    const images = sanitizeImages(doc.images);
    const prevCoverImageUrl = toNormalized(doc.coverImageUrl);
    const prevCoverImage = toNormalized(doc.coverImage);
    const existingCover = prevCoverImageUrl || prevCoverImage;
    const baseImages = images.length ? images : existingCover ? [existingCover] : [];
    const nextImages = baseImages;
    const nextCover = nextImages[0] || null;

    const set: Record<string, unknown> = {
      images: nextImages,
      coverImageUrl: nextCover
    };
    if (!prevCoverImage || isUnstableImageUrl(prevCoverImage)) {
      set.coverImage = nextCover;
    }

    const changed =
      JSON.stringify(nextImages) !== JSON.stringify(Array.isArray(doc.images) ? doc.images : []) ||
      prevCoverImageUrl !== nextCover ||
      (Object.prototype.hasOwnProperty.call(set, "coverImage") && prevCoverImage !== set.coverImage);

    if (!changed) continue;
    await Model.updateOne({ _id: doc._id }, { $set: set });
    updated += 1;
  }

  return { scanned: docs.length, updated };
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");
  await connectDb(mongoUrl);

  const [products, services] = await Promise.all([
    fixModel(Product),
    fixModel(Service)
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
  console.error("Failed to fix listing images:", err);
  await mongoose.disconnect();
  process.exit(1);
});
