import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { AgentProfile } from "../src/models/AgentProfile";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { User } from "../src/models/User";

type ProductSeed = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  price: number;
  oldPrice?: number;
  salePrice?: number;
  discountPercent?: number;
  images: string[];
  coverImageUrl: string;
  likes: number;
  views: number;
  orders: number;
  likes_7d: number;
  views_7d: number;
  orders_7d: number;
};

type ServiceSeed = {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: "SOCIAL" | "MATERIAL";
  category: string;
  hourlyRate: number;
  price: number;
  oldPrice?: number;
  salePrice?: number;
  discountPercent?: number;
  images: string[];
  coverImageUrl: string;
  likes: number;
  views: number;
  orders: number;
  likes_7d: number;
  views_7d: number;
  orders_7d: number;
};

const PRODUCT_SEEDS: ProductSeed[] = [
  {
    id: "65f100000000000000000001",
    slug: "seed-sale-product-alpha",
    title: "Seed Sale Product Alpha",
    description: "Home demo: sale product #1",
    category: "electronics",
    price: 2500000,
    salePrice: 1990000,
    images: ["/static/products/sony_a7iv.jpg", "/static/products/canon_r6m2.jpg", "/static/products/fuji_xs20.jpg"],
    coverImageUrl: "/static/products/sony_a7iv.jpg",
    likes: 120,
    views: 3400,
    orders: 190,
    likes_7d: 30,
    views_7d: 900,
    orders_7d: 25
  },
  {
    id: "65f100000000000000000002",
    slug: "seed-sale-product-beta",
    title: "Seed Sale Product Beta",
    description: "Home demo: sale product #2",
    category: "appliances",
    price: 1800000,
    discountPercent: 15,
    images: ["/static/products/canon_r6m2.jpg", "/static/products/sony_a7iv.jpg", "/static/products/fuji_xs20.jpg"],
    coverImageUrl: "/static/products/canon_r6m2.jpg",
    likes: 88,
    views: 2900,
    orders: 122,
    likes_7d: 18,
    views_7d: 600,
    orders_7d: 14
  },
  {
    id: "65f100000000000000000003",
    slug: "seed-sale-product-gamma",
    title: "Seed Sale Product Gamma",
    description: "Home demo: sale product #3",
    category: "smart-home",
    price: 1200000,
    oldPrice: 1200000,
    salePrice: 950000,
    images: ["/static/products/fuji_xs20.jpg", "/static/products/sony_a7iv.jpg", "/static/products/canon_r6m2.jpg"],
    coverImageUrl: "/static/products/fuji_xs20.jpg",
    likes: 64,
    views: 1600,
    orders: 80,
    likes_7d: 8,
    views_7d: 250,
    orders_7d: 7
  },
  {
    id: "65f100000000000000000004",
    slug: "seed-normal-product-delta",
    title: "Seed Normal Product Delta",
    description: "Home demo: regular product #1",
    category: "office",
    price: 1100000,
    images: ["/static/products/sony_a7iv.jpg", "/static/products/fuji_xs20.jpg", "/static/products/canon_r6m2.jpg"],
    coverImageUrl: "/static/products/sony_a7iv.jpg",
    likes: 40,
    views: 900,
    orders: 41,
    likes_7d: 5,
    views_7d: 120,
    orders_7d: 3
  },
  {
    id: "65f100000000000000000005",
    slug: "seed-normal-product-epsilon",
    title: "Seed Normal Product Epsilon",
    description: "Home demo: regular product #2",
    category: "household",
    price: 670000,
    images: ["/static/products/canon_r6m2.jpg", "/static/products/fuji_xs20.jpg", "/static/products/sony_a7iv.jpg"],
    coverImageUrl: "/static/products/canon_r6m2.jpg",
    likes: 28,
    views: 640,
    orders: 19,
    likes_7d: 2,
    views_7d: 90,
    orders_7d: 1
  }
];

const SERVICE_SEEDS: ServiceSeed[] = [
  {
    id: "65f100000000000000000006",
    slug: "seed-sale-service-delta",
    title: "Seed Sale Service Delta",
    description: "Home demo: sale service #1",
    kind: "MATERIAL",
    category: "delivery",
    hourlyRate: 320000,
    price: 320000,
    salePrice: 250000,
    images: ["/static/services/delivery/14.jpg", "/static/services/translation/14.jpg", "/static/services/consulting/14.jpg"],
    coverImageUrl: "/static/services/delivery/14.jpg",
    likes: 96,
    views: 2600,
    orders: 144,
    likes_7d: 22,
    views_7d: 700,
    orders_7d: 19
  },
  {
    id: "65f100000000000000000007",
    slug: "seed-sale-service-epsilon",
    title: "Seed Sale Service Epsilon",
    description: "Home demo: sale service #2",
    kind: "SOCIAL",
    category: "translation",
    hourlyRate: 280000,
    price: 280000,
    discountPercent: 20,
    images: ["/static/services/translation/14.jpg", "/static/services/delivery/14.jpg", "/static/services/legal/law-4-1-1.jpg"],
    coverImageUrl: "/static/services/translation/14.jpg",
    likes: 84,
    views: 2200,
    orders: 116,
    likes_7d: 15,
    views_7d: 540,
    orders_7d: 13
  },
  {
    id: "65f100000000000000000008",
    slug: "seed-sale-service-zeta",
    title: "Seed Sale Service Zeta",
    description: "Home demo: sale service #3",
    kind: "SOCIAL",
    category: "consulting",
    hourlyRate: 190000,
    price: 190000,
    oldPrice: 190000,
    salePrice: 150000,
    images: ["/static/services/consulting/14.jpg", "/static/services/cleaning/14.jpg", "/static/services/delivery/14.jpg"],
    coverImageUrl: "/static/services/consulting/14.jpg",
    likes: 72,
    views: 1800,
    orders: 91,
    likes_7d: 11,
    views_7d: 430,
    orders_7d: 9
  },
  {
    id: "65f100000000000000000009",
    slug: "seed-normal-service-eta",
    title: "Seed Normal Service Eta",
    description: "Home demo: regular service #1",
    kind: "MATERIAL",
    category: "cleaning",
    hourlyRate: 120000,
    price: 120000,
    images: ["/static/services/cleaning/14.jpg", "/static/services/delivery/14.jpg", "/static/services/translation/14.jpg"],
    coverImageUrl: "/static/services/cleaning/14.jpg",
    likes: 32,
    views: 820,
    orders: 34,
    likes_7d: 6,
    views_7d: 210,
    orders_7d: 4
  },
  {
    id: "65f100000000000000000010",
    slug: "seed-weekly-top-service-omega",
    title: "Seed Weekly Top Service Omega",
    description: "Home demo: expected weekly top item",
    kind: "MATERIAL",
    category: "delivery",
    hourlyRate: 450000,
    price: 450000,
    images: ["/static/services/delivery/14.jpg", "/static/services/legal/law-4-1-1.jpg", "/static/services/consulting/14.jpg"],
    coverImageUrl: "/static/services/delivery/14.jpg",
    likes: 170,
    views: 5200,
    orders: 260,
    likes_7d: 40,
    views_7d: 1500,
    orders_7d: 31
  }
];

const ensureSeedAgent = async () => {
  let user = await User.findOne({ role: "AGENT" }).sort({ createdAt: 1 });
  if (!user) {
    user = await User.findOne().sort({ createdAt: 1 });
  }
  if (!user) {
    throw new Error("No users found. Create at least one user before running seed.");
  }

  const updates: Record<string, unknown> = {};
  if (user.role !== "AGENT") updates.role = "AGENT";
  if (!user.isVerified) updates.isVerified = true;
  if (Object.keys(updates).length) {
    await User.updateOne({ _id: user._id }, { $set: updates });
  }

  const profile = await AgentProfile.findOne({ user: user._id }).lean();
  if (!profile) {
    await AgentProfile.create({
      user: user._id,
      kind: "SELLER",
      socialServices: ["consulting", "translation"],
      materialServices: ["delivery", "resale"],
      verifiedByAdmin: true
    });
  }

  return user;
};

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL not set");
  }

  await connectDb(mongoUrl);
  const seedUser = await ensureSeedAgent();

  let productInserted = 0;
  let productUpdated = 0;
  let serviceInserted = 0;
  let serviceUpdated = 0;

  for (const seed of PRODUCT_SEEDS) {
    const result = await Product.updateOne(
      { slug: seed.slug },
      {
        $set: {
          title: seed.title,
          slug: seed.slug,
          description: seed.description,
          category: seed.category,
          price: seed.price,
          oldPrice: seed.oldPrice,
          salePrice: seed.salePrice,
          discountPercent: seed.discountPercent,
          currency: "UZS",
          images: seed.images,
          coverImageUrl: seed.coverImageUrl,
          coverImage: seed.coverImageUrl,
          imageUrl: seed.coverImageUrl,
          image: seed.coverImageUrl,
          thumbnail: seed.coverImageUrl,
          status: "ACTIVE",
          likes: seed.likes,
          views: seed.views,
          orders: seed.orders,
          likes_7d: seed.likes_7d,
          views_7d: seed.views_7d,
          orders_7d: seed.orders_7d,
          createdBy: seedUser._id,
          ratingAvg: 4.7,
          ratingCount: 30
        },
        $setOnInsert: {
          _id: new mongoose.Types.ObjectId(seed.id)
        }
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      productInserted += 1;
    } else {
      productUpdated += 1;
    }
  }

  for (const seed of SERVICE_SEEDS) {
    const result = await Service.updateOne(
      { slug: seed.slug },
      {
        $set: {
          title: seed.title,
          slug: seed.slug,
          description: seed.description,
          kind: seed.kind,
          category: seed.category,
          hourlyRate: seed.hourlyRate,
          price: seed.price,
          oldPrice: seed.oldPrice,
          salePrice: seed.salePrice,
          discountPercent: seed.discountPercent,
          currency: "UZS",
          images: seed.images,
          coverImageUrl: seed.coverImageUrl,
          coverImage: seed.coverImageUrl,
          imageUrl: seed.coverImageUrl,
          image: seed.coverImageUrl,
          cardImageUrl: seed.coverImageUrl,
          likes: seed.likes,
          views: seed.views,
          orders: seed.orders,
          likes_7d: seed.likes_7d,
          views_7d: seed.views_7d,
          orders_7d: seed.orders_7d,
          createdBy: seedUser._id,
          ratingAvg: 4.8,
          ratingCount: 35
        },
        $setOnInsert: {
          _id: new mongoose.Types.ObjectId(seed.id)
        }
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      serviceInserted += 1;
    } else {
      serviceUpdated += 1;
    }
  }

  console.log(
    JSON.stringify({
      seededByUser: String(seedUser._id),
      products: { total: PRODUCT_SEEDS.length, inserted: productInserted, updated: productUpdated },
      services: { total: SERVICE_SEEDS.length, inserted: serviceInserted, updated: serviceUpdated }
    })
  );
}

run()
  .catch((err) => {
    console.error("Failed to seed home listings:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
