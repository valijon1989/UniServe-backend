import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { apiBaseUrl } from "../src/utils/imageHelpers";

type Doc = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  name?: string;
  category?: string;
  serviceCategory?: string;
  images?: unknown;
  coverImageUrl?: unknown;
  coverImage?: unknown;
};

const productImages = [
  `${apiBaseUrl}/static/products/sony_a7iv.jpg`,
  `${apiBaseUrl}/static/products/canon_r6m2.jpg`,
  `${apiBaseUrl}/static/products/fuji_xs20.jpg`
];

const serviceImageByKey: Record<string, string> = {
  translation: `${apiBaseUrl}/static/services/translation/14.jpg`,
  delivery: `${apiBaseUrl}/static/services/delivery/14.jpg`,
  education: `${apiBaseUrl}/static/services/education/63.jpg`,
  language: `${apiBaseUrl}/static/services/education/63.jpg`,
  consulting: `${apiBaseUrl}/static/services/consulting/14.jpg`,
  legal: `${apiBaseUrl}/static/services/legal/law-4-1-1.jpg`,
  repair: `${apiBaseUrl}/static/services/technical/14.jpg`,
  technical: `${apiBaseUrl}/static/services/technical/14.jpg`,
  construction: `${apiBaseUrl}/static/services/construction/14.jpg`,
  taxi: `${apiBaseUrl}/static/services/taxi/14.jpg`,
  marketing: `${apiBaseUrl}/static/services/marketing/14.jpg`,
  psychology: `${apiBaseUrl}/static/services/psychology/psy-24.jpg`,
  cleaning: `${apiBaseUrl}/static/services/cleaning/14.jpg`,
  moving: `${apiBaseUrl}/static/services/moving/14.jpg`,
  nanny: `${apiBaseUrl}/static/services/nanny/14.jpg`,
  sport: `${apiBaseUrl}/static/services/sport/sport-8-2-2.jpg`,
  employment: `${apiBaseUrl}/static/services/employment/14.jpg`
};

const normalizeString = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

const hasImage = (doc: Doc) => {
  const cover = typeof doc.coverImageUrl === "string" ? doc.coverImageUrl.trim() : "";
  const coverLegacy = typeof doc.coverImage === "string" ? doc.coverImage.trim() : "";
  const images = Array.isArray(doc.images) ? doc.images : [];
  return Boolean(cover || coverLegacy || images.length);
};

const pickProductImage = (doc: Doc) => {
  const text = `${normalizeString(doc.title)} ${normalizeString(doc.name)} ${normalizeString(doc.category)}`;
  if (text.includes("sony")) return productImages[0];
  if (text.includes("canon")) return productImages[1];
  if (text.includes("fuji") || text.includes("fujifilm")) return productImages[2];
  const id = String(doc._id);
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return productImages[hash % productImages.length];
};

const pickServiceImage = (doc: Doc) => {
  const text = `${normalizeString(doc.serviceCategory)} ${normalizeString(doc.category)} ${normalizeString(doc.title)} ${normalizeString(doc.name)}`;
  for (const [key, image] of Object.entries(serviceImageByKey)) {
    if (text.includes(key)) return image;
  }
  return `${apiBaseUrl}/static/placeholders/services/default.jpg`;
};

async function fillModel(
  kind: "product" | "service",
  Model: {
    find: (q: Record<string, unknown>) => { select: (fields: string) => { lean: () => Promise<Doc[]> } };
    updateOne: (q: Record<string, unknown>, u: Record<string, unknown>) => Promise<{ modifiedCount?: number }>;
  }
) {
  const docs = await Model.find({}).select("_id title name category serviceCategory images coverImageUrl coverImage").lean();
  let updated = 0;

  for (const doc of docs) {
    if (hasImage(doc)) continue;
    const image = kind === "product" ? pickProductImage(doc) : pickServiceImage(doc);
    const result = await Model.updateOne(
      { _id: doc._id },
      {
        $set: {
          images: [image],
          coverImageUrl: image,
          coverImage: image
        }
      }
    );
    if ((result as any).modifiedCount > 0) updated += 1;
  }

  return { scanned: docs.length, updated };
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");
  await connectDb(mongoUrl);

  const [products, services] = await Promise.all([fillModel("product", Product), fillModel("service", Service)]);

  console.log(
    JSON.stringify(
      {
        productScanned: products.scanned,
        productUpdated: products.updated,
        serviceScanned: services.scanned,
        serviceUpdated: services.updated
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("fillMissingListingImages failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
