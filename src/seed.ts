import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "./models/User";
import { AgentProfile } from "./models/AgentProfile";
import { Product } from "./models/Product";
import { Service } from "./models/Service";
import { Post } from "./models/Post";
import { ConstructionListing } from "./models/ConstructionListing";
import { CommunityGroupModel } from "./models/CommunityGroup";
import { NewsPost } from "./models/NewsPost";
import { communityPostFixtures } from "./data/communityPosts";

export async function seedIfEmpty() {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log("➡️ Seed skipped (users already exist)");
    await seedAgentsIfMissing();
    await seedAgentListingsIfMissing();
    await seedCommunityGroupsIfMissing();
    await seedNewsIfMissing();
    return;
  }

  console.log("🌱 Seeding UniServe sample data...");

  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "Admin123!";
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@uniserve.com";
  const hashAdmin = await bcrypt.hash(adminPassword, 10);

  const admin = await User.create({
    email: adminEmail,
    passwordHash: hashAdmin,
    name: "UniServe Admin",
    username: "uniserve_admin",
    role: "ADMIN",
    isVerified: true,
    isPrivate: false,
    avatarUrl: "/static/avatars/admin.jpg",
    bio: "Global UniServe administrator"
  });

  const hashUser = await bcrypt.hash("User123!", 10);
  const users = await User.insertMany([
    {
      email: "user1@example.com",
      passwordHash: hashUser,
      name: "Social User 1",
      username: "user_one",
      role: "USER",
      isVerified: false,
      isPrivate: false,
      avatarUrl: "/static/avatars/user1.jpg",
      bio: "Just exploring UniServe"
    },
    {
      email: "user2@example.com",
      passwordHash: hashUser,
      name: "Social User 2",
      username: "user_two",
      role: "USER",
      isVerified: false,
      isPrivate: true,
      avatarUrl: "/static/avatars/user2.jpg",
      bio: "Private profile example"
    },
    {
      email: "user3@example.com",
      passwordHash: hashUser,
      name: "Social User 3",
      username: "user_three",
      role: "USER",
      isVerified: false,
      isPrivate: false,
      avatarUrl: "/static/avatars/user3.jpg",
      bio: "Sharing local news and updates"
    }
  ]);

  const hashAgent = await bcrypt.hash("Agent123!", 10);
  const agents = await User.insertMany([
    {
      email: "seller1@agents.com",
      passwordHash: hashAgent,
      name: "Seller Agent 1",
      username: "seller_one",
      role: "AGENT",
      isVerified: true,
      isPrivate: false,
      avatarUrl: "/static/avatars/agent1.jpg",
      bio: "Electronics & gadgets seller",
      region: "Seoul"
    },
    {
      email: "service1@agents.com",
      passwordHash: hashAgent,
      name: "Service Agent 1",
      username: "service_one",
      role: "AGENT",
      isVerified: true,
      isPrivate: false,
      avatarUrl: "/static/avatars/agent2.jpg",
      bio: "Language teacher & translator",
      region: "Cheonan"
    },
    {
      email: "construction1@agents.com",
      passwordHash: hashAgent,
      name: "Construction Agent 1",
      username: "construction_one",
      role: "AGENT",
      isVerified: true,
      isPrivate: false,
      avatarUrl: "/static/avatars/agent3.jpg",
      bio: "Fasad va tashqi qurilish ustasi",
      region: "Toshkent"
    },
    {
      email: "construction2@agents.com",
      passwordHash: hashAgent,
      name: "Construction Agent 2",
      username: "construction_two",
      role: "AGENT",
      isVerified: true,
      isPrivate: false,
      avatarUrl: "/static/avatars/agent4.jpg",
      bio: "Ichki ta'mirlash bo'yicha usta",
      region: "Samarqand"
    },
    {
      email: "construction3@agents.com",
      passwordHash: hashAgent,
      name: "Construction Agent 3",
      username: "construction_three",
      role: "AGENT",
      isVerified: true,
      isPrivate: false,
      avatarUrl: "/static/avatars/agent5.jpg",
      bio: "Tom yopish va beton ishlar",
      region: "Namangan"
    },
    {
      email: "construction4@agents.com",
      passwordHash: hashAgent,
      name: "Construction Agent 4",
      username: "construction_four",
      role: "AGENT",
      isVerified: true,
      isPrivate: false,
      avatarUrl: "/static/avatars/agent6.jpg",
      bio: "Dizayn va pardozlash xizmatlari",
      region: "Buxoro"
    }
  ]);

  const [seller1, service1, construction1, construction2, construction3, construction4] = agents;

  const agentProfiles = await AgentProfile.insertMany([
    {
      user: seller1._id,
      kind: "SELLER",
      socialServices: [],
      materialServices: ["Delivery", "Electronics resale"],
      rating: 4.8,
      verifiedByAdmin: true
    },
    {
      user: service1._id,
      kind: "SERVICE",
      socialServices: ["Language teaching", "Translation", "Consulting"],
      materialServices: [],
      rating: 4.9,
      verifiedByAdmin: true
    },
    {
      user: construction1._id,
      kind: "SERVICE",
      socialServices: [],
      materialServices: ["Construction"],
      rating: 4.9,
      verifiedByAdmin: true,
      serviceCategory: "construction",
      constructionAreas: ["exterior"],
      constructionServices: ["facade", "concrete", "bricklaying"],
      serviceOfficeAddress: "Toshkent, Yunusobod tumani",
      serviceQualification: "8 yil tajriba, jamoa bilan ishlash"
    },
    {
      user: construction2._id,
      kind: "SERVICE",
      socialServices: [],
      materialServices: ["Construction"],
      rating: 4.7,
      verifiedByAdmin: true,
      serviceCategory: "construction",
      constructionAreas: ["interior"],
      constructionServices: ["painting", "wallpaper", "doors-windows", "ceiling-repair"],
      serviceOfficeAddress: "Samarqand, Registon yaqinida",
      serviceQualification: "6 yil tajriba, toza va tez ish"
    },
    {
      user: construction3._id,
      kind: "SERVICE",
      socialServices: [],
      materialServices: ["Construction"],
      rating: 4.6,
      verifiedByAdmin: true,
      serviceCategory: "construction",
      constructionAreas: ["exterior"],
      constructionServices: ["roofing", "roof-repair", "concrete"],
      serviceOfficeAddress: "Namangan, Chorsu",
      serviceQualification: "Tom yopish va beton bo'yicha mutaxassis"
    },
    {
      user: construction4._id,
      kind: "SERVICE",
      socialServices: [],
      materialServices: ["Construction"],
      rating: 4.8,
      verifiedByAdmin: true,
      serviceCategory: "construction",
      constructionAreas: ["interior"],
      constructionServices: ["interior-design", "plastering", "tile"],
      serviceOfficeAddress: "Buxoro, Markaz",
      serviceQualification: "Dizayn va pardozlash bo'yicha 7 yil tajriba"
    }
  ]);

  await Product.insertMany([
    {
      slug: "seed-sony-a7-iv-body",
      title: "Sony A7 IV Body",
      description: "Full-frame mirrorless camera body, great for photo & video.",
      price: 2300,
      salePrice: 1990,
      discountPercent: 13,
      currency: "USD",
      images: ["/static/products/sony_a7iv.jpg"],
      category: "Camera",
      status: "ACTIVE",
      likes: 120,
      views: 2100,
      orders: 140,
      likes_7d: 32,
      views_7d: 640,
      orders_7d: 18,
      createdBy: seller1._id
    },
    {
      slug: "seed-canon-r6-mark-ii-kit",
      title: "Canon R6 Mark II Kit",
      description: "24-105mm lens included, perfect hybrid camera.",
      price: 2600,
      salePrice: 2240,
      discountPercent: 14,
      currency: "USD",
      images: ["/static/products/canon_r6m2.jpg"],
      category: "Camera",
      status: "ACTIVE",
      likes: 94,
      views: 1760,
      orders: 116,
      likes_7d: 21,
      views_7d: 520,
      orders_7d: 14,
      createdBy: seller1._id
    },
    {
      slug: "seed-fujifilm-xs20-vlogger-set",
      title: "Fujifilm X-S20 Vlogger Set",
      description: "APS-C camera with prime lens and mic for content creators.",
      price: 1800,
      salePrice: 1530,
      discountPercent: 15,
      currency: "USD",
      images: ["/static/products/fuji_xs20.jpg"],
      category: "Camera",
      status: "ACTIVE",
      likes: 88,
      views: 1490,
      orders: 92,
      likes_7d: 18,
      views_7d: 470,
      orders_7d: 12,
      createdBy: seller1._id
    }
  ]);

  await Service.insertMany([
    {
      slug: "seed-korean-language-class-online",
      title: "Korean Language Class (online)",
      description: "Beginner to intermediate Korean lessons via Zoom.",
      kind: "SOCIAL",
      category: "Language teaching",
      hourlyRate: 25,
      price: 25,
      salePrice: 20,
      discountPercent: 20,
      currency: "USD",
      location: "Online",
      likes: 102,
      views: 1950,
      orders: 123,
      likes_7d: 28,
      views_7d: 610,
      orders_7d: 19,
      images: [
        "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=800&q=80"
      ],
      createdBy: service1._id
    },
    {
      slug: "seed-document-translation-korean-english",
      title: "Document Translation (Korean-English)",
      description: "Official-style translation for study & migration documents.",
      kind: "SOCIAL",
      category: "Translation",
      hourlyRate: 30,
      price: 30,
      salePrice: 24,
      discountPercent: 20,
      currency: "USD",
      location: "Cheonan",
      likes: 96,
      views: 1820,
      orders: 114,
      likes_7d: 24,
      views_7d: 560,
      orders_7d: 16,
      images: [
        "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=800&q=80"
      ],
      createdBy: service1._id
    },
    {
      slug: "seed-airport-delivery-support",
      title: "Airport Delivery Support",
      description: "Helping with luggage, pickup and delivery in Seoul area.",
      kind: "MATERIAL",
      category: "Delivery",
      hourlyRate: 20,
      price: 20,
      salePrice: 16,
      discountPercent: 20,
      currency: "USD",
      location: "Seoul",
      likes: 84,
      views: 1640,
      orders: 101,
      likes_7d: 20,
      views_7d: 490,
      orders_7d: 13,
      images: [
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80"
      ],
      createdBy: service1._id
    }
  ]);

  const constructionTemplates = [
    {
      category: "exterior",
      subcategory: "facade",
      titleBase: "Tashqi fasad ishlari",
      description: "Fasadni bezash, izolatsiya va mustahkamlash xizmatlari.",
      imageTag: "building-facade"
    },
    {
      category: "exterior",
      subcategory: "concrete",
      titleBase: "Beton ishlari",
      description: "Monolit va beton quyish ishlari, mustahkam poydevor.",
      imageTag: "concrete-work"
    },
    {
      category: "exterior",
      subcategory: "bricklaying",
      titleBase: "G'isht terish",
      description: "G'isht terish, devor va to'siqlarni barpo etish.",
      imageTag: "bricklaying"
    },
    {
      category: "exterior",
      subcategory: "roofing",
      titleBase: "Tom yopish",
      description: "Tom yopish va montaj ishlari, turli materiallar.",
      imageTag: "roofing"
    },
    {
      category: "exterior",
      subcategory: "roof-repair",
      titleBase: "Tom ta'mirlash",
      description: "Tomdagi nosozliklarni bartaraf etish va yangilash.",
      imageTag: "roof-repair"
    },
    {
      category: "interior",
      subcategory: "painting",
      titleBase: "Ichki bo'yoq ishlari",
      description: "Xonalarni bo'yash, rang tanlash va sifatli pardoz.",
      imageTag: "interior-painting"
    },
    {
      category: "interior",
      subcategory: "wallpaper",
      titleBase: "Gul qog'oz yopishtirish",
      description: "Gul qog'ozlarni toza va tekis yopishtirish xizmati.",
      imageTag: "wallpaper-installation"
    },
    {
      category: "interior",
      subcategory: "interior-design",
      titleBase: "Ichki dizayn",
      description: "Ichki dizayn va rejalashtirish, shaxsiy yondashuv.",
      imageTag: "interior-design"
    },
    {
      category: "interior",
      subcategory: "doors-windows",
      titleBase: "Eshik va deraza romlari",
      description: "Eshik va deraza romlarini o'rnatish va sozlash.",
      imageTag: "doors-windows"
    },
    {
      category: "interior",
      subcategory: "ceiling-repair",
      titleBase: "Shift ta'mirlash",
      description: "Shiftlarni tekislash, gipsokarton va bezak ishlari.",
      imageTag: "ceiling-repair"
    }
  ];

  const constructionAgents = [construction1, construction2, construction3, construction4];
  let imageCounter = 1;

  const constructionListings = constructionTemplates.flatMap((template) =>
    Array.from({ length: 3 }).map((_, index) => {
      const agent = constructionAgents[(imageCounter - 1) % constructionAgents.length];
      const priceBase = 150000 + index * 30000;
      const imageUrl = `https://source.unsplash.com/featured/?${template.imageTag}&sig=${imageCounter}`;
      imageCounter += 1;
      return {
        agentId: agent._id,
        title: `${template.titleBase} ${index + 1}`,
        category: template.category,
        subcategory: template.subcategory,
        description: template.description,
        location: agent.region || "Toshkent",
        priceFrom: priceBase,
        priceTo: priceBase + 120000,
        currency: "UZS",
        images: [imageUrl],
        status: "active"
      };
    })
  );

  await ConstructionListing.insertMany(constructionListings);

  await seedCommunityGroupsIfMissing(admin._id);
  const specialSlugs = ["g-consult-001", "g-translation-002", "g-tech-003"];
  const seededSpecialGroups = await CommunityGroupModel.find({ slug: { $in: specialSlugs } });
  const slugToGroupId: Record<string, mongoose.Types.ObjectId> = {};
  seededSpecialGroups.forEach((group) => {
    if (group.slug) {
      slugToGroupId[group.slug] = group._id;
    }
  });
  const defaultGroupId =
    seededSpecialGroups.length > 0 ? seededSpecialGroups[0]._id : users[0]._id; // fallback

  for (const fixture of communityPostFixtures) {
    const slug = fixture.slug;
    const exists = await Post.findOne({ slug });
    if (exists) continue;
    const groupId = slugToGroupId[fixture.groupSlug] || defaultGroupId;
    const authorId =
      fixture.authorRole === "AGENT"
        ? agents[0]._id
        : users[Math.floor(Math.random() * users.length)]._id;
    const likesCount = Math.max(1, fixture.likes);
    const likesArray = Array.from({ length: likesCount }, () => users[0]._id);
    const commentsSample = Array.from({ length: fixture.replies }).map(() => ({
      user: users[0]._id,
      text: "Admin javobi",
      createdAt: new Date()
    }));

    await Post.create({
      author: authorId,
      slug,
      excerpt: fixture.body.slice(0, 120),
      text: fixture.body,
      content: fixture.body,
      images: fixture.attachments
        .filter((a) => a.type === "image")
        .map((a) => a.url),
      videoUrl: fixture.attachments.find((a) => a.type === "video")?.url || "",
      category: fixture.category,
      type: fixture.type,
      communityGroup: groupId,
      language: "Uzbek",
      isFeatured: false,
      isActive: true,
      status: "active",
      attachments: fixture.attachments,
      likes: likesArray,
      comments: commentsSample,
      createdAt: new Date(fixture.createdAt),
      updatedAt: new Date(fixture.createdAt)
    });
  }

  await seedNewsIfMissing(admin._id);
  console.log("✅ Seeding completed");
}

async function seedAgentsIfMissing() {
  const agentCount = await AgentProfile.countDocuments();
  if (agentCount > 0) {
    console.log("➡️ Agent seed skipped (agents already exist)");
    return;
  }

  console.log("🌱 Seeding agent profiles...");
  const hashAgent = await bcrypt.hash("Agent123!", 10);

  const agentSeeds = [
    {
      email: "seller1@agents.com",
      username: "seller_one",
      name: "Seller Agent 1",
      bio: "Electronics & gadgets seller",
      region: "Seoul",
      avatarUrl: "/static/avatars/agent1.jpg",
      kind: "SELLER" as const,
      rating: 4.8
    },
    {
      email: "service1@agents.com",
      username: "service_one",
      name: "Service Agent 1",
      bio: "Language teacher & translator",
      region: "Cheonan",
      avatarUrl: "/static/avatars/agent2.jpg",
      kind: "SERVICE" as const,
      rating: 4.9,
      serviceCategory: "language"
    },
    {
      email: "construction1@agents.com",
      username: "construction_one",
      name: "Construction Agent 1",
      bio: "Fasad va tashqi qurilish ustasi",
      region: "Toshkent",
      avatarUrl: "/static/avatars/agent3.jpg",
      kind: "SERVICE" as const,
      rating: 4.9,
      serviceCategory: "construction",
      constructionAreas: ["exterior"],
      constructionServices: ["facade", "concrete", "bricklaying"]
    },
    {
      email: "construction2@agents.com",
      username: "construction_two",
      name: "Construction Agent 2",
      bio: "Ichki ta'mirlash bo'yicha usta",
      region: "Samarqand",
      avatarUrl: "/static/avatars/agent4.jpg",
      kind: "SERVICE" as const,
      rating: 4.7,
      serviceCategory: "construction",
      constructionAreas: ["interior"],
      constructionServices: ["painting", "wallpaper", "doors-windows", "ceiling-repair"]
    },
    {
      email: "construction3@agents.com",
      username: "construction_three",
      name: "Construction Agent 3",
      bio: "Tom yopish va beton ishlar",
      region: "Namangan",
      avatarUrl: "/static/avatars/agent5.jpg",
      kind: "SERVICE" as const,
      rating: 4.6,
      serviceCategory: "construction",
      constructionAreas: ["exterior"],
      constructionServices: ["roofing", "roof-repair", "concrete"]
    },
    {
      email: "construction4@agents.com",
      username: "construction_four",
      name: "Construction Agent 4",
      bio: "Dizayn va pardozlash xizmatlari",
      region: "Buxoro",
      avatarUrl: "/static/avatars/agent6.jpg",
      kind: "SERVICE" as const,
      rating: 4.8,
      serviceCategory: "construction",
      constructionAreas: ["interior"],
      constructionServices: ["interior-design", "plastering", "tile"]
    }
  ];

  for (const seed of agentSeeds) {
    const existing = await User.findOne({ email: seed.email });
    const user =
      existing ||
      (await User.create({
        email: seed.email,
        passwordHash: hashAgent,
        name: seed.name,
        username: seed.username,
        role: "AGENT",
        isVerified: true,
        isPrivate: false,
        avatarUrl: seed.avatarUrl,
        bio: seed.bio,
        region: seed.region
      }));

    user.role = "AGENT";
    user.isVerified = true;
    user.avatarUrl = user.avatarUrl || seed.avatarUrl;
    user.bio = user.bio || seed.bio;
    user.region = user.region || seed.region;
    await user.save();

    const profile = await AgentProfile.findOne({ user: user._id });
    if (!profile) {
      await AgentProfile.create({
        user: user._id,
        kind: seed.kind,
        socialServices: seed.kind === "SERVICE" ? ["Translation", "Consulting"] : [],
        materialServices: seed.kind === "SELLER" ? ["Electronics resale", "Delivery"] : [],
        rating: seed.rating,
        ratingCount: 12,
        profileViews: Math.floor(50 + Math.random() * 200),
        profileLikes: Math.floor(10 + Math.random() * 80),
        verifiedByAdmin: true,
        serviceCategory: seed.serviceCategory,
        constructionAreas: seed.constructionAreas || [],
        constructionServices: seed.constructionServices || [],
        serviceOfficeAddress: seed.region ? `${seed.region} markaz` : undefined,
        serviceQualification: "3+ yil tajriba"
      });
    }
  }

  console.log("✅ Agent seeding completed");
}

async function seedAgentListingsIfMissing() {
  const agents = await User.find({ role: "AGENT" }).lean();
  if (agents.length === 0) return;

  const profiles = await AgentProfile.find({ user: { $in: agents.map((a) => a._id) } }).lean();
  const profileByUser = new Map<string, any>();
  profiles.forEach((profile) => {
    profileByUser.set(String(profile.user), profile);
  });

  const productTemplates = [
    {
      title: "Sony A7 IV Body",
      description: "Full-frame mirrorless camera body, great for photo & video.",
      price: 2300,
      currency: "USD",
      images: ["/static/products/sony_a7iv.jpg"],
      category: "Camera"
    },
    {
      title: "Canon R6 Mark II Kit",
      description: "24-105mm lens included, perfect hybrid camera.",
      price: 2600,
      currency: "USD",
      images: ["/static/products/canon_r6m2.jpg"],
      category: "Camera"
    },
    {
      title: "Fujifilm X-S20 Vlogger Set",
      description: "APS-C camera with prime lens and mic for content creators.",
      price: 1800,
      currency: "USD",
      images: ["/static/products/fuji_xs20.jpg"],
      category: "Camera"
    }
  ];

  const serviceTemplates = [
    {
      title: "Korean Language Class (online)",
      description: "Beginner to intermediate Korean lessons via Zoom.",
      kind: "SOCIAL" as const,
      category: "Language teaching",
      hourlyRate: 25,
      currency: "USD",
      location: "Online"
    },
    {
      title: "Document Translation (Korean-English)",
      description: "Official-style translation for study & migration documents.",
      kind: "SOCIAL" as const,
      category: "Translation",
      hourlyRate: 30,
      currency: "USD",
      location: "Cheonan"
    },
    {
      title: "Airport Delivery Support",
      description: "Helping with luggage, pickup and delivery in Seoul area.",
      kind: "MATERIAL" as const,
      category: "Delivery",
      hourlyRate: 20,
      currency: "USD",
      location: "Seoul"
    }
  ];

  const saleProductSeeds = [
    {
      slug: "seed-dev-sale-product-1",
      title: "Seed Dev Sale Product 1",
      description: "Guaranteed discounted product #1 for /deals endpoint",
      category: "Camera",
      price: 2400,
      salePrice: 1990,
      discountPercent: 17,
      currency: "USD",
      images: ["/static/products/sony_a7iv.jpg"],
      coverImageUrl: "/static/products/sony_a7iv.jpg",
      likes: 118,
      views: 2400,
      orders: 155,
      likes_7d: 30,
      views_7d: 760,
      orders_7d: 22
    },
    {
      slug: "seed-dev-sale-product-2",
      title: "Seed Dev Sale Product 2",
      description: "Guaranteed discounted product #2 for /deals endpoint",
      category: "Camera",
      price: 2600,
      salePrice: 2190,
      discountPercent: 16,
      currency: "USD",
      images: ["/static/products/canon_r6m2.jpg"],
      coverImageUrl: "/static/products/canon_r6m2.jpg",
      likes: 102,
      views: 2100,
      orders: 139,
      likes_7d: 25,
      views_7d: 680,
      orders_7d: 18
    },
    {
      slug: "seed-dev-sale-product-3",
      title: "Seed Dev Sale Product 3",
      description: "Guaranteed discounted product #3 for /deals endpoint",
      category: "Camera",
      price: 1900,
      salePrice: 1590,
      discountPercent: 16,
      currency: "USD",
      images: ["/static/products/fuji_xs20.jpg"],
      coverImageUrl: "/static/products/fuji_xs20.jpg",
      likes: 89,
      views: 1850,
      orders: 121,
      likes_7d: 22,
      views_7d: 590,
      orders_7d: 16
    }
  ];

  const saleServiceSeeds = [
    {
      slug: "seed-dev-sale-service-1",
      title: "Seed Dev Sale Service 1",
      description: "Guaranteed discounted service #1 for /deals endpoint",
      kind: "SOCIAL" as const,
      category: "Translation",
      hourlyRate: 30,
      price: 30,
      salePrice: 24,
      discountPercent: 20,
      currency: "USD",
      location: "Online",
      images: ["/static/services/translation/14.jpg"],
      coverImageUrl: "/static/services/translation/14.jpg",
      likes: 110,
      views: 2200,
      orders: 147,
      likes_7d: 27,
      views_7d: 710,
      orders_7d: 20
    },
    {
      slug: "seed-dev-sale-service-2",
      title: "Seed Dev Sale Service 2",
      description: "Guaranteed discounted service #2 for /deals endpoint",
      kind: "MATERIAL" as const,
      category: "Delivery",
      hourlyRate: 26,
      price: 26,
      salePrice: 21,
      discountPercent: 19,
      currency: "USD",
      location: "Seoul",
      images: ["/static/services/delivery/14.jpg"],
      coverImageUrl: "/static/services/delivery/14.jpg",
      likes: 104,
      views: 2080,
      orders: 132,
      likes_7d: 24,
      views_7d: 650,
      orders_7d: 17
    },
    {
      slug: "seed-dev-sale-service-3",
      title: "Seed Dev Sale Service 3",
      description: "Guaranteed discounted service #3 for /deals endpoint",
      kind: "SOCIAL" as const,
      category: "Language teaching",
      hourlyRate: 22,
      price: 22,
      salePrice: 18,
      discountPercent: 18,
      currency: "USD",
      location: "Cheonan",
      images: ["/static/services/consulting/14.jpg"],
      coverImageUrl: "/static/services/consulting/14.jpg",
      likes: 96,
      views: 1920,
      orders: 125,
      likes_7d: 21,
      views_7d: 610,
      orders_7d: 15
    }
  ];

  for (const agent of agents) {
    const profile = profileByUser.get(String(agent._id));
    const kind = profile?.kind || "SERVICE";

    const productsCount = await Product.countDocuments({ createdBy: agent._id });
    const servicesCount = await Service.countDocuments({ createdBy: agent._id });

    if (kind === "SELLER" && productsCount === 0) {
      await Product.insertMany(
        productTemplates.map((template) => ({
          ...template,
          status: "ACTIVE",
          createdBy: agent._id
        }))
      );
    }

    if (kind === "SERVICE" && servicesCount === 0) {
      const serviceCategory = profile?.serviceCategory;
      const seededServices = serviceTemplates.map((template) => ({
        ...template,
        category: serviceCategory ? `${template.category}` : template.category,
        createdBy: agent._id
      }));
      await Service.insertMany(seededServices);
    }
  }

  const sellerAgent =
    agents.find((agent) => (profileByUser.get(String(agent._id))?.kind || "SERVICE") === "SELLER") || agents[0];
  const serviceAgent =
    agents.find((agent) => (profileByUser.get(String(agent._id))?.kind || "SERVICE") === "SERVICE") || agents[0];

  if (sellerAgent) {
    await AgentProfile.findOneAndUpdate(
      { user: sellerAgent._id },
      {
        $set: {
          kind: "SELLER",
          verifiedByAdmin: true
        },
        $setOnInsert: {
          user: sellerAgent._id,
          socialServices: [],
          materialServices: ["Delivery", "Electronics resale"],
          rating: 4.7,
          ratingCount: 8
        }
      },
      { upsert: true, new: true }
    );
  }
  if (serviceAgent) {
    await AgentProfile.findOneAndUpdate(
      { user: serviceAgent._id },
      {
        $set: {
          kind: "SERVICE",
          verifiedByAdmin: true
        },
        $setOnInsert: {
          user: serviceAgent._id,
          socialServices: ["Translation", "Consulting"],
          materialServices: [],
          rating: 4.8,
          ratingCount: 10
        }
      },
      { upsert: true, new: true }
    );
  }

  if (sellerAgent) {
    for (const saleProductSeed of saleProductSeeds) {
      await Product.updateOne(
        { slug: saleProductSeed.slug },
        {
          $set: {
            title: saleProductSeed.title,
            slug: saleProductSeed.slug,
            description: saleProductSeed.description,
            category: saleProductSeed.category,
            price: saleProductSeed.price,
            salePrice: saleProductSeed.salePrice,
            discountPercent: saleProductSeed.discountPercent,
            currency: saleProductSeed.currency,
            images: saleProductSeed.images,
            coverImageUrl: saleProductSeed.coverImageUrl,
            coverImage: saleProductSeed.coverImageUrl,
            imageUrl: saleProductSeed.coverImageUrl,
            image: saleProductSeed.coverImageUrl,
            thumbnail: saleProductSeed.coverImageUrl,
            status: "ACTIVE",
            likes: saleProductSeed.likes,
            views: saleProductSeed.views,
            orders: saleProductSeed.orders,
            likes_7d: saleProductSeed.likes_7d,
            views_7d: saleProductSeed.views_7d,
            orders_7d: saleProductSeed.orders_7d,
            createdBy: sellerAgent._id
          }
        },
        { upsert: true }
      );
    }
  }

  if (serviceAgent) {
    for (const saleServiceSeed of saleServiceSeeds) {
      await Service.updateOne(
        { slug: saleServiceSeed.slug },
        {
          $set: {
            title: saleServiceSeed.title,
            slug: saleServiceSeed.slug,
            description: saleServiceSeed.description,
            kind: saleServiceSeed.kind,
            category: saleServiceSeed.category,
            hourlyRate: saleServiceSeed.hourlyRate,
            price: saleServiceSeed.price,
            salePrice: saleServiceSeed.salePrice,
            discountPercent: saleServiceSeed.discountPercent,
            currency: saleServiceSeed.currency,
            location: saleServiceSeed.location,
            images: saleServiceSeed.images,
            coverImageUrl: saleServiceSeed.coverImageUrl,
            coverImage: saleServiceSeed.coverImageUrl,
            imageUrl: saleServiceSeed.coverImageUrl,
            image: saleServiceSeed.coverImageUrl,
            cardImageUrl: saleServiceSeed.coverImageUrl,
            likes: saleServiceSeed.likes,
            views: saleServiceSeed.views,
            orders: saleServiceSeed.orders,
            likes_7d: saleServiceSeed.likes_7d,
            views_7d: saleServiceSeed.views_7d,
            orders_7d: saleServiceSeed.orders_7d,
            createdBy: serviceAgent._id
          }
        },
        { upsert: true }
      );
    }
  }

  console.log("✅ Agent listings seeding completed");
}

type CommunityGroupSeed = {
  title: string;
  description: string;
  category: string;
  tags: string[];
  members: number;
  rating: number;
  ratingVotes: number;
  spamReports: number;
  channelType: "group" | "channel";
  groupType?: "group" | "channel";
  privacy?: "public" | "private" | "secret";
  requiresApproval?: boolean;
  pendingApprovals?: number;
  isVerified?: boolean;
  lastActivity?: Date;
  _id?: mongoose.Types.ObjectId;
  slug?: string;
  legacyId?: string;
};

const makeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

const communityGroupSeeds: CommunityGroupSeed[] = [
  {
    title: "Koreyadagi Uzbek Biznes Consulting",
    description: "Koreyada biznes ochish, moliya va sheriklar bilan maslahat.",
    category: "consulting",
    tags: ["korea", "startup", "mentor"],
    members: 620,
    rating: 4.9,
    ratingVotes: 110,
    spamReports: 1,
    channelType: "group"
  },
  {
    title: "Korean Startup Strategies",
    description: "Seulda ish olib borayotgan o‘zbek tadbirkorlar bilan suhbat.",
    category: "consulting",
    tags: ["strategy", "network", "korea"],
    members: 458,
    rating: 4.7,
    ratingVotes: 76,
    spamReports: 0,
    channelType: "channel"
  },
  {
    title: "Translation Support — Koreys/Uzb",
    description: "Hujjatlar, portal va visa hujjatlarini tez tarjima qiling.",
    category: "translation",
    tags: ["documents", "korea", "verified"],
    members: 508,
    rating: 4.8,
    ratingVotes: 88,
    spamReports: 1,
    channelType: "group"
  },
  {
    title: "Legal Clinic for Uzbek Expats",
    description: "Mehnat huquqi, visa, kontraktlar bo'yicha yuridik yordam.",
    category: "legal",
    tags: ["immigration", "contracts", "visa"],
    members: 392,
    rating: 4.6,
    ratingVotes: 64,
    spamReports: 2,
    channelType: "group"
  },
  {
    title: "Psychology Support Korea",
    description: "Stress, oilaviy muammolar va psixologik maslahat.",
    category: "psychology",
    tags: ["support", "therapy", "confidential"],
    members: 312,
    rating: 4.7,
    ratingVotes: 59,
    spamReports: 3,
    channelType: "group"
  },
  {
    title: "Seoul Sports & Fitness Uzbek Crew",
    description: "Seoul stadionlari, musobaqalar va individual trenerlar.",
    category: "sports",
    tags: ["fitness", "trainer", "events"],
    members: 278,
    rating: 4.5,
    ratingVotes: 43,
    spamReports: 1,
    channelType: "channel"
  },
  {
    title: "Korea Products & Shopping Tips",
    description: "Seulda eng yaxshi chegirmalar, gadget sharhlar va cashback.",
    category: "products",
    tags: ["shopping", "deals", "korea"],
    members: 710,
    rating: 4.6,
    ratingVotes: 92,
    spamReports: 0,
    channelType: "channel"
  },
  {
    title: "UniServe Platform Help Korea",
    description: "Platformani qanday ishlatish, onboarding va FAQ.",
    category: "platform",
    tags: ["help", "faq", "onboarding"],
    members: 980,
    rating: 4.9,
    ratingVotes: 120,
    spamReports: 1,
    channelType: "channel"
  },
  {
    title: "Korean Language Study Room",
    description: "Koreys tilini o‘rganuvchilar, intervyu va darslar.",
    category: "consulting",
    tags: ["language", "online", "mentor"],
    members: 520,
    rating: 4.8,
    ratingVotes: 81,
    spamReports: 0,
    channelType: "group"
  },
  {
    title: "Visa & Document Support Korea",
    description: "Visa arizalari, hujjat tayyorlash va gov. misollar.",
    category: "legal",
    tags: ["visa", "documents", "immigration"],
    members: 425,
    rating: 4.5,
    ratingVotes: 62,
    spamReports: 2,
    channelType: "group"
  },
  {
    title: "Mom & Kids Korea Circle",
    description: "Bolalar bog‘chalari, tibbiy maslahatlar va kun tartibi.",
    category: "psychology",
    tags: ["parenting", "health", "community"],
    members: 260,
    rating: 4.6,
    ratingVotes: 47,
    spamReports: 0,
    channelType: "group"
  },
  {
    title: "Events & Meetups Korea",
    description: "Festival, ko‘rgazma va bolalar tadbirlarini rejalashtirish.",
    category: "platform",
    tags: ["events", "community", "korea"],
    members: 340,
    rating: 4.4,
    ratingVotes: 35,
    spamReports: 0,
    channelType: "group"
  },
  {
    title: "Korean Deals & Bargains",
    description: "Narx taqqoslash, kredit kartalar va cashback yollari.",
    category: "products",
    tags: ["deals", "finance", "shopping"],
    members: 580,
    rating: 4.5,
    ratingVotes: 58,
    spamReports: 1,
    channelType: "group"
  },
  {
    title: "Rapid Translation Exchange",
    description: "Hujjat va notarial tarjima uchun kechiktirmas jamoa.",
    category: "translation",
    tags: ["fast", "certified", "remote"],
    members: 472,
    rating: 4.7,
    ratingVotes: 66,
    spamReports: 0,
    channelType: "channel"
  },
  {
    title: "Legal Compliance Circle",
    description: "Shartnomalar, bandlik va notarial masalalar bo'yicha yordam.",
    category: "legal",
    tags: ["contracts", "compliance", "korea"],
    members: 310,
    rating: 4.6,
    ratingVotes: 39,
    spamReports: 1,
    channelType: "group"
  },
  {
    title: "Sports Coaching Korea",
    description: "Individuall trenerlar, musobaqa rejalari va diet rejalar.",
    category: "sports",
    tags: ["coaching", "training", "korea"],
    members: 335,
    rating: 4.6,
    ratingVotes: 52,
    spamReports: 0,
    channelType: "group"
  },
  {
    title: "Platform Help Desk (Korea)",
    description: "Texnik savollar, onboarding, email va push ko‘rsatmalar.",
    category: "platform",
    tags: ["support", "technical", "faq"],
    members: 910,
    rating: 4.8,
    ratingVotes: 102,
    spamReports: 0,
    channelType: "channel"
  },
  {
    title: "Translation Marketplace Korea",
    description: "Professional tarjimonlar, notarial va marketing matnlar.",
    category: "translation",
    tags: ["marketplace", "korea", "professional"],
    members: 456,
    rating: 4.6,
    ratingVotes: 61,
    spamReports: 0,
    channelType: "group"
  },
  {
    title: "Consulting Circle for Uzbek Expats",
    description: "Bank, marketing va investor tarmoqlari bilan maslahat.",
    category: "consulting",
    tags: ["expat", "finance", "network"],
    members: 388,
    rating: 4.5,
    ratingVotes: 45,
    spamReports: 0,
    channelType: "group"
  },
  {
    title: "Product Review Panel Korea",
    description: "Yangilangan gadgetlar, kiyim-kechak va Arzon Bozor yulduzlari.",
    category: "products",
    tags: ["review", "panel", "korea"],
    members: 505,
    rating: 4.6,
    ratingVotes: 64,
    spamReports: 1,
    channelType: "channel"
  },
  {
    slug: "g-consult-001",
    title: "Koreyada Uzbek Biznes Consulting",
    description: "Seul va Cheonan shaharlarida startap, investor va marketing maslahatlari.",
    category: "consulting",
    tags: ["korea", "business", "mentor"],
    members: 702,
    rating: 4.9,
    ratingVotes: 118,
    spamReports: 1,
    channelType: "group",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 2 * 3600 * 1000),
    legacyId: "692fc355e866dc36094e492c"
  },
  {
    slug: "g-translation-002",
    title: "Translation Support — Koreys/Uzb",
    description: "Visa va immigration hujjatlarini professional tarzda tarjima qilish.",
    category: "translation",
    tags: ["documents", "visa", "official"],
    members: 547,
    rating: 4.7,
    ratingVotes: 92,
    spamReports: 0,
    channelType: "group",
    privacy: "public",
    requiresApproval: true,
    lastActivity: new Date(Date.now() - 6 * 3600 * 1000),
    legacyId: "692fc355e866dc36094e492d"
  },
  {
    slug: "g-tech-003",
    title: "Korea Uzbek Tech Talk",
    description: "Texnologiya, media va startup yangiliklarini birgalikda muhokama qilamiz.",
    category: "community",
    tags: ["tech", "startup", "media"],
    members: 186,
    rating: 4.8,
    ratingVotes: 37,
    spamReports: 0,
    channelType: "group",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 3 * 3600 * 1000),
    legacyId: "692fc355e866dc36094e492e"
  },
  {
    slug: "c-seoul-english",
    title: "Seoul English Lounge",
    description: "Koreys tilida o‘zaro suhbat, film muhokamasi va til klubimiz e’lonlari.",
    category: "community",
    tags: ["english", "seoul", "conversation"],
    members: 480,
    rating: 4.8,
    ratingVotes: 72,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 2 * 3600 * 1000)
  },
  {
    slug: "c-express-logistics",
    title: "Express Logistics Tips",
    description: "Yangi jo‘natmalar, bojxona yangiliklari va tez yetkazish formatlari.",
    category: "business",
    tags: ["logistics", "shipping", "cargo"],
    members: 315,
    rating: 4.6,
    ratingVotes: 53,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 5 * 3600 * 1000)
  },
  {
    slug: "c-korea-visa-stream",
    title: "Korea Visa Stream",
    description: "Visa yangiliklari, rasmiy hujjatlar va tayyorlanish check list’lari.",
    category: "government",
    tags: ["visa", "documents", "immigration"],
    members: 620,
    rating: 4.7,
    ratingVotes: 88,
    spamReports: 1,
    channelType: "channel",
    privacy: "public",
    requiresApproval: true,
    lastActivity: new Date(Date.now() - 3 * 3600 * 1000)
  },
  {
    slug: "c-mint-design",
    title: "Mint Design Studio",
    description: "Visual dizayn yangiliklari, marketing kanali va trend video postlar.",
    category: "design",
    tags: ["design", "video", "creative"],
    members: 410,
    rating: 4.9,
    ratingVotes: 67,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 7 * 3600 * 1000)
  },
  {
    slug: "c-ryu-food",
    title: "Ryu FoodTube",
    description: "Koreys oshxonasi, street food video va tayyor retseptlar.",
    category: "food",
    tags: ["food", "cooking", "korean"],
    members: 530,
    rating: 4.5,
    ratingVotes: 55,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 4 * 3600 * 1000)
  },
  {
    slug: "c-kpop-insights",
    title: "K-Pop Insights",
    description: "K-Pop yangiliklari, chiqishlar, fan project e’lonlariga bag‘ishlangan kanal.",
    category: "entertainment",
    tags: ["kpop", "music", "culture"],
    members: 780,
    rating: 4.9,
    ratingVotes: 141,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 1 * 3600 * 1000)
  },
  {
    slug: "c-pace-learning",
    title: "PACE Learning Stream",
    description: "IT, AI va data science bootcamp yangiliklarini uzatadi.",
    category: "education",
    tags: ["ai", "tech", "learning"],
    members: 420,
    rating: 4.8,
    ratingVotes: 60,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 9 * 3600 * 1000)
  },
  {
    slug: "c-korea-tech-today",
    title: "Korea Tech Today",
    description: "Koreya startapi, investor yangiliklari va product showcase'lar.",
    category: "technology",
    tags: ["startup", "tech", "investor"],
    members: 610,
    rating: 4.7,
    ratingVotes: 79,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 12 * 3600 * 1000)
  },
  {
    slug: "c-dokdo-voyage",
    title: "Dokdo Voyage Updates",
    description: "Turizm, Koreya bo‘ylab sayohat videolari va joy xaritalari.",
    category: "travel",
    tags: ["travel", "voyage", "seoul"],
    members: 360,
    rating: 4.6,
    ratingVotes: 44,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 14 * 3600 * 1000)
  },
  {
    slug: "c-ux-hamlab",
    title: "UX HamLab Korea",
    description: "Mobil dizayn, UI/UX materiallari, kitoblar va dizayn mezonlari.",
    category: "design",
    tags: ["ux", "design", "mobile"],
    members: 290,
    rating: 4.8,
    ratingVotes: 48,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 11 * 3600 * 1000)
  },
  {
    slug: "c-career-link",
    title: "Career Link Korea",
    description: "Ish bozoridagi yangiliklar, agentliklar, rezume va tayyorgarliklar.",
    category: "career",
    tags: ["career", "jobs", "agents"],
    members: 510,
    rating: 4.6,
    ratingVotes: 71,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 15 * 3600 * 1000)
  },
  {
    slug: "c-biz-venture",
    title: "Biz Venture Korea",
    description: "Investor pitchlar, venture insights va equity forum.",
    category: "investor",
    tags: ["venture", "investor", "fund"],
    members: 270,
    rating: 4.7,
    ratingVotes: 33,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: true,
    lastActivity: new Date(Date.now() - 18 * 3600 * 1000)
  },
  {
    slug: "c-city-labs",
    title: "City Labs Korea",
    description: "Smart city yangiliklari, IoT, trafik va urban dizayn.",
    category: "engineering",
    tags: ["iot", "smartcity", "urban"],
    members: 340,
    rating: 4.6,
    ratingVotes: 37,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 9 * 3600 * 1000)
  },
  {
    slug: "c-creative-code",
    title: "Creative Code Korea",
    description: "Frontend, WebGL, creative coding qiziqarli kod namunalari.",
    category: "technology",
    tags: ["code", "creative", "web"],
    members: 470,
    rating: 4.9,
    ratingVotes: 58,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 6 * 3600 * 1000)
  },
  {
    slug: "c-global-freight",
    title: "Global Freight Korea",
    description: "Tashqi savdo, eksport-import tarmog‘iga oid yangiliklar va reglamentlar.",
    category: "trade",
    tags: ["trade", "global", "import"],
    members: 380,
    rating: 4.6,
    ratingVotes: 50,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 16 * 3600 * 1000)
  },
  {
    slug: "c-artsignal",
    title: "ArtSignal Korea",
    description: "Raqamli san’at, NFT va gallery e’lonlari.",
    category: "art",
    tags: ["art", "gallery", "nft"],
    members: 220,
    rating: 4.5,
    ratingVotes: 20,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 7 * 3600 * 1000)
  },
  {
    slug: "c-sustain-link",
    title: "Sustain Link Korea",
    description: "Barqarorlik, ESG, green startup va chiqindilarni qayta ishlash.",
    category: "sustainability",
    tags: ["sustainability", "green", "climate"],
    members: 260,
    rating: 4.6,
    ratingVotes: 39,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    lastActivity: new Date(Date.now() - 10 * 3600 * 1000)
  }
];

const normalizeSeedType = (value?: string) => (value === "channel" ? "channel" : "group");
const communityGroupSeedsWithDefaults = communityGroupSeeds.map((seed, index) => {
  const type = normalizeSeedType(seed.channelType);
  const requiresApproval = seed.requiresApproval ?? type === "channel";
  const privacy = seed.privacy || (type === "channel" ? "private" : "public");
  const lastActivity =
    seed.lastActivity || new Date(Date.now() - ((index % 5) + 1) * 24 * 60 * 60 * 1000);
  const slugValue = seed.slug || makeSlug(seed.title);
  return {
    ...seed,
    slug: slugValue,
    groupType: type,
    channelType: type,
    privacy,
    requiresApproval,
    pendingApprovals: seed.pendingApprovals ?? (requiresApproval ? Math.ceil(seed.members / 200) : 0),
    isVerified: seed.isVerified ?? seed.spamReports < 3,
    lastActivity
  };
});

export async function seedCommunityGroupsIfMissing(createdById?: mongoose.Types.ObjectId) {
  const inserted: string[] = [];
  for (const seed of communityGroupSeedsWithDefaults) {
    const slug = seed.slug || makeSlug(seed.title);
    const legacyObjectId =
      seed.legacyId && mongoose.Types.ObjectId.isValid(seed.legacyId)
        ? new mongoose.Types.ObjectId(seed.legacyId)
        : undefined;
    const exists = await CommunityGroupModel.findOne({
      $or: [{ slug }, ...(legacyObjectId ? [{ _id: legacyObjectId }] : [])]
    });
    if (exists) continue;
    await CommunityGroupModel.create({
      ...(legacyObjectId ? { _id: legacyObjectId } : {}),
      title: seed.title,
      description: seed.description,
      category: seed.category,
      tags: seed.tags,
      members: seed.members,
      rating: seed.rating,
      ratingVotes: seed.ratingVotes,
      spamReports: seed.spamReports,
      groupType: seed.groupType || seed.channelType,
      channelType: seed.channelType,
      privacy: seed.privacy,
      requiresApproval: seed.requiresApproval ?? false,
      pendingApprovals: seed.pendingApprovals ?? 0,
      isVerified: seed.isVerified ?? seed.spamReports < 3,
      lastActivity: seed.lastActivity ?? new Date(),
      slug,
      createdBy: createdById
    });
    inserted.push(slug);
  }
  if (inserted.length) {
    console.log(`✅ Seeded ${inserted.length} community groups: ${inserted.join(", ")}`);
  } else {
    console.log("➡️ Community groups already seeded");
  }
}

const newsSeedItems = [
  {
    title: "Seoulda bolalar bog'chasi tanlash bo'yicha qo'llanma",
    excerpt: "Koreyada yashovchi oilalar uchun sertifikatli bog'cha va narx-maslahat.",
    content:
      "Seul va Incheon shaharlarida tasdiqlangan bog'cha tanlangani, til vositalari, transport va hujjatlar ko‘rib chiqiladi. Ruxsatnomalar va onlayn ro‘yxatdan o‘tish jarayoni haqidagi bosqichlar ham ko‘rib chiqiladi.",
    coverImage: "https://images.unsplash.com/photo-1501734977020-3c42b10b1a2c",
    location: "Seoul",
    category: "parenting",
    type: "article",
    language: "Uzbek",
    sourceUrl: "https://example.com/seoul-childcare-guide",
    isFeatured: true,
    views: 120
  },
  {
    title: "Visa & Docs tips for Uzbek families in Korea",
    excerpt: "Hujjatlarni qanday topshirish, qanaqa qo‘shimcha hujjat talab qilinishi.",
    content:
      "Muayyan visa turlariga mos hujjatlar ro‘yxatini qanday tayyorlash, tasdiqlash va notariallashtirish kerakligi tushuntiriladi. Hujjatlarni tarjima qilish uchun ishonchli manbalar ham keltiriladi.",
    coverImage: "https://images.unsplash.com/photo-1469474968028-56623f02e42e",
    location: "Seoul",
    category: "visa",
    type: "tip",
    language: "English",
    sourceUrl: "https://example.com/korea-visa-tips",
    isFeatured: true,
    views: 95
  },
  {
    title: "Koreyadagi mahsulotlar uchun eng zo'r chegirmalar",
    excerpt: "Gyeongdong va Dongdaemun bozorlaridagi chegirmalar, cashback va xarid yo‘llari.",
    content:
      "Bozorlar, kichik do‘konlar va kafe chegirmalari haqidagi qisqacha tahlil: qachon chegirma bo‘ladi, qanday qilib arzonroq narxga olish mumkin.",
    coverImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f",
    location: "Seoul",
    category: "deals",
    type: "deal",
    language: "Uzbek",
    sourceUrl: "https://example.com/korea-deals",
    isFeatured: false,
    views: 80
  },
  {
    title: "Uzbek legal aid for newcomers in Korea",
    excerpt: "Ish faoliyati, mulk, notarial xizmat va immigration bo‘yicha huquqiy maslahatlar.",
    content:
      "Koreyaning immigrant qonunlari va oddiy savollar: ish ruxsati, mulk sotib olish va notarial guvohnoma olish bo‘yicha amaliy tavsiyalar.",
    coverImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
    location: "Seoul",
    category: "legal",
    type: "article",
    language: "Russian",
    sourceUrl: "https://example.com/korea-legal-support",
    isFeatured: true,
    views: 105
  },
  {
    title: "Rapid translation services for visa documents",
    excerpt: "Kimdir tezda visa hujjatlarini tarjima qilishga muhtojmi?",
    content:
      "Sizga kerakli tilga tarjima xizmatlari, notarial tasdiqlash, rasmiy hujjatlar va qachon tez xizmatdan foydalanish kerakligi.",
    coverImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
    location: "Cheonan",
    category: "translation",
    type: "tip",
    language: "English",
    sourceUrl: "https://example.com/translation-visa",
    isFeatured: false,
    views: 70
  },
  {
    title: "Qishki stressni yengish: Seoul sog’liq yo‘llari",
    excerpt: "Issiq joylar, psixologik mashg‘ulotlar va guruh terapiyasi.",
    content:
      "Koreyaning salqin qishida stress bilan kurashish uchun mavjud psixologiyaga asoslangan guruhlar va maslahatchilar ro‘yxati.",
    coverImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773",
    location: "Seoul",
    category: "health",
    type: "tip",
    language: "Uzbek",
    sourceUrl: "https://example.com/korea-health-guide",
    isFeatured: false,
    views: 55
  },
  {
    title: "Mom & Kids events in Busan",
    excerpt: "Oilaviy uchrashuvlar, bog‘cha tanlovlari va ona/bola guruhlari.",
    content:
      "Busan shahri uchun maxsus oilaviy eventlar, bolalar uchun atrof-muhit, sog‘liq va o‘quv kurslari haqida ma'lumot.",
    coverImage: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1",
    location: "Busan",
    category: "events",
    type: "event",
    language: "Uzbek",
    sourceUrl: "https://example.com/busan-moms",
    isFeatured: true,
    views: 60
  },
  {
    title: "Uzbek-Korean life tips: Cheonggyecheon picnic",
    excerpt: "Cheonggyecheon daryosi bo‘yida piknik va oila bilan dam olish.",
    content:
      "Qanday qilib Cheonggyecheonga borish, ovqatlanish va yangi joylar bilan tanishish; bolalar uchun qulay piknik zonalari haqida hikoya.",
    coverImage: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    location: "Seoul",
    category: "life",
    type: "tip",
    language: "Uzbek",
    sourceUrl: "https://example.com/cheonggyecheon-guide",
    isFeatured: false,
    views: 45
  },
  {
    title: "Seoul sports fields for Uzbek communities",
    excerpt: "Futbol, badminton va halqa musobaqalari.",
    content:
      "Seoulda sport maydonlaridagi turnirlar, Uzbek team builder va trenerlar bilan bog‘lanish, rejalashtirishdagi yangiliklar.",
    coverImage: "https://images.unsplash.com/photo-1517649763962-0c623066013b",
    location: "Seoul",
    category: "sports",
    type: "event",
    language: "English",
    sourceUrl: "https://example.com/seoul-sports",
    isFeatured: false,
    views: 50
  }
];

const slugifySeedTitle = (value: string, suffix: number) => {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "news"}-${suffix + 1}`;
};

export async function seedNewsIfMissing(authorId?: mongoose.Types.ObjectId) {
  const count = await NewsPost.countDocuments();
  if (count > 0) {
    console.log("➡️ News already seeded");
    return;
  }

  let effectiveAuthorId = authorId;
  if (!effectiveAuthorId) {
    const adminUser = await User.findOne({ role: "ADMIN" });
    effectiveAuthorId = adminUser?._id;
  }

  if (!effectiveAuthorId) {
    console.warn("⚠️ News seeding skipped (no author available)");
    return;
  }

  const documents = newsSeedItems.map((item, index) => ({
    ...item,
    author: effectiveAuthorId,
    slug: slugifySeedTitle(item.title, index),
    status: "published",
    isActive: true
  }));

  await NewsPost.insertMany(documents);
  console.log(`✅ Seeded ${documents.length} news posts`);
}
