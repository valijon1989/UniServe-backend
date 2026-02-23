import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { NewsPost } from "../src/models/NewsPost";
import { Post } from "../src/models/Post";

const EXCLUDED_NEWS_CATEGORIES = new Set([
  "product",
  "products",
  "service",
  "services",
  "listing",
  "listings",
  "marketplace",
  "construction",
  "education",
  "taxi",
  "delivery"
]);

const normalizeCategory = (value: unknown): string => String(value || "community").trim().toLowerCase();

const mapCategory = (value: unknown): string => {
  const normalized = normalizeCategory(value);
  if (EXCLUDED_NEWS_CATEGORIES.has(normalized)) return "community";
  return normalized || "community";
};

const mapStatus = (value: unknown): "active" | "pending" | "blocked" => {
  const status = String(value || "").toLowerCase();
  if (status === "published") return "active";
  if (status === "blocked") return "blocked";
  return "pending";
};

const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const makeUniqueSlug = async (baseSlug: string, used: Set<string>): Promise<string> => {
  const base = (baseSlug || "news-post").trim().toLowerCase();
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  const pattern = `^${escapeRegex(base)}(?:-n\\d+)?$`;
  const existing = await Post.find({ slug: { $regex: pattern, $options: "i" } })
    .select("slug")
    .lean();
  const taken = new Set(
    existing
      .map((item: any) => String(item.slug || "").trim().toLowerCase())
      .filter(Boolean)
  );
  let index = 2;
  let next = `${base}-n${index}`;
  while (used.has(next) || taken.has(next)) {
    index += 1;
    next = `${base}-n${index}`;
  }
  used.add(next);
  return next;
};

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");
  await connectDb(mongoUrl);

  const migrationPrefix = "newspost:";
  const [newsItems, existingMigrated, existingSlugs] = await Promise.all([
    NewsPost.find({}).sort({ createdAt: 1 }).lean(),
    Post.find({ "attachments.url": { $regex: `^${migrationPrefix}` } })
      .select("attachments")
      .lean(),
    Post.find({}).select("slug").lean()
  ]);

  const alreadyMigratedIds = new Set<string>();
  for (const post of existingMigrated) {
    const attachments = Array.isArray((post as any).attachments) ? (post as any).attachments : [];
    for (const item of attachments) {
      const url = String(item?.url || "");
      if (!url.startsWith(migrationPrefix)) continue;
      alreadyMigratedIds.add(url.slice(migrationPrefix.length));
    }
  }

  const usedSlugs = new Set(
    existingSlugs
      .map((item: any) => String(item.slug || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const docsToInsert: any[] = [];
  let skipped = 0;
  let remappedCategories = 0;

  for (const news of newsItems) {
    const sourceId = String((news as any)._id);
    if (alreadyMigratedIds.has(sourceId)) {
      skipped += 1;
      continue;
    }

    const originalCategory = normalizeCategory((news as any).category);
    const mappedCategory = mapCategory((news as any).category);
    if (originalCategory !== mappedCategory) remappedCategories += 1;

    const slug = await makeUniqueSlug(String((news as any).slug || ""), usedSlugs);
    const coverImage = String((news as any).coverImage || "").trim();
    const content = String((news as any).content || "").trim();
    const excerpt = String((news as any).excerpt || "").trim();
    const sourceUrl = String((news as any).sourceUrl || "").trim();
    const type = String((news as any).type || "article").trim().toLowerCase();

    docsToInsert.push({
      author: (news as any).author,
      title: String((news as any).title || "").trim() || "News",
      slug,
      excerpt: excerpt || content.slice(0, 200),
      content,
      text: content,
      images: coverImage ? [coverImage] : [],
      videoUrl: "",
      category: mappedCategory,
      type,
      location: String((news as any).location || "").trim(),
      language: String((news as any).language || "Uzbek").trim(),
      sourceUrl,
      attachments: [
        {
          type: "migration",
          url: `${migrationPrefix}${sourceId}`,
          name: "legacy-news"
        }
      ],
      isFeatured: Boolean((news as any).isFeatured),
      isActive: Boolean((news as any).isActive),
      status: mapStatus((news as any).status),
      views: Number((news as any).views || 0),
      likes: Array.isArray((news as any).likes) ? (news as any).likes : [],
      reports: Number((news as any).reports || 0),
      comments: [],
      createdAt: (news as any).createdAt || new Date(),
      updatedAt: (news as any).updatedAt || new Date()
    });
  }

  if (docsToInsert.length) {
    await Post.collection.insertMany(docsToInsert, { ordered: false });
  }

  console.log(
    JSON.stringify(
      {
        newsTotal: newsItems.length,
        inserted: docsToInsert.length,
        skippedAlreadyMigrated: skipped,
        remappedCategories
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("migrateNewsPostsToPosts failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});

