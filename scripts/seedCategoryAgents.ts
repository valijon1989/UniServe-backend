import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectDb } from "../src/config/db";
import { User } from "../src/models/User";
import { AgentProfile } from "../src/models/AgentProfile";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { getProductImages, stubProducts } from "../src/data/stubProducts";

type CategorySeedResult = {
  createdUsers: number;
  createdProfiles: number;
  createdProducts: number;
  createdServices: number;
};

const serviceCategories = [
  "language",
  "translation",
  "consulting",
  "legal",
  "delivery",
  "repair",
  "education",
  "construction"
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const pickServiceKind = (category: string) =>
  ["delivery", "repair", "construction"].includes(category) ? "MATERIAL" : "SOCIAL";

async function upsertAgentUser(email: string, username: string, name: string, role: "SELLER" | "SERVICE") {
  let user = await User.findOne({ email });
  if (!user) {
    const hash = await bcrypt.hash("Agent123!", 10);
    user = await User.create({
      email,
      passwordHash: hash,
      name,
      username,
      role: "AGENT",
      isVerified: true,
      isPrivate: false
    });
  } else {
    user.name = name;
    user.username = user.username || username;
    user.role = "AGENT";
    user.isVerified = true;
    await user.save();
  }

  let profile = await AgentProfile.findOne({ user: user._id });
  let createdProfile = false;
  if (!profile) {
    profile = await AgentProfile.create({
      user: user._id,
      kind: role,
      socialServices: role === "SERVICE" ? ["Consulting"] : [],
      materialServices: role === "SELLER" ? ["Product sales"] : [],
      rating: 4.4,
      ratingCount: 5,
      profileViews: 0,
      profileLikes: 0,
      verifiedByAdmin: true
    });
    createdProfile = true;
  }

  return { user, profile, createdProfile };
}

async function seedSellerAgents(categories: string[]): Promise<CategorySeedResult> {
  let createdUsers = 0;
  let createdProfiles = 0;
  let createdProducts = 0;

  for (const category of categories) {
    const slug = slugify(category);

    for (let i = 1; i <= 2; i += 1) {
      const email = `seller-${slug}-${i}@agents.local`;
      const username = `seller_${slug}_${i}`;
      const name = `Seller ${category} ${i}`;
      const existingUser = await User.findOne({ email });

      const { user, createdProfile } = await upsertAgentUser(email, username, name, "SELLER");
      if (!existingUser) createdUsers += 1;
      if (createdProfile) createdProfiles += 1;

      const title = `${category} product ${i}`;
      const existingProduct = await Product.findOne({ createdBy: user._id, title });
      if (!existingProduct) {
        await Product.create({
          title,
          description: `${category} bo'yicha demo mahsulot`,
          price: 150000 + i * 50000,
          currency: "UZS",
          images: getProductImages(`${slug}-product-${i}`, category, title),
          category,
          status: "ACTIVE",
          likes: 0,
          views: 0,
          orders: 0,
          createdBy: user._id
        });
        createdProducts += 1;
      }
    }
  }

  return { createdUsers, createdProfiles, createdProducts, createdServices: 0 };
}

async function seedServiceAgents(categories: string[]): Promise<CategorySeedResult> {
  let createdUsers = 0;
  let createdProfiles = 0;
  let createdServices = 0;

  for (const category of categories) {
    const slug = slugify(category);

    for (let i = 1; i <= 2; i += 1) {
      const email = `service-${slug}-${i}@agents.local`;
      const username = `service_${slug}_${i}`;
      const name = `Service ${category} ${i}`;
      const existingUser = await User.findOne({ email });

      const { user, createdProfile } = await upsertAgentUser(email, username, name, "SERVICE");
      if (!existingUser) createdUsers += 1;
      if (createdProfile) createdProfiles += 1;

      const profile = await AgentProfile.findOne({ user: user._id });
      if (profile) {
        profile.serviceCategory = category as any;
        profile.verifiedByAdmin = true;
        await profile.save();
      }

      const title = `${category} service ${i}`;
      const existingService = await Service.findOne({ createdBy: user._id, title });
      if (!existingService) {
        await Service.create({
          title,
          description: `${category} bo'yicha demo xizmat`,
          kind: pickServiceKind(category) as any,
          category,
          hourlyRate: 10 + i * 5,
          currency: "USD",
          location: "Tashkent",
          likes: 0,
          views: 0,
          orders: 0,
          createdBy: user._id
        });
        createdServices += 1;
      }
    }
  }

  return { createdUsers, createdProfiles, createdProducts: 0, createdServices };
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL not set");
  }

  await connectDb(mongoUrl);

  const productCategories = Array.from(new Set(stubProducts.map((p) => p.category)));

  const sellerResult = await seedSellerAgents(productCategories);
  const serviceResult = await seedServiceAgents(serviceCategories);

  console.log(
    JSON.stringify({
      productCategories: productCategories.length,
      serviceCategories: serviceCategories.length,
      createdUsers: sellerResult.createdUsers + serviceResult.createdUsers,
      createdProfiles: sellerResult.createdProfiles + serviceResult.createdProfiles,
      createdProducts: sellerResult.createdProducts,
      createdServices: serviceResult.createdServices
    })
  );
}

run().catch((err) => {
  console.error("Failed to seed category agents:", err);
  process.exit(1);
});
