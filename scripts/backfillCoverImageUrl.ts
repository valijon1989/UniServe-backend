import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { ensureAbsoluteUrl } from "../src/utils/imageHelpers";
import {
  isLocalImageUrl,
  isRandomUnsplashUrl,
  localImageExists,
  normalizeCoverImageUrl,
  resolveCoverImage
} from "../src/utils/resolveCoverImage";

type ListingDoc = {
  _id: mongoose.Types.ObjectId;
  category?: unknown;
  coverImageUrl?: unknown;
  coverImage?: unknown;
  imageUrl?: unknown;
  image?: unknown;
  thumbnail?: unknown;
  images?: unknown;
  media?: unknown;
};

const pickFromImages = (images: unknown): string | null => {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (first && typeof first === "object" && typeof (first as { url?: unknown }).url === "string") {
    return normalizeCoverImageUrl((first as { url: string }).url);
  }
  return normalizeCoverImageUrl(first);
};

const toComparable = (value: unknown): string | null => normalizeCoverImageUrl(value);
const PRODUCT_FALLBACK = ensureAbsoluteUrl("/images/fallback-product.png") || "http://localhost:5001/images/fallback-product.png";
const SERVICE_FALLBACK = ensureAbsoluteUrl("/images/fallback-service.png") || "http://localhost:5001/images/fallback-service.png";

async function backfillModel(
  label: "products" | "services",
  Model: {
    find: (query: Record<string, unknown>) => {
      select: (fields: string) => { lean: () => Promise<ListingDoc[]> };
    };
    updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>) => Promise<unknown>;
  }
) {
  const docs = await Model.find({})
    .select("_id category coverImageUrl coverImage imageUrl image thumbnail images media")
    .lean();

  let updated = 0;
  let stillMissing = 0;
  let randomUnsplashRemoved = 0;

  for (const doc of docs) {
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, unknown> = {};

    const current = toComparable(doc.coverImageUrl);
    let next =
      toComparable(doc.coverImageUrl) ||
      pickFromImages(doc.images) ||
      toComparable(doc.imageUrl) ||
      toComparable(doc.image) ||
      toComparable(doc.thumbnail) ||
      resolveCoverImage(doc);

    if (next && isLocalImageUrl(next) && !localImageExists(next)) {
      next = null;
    }
    if (!next) {
      next = label === "products" ? PRODUCT_FALLBACK : SERVICE_FALLBACK;
    }

    if (typeof doc.imageUrl === "string" && isRandomUnsplashUrl(doc.imageUrl)) {
      $unset.imageUrl = 1;
      randomUnsplashRemoved += 1;
    }
    if (typeof doc.coverImageUrl === "string" && isRandomUnsplashUrl(doc.coverImageUrl)) {
      $unset.coverImageUrl = 1;
      $unset.coverImage = 1;
      randomUnsplashRemoved += 1;
    }

    if (next !== current) {
      if (next) {
        $set.coverImageUrl = next;
        $set.coverImage = next;
      } else {
        $unset.coverImageUrl = 1;
        $unset.coverImage = 1;
      }
    }

    if (!next) stillMissing += 1;

    if (Object.keys($set).length || Object.keys($unset).length) {
      const update: Record<string, unknown> = {};
      if (Object.keys($set).length) update.$set = $set;
      if (Object.keys($unset).length) update.$unset = $unset;
      await Model.updateOne({ _id: doc._id }, update);
      updated += 1;
    }
  }

  return {
    label,
    scanned: docs.length,
    updated,
    stillMissing,
    randomUnsplashRemoved
  };
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");
  await connectDb(mongoUrl);

  const [products, services] = await Promise.all([
    backfillModel("products", Product),
    backfillModel("services", Service)
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
  console.error("backfillCoverImageUrl failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
