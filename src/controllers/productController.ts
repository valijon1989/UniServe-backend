import { Request, Response } from "express";
import { Product } from "../models/Product";
import { parsePositiveInt } from "../utils/pagination";
import mongoose from "mongoose";
import dayjs from "dayjs";
import path from "path";

type StubProduct = {
  slug: string;
  name: string;
  price: number;
  images: string[];
  description: string;
  category: string;
  subCategory?: string;
  oldPrice?: number;
  brand?: string;
  condition?: string;
  badges?: string[];
  highlights?: string[];
  delivery?: {
    type?: string;
    fee?: number;
    estimated?: string;
    promise?: string;
    origin?: string;
    freeReturn?: boolean;
    address?: string;
  };
  seller?: {
    name?: string;
    rating?: number;
    reviewCount?: number;
    sales?: number;
    contact?: string;
    isOfficial?: boolean;
    badges?: string[];
  };
  benefits?: {
    coupons?: { label: string; description: string }[];
    installment?: { months: number[]; partner: string; minPrice: number };
    delivery?: string;
  };
  specs?: { label: string; value: string }[];
  options?: { name: string; values: string[]; defaultValue?: string }[];
  policies?: {
    returnWindow?: string;
    exchange?: string;
    warranty?: string;
    support?: string;
  };
  stock?: number;
  rating?: { avg: number; count: number };
  stats?: { views: number; likes: number; purchases: number };
};

const fallbackImage =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80";
const stubImage = (slug: string) =>
  `https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80&slug=${slug}`;
const stubImages = (slug: string) => [
  `${stubImage(slug)}&i=1`,
  `${stubImage(slug)}&i=2`,
  `${stubImage(slug)}&i=3`
];
const baseStats = { views: 120, likes: 15, purchases: 6 };
const baseRating = { avg: 4.3, count: 12 };
const stubProducts: StubProduct[] = [
  {
    slug: "pc-1",
    name: "Office PC",
    price: 2800000,
    oldPrice: 3200000,
    images: stubImages("pc-1"),
    description: "Office uchun balanslangan kompyuter (Core i5, 16GB RAM, 512GB SSD)",
    category: "elektronika",
    subCategory: "pc",
    brand: "Lenovo",
    condition: "Yangi",
    rating: baseRating,
    stats: baseStats,
    highlights: ["Core i5 + 16GB RAM", "Windows 11 Pro", "2 yillik kafolat"],
    specs: [
      { label: "Processor", value: "Intel Core i5-12400" },
      { label: "Xotira", value: "16GB DDR4" },
      { label: "Saqlash", value: "512GB SSD" },
      { label: "OS", value: "Windows 11 Pro" }
    ],
    options: [
      { name: "Xotira", values: ["8GB", "16GB"], defaultValue: "16GB" },
      { name: "Disk", values: ["256GB SSD", "512GB SSD"], defaultValue: "512GB SSD" }
    ],
    policies: { warranty: "24 oy rasmiy kafolat" }
  },
  {
    slug: "cam-1",
    name: "Camcorder 4K",
    price: 3200000,
    oldPrice: 3550000,
    images: stubImages("cam-1"),
    description: "4K videokamera, barqarorlashtirish va keng burchakli ob'ektiv bilan",
    category: "elektronika",
    subCategory: "texnika",
    brand: "Sony",
    condition: "Yangi",
    rating: baseRating,
    stats: { views: 45, likes: 9, purchases: 3 },
    highlights: ["4K 60fps videoyozuv", "Ovoz uchun ikki kanalli mikrofon", "Barqarorlashtirish va auto-focus"],
    specs: [
      { label: "Video", value: "4K 60fps / FHD 120fps" },
      { label: "Sensor", value: "1/2.3\" CMOS" },
      { label: "Stabilizatsiya", value: "OIS + EIS" },
      { label: "Xotira", value: "SDXC (256GB gacha)" }
    ],
    options: [{ name: "Komplekt", values: ["Solo", "Extra batareya"], defaultValue: "Solo" }],
    policies: { warranty: "12 oy rasmiy kafolat" }
  },
  {
    slug: "pc-2",
    name: "Mini PC",
    price: 2600000,
    oldPrice: 2950000,
    images: stubImages("pc-2"),
    description: "Ixcham mini PC (Ryzen 5, 16GB, 512GB SSD) ofis va kassalar uchun",
    category: "elektronika",
    subCategory: "pc",
    brand: "Beelink",
    condition: "Yangi",
    rating: baseRating,
    stats: baseStats,
    highlights: ["Palm-top dizayn", "4K dual display", "Wi-Fi 6"],
    specs: [
      { label: "Processor", value: "AMD Ryzen 5 5600H" },
      { label: "Xotira", value: "16GB DDR4" },
      { label: "Saqlash", value: "512GB NVMe SSD" },
      { label: "Video chiqish", value: "HDMI 2.0 x2" }
    ],
    options: [{ name: "Saqlash", values: ["512GB", "1TB"], defaultValue: "512GB" }]
  },
  {
    slug: "pc-3",
    name: "Gaming PC",
    price: 4500000,
    oldPrice: 5200000,
    images: stubImages("pc-3"),
    description: "RTX 3060 bilan o'yin va dizayn uchun kuchli desktop",
    category: "elektronika",
    subCategory: "pc",
    brand: "MSI",
    condition: "Yangi",
    rating: baseRating,
    stats: baseStats,
    highlights: ["RTX 3060 12GB", "Ryzen 7 5700X", "ARGB sovutish"],
    specs: [
      { label: "Video karta", value: "NVIDIA RTX 3060 12GB" },
      { label: "Processor", value: "AMD Ryzen 7 5700X" },
      { label: "Xotira", value: "16GB DDR4 3600MHz" },
      { label: "Saqlash", value: "1TB NVMe SSD" }
    ],
    options: [{ name: "Operativ xotira", values: ["16GB", "32GB"], defaultValue: "16GB" }]
  },
  {
    slug: "mobile-2",
    name: "mobile-2",
    price: 100000,
    oldPrice: 115000,
    images: stubImages("mobile-2"),
    description: "mobile-2 (stub) — tez yetkazib beriladigan demo mahsulot",
    category: "oziq-ovqat",
    subCategory: "tayyor-maxsulotlar",
    brand: "UniServe Demo",
    condition: "Yangi",
    rating: baseRating,
    stats: { views: 18, likes: 4, purchases: 2 },
    highlights: ["Kategoriya: oziq-ovqat", "Demo mahsulot tafsilotlari", "Tez yetkazib berish mavjud"],
    specs: [
      { label: "Kategoriya", value: "oziq-ovqat" },
      { label: "Sub-kategoriya", value: "tayyor mahsulotlar" },
      { label: "Holati", value: "Yangi" }
    ]
  },
  {
    slug: "ready-1",
    name: "Tayyor taom box",
    price: 115000,
    oldPrice: 135000,
    images: stubImages("ready-1"),
    description: "Sog'lom va to'yimli tayyor taom: guruch, tovuq va sabzavotlar",
    category: "oziq-ovqat",
    subCategory: "tayyor-maxsulotlar",
    brand: "UniServe Kitchen",
    condition: "Yangi",
    rating: baseRating,
    stats: baseStats,
    highlights: ["Protein: 34g", "Kaloriya: 520 kcal", "1 porsiya"],
    specs: [
      { label: "Og'irligi", value: "450 g" },
      { label: "Saqlash muddati", value: "5 kun, +2°C +6°C" },
      { label: "Tarkibi", value: "Tovuqli guruch, brokkoli, sous" }
    ],
    options: [{ name: "Achchiqlik darajasi", values: ["Mild", "Medium", "Hot"], defaultValue: "Medium" }],
    policies: { returnWindow: "Yopiq qadoq va chetlanmagan holda 24 soat" }
  },
  {
    slug: "ready-2",
    name: "Tayyor salat",
    price: 65000,
    oldPrice: 78000,
    images: stubImages("ready-2"),
    description: "Grecheskiy salat yangi sabzavotlar va feta pishlog'i bilan",
    category: "oziq-ovqat",
    subCategory: "tayyor-maxsulotlar",
    brand: "UniServe Kitchen",
    condition: "Yangi",
    rating: baseRating,
    stats: baseStats,
    highlights: ["Vitaminlarga boy", "Past kaloriya", "1 porsiya"],
    specs: [
      { label: "Og'irligi", value: "320 g" },
      { label: "Saqlash muddati", value: "3 kun, +2°C +6°C" },
      { label: "Tarkibi", value: "Bodring, pamidor, feta, zaytun" }
    ]
  },
  {
    slug: "ready-3",
    name: "Tayyor sho'rva",
    price: 85000,
    images: stubImages("ready-3"),
    description: "Krem sho'rva, qo'ziqorin va qaymoqli retsept bo'yicha",
    category: "oziq-ovqat",
    subCategory: "tayyor-maxsulotlar",
    brand: "UniServe Kitchen",
    condition: "Yangi",
    rating: baseRating,
    stats: baseStats,
    highlights: ["Past kaloriyali", "1 porsiya", "Qaymoqli ta'm"],
    specs: [
      { label: "Og'irligi", value: "400 g" },
      { label: "Saqlash muddati", value: "4 kun, +2°C +6°C" },
      { label: "Tarkibi", value: "Qo'ziqorin, qaymoq, bulon" }
    ]
  },
  { slug: "frag-1", name: "Atir", price: 520000, images: [stubImage("frag-1")], description: "Fragrance demo", category: "gozallik", subCategory: "atirlar", rating: baseRating, stats: baseStats },
  { slug: "skin-1", name: "Yuz kremi", price: 220000, images: [stubImage("skin-1")], description: "Skin care demo", category: "gozallik", subCategory: "yuz-kremlari", rating: baseRating, stats: baseStats },
  { slug: "car-1", name: "Sedan 2020", price: 145000000, images: [stubImage("car-1")], description: "Car demo", category: "avto-texnika", subCategory: "avtomobil", rating: baseRating, stats: baseStats },
  { slug: "carpart-1", name: "Tormoz diski", price: 1800000, images: [stubImage("carpart-1")], description: "Car part demo", category: "avto-texnika", subCategory: "avtomobil-extiyot-qismlari", rating: baseRating, stats: baseStats },
  { slug: "tech-1", name: "Notebook i7", price: 9500000, images: [stubImage("tech-1")], description: "Tech demo", category: "avto-texnika", subCategory: "texnika", rating: baseRating, stats: baseStats },
  { slug: "vac-1", name: "Chang yutkich", price: 1450000, images: [stubImage("vac-1")], description: "Vacuum demo", category: "maishiy-uskunalar", subCategory: "chang-yutkich", rating: baseRating, stats: baseStats },
  { slug: "wash-1", name: "Kir yuvish mashinasi", price: 4200000, images: [stubImage("wash-1")], description: "Washer demo", category: "maishiy-uskunalar", subCategory: "kir-yuvish", rating: baseRating, stats: baseStats },
  { slug: "men-1", name: "Erkaklar T-shirt", price: 180000, images: [stubImage("men-1")], description: "Men wear", category: "kiyim-kechak", subCategory: "erkaklar", rating: baseRating, stats: baseStats },
  { slug: "women-1", name: "Ayollar bluzka", price: 210000, images: [stubImage("women-1")], description: "Women wear", category: "kiyim-kechak", subCategory: "ayollar", rating: baseRating, stats: baseStats }
];

type DeliveryInfo = {
  type: string;
  fee: number;
  estimated: string;
  promise: string;
  origin: string;
  freeReturn: boolean;
  address?: string;
};

type SellerInfo = {
  name: string;
  rating: number;
  reviewCount: number;
  sales: number;
  contact: string;
  isOfficial: boolean;
  badges: string[];
};

const formatDateRange = (fromDays = 1, toDays = 2) =>
  `${dayjs().add(fromDays, "day").format("MMM D")} - ${dayjs().add(toDays, "day").format("MMM D")}`;

const defaultSeller: SellerInfo = {
  name: "UniServe Mall",
  rating: 4.7,
  reviewCount: 1240,
  sales: 3200,
  contact: "+998 71 123 45 67",
  isOfficial: true,
  badges: ["Rasmiy diler", "Original mahsulot", "24/7 qo'llab-quvvatlash"]
};

const buildBadges = (p: any) =>
  p.badges || ["Tez yetkazib berish", "Original mahsulot", "15 kun qaytarish", "Qadoqlashni videoga olish"];

const buildDeliveryInfo = (p: any): DeliveryInfo => {
  const estimated = p.delivery?.estimated || formatDateRange(1, 2);
  return {
    type: p.delivery?.type || "fast",
    fee: p.delivery?.fee ?? 0,
    estimated,
    promise: p.delivery?.promise || "Buyurtma 18:00 gacha tasdiqlansa ertangi kuni yetkaziladi",
    origin: p.delivery?.origin || "Toshkent ombori",
    freeReturn: p.delivery?.freeReturn ?? true,
    address: p.delivery?.address
  };
};

const buildSellerInfo = (p: any): SellerInfo => {
  const seller = p.seller || {};
  return {
    name: seller.name || p.vendor?.name || "UniServe Market",
    rating: seller.rating ?? p.rating?.avg ?? defaultSeller.rating,
    reviewCount: seller.reviewCount ?? p.rating?.count ?? defaultSeller.reviewCount,
    sales: seller.sales ?? p.stats?.purchases ?? defaultSeller.sales,
    contact: seller.contact || defaultSeller.contact,
    isOfficial: seller.isOfficial ?? defaultSeller.isOfficial,
    badges: seller.badges || defaultSeller.badges
  };
};

const buildBenefits = (p: any, delivery: DeliveryInfo) => ({
  coupons:
    p.benefits?.coupons ||
    [
      { label: "5% kupon", description: "Checkout jarayonida avtomatik qo'llanadi" },
      { label: "10 000 so'm bonus", description: "Yangi foydalanuvchilar uchun" }
    ],
  installment:
    p.benefits?.installment || { months: [3, 6, 12], partner: "Paymart", minPrice: 100000 },
  delivery: p.benefits?.delivery || (delivery.fee === 0 ? "Yetkazib berish bepul" : "Tez yetkazish xizmati mavjud")
});

const buildPolicies = (p: any) => ({
  returnWindow: p.policies?.returnWindow || "15 kun ichida bepul qaytarish",
  exchange: p.policies?.exchange || "Oson almashtirish va pulni qaytarish",
  warranty: p.policies?.warranty || "12 oy ishlab chiqaruvchi kafolati",
  support: p.policies?.support || "24/7 qo'llab-quvvatlash"
});

const buildSpecs = (p: any) => {
  const baseSpecs = [
    { label: "Kategoriya", value: p.category || "Umumiy" },
    { label: "Brend", value: p.brand || "UniServe tanlovi" },
    { label: "Holati", value: p.condition || "Yangi" }
  ];
  const merged = [...baseSpecs, ...(p.specs || [])];
  const seen = new Set<string>();
  return merged.filter((spec) => {
    if (!spec.label) return false;
    const key = spec.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(spec.value);
  });
};

const buildOptions = (p: any) =>
  p.options || [
    { name: "Rangi", values: ["Oq", "Qora"], defaultValue: "Oq" },
    { name: "O'lcham", values: ["S", "M", "L"], defaultValue: "M" }
  ];

const buildHighlights = (name: string, delivery: DeliveryInfo, seller: SellerInfo, p: any) =>
  p.highlights || [
    `${name} uchun tez yetkazib berish (${delivery.estimated})`,
    `${seller.name} tomonidan kafolatlangan original mahsulot`,
    p.price ? `Hozirgi narx: ${p.price} so'm` : "Narx aniqlandi"
  ];

const buildReviewSummary = (p: any) => {
  const avg = Number(p.rating?.avg || 0);
  const count = Number(p.rating?.count || 0);
  return {
    average: avg,
    count,
    photoCount: p.reviewSummary?.photoCount ?? Math.max(0, Math.round(count * 0.35))
  };
};

const buildDetailSections = (
  highlights: string[],
  specs: { label: string; value: string }[],
  delivery: DeliveryInfo,
  seller: SellerInfo,
  policies: { returnWindow: string; exchange: string; warranty: string; support: string }
) => [
  { title: "Asosiy ma'lumotlar", items: highlights },
  { title: "Texnik xarakteristikalar", items: specs.map((s) => `${s.label}: ${s.value}`) },
  { title: "Yetkazib berish", items: [`Xizmat: ${delivery.type}`, `Narx: ${delivery.fee ? `${delivery.fee} so'm` : "Bepul"}`, `Taxminiy sana: ${delivery.estimated}`, delivery.promise] },
  {
    title: "Sotuvchi",
    items: [`Sotuvchi: ${seller.name}`, `Reyting: ${seller.rating} (${seller.reviewCount} izoh)`, `Sotuvlar: ${seller.sales}`, `Kontakt: ${seller.contact}`]
  },
  { title: "Qaytarish va kafolat", items: [policies.returnWindow, policies.exchange, policies.warranty, policies.support] }
];

const normalizeImages = (p: any) => {
  const provided = (p.images || []).filter(Boolean).slice(0, 20);
  const filled = provided.length ? [...provided] : [fallbackImage];
  while (filled.length < 3 && filled.length < 20) {
    filled.push(filled[filled.length - 1]);
  }
  return filled.slice(0, 20);
};

const toDetailDto = (p: any) => {
  const name = p.name || p.title;
  const price = Number(p.price || 0);
  const oldPrice = p.oldPrice ?? (price ? Math.round(price * 1.12) : undefined);
  const rating = p.rating || { avg: 0, count: 0 };
  const stats = p.stats || { views: p.views || 0, likes: p.likes || 0, purchases: p.orders || 0 };
  const delivery = buildDeliveryInfo(p);
  const seller = buildSellerInfo(p);
  const badges = buildBadges(p);
  const benefits = buildBenefits(p, delivery);
  const specs = buildSpecs(p);
  const highlights = buildHighlights(name, delivery, seller, p);
  const policies = buildPolicies(p);
  const options = buildOptions(p);
  const detailSections = buildDetailSections(highlights, specs, delivery, seller, policies);
  const reviewSummary = buildReviewSummary(p);
  const images = normalizeImages(p);

  return {
    id: p._id?.toString?.() ?? p.slug ?? p.id,
    name,
    description: p.description || "",
    price,
    currency: p.currency || "UZS",
    oldPrice,
    thumbnail: p.thumbnail || images[0] || fallbackImage,
    images,
    rating,
    reviewSummary,
    stats,
    category: p.category,
    subCategory: p.subCategory,
    brand: p.brand,
    condition: p.condition || "Yangi",
    size: p.size,
    season: p.season,
    audience: p.audience,
    vendor: p.vendor || p.createdBy,
    badges,
    highlights,
    delivery,
    seller,
    benefits,
    specs,
    options,
    policies,
    stock: p.stock ?? p.quantity ?? 24,
    detailSections
  };
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { title, description, price, currency, images, category } = req.body;
    if (!title || !price) {
      return res.status(400).json({ message: "title and price required" });
    }
    if (!Array.isArray(images) || images.length < 3 || images.length > 20) {
      return res.status(400).json({ message: "images must contain between 3 and 20 items" });
    }
    const product = await Product.create({
      title,
      description,
      price,
      currency: currency || "USD",
      images: images || [],
      category,
      createdBy: req.user._id
    });
    return res.status(201).json({ product });
  } catch (err) {
    console.error("createProduct error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listProducts = async (req: Request, res: Response) => {
  try {
    // Return only stubbed catalog to avoid duplicate keys and keep consistent slugs
    const products = stubProducts.map((s) => toDetailDto(s));
    return res.json({ products });
  } catch (err) {
    console.error("listProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const productDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let product: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id).populate("createdBy", "name username role");
    }
    if (!product) {
      const stub = stubProducts.find((s) => s.slug === id);
      if (stub) {
        product = stub;
      }
    }
    if (!product) {
      const fallback = {
        slug: id,
        name: id,
        price: 100000,
        images: [stubImage(id)],
        description: `${id} (stub)`,
        category: "oziq-ovqat",
        subCategory: "tayyor-maxsulotlar",
        rating: baseRating,
        stats: { views: 0, likes: 0, purchases: 0 }
      };
      return res.json(toDetailDto(fallback));
    }
    return res.json(toDetailDto(product));
  } catch (err) {
    console.error("productDetail error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const productStat = async (req: Request, res: Response) => {
  try {
    const { id, action } = req.params;
    if (action !== "view" && !req.user) {
      return res.status(401).json({ message: "Login required" });
    }

    let product: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id);
    }
    if (!product) {
      const stub = stubProducts.find((s) => s.slug === id);
      if (stub) {
        product = stub;
      }
    }
    if (!product) {
      product = {
        _id: id,
        stats: { views: 0, likes: 0, purchases: 0 }
      };
    }

    const stats = product.stats || { views: product.views || 0, likes: product.likes || 0, purchases: product.orders || 0 };
    if (action === "view") stats.views = (stats.views || 0) + 1;
    if (action === "like") stats.likes = (stats.likes || 0) + 1;
    if (action === "purchase") stats.purchases = (stats.purchases || 0) + 1;
    if (product.slug) {
      const stub = stubProducts.find((s) => s.slug === product.slug);
      if (stub) stub.stats = stats;
    }
    return res.json({ stats });
  } catch (err) {
    console.error("productStat error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const myProducts = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const products = await Product.find({ createdBy: req.user._id });
    return res.json({ products });
  } catch (err) {
    console.error("myProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateProductStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id } = req.params;
    const { status } = req.body;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (String(product.createdBy) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }
    product.status = status;
    await product.save();
    return res.json({ product });
  } catch (err) {
    console.error("updateProductStatus error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getPopularProducts = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 8, 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find({})
        .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      Product.countDocuments({})
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      items
    });
  } catch (err) {
    console.error("getPopularProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getTrendingProducts = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 9, 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find({})
        .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      Product.countDocuments({})
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      items
    });
  } catch (err) {
    console.error("getTrendingProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const uploadProductImagesHandler = async (req: Request, res: Response) => {
  try {
    const files = (req.files as any[]) || [];
    if (!files.length) {
      return res.status(400).json({ message: "Hech qanday rasm yuklanmadi" });
    }
    const urls = files.map((file: any) =>
      `/static/products/${path.basename(file.filename || file.path || file.originalname)}`
    );
    return res.status(201).json({ urls, count: urls.length });
  } catch (err) {
    console.error("uploadProductImagesHandler error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
