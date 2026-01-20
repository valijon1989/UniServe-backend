import bcrypt from "bcryptjs";
import { User } from "./models/User";
import { AgentProfile } from "./models/AgentProfile";
import { Product } from "./models/Product";
import { Service } from "./models/Service";
import { Post } from "./models/Post";
import { ConstructionListing } from "./models/ConstructionListing";

export async function seedIfEmpty() {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log("➡️ Seed skipped (users already exist)");
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
      title: "Sony A7 IV Body",
      description: "Full-frame mirrorless camera body, great for photo & video.",
      price: 2300,
      currency: "USD",
      images: ["/static/products/sony_a7iv.jpg"],
      category: "Camera",
      status: "ACTIVE",
      createdBy: seller1._id
    },
    {
      title: "Canon R6 Mark II Kit",
      description: "24-105mm lens included, perfect hybrid camera.",
      price: 2600,
      currency: "USD",
      images: ["/static/products/canon_r6m2.jpg"],
      category: "Camera",
      status: "ACTIVE",
      createdBy: seller1._id
    },
    {
      title: "Fujifilm X-S20 Vlogger Set",
      description: "APS-C camera with prime lens and mic for content creators.",
      price: 1800,
      currency: "USD",
      images: ["/static/products/fuji_xs20.jpg"],
      category: "Camera",
      status: "ACTIVE",
      createdBy: seller1._id
    }
  ]);

  await Service.insertMany([
    {
      title: "Korean Language Class (online)",
      description: "Beginner to intermediate Korean lessons via Zoom.",
      kind: "SOCIAL",
      category: "Language teaching",
      hourlyRate: 25,
      currency: "USD",
      location: "Online",
      createdBy: service1._id
    },
    {
      title: "Document Translation (Korean-English)",
      description: "Official-style translation for study & migration documents.",
      kind: "SOCIAL",
      category: "Translation",
      hourlyRate: 30,
      currency: "USD",
      location: "Cheonan",
      createdBy: service1._id
    },
    {
      title: "Airport Delivery Support",
      description: "Helping with luggage, pickup and delivery in Seoul area.",
      kind: "MATERIAL",
      category: "Delivery",
      hourlyRate: 20,
      currency: "USD",
      location: "Seoul",
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

  await Post.insertMany([
    {
      author: users[0]._id,
      text: "Bugun Cheonanda yangi kafe ochilibdi, juda chiroyli interyer!",
      images: ["/static/posts/cafe1.jpg"],
      videoUrl: undefined,
      likes: [users[1]._id, seller1._id],
      comments: []
    },
    {
      author: seller1._id,
      text: "Sony A7 IV yangi kelib tushdi. Professional foto va video uchun juda zo'r!",
      images: ["/static/products/sony_a7iv.jpg"],
      videoUrl: undefined,
      likes: [users[0]._id, users[2]._id],
      comments: []
    },
    {
      author: service1._id,
      text: "Koreys tilini 0 dan o'rganmoqchi bo'lsangiz, yoziling!",
      images: [],
      videoUrl: "/static/posts/korean_class.mp4",
      likes: [users[1]._id],
      comments: []
    }
  ]);

  console.log("✅ Seeding completed");
}
