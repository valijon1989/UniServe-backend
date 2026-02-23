import "dotenv/config";
import { connectDb } from "../src/config/db";
import { User } from "../src/models/User";
import { AgentProfile } from "../src/models/AgentProfile";
import { Product } from "../src/models/Product";
import { stubProducts } from "../src/data/stubProducts";

async function ensureSeedUser() {
  let user = await User.findOne({ role: "AGENT" }).sort({ createdAt: 1 });
  if (!user) {
    user = await User.findOne().sort({ createdAt: 1 });
  }
  if (!user) {
    throw new Error("No users found to assign stub products.");
  }

  const updates: Record<string, any> = {};
  if (user.role !== "AGENT") updates.role = "AGENT";
  if (!user.isVerified) updates.isVerified = true;
  if (Object.keys(updates).length) {
    await User.updateOne({ _id: user._id }, { $set: updates });
  }

  const existingProfile = await AgentProfile.findOne({ user: user._id }).lean();
  if (!existingProfile) {
    await AgentProfile.create({
      user: user._id,
      kind: "SELLER",
      socialServices: [],
      materialServices: [],
      verifiedByAdmin: true
    });
  }

  return user;
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL not set");
  }

  await connectDb(mongoUrl);

  const seedUser = await ensureSeedUser();

  const existing = await Product.find({ createdBy: seedUser._id })
    .select("title category price")
    .lean();
  const existingKeys = new Set(existing.map((p) => `${p.title}||${p.category}||${p.price}`));

  const toInsert = stubProducts
    .map((p) => ({
      title: p.name,
      description: p.description,
      price: p.price,
      currency: "UZS",
      images: p.images,
      category: p.category,
      status: "ACTIVE",
      likes: p.stats?.likes ?? 0,
      views: p.stats?.views ?? 0,
      orders: p.stats?.purchases ?? 0,
      createdBy: seedUser._id
    }))
    .filter((p) => !existingKeys.has(`${p.title}||${p.category}||${p.price}`));

  if (toInsert.length) {
    await Product.insertMany(toInsert);
  }

  console.log(
    JSON.stringify({
      seedUser: String(seedUser._id),
      totalStub: stubProducts.length,
      inserted: toInsert.length,
      skipped: stubProducts.length - toInsert.length
    })
  );
}

run().catch((err) => {
  console.error("Failed to seed stub products:", err);
  process.exit(1);
});
