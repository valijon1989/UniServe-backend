import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Post } from "../src/models/Post";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const UNSPLASH_BASE = "https://images.unsplash.com";

const buildFallbackImages = (identifier: string, category?: string) => {
  const keyword = (category || "community").replace(/\s+/g, "+").toLowerCase();
  return Array.from({ length: 3 }).map((_, index) => {
    return `${UNSPLASH_BASE}/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80&sig=${encodeURIComponent(
      `${identifier}-${index}`
    )}&${keyword}`;
  });
};

const run = async () => {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error("MONGO_URL is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log("Connected to MongoDB");

  const posts = await Post.find({}).limit(200);
  let updated = 0;
  for (const post of posts) {
    const hasImages = Array.isArray(post.images) && post.images.length > 0;
    const hasAttachmentImage =
      Array.isArray(post.attachments) && post.attachments.some((attachment) => attachment.type?.startsWith("image"));
    if (!hasImages) {
      const idKey = post.slug || post._id?.toString() || "post";
      post.images = buildFallbackImages(idKey, post.category);
      updated += 1;
    }
    if (!hasAttachmentImage && post.images.length) {
      const [imageUrl] = post.images;
      post.attachments = post.attachments || [];
      post.attachments.push({ type: "image", url: imageUrl });
    }
    await post.save();
  }

  console.log(`Processed ${posts.length} posts, updated ${updated} with fallback images.`);
  await mongoose.disconnect();
};

run()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed to update post images", err);
    process.exit(1);
  });
