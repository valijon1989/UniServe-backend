export interface CommunityPostFixture {
  slug: string;
  groupSlug: string;
  type: "question" | "post" | "comment" | "file" | "like";
  title: string;
  body: string;
  category: string;
  authorRole: "USER" | "AGENT";
  attachments: { type: "image" | "video" | "document"; url: string; name?: string }[];
  likes: number;
  replies: number;
  createdAt: string;
}

export const communityPostFixtures: CommunityPostFixture[] = [
  {
    slug: "g-consult-001-q1",
    groupSlug: "g-consult-001",
    type: "question",
    title: "Seuldagi yangi startap ofisini qanday topish mumkin?",
    body: "Agar dizayn studiyasi ochmoqchi bo‘lsam, qaysi tumanlarda ijara narxi arzonga tushadi?",
    category: "consulting",
    authorRole: "USER",
    attachments: [
      { type: "document", url: "/static/posts/consult-guide.pdf", name: "SeulOffice.pdf" }
    ],
    likes: 12,
    replies: 4,
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  },
  {
    slug: "g-consult-001-q2",
    groupSlug: "g-consult-001",
    type: "post",
    title: "Marketing kampaniyani qayerdan boshlash kerak?",
    body: "Koreyada Uzbek mahsulotini reklama qilish uchun eng yaxshi kanallar qaysilar?",
    category: "consulting",
    authorRole: "AGENT",
    attachments: [
      { type: "image", url: "/static/posts/marketing.jpg", name: "marketing.jpg" }
    ],
    likes: 8,
    replies: 2,
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  },
  {
    slug: "g-consult-001-post3",
    groupSlug: "g-consult-001",
    type: "post",
    title: "Barcha ishtirokchilar uchun networking sessiyasi",
    body: "Yangi investorlar bilan tanishish uchun har haftalik meetup tashkil etiladi, siz ham sovqat olib keling.",
    category: "consulting",
    authorRole: "AGENT",
    attachments: [
      { type: "image", url: "/static/posts/networking.jpg", name: "networking.jpg" }
    ],
    likes: 6,
    replies: 3,
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString()
  },
  {
    slug: "g-translation-002-q1",
    groupSlug: "g-translation-002",
    type: "question",
    title: "Visa hujjatlari uchun qaysi tarjimon mos?",
    body: "Kim menga rasmiy Korea visa uchun notarial tarjima xizmatini taklif qiladi?",
    category: "translation",
    authorRole: "USER",
    attachments: [
      { type: "document", url: "/static/posts/visa-doc.pdf", name: "visa-doc.pdf" }
    ],
    likes: 15,
    replies: 3,
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
  },
  {
    slug: "g-translation-002-q2",
    groupSlug: "g-translation-002",
    type: "post",
    title: "Tarjimonlar uchun onboarding sessiyasi",
    body: "Hujjatlar uchun qaysi platforma ishlatish samarali ekanini hizmat qiluvchi agentlar bilan muhokama qilamiz.",
    category: "translation",
    authorRole: "AGENT",
    attachments: [
      { type: "video", url: "/static/posts/translation-hint.mp4", name: "translation.mp4" }
    ],
    likes: 9,
    replies: 1,
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  },
  {
    slug: "g-translation-002-post3",
    groupSlug: "g-translation-002",
    type: "file",
    title: "Immigration doc checklist",
    body: "Koreya immigratsiya bo‘limiga topshirish uchun to‘liq fayl ro‘yxati va formani shu yerda yuklab olishingiz mumkin.",
    category: "translation",
    authorRole: "AGENT",
    attachments: [
      { type: "document", url: "/static/posts/immigration-checklist.pdf", name: "immigration-checklist.pdf" },
      { type: "image", url: "/static/posts/checklist-hero.jpg", name: "checklist-hero.jpg" }
    ],
    likes: 11,
    replies: 2,
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  },
  {
    slug: "g-tech-003-q1",
    groupSlug: "g-tech-003",
    type: "question",
    title: "Startup uchun legal hujjatlar qayerdan?",
    body: "Seulda yuridik asistencia topish uchun ishonchli agentlar kimlar?",
    category: "community",
    authorRole: "USER",
    attachments: [],
    likes: 5,
    replies: 2,
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
  },
  {
    slug: "g-tech-003-q2",
    groupSlug: "g-tech-003",
    type: "post",
    title: "Brendingizni video tarzda targ‘ib qiling",
    body: "Media startaplar uchun video kontent yetkazib berish qiziqarli variant.",
    category: "community",
    authorRole: "AGENT",
    attachments: [
      { type: "video", url: "/static/posts/tech-video.mp4", name: "tech.mp4" }
    ],
    likes: 10,
    replies: 0,
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  },
  {
    slug: "g-tech-003-post3",
    groupSlug: "g-tech-003",
    type: "post",
    title: "Hackathon g‘oyalarini baham ko‘ring",
    body: "Ochiq manba vositalaridan foydalanish, Korea va Uzbekiston kod platformalari bilan tajriba o'tkazing.",
    category: "community",
    authorRole: "USER",
    attachments: [
      { type: "image", url: "/static/posts/hackathon.jpg", name: "hackathon.jpg" },
      { type: "video", url: "/static/posts/hackathon-teaser.mp4", name: "hackathon-teaser.mp4" }
    ],
    likes: 14,
    replies: 5,
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  }
];
