import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { EducationListing } from "../src/models/EducationListing";
import { ConstructionListing } from "../src/models/ConstructionListing";
import { TaxiListing } from "../src/models/TaxiListing";
import { apiBaseUrl } from "../src/utils/imageHelpers";
import { localImageExists, normalizeCoverImageUrl, resolveCoverImage, sanitizeImageArray } from "../src/utils/resolveCoverImage";

type ListingKind = "products" | "services" | "education" | "construction" | "taxi";

type RawDoc = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  serviceCategory?: string;
  images?: unknown;
  coverImageUrl?: unknown;
  coverImage?: unknown;
  imageUrl?: unknown;
  image?: unknown;
  thumbnail?: unknown;
};

type Summary = {
  scanned: number;
  updated: number;
  generatedImages: number;
  replacedDuplicateImages: number;
  filledMissingImages: number;
};

const OUTPUT_ROOT = path.join(process.cwd(), "static", "generated", "listings");
const ORIGIN = apiBaseUrl.replace(/\/+$/, "");
const MIN_IMAGES = 3;

const ensureDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const normalizeText = (value: unknown): string => String(value || "").trim();

const hash = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const paletteFor = (seed: string) => {
  const h = hash(seed);
  const c1 = `hsl(${h % 360} 70% 52%)`;
  const c2 = `hsl(${(h >> 3) % 360} 68% 34%)`;
  const c3 = `hsl(${(h >> 7) % 360} 72% 20%)`;
  return { c1, c2, c3 };
};

const shortText = (input: string, max = 44): string => {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Listing";
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 3)}...`;
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildSvg = (kind: ListingKind, title: string, topic: string, seed: string): string => {
  const { c1, c2, c3 } = paletteFor(`${kind}:${seed}`);
  const safeTitle = escapeXml(shortText(title, 52));
  const safeTopic = escapeXml(shortText(topic, 38));
  const safeKind = escapeXml(kind.toUpperCase());

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="55%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <rect x="48" y="48" width="1104" height="704" rx="26" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.28)"/>
  <text x="90" y="154" fill="#ffffff" font-family="Arial, sans-serif" font-size="44" font-weight="700">${safeTitle}</text>
  <text x="90" y="212" fill="rgba(255,255,255,0.92)" font-family="Arial, sans-serif" font-size="28" font-weight="500">Topic: ${safeTopic}</text>
  <text x="90" y="260" fill="rgba(255,255,255,0.82)" font-family="Arial, sans-serif" font-size="22">Category image generated for this listing only</text>
  <text x="90" y="706" fill="rgba(255,255,255,0.88)" font-family="Arial, sans-serif" font-size="24" font-weight="700">${safeKind}</text>
  <circle cx="1008" cy="208" r="122" fill="rgba(255,255,255,0.16)"/>
  <circle cx="936" cy="552" r="176" fill="rgba(255,255,255,0.10)"/>
</svg>`;
};

const topicFromDoc = (kind: ListingKind, doc: RawDoc): string => {
  const parts = [
    normalizeText(doc.category),
    normalizeText(doc.subcategory),
    normalizeText(doc.serviceCategory),
    normalizeText(doc.title),
    normalizeText(doc.name)
  ].filter(Boolean);
  if (parts.length) return parts.join(" | ");
  return kind;
};

const titleFromDoc = (doc: RawDoc): string => normalizeText(doc.title) || normalizeText(doc.name) || "Listing";

const relativeToAbsolute = (relativePath: string): string => `${ORIGIN}/${relativePath.replace(/^\/+/, "")}`;

const writeGeneratedImage = (kind: ListingKind, docId: string, index: number, title: string, topic: string): string => {
  const dir = path.join(OUTPUT_ROOT, kind);
  ensureDir(dir);
  const fileName = `${docId}-${index + 1}.svg`;
  const fullPath = path.join(dir, fileName);
  const relativePath = path.posix.join("static", "generated", "listings", kind, fileName);
  const svg = buildSvg(kind, title, topic, `${docId}-${index + 1}`);
  fs.writeFileSync(fullPath, svg, "utf8");
  return relativeToAbsolute(relativePath);
};

const uniquePush = (arr: string[], value: string) => {
  if (!arr.includes(value)) arr.push(value);
};

const candidateImages = (doc: RawDoc): string[] => {
  const out: string[] = [];
  const cover = resolveCoverImage(doc);
  if (cover) uniquePush(out, cover);
  for (const img of sanitizeImageArray(doc.images)) uniquePush(out, img);
  const manual = [doc.coverImageUrl, doc.coverImage, doc.imageUrl, doc.image, doc.thumbnail]
    .map((v) => normalizeCoverImageUrl(v))
    .filter(Boolean) as string[];
  for (const img of manual) uniquePush(out, img);
  return out;
};

async function processCollection(
  kind: ListingKind,
  Model: {
    find: (query: Record<string, unknown>) => { select: (fields: string) => { sort: (spec: Record<string, 1 | -1>) => { lean: () => Promise<RawDoc[]> } } };
    updateOne: (query: Record<string, unknown>, update: Record<string, unknown>) => Promise<{ modifiedCount?: number }>;
  },
  usedUrls: Set<string>
): Promise<Summary> {
  const docs = await Model.find({})
    .select("_id title name category subcategory serviceCategory images coverImageUrl coverImage imageUrl image thumbnail")
    .sort({ createdAt: -1 })
    .lean();

  let updated = 0;
  let generatedImages = 0;
  let replacedDuplicateImages = 0;
  let filledMissingImages = 0;

  for (const doc of docs) {
    const listingId = String(doc._id);
    const title = titleFromDoc(doc);
    const topic = topicFromDoc(kind, doc);
    const candidates = candidateImages(doc);

    const nextImages: string[] = [];

    for (const img of candidates) {
      if (!img) continue;
      if (usedUrls.has(img)) {
        replacedDuplicateImages += 1;
        continue;
      }
      if (!localImageExists(img)) continue;
      usedUrls.add(img);
      uniquePush(nextImages, img);
      if (nextImages.length >= MIN_IMAGES) break;
    }

    if (nextImages.length === 0) {
      filledMissingImages += 1;
    }

    while (nextImages.length < MIN_IMAGES) {
      const generated = writeGeneratedImage(kind, listingId, nextImages.length, title, topic);
      if (usedUrls.has(generated)) {
        const regenerated = writeGeneratedImage(kind, `${listingId}-${hash(generated)}`, nextImages.length, title, topic);
        usedUrls.add(regenerated);
        uniquePush(nextImages, regenerated);
      } else {
        usedUrls.add(generated);
        uniquePush(nextImages, generated);
      }
      generatedImages += 1;
    }

    const cover = nextImages[0] || null;
    const updateSet: Record<string, unknown> = { images: nextImages };

    if (kind === "products" || kind === "services") {
      updateSet.coverImageUrl = cover;
      updateSet.coverImage = cover;
      updateSet.cardImageUrl = cover;
      updateSet.imageUrl = cover;
      updateSet.image = cover;
      updateSet.thumbnail = cover;
    }

    const res = await Model.updateOne({ _id: doc._id }, { $set: updateSet });
    if ((res.modifiedCount || 0) > 0) updated += 1;
  }

  return {
    scanned: docs.length,
    updated,
    generatedImages,
    replacedDuplicateImages,
    filledMissingImages
  };
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");

  ensureDir(OUTPUT_ROOT);
  await connectDb(mongoUrl);

  const usedUrls = new Set<string>();

  const [products, services, education, construction, taxi] = await Promise.all([
    processCollection("products", Product as any, usedUrls),
    processCollection("services", Service as any, usedUrls),
    processCollection("education", EducationListing as any, usedUrls),
    processCollection("construction", ConstructionListing as any, usedUrls),
    processCollection("taxi", TaxiListing as any, usedUrls)
  ]);

  const totals = [products, services, education, construction, taxi].reduce(
    (acc, item) => {
      acc.scanned += item.scanned;
      acc.updated += item.updated;
      acc.generatedImages += item.generatedImages;
      acc.replacedDuplicateImages += item.replacedDuplicateImages;
      acc.filledMissingImages += item.filledMissingImages;
      return acc;
    },
    { scanned: 0, updated: 0, generatedImages: 0, replacedDuplicateImages: 0, filledMissingImages: 0 }
  );

  console.log(
    JSON.stringify(
      {
        products,
        services,
        education,
        construction,
        taxi,
        totals
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("fixListingTopicImages failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
