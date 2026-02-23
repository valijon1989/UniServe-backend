export interface CommunityGroupFixture {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  members: number;
  rating: number;
  ratingVotes: number;
  spamReports: number;
  channelType: "group" | "channel";
  privacy: "public" | "private" | "secret";
  requiresApproval: boolean;
  groupType: "group" | "channel";
  lastActivity: string;
  host?: {
    name: string;
    username: string;
    avatarUrl: string;
  };
  legacyId?: string;
}

export const communityGroupFixtures: CommunityGroupFixture[] = [
  {
    slug: "g-consult-001",
    legacyId: "692fc355e866dc36094e492c",
    title: "Koreyada Uzbek Biznes Consulting",
    description: "Seul va Cheonan shaharlarida startap va moliyaviy mentorlik sessiyalari.",
    category: "consulting",
    tags: ["korea", "business", "mentoring"],
    members: 680,
    rating: 4.9,
    ratingVotes: 118,
    spamReports: 1,
    channelType: "group",
    privacy: "public",
    requiresApproval: false,
    groupType: "group",
    lastActivity: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    host: {
      name: "UniServe Admin",
      username: "uniserve_admin",
      avatarUrl: "/static/avatars/admin.jpg"
    }
  },
  {
    slug: "g-translation-002",
    legacyId: "692fc355e866dc36094e492d",
    title: "Translation Support — Koreys/Uzb",
    description: "Rasmiy hujjatlarni tez va arzon tarzda tarjima qilish hamjamiyati.",
    category: "translation",
    tags: ["documents", "visa", "verified"],
    members: 530,
    rating: 4.7,
    ratingVotes: 92,
    spamReports: 0,
    channelType: "group",
    privacy: "public",
    requiresApproval: true,
    groupType: "group",
    lastActivity: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    host: {
      name: "Translation Agent",
      username: "translator_pro",
      avatarUrl: "/static/avatars/agent2.jpg"
    }
  },
  {
    slug: "g-tech-003",
    legacyId: "692fc355e866dc36094e492e",
    title: "Korea Uzbek Tech Talk",
    description: "Texnologiya, startup va media yangiliklarni muhokama qiluvchi jamoa.",
    category: "community",
    tags: ["tech", "startup", "media"],
    members: 190,
    rating: 4.8,
    ratingVotes: 37,
    spamReports: 0,
    channelType: "group",
    privacy: "public",
    requiresApproval: false,
    groupType: "group",
    lastActivity: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    host: {
      name: "Tech Curator",
      username: "tech_ujg",
      avatarUrl: "/static/avatars/user2.jpg"
    }
  }
  ,
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    host: {
      name: "Lingua Host",
      username: "lingua_seoul",
      avatarUrl: "/static/avatars/user3.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    host: {
      name: "LogiStream",
      username: "logistream",
      avatarUrl: "/static/avatars/agent1.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    host: {
      name: "Visa Desk",
      username: "visa_desk",
      avatarUrl: "/static/avatars/admin.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
    host: {
      name: "Mint Studio",
      username: "mint_studio",
      avatarUrl: "/static/avatars/user1.jpg"
    }
  },
  {
    slug: "c-ryu-food",
    title: "Ryu FoodTube",
    description: "Koreys oshxonasi, street food video va tayyor retseptlar.",
    category: "food",
    tags: ["food", "korean", "cooking"],
    members: 530,
    rating: 4.5,
    ratingVotes: 55,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    groupType: "channel",
    lastActivity: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    host: {
      name: "Chef Ryu",
      username: "chef_ryu",
      avatarUrl: "/static/avatars/agent2.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    host: {
      name: "Hallyu Desk",
      username: "hallyu_desk",
      avatarUrl: "/static/avatars/user2.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
    host: {
      name: "PACE Labs",
      username: "pace_labs",
      avatarUrl: "/static/avatars/agent1.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    host: {
      name: "NextWave",
      username: "nextwave",
      avatarUrl: "/static/avatars/agent3.jpg"
    }
  },
  {
    slug: "c-dokdo-voyage",
    title: "Dokdo Voyage Updates",
    description: "Turizm, Koreya bo‘ylab sayohat videolari va joy xaritalari.",
    category: "travel",
    tags: ["travel", "seoul", "voyage"],
    members: 360,
    rating: 4.6,
    ratingVotes: 44,
    spamReports: 0,
    channelType: "channel",
    privacy: "public",
    requiresApproval: false,
    groupType: "channel",
    lastActivity: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    host: {
      name: "Tour Desk",
      username: "tourdesk",
      avatarUrl: "/static/avatars/admin.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
    host: {
      name: "UX Korea",
      username: "uxkorea",
      avatarUrl: "/static/avatars/user3.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 15 * 3600 * 1000).toISOString(),
    host: {
      name: "Career Hub",
      username: "career_hub",
      avatarUrl: "/static/avatars/agent4.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    host: {
      name: "Venture Desk",
      username: "venture_desk",
      avatarUrl: "/static/avatars/user2.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
    host: {
      name: "City Labs",
      username: "city_labs",
      avatarUrl: "/static/avatars/user1.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    host: {
      name: "Code Studio",
      username: "code_studio",
      avatarUrl: "/static/avatars/user2.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
    host: {
      name: "Trade Watch",
      username: "trade_watch",
      avatarUrl: "/static/avatars/user3.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
    host: {
      name: "ArtSignal",
      username: "artsignal",
      avatarUrl: "/static/avatars/user1.jpg"
    }
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
    groupType: "channel",
    lastActivity: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    host: {
      name: "Sustain Link",
      username: "sustain_link",
      avatarUrl: "/static/avatars/admin.jpg"
    }
  }
];
