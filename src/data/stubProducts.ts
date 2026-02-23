export type StubProduct = {
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

export const fallbackImage = "https://picsum.photos/seed/uniserve-product-fallback/900/600";

export const categoryKeyword = (category?: string, name?: string) => {
  const label = (category || "").toLowerCase();
  if (label.includes("elektronika")) return "computer";
  if (label.includes("oziq")) return "food";
  if (label.includes("gozallik")) return "cosmetics";
  if (label.includes("avto")) return "car";
  if (label.includes("maishiy")) return "appliance";
  if (label.includes("kiyim")) return "fashion";
  return (name || "product").toLowerCase();
};

export const stubImage = (slug: string, keyword: string) =>
  `https://picsum.photos/seed/uniserve-${encodeURIComponent(keyword)}-${encodeURIComponent(slug)}/900/600`;

const stubImages = (slug: string, keyword: string) => [
  `${stubImage(`${slug}-1`, keyword)}`,
  `${stubImage(`${slug}-2`, keyword)}`,
  `${stubImage(`${slug}-3`, keyword)}`
];

export const getProductImages = (slug: string, category?: string, name?: string) =>
  stubImages(slug, categoryKeyword(category, name));

const baseStats = { views: 120, likes: 15, purchases: 6 };
export const baseRating = { avg: 4.3, count: 12 };

export const stubProducts: StubProduct[] = [
  {
    slug: "pc-1",
    name: "Office PC",
    price: 2800000,
    oldPrice: 3200000,
    images: getProductImages("pc-1", "elektronika", "Office PC"),
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
    images: getProductImages("cam-1", "elektronika", "Camcorder"),
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
    images: getProductImages("pc-2", "elektronika", "Mini PC"),
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
    images: getProductImages("pc-3", "elektronika", "Gaming PC"),
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
    images: getProductImages("mobile-2", "oziq-ovqat", "Mobile food"),
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
    images: getProductImages("ready-1", "oziq-ovqat", "Meal box"),
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
    images: getProductImages("ready-2", "oziq-ovqat", "Salad"),
    description: "Yengil sabzavotli salat, vitaminlarga boy",
    category: "oziq-ovqat",
    subCategory: "salatlar",
    brand: "UniServe Kitchen",
    condition: "Yangi",
    rating: baseRating,
    stats: baseStats,
    highlights: ["Vitamin C", "Yengil kaloriya", "1 porsiya"],
    specs: [
      { label: "Og'irligi", value: "300 g" },
      { label: "Saqlash muddati", value: "3 kun, +2°C +6°C" },
      { label: "Tarkibi", value: "Sabzavotlar, zaytun, sous" }
    ],
    options: [{ name: "Sous", values: ["Yog'li", "Yengil"], defaultValue: "Yengil" }]
  },
  {
    slug: "ready-3",
    name: "Tayyor sho'rva",
    price: 75000,
    oldPrice: 88000,
    images: getProductImages("ready-3", "oziq-ovqat", "Soup"),
    description: "Issiq sho'rva, tez tayyor bo'ladigan va to'yimli",
    category: "oziq-ovqat",
    subCategory: "sho'rvalar",
    brand: "UniServe Kitchen",
    condition: "Yangi",
    rating: baseRating,
    stats: baseStats,
    highlights: ["Issiq va to'yimli", "Tez isitiladi", "1 porsiya"],
    specs: [
      { label: "Og'irligi", value: "500 g" },
      { label: "Saqlash muddati", value: "4 kun, +2°C +6°C" },
      { label: "Tarkibi", value: "Go'sht, sabzavot, ziravorlar" }
    ]
  },
  { slug: "frag-1", name: "Atir", price: 520000, images: getProductImages("frag-1", "gozallik", "Atir"), description: "Fragrance demo", category: "gozallik", subCategory: "atirlar", rating: baseRating, stats: baseStats },
  { slug: "skin-1", name: "Yuz kremi", price: 220000, images: getProductImages("skin-1", "gozallik", "Yuz kremi"), description: "Skin care demo", category: "gozallik", subCategory: "yuz-kremlari", rating: baseRating, stats: baseStats },
  { slug: "car-1", name: "Sedan 2020", price: 145000000, images: getProductImages("car-1", "avto-texnika", "Sedan"), description: "Car demo", category: "avto-texnika", subCategory: "avtomobil", rating: baseRating, stats: baseStats },
  { slug: "carpart-1", name: "Tormoz diski", price: 1800000, images: getProductImages("carpart-1", "avto-texnika", "Car part"), description: "Car part demo", category: "avto-texnika", subCategory: "avtomobil-extiyot-qismlari", rating: baseRating, stats: baseStats },
  { slug: "tech-1", name: "Notebook i7", price: 9500000, images: getProductImages("tech-1", "avto-texnika", "Notebook"), description: "Tech demo", category: "avto-texnika", subCategory: "texnika", rating: baseRating, stats: baseStats },
  { slug: "vac-1", name: "Chang yutkich", price: 1450000, images: getProductImages("vac-1", "maishiy-uskunalar", "Vacuum"), description: "Vacuum demo", category: "maishiy-uskunalar", subCategory: "chang-yutkich", rating: baseRating, stats: baseStats },
  { slug: "wash-1", name: "Kir yuvish mashinasi", price: 4200000, images: getProductImages("wash-1", "maishiy-uskunalar", "Washer"), description: "Washer demo", category: "maishiy-uskunalar", subCategory: "kir-yuvish", rating: baseRating, stats: baseStats },
  { slug: "men-1", name: "Erkaklar T-shirt", price: 180000, images: getProductImages("men-1", "kiyim-kechak", "Men shirt"), description: "Men wear", category: "kiyim-kechak", subCategory: "erkaklar", rating: baseRating, stats: baseStats },
  { slug: "women-1", name: "Ayollar bluzka", price: 210000, images: getProductImages("women-1", "kiyim-kechak", "Women blouse"), description: "Women wear", category: "kiyim-kechak", subCategory: "ayollar", rating: baseRating, stats: baseStats }
];
