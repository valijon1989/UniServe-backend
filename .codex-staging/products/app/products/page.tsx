"use client";

import { useMemo, useState } from "react";
import { CatalogTopbar } from "@/components/CatalogTopbar";
import Pagination from "@/components/Pagination";
import ProductCard from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/product-card/ProductCardSkeleton";
import { ProductGrid } from "@/components/ProductGrid";
import { useProducts } from "@/hooks/useProducts";
import CategoriesSidebar from "@/components/CategoriesSidebar";
import type { Product } from "@/api/products";
import { getShopCategoryMeta, resolveShopCategorySlug } from "@/data/shopTaxonomy";
import { useI18n } from "@/context/i18n";
import { resolveLocalizedText } from "@/lib/localization";
import {
  formatProductPaginationSummary,
  formatProductResultCount,
  getLocalizedProductSearchChips,
  getProductAudienceLabel,
  getProductConditionLabel,
  getProductDeliveryLabel,
  getProductSeasonLabel
} from "@/lib/productsPresentation";

const PRODUCT_IMAGE_POOL_SIZE = 36;
const DELIVERY_OPTIONS = ["fast", "tomorrow", "standard"] as const;

type QuickFiltersState = {
  priceMin: string;
  priceMax: string;
  brand: string;
  rating45: boolean;
  delivery: "any" | "fast" | "tomorrow" | "standard";
  inStock: boolean;
  condition: "any" | "new" | "used";
};

const DEFAULT_QUICK_FILTERS: QuickFiltersState = {
  priceMin: "",
  priceMax: "",
  brand: "",
  rating45: false,
  delivery: "any",
  inStock: false,
  condition: "any"
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const makeProductImages = (pool: string, seed: string, count = 3) => {
  const safeCount = Math.min(20, Math.max(3, count));
  const base = (hashString(`${pool}-${seed}`) % PRODUCT_IMAGE_POOL_SIZE) + 1;
  return Array.from({ length: safeCount }, (_, idx) => {
    const value = ((base + idx * 5) % PRODUCT_IMAGE_POOL_SIZE) + 1;
    return `/services/${pool}/${String(value).padStart(2, "0")}.jpg`;
  });
};

const getDeliveryMeta = (item: Product) => {
  const seed = (item._id || item.id || item.name || item.title || "").toString();
  const base = hashString(seed);
  const delivery = DELIVERY_OPTIONS[base % DELIVERY_OPTIONS.length];
  const inStock = base % 9 !== 0;
  return { delivery, inStock };
};

const withProductImages = (
  record: Record<string, Product[]>,
  pool: string,
  overrides: Record<string, number> = {}
) =>
  Object.fromEntries(
    Object.entries(record).map(([key, items]) => [
      key,
      items.map((item) => {
        const count = overrides[item.id || item._id || item.name || ""] ?? 3;
        const images = makeProductImages(pool, item.id || item._id || item.name || key, count);
        return {
          ...item,
          thumbnail: images[0],
          images
        };
      })
    ])
  );

export default function ProductsPage() {
  const { t, language } = useI18n();
  const tp = (key: string, fallback: string) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };
  const {
    items,
    loading,
    filters,
    setFilters,
    pagination,
    setPagination
  } = useProducts({
    category: "",
    order: "popular"
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "relevance" | "bestseller" | "toprated" | "priceLow" | "priceHigh" | "newest"
  >("relevance");
  const [quickFilters, setQuickFilters] = useState<QuickFiltersState>({ ...DEFAULT_QUICK_FILTERS });
  const [fastOnly, setFastOnly] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handleCategorySelect = (slug: string) => {
    const nextCategory = resolveShopCategorySlug(slug);
    setFilters({ ...filters, category: nextCategory === "all" ? "" : nextCategory });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const resetCategoryPanels = () => {
    setFoodSubcategory(null);
    setBeautySubcategory(null);
    setBeautyFilters({ brand: "", audience: "any" });
    setElectronicsSubcategory(null);
    setElectronicsFilters({ brand: "", condition: "any" });
    setAutoSubcategory(null);
    setAutoFilters({ brand: "", condition: "any" });
    setHomeSubcategory(null);
    setHomeFilters({ brand: "", condition: "any" });
    setClothingSubcategory(null);
    setClothingFilters({ brand: "", size: "any", season: "any" });
  };

  const resetQuickFilterState = () => {
    setQuickFilters({ ...DEFAULT_QUICK_FILTERS });
    setFastOnly(false);
    setSearchQuery("");
  };

  const clearAllListingFilters = () => {
    resetQuickFilterState();
    resetCategoryPanels();
    setFilters((prev) => ({ ...prev, category: "" }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const activeCategory = resolveShopCategorySlug(filters.category);
  const activeCategoryMeta = getShopCategoryMeta(activeCategory);

  const [foodSubcategory, setFoodSubcategory] = useState<string | null>(null);
  const [foodFilters, setFoodFilters] = useState<{
    brand: string;
    priceMin?: number;
    priceMax?: number;
    condition: "any" | "fresh" | "frozen";
  }>({
    brand: "",
    condition: "any"
  });
  const isFoodCategory = activeCategory === "food";

  const [beautySubcategory, setBeautySubcategory] = useState<string | null>(null);
  const [beautyFilters, setBeautyFilters] = useState<{
    brand: string;
    priceMin?: number;
    priceMax?: number;
    audience: "any" | "women" | "men" | "kids" | "unisex";
  }>({
    brand: "",
    audience: "any"
  });
  const isBeautyCategory = activeCategory === "beauty";

  const [electronicsSubcategory, setElectronicsSubcategory] = useState<string | null>(null);
  const [electronicsFilters, setElectronicsFilters] = useState<{
    brand: string;
    priceMin?: number;
    priceMax?: number;
    condition: "any" | "new" | "used";
  }>({
    brand: "",
    condition: "any"
  });
  const isElectronicsCategory = activeCategory === "electronics";

  const [autoSubcategory, setAutoSubcategory] = useState<string | null>(null);
  const [autoFilters, setAutoFilters] = useState<{
    brand: string;
    priceMin?: number;
    priceMax?: number;
    condition: "any" | "new" | "used";
  }>({
    brand: "",
    condition: "any"
  });
  const isAutoCategory = activeCategory === "auto-tech";

  const [homeSubcategory, setHomeSubcategory] = useState<string | null>(null);
  const [homeFilters, setHomeFilters] = useState<{
    brand: string;
    priceMin?: number;
    priceMax?: number;
    condition: "any" | "new" | "used";
  }>({
    brand: "",
    condition: "any"
  });
  const isHomeCategory = activeCategory === "home-appliances";

  const [clothingSubcategory, setClothingSubcategory] = useState<string | null>(null);
  const [clothingFilters, setClothingFilters] = useState<{
    brand: string;
    priceMin?: number;
    priceMax?: number;
    size: "any" | "s" | "m" | "l" | "xl";
    season: "any" | "summer" | "winter" | "allseason";
  }>({
    brand: "",
    size: "any",
    season: "any"
  });
  const isClothingCategory = activeCategory === "fashion";

  const localizeSubcategories = (slug: string) =>
    getShopCategoryMeta(slug).subcategories.map((sub) => ({
      key: sub.key,
      label: resolveLocalizedText(sub.label, language) || sub.key
    }));

  const foodSubcategories = useMemo(() => localizeSubcategories("food"), [language]);
  const beautySubcategories = useMemo(() => localizeSubcategories("beauty"), [language]);
  const electronicsSubcategories = useMemo(() => localizeSubcategories("electronics"), [language]);
  const autoSubcategories = useMemo(() => localizeSubcategories("auto-tech"), [language]);
  const homeSubcategories = useMemo(() => localizeSubcategories("home-appliances"), [language]);
  const clothingSubcategories = useMemo(() => localizeSubcategories("fashion"), [language]);

  const foodProductsMock: Record<string, Product[]> = withProductImages({
    tayyor: [
      {
        id: "ready-1",
        name: "Mediterranean mezze set",
        description: "Humus, tabbouleh va pita noni to'plami",
        price: 24.9,
        thumbnail: "/images/remote/remote-0006.jpg",
        images: ["/images/remote/remote-0007.jpg"],
        rating: { avg: 4.8, count: 120 },
        stats: { views: 1200, likes: 340, purchases: 210 }
      },
      {
        id: "ready-2",
        name: "Sushi mix box",
        description: "12 dona nigiri va maki kombo",
        price: 29.5,
        thumbnail: "/images/remote/remote-0008.jpg",
        images: ["/images/remote/remote-0009.jpg"],
        rating: { avg: 4.7, count: 95 },
        stats: { views: 980, likes: 280, purchases: 180 }
      },
      {
        id: "ready-3",
        name: "Vegetarian bowl",
        description: "Quinoa, avokado va qovurilgan sabzavotlar",
        price: 18.0,
        thumbnail: "/images/remote/remote-0010.jpg",
        images: ["/images/remote/remote-0011.jpg"],
        rating: { avg: 4.6, count: 88 },
        stats: { views: 720, likes: 190, purchases: 140 }
      }
    ],
    "yarim-tayyor": [
      {
        id: "semiready-1",
        name: "Manti semi-ready",
        description: "Bug'doy xamiri va mol go'shti aralashmasi",
        price: 14.9,
        thumbnail: "/images/remote/remote-0012.jpg",
        images: ["/images/remote/remote-0013.jpg"],
        rating: { avg: 4.5, count: 64 },
        stats: { views: 540, likes: 130, purchases: 90 }
      },
      {
        id: "semiready-2",
        name: "Pelmeni set",
        description: "1 kg muzlatilgan tovuq pelmeni",
        price: 12.5,
        thumbnail: "/images/remote/remote-0014.jpg",
        images: ["/images/remote/remote-0015.jpg"],
        rating: { avg: 4.4, count: 52 },
        stats: { views: 460, likes: 110, purchases: 80 }
      },
      {
        id: "semiready-3",
        name: "Pizza base kit",
        description: "2 ta xamirdan iborat, sous va pishloq bilan",
        price: 16.0,
        thumbnail: "/images/remote/remote-0016.jpg",
        images: ["/images/remote/remote-0017.jpg"],
        rating: { avg: 4.6, count: 70 },
        stats: { views: 610, likes: 150, purchases: 100 }
      }
    ],
    bolalar: [
      {
        id: "kids-1",
        name: "Organic apple puree",
        description: "Shakar qo'shilmagan, 6+ oy",
        price: 4.5,
        thumbnail: "/images/remote/remote-0018.jpg",
        images: ["/images/remote/remote-0019.jpg"],
        rating: { avg: 4.9, count: 140 },
        stats: { views: 880, likes: 260, purchases: 210 }
      },
      {
        id: "kids-2",
        name: "Kids cereal mix",
        description: "Vitaminli donalar, kakao ta'mi",
        price: 6.9,
        thumbnail: "/images/remote/remote-0020.jpg",
        images: ["/images/remote/remote-0021.jpg"],
        rating: { avg: 4.7, count: 90 },
        stats: { views: 720, likes: 190, purchases: 150 }
      },
      {
        id: "kids-3",
        name: "Mini fruit snacks",
        description: "Quruq mevalar, paketli",
        price: 5.2,
        thumbnail: "/images/remote/remote-0022.jpg",
        images: ["/images/remote/remote-0023.jpg"],
        rating: { avg: 4.5, count: 60 },
        stats: { views: 500, likes: 120, purchases: 90 }
      }
    ],
    goshtli: [
      {
        id: "meat-1",
        name: "Ribeye steak",
        description: "Alo navli mol go'shti, 350g",
        price: 21.0,
        thumbnail: "/images/remote/remote-0024.jpg",
        images: ["/images/remote/remote-0025.jpg"],
        rating: { avg: 4.8, count: 110 },
        stats: { views: 940, likes: 280, purchases: 200 }
      },
      {
        id: "meat-2",
        name: "Chicken fillet pack",
        description: "1 kg terisiz tovuq filesi",
        price: 9.8,
        thumbnail: "/images/remote/remote-0026.jpg",
        images: ["/images/remote/remote-0027.jpg"],
        rating: { avg: 4.6, count: 85 },
        stats: { views: 780, likes: 210, purchases: 170 }
      },
      {
        id: "meat-3",
        name: "Lamb kebab mix",
        description: "Tayyorlangan marinadlangan qoy go'shti",
        price: 17.5,
        thumbnail: "/images/remote/remote-0028.jpg",
        images: ["/images/remote/remote-0029.jpg"],
        rating: { avg: 4.7, count: 92 },
        stats: { views: 820, likes: 230, purchases: 160 }
      }
    ],
    exclusive: [
      {
        id: "ex-1",
        name: "Truffle pasta kit",
        description: "Qora truffle sousi va artisan makaron",
        price: 34.0,
        thumbnail: "/images/remote/remote-0026.jpg",
        images: ["/images/remote/remote-0027.jpg"],
        rating: { avg: 4.9, count: 60 },
        stats: { views: 620, likes: 190, purchases: 120 }
      },
      {
        id: "ex-2",
        name: "Artisan cheese board",
        description: "5 xil premium pishloq va qoshimchalar",
        price: 42.0,
        thumbnail: "/images/remote/remote-0030.jpg",
        images: ["/images/remote/remote-0031.jpg"],
        rating: { avg: 4.8, count: 75 },
        stats: { views: 700, likes: 210, purchases: 130 }
      },
      {
        id: "ex-3",
        name: "Single-origin cocoa set",
        description: "Yuqori sifatli kakao donalari va sharbatlari",
        price: 27.5,
        thumbnail: "/images/remote/remote-0026.jpg",
        images: ["/images/remote/remote-0027.jpg"],
        rating: { avg: 4.7, count: 68 },
        stats: { views: 650, likes: 180, purchases: 115 }
      }
    ]
  }, "delivery");

  const beautyProductsMock: Record<string, Product[]> = withProductImages({
    fragrance: [
      {
        id: "frag-1",
        name: "Floral Breeze",
        description: "Yengil bahor atiri, uzun davomiylik",
        price: 89,
        brand: "Fleur",
        thumbnail: "/images/remote/remote-0032.jpg",
        images: ["/images/remote/remote-0033.jpg"],
        rating: { avg: 4.7, count: 160 },
        stats: { views: 1100, likes: 340, purchases: 240 },
        audience: "women"
      },
      {
        id: "frag-2",
        name: "Woody Noir",
        description: "Daraxt va achchiq notalar, kechki chiqishlar uchun",
        price: 105,
        brand: "Noir",
        thumbnail: "/images/remote/remote-0034.jpg",
        images: ["/images/remote/remote-0035.jpg"],
        rating: { avg: 4.8, count: 140 },
        stats: { views: 980, likes: 320, purchases: 210 },
        audience: "men"
      },
      {
        id: "frag-3",
        name: "Citrus Glow",
        description: "Sitrus asosida unisex atir",
        price: 79,
        brand: "Lumen",
        thumbnail: "/images/remote/remote-0036.jpg",
        images: ["/images/remote/remote-0037.jpg"],
        rating: { avg: 4.6, count: 120 },
        stats: { views: 860, likes: 270, purchases: 180 },
        audience: "unisex"
      }
    ],
    skincare: [
      {
        id: "skin-1",
        name: "Hydra Glow Cream",
        description: "Namlovchi yuz kremi, gialuron kislotasi",
        price: 42,
        brand: "Hydra",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.7, count: 200 },
        stats: { views: 1250, likes: 390, purchases: 260 },
        audience: "women"
      },
      {
        id: "skin-2",
        name: "Vitamin C Serum",
        description: "Yuzni yorqinlashtiruvchi 10% vitamin C",
        price: 38,
        brand: "C-Light",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.6, count: 150 },
        stats: { views: 980, likes: 310, purchases: 210 },
        audience: "unisex"
      },
      {
        id: "skin-3",
        name: "SPF 50 Daily",
        description: "Keng spektrli quyoshdan himoya",
        price: 29,
        brand: "SunGuard",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.5, count: 130 },
        stats: { views: 820, likes: 250, purchases: 170 },
        audience: "unisex"
      }
    ],
    haircare: [
      {
        id: "hair-1",
        name: "Keratin Shampoo",
        description: "Sochni mustahkamlovchi keratinli shampun",
        price: 19,
        brand: "Kerax",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.5, count: 110 },
        stats: { views: 740, likes: 200, purchases: 150 },
        audience: "women"
      },
      {
        id: "hair-2",
        name: "Volume Spray",
        description: "Hajm beruvchi styling spreyi",
        price: 24,
        brand: "Volumix",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.4, count: 95 },
        stats: { views: 680, likes: 180, purchases: 130 },
        audience: "women"
      },
      {
        id: "hair-3",
        name: "Beard Oil",
        description: "Erkaklar uchun yengil yog'li aralashma",
        price: 21,
        brand: "Gentle",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.6, count: 80 },
        stats: { views: 560, likes: 170, purchases: 120 },
        audience: "men"
      }
    ],
    makeup: [
      {
        id: "makeup-1",
        name: "Matte Lipstick",
        description: "Uzoq saqlanuvchi, mat effekt",
        price: 22,
        brand: "Velvet",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.7, count: 140 },
        stats: { views: 880, likes: 260, purchases: 190 },
        audience: "women"
      },
      {
        id: "makeup-2",
        name: "All-day Foundation",
        description: "Yengil va yuqori yopuvchanlik",
        price: 34,
        brand: "Prime",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.6, count: 120 },
        stats: { views: 760, likes: 220, purchases: 170 },
        audience: "women"
      },
      {
        id: "makeup-3",
        name: "Mascara Lift",
        description: "Uzaytiruvchi va qalinlashtiruvchi maskara",
        price: 18,
        brand: "Lift",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.5, count: 130 },
        stats: { views: 690, likes: 200, purchases: 150 },
        audience: "women"
      }
    ],
    bodycare: [
      {
        id: "body-1",
        name: "Shea Body Butter",
        description: "Quruq teri uchun intensiv namlovchi",
        price: 26,
        brand: "SheaLux",
        thumbnail: "/images/remote/remote-0032.jpg",
        images: ["/images/remote/remote-0033.jpg"],
        rating: { avg: 4.7, count: 100 },
        stats: { views: 620, likes: 180, purchases: 130 },
        audience: "unisex"
      },
      {
        id: "body-2",
        name: "Kids Gentle Wash",
        description: "Bolalar uchun yumshoq yuvinish geli",
        price: 14,
        brand: "SoftKids",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.6, count: 90 },
        stats: { views: 540, likes: 150, purchases: 110 },
        audience: "kids"
      },
      {
        id: "body-3",
        name: "Men's Body Wash",
        description: "Erkaklar uchun yangilovchi jel",
        price: 17,
        brand: "FreshMen",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.5, count: 85 },
        stats: { views: 500, likes: 140, purchases: 95 },
        audience: "men"
      }
    ],
    nails: [
      {
        id: "nail-1",
        name: "Gel nail polish set",
        description: "3 ta gel lak va top coat",
        price: 28,
        brand: "Lumi Nails",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.6, count: 90 },
        stats: { views: 610, likes: 170, purchases: 120 },
        audience: "women"
      },
      {
        id: "nail-2",
        name: "Cuticle oil",
        description: "Oziqlantiruvchi bodom yog'i asosida",
        price: 12,
        brand: "SoftNail",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.5, count: 70 },
        stats: { views: 480, likes: 140, purchases: 90 },
        audience: "unisex"
      },
      {
        id: "nail-3",
        name: "Nail care kit",
        description: "Pilka, buff va metall asboblar to'plami",
        price: 19,
        brand: "CareKit",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.4, count: 60 },
        stats: { views: 430, likes: 120, purchases: 80 },
        audience: "unisex"
      }
    ],
    tools: [
      {
        id: "tool-1",
        name: "Makeup brush set",
        description: "12 dona professional cho'tkalar",
        price: 39,
        brand: "BrushPro",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.7, count: 130 },
        stats: { views: 720, likes: 210, purchases: 150 },
        audience: "women"
      },
      {
        id: "tool-2",
        name: "Hair dryer ionic",
        description: "Ioniq funksiyali, 3 rejim",
        price: 65,
        brand: "IonicAir",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.6, count: 100 },
        stats: { views: 650, likes: 180, purchases: 120 },
        audience: "unisex"
      },
      {
        id: "tool-3",
        name: "Face cleansing brush",
        description: "Elektron yuz tozalash cho'tkasi",
        price: 45,
        brand: "PureFace",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.5, count: 95 },
        stats: { views: 580, likes: 170, purchases: 110 },
        audience: "women"
      }
    ],
    bathspa: [
      {
        id: "bath-1",
        name: "Bath bomb set",
        description: "Lavanda, sitrus va vanil aromatlari",
        price: 22,
        brand: "Calm",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.6, count: 90 },
        stats: { views: 520, likes: 150, purchases: 100 },
        audience: "unisex"
      },
      {
        id: "bath-2",
        name: "Eucalyptus shower gel",
        description: "Tiniqlik beruvchi dush jeli",
        price: 16,
        brand: "FreshSpa",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.5, count: 80 },
        stats: { views: 470, likes: 130, purchases: 90 },
        audience: "unisex"
      },
      {
        id: "bath-3",
        name: "Body scrub sea salt",
        description: "Mineralli skrab, terini yangilaydi",
        price: 27,
        brand: "Ocean",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.6, count: 85 },
        stats: { views: 510, likes: 140, purchases: 95 },
        audience: "unisex"
      }
    ],
    suncare: [
      {
        id: "sun-1",
        name: "SPF 50 Mist",
        description: "Yengil purkagich, makiyaj ustiga mos",
        price: 33,
        brand: "SunMist",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.6, count: 90 },
        stats: { views: 480, likes: 150, purchases: 100 },
        audience: "unisex"
      },
      {
        id: "sun-2",
        name: "Mineral SPF 30",
        description: "Hissiz, keng spektrli, bolalar va kattalar uchun",
        price: 29,
        brand: "Mineral",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.5, count: 85 },
        stats: { views: 450, likes: 130, purchases: 90 },
        audience: "kids"
      },
      {
        id: "sun-3",
        name: "After-sun gel",
        description: "Aloe vera asosida tinchlantiruvchi",
        price: 18,
        brand: "CoolAloe",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.5, count: 75 },
        stats: { views: 420, likes: 120, purchases: 80 },
        audience: "unisex"
      }
    ]
  }, "marketing");

  const electronicsProductsMock: Record<string, Product[]> = withProductImages({
    pc: [
      {
        id: "pc-1",
        name: "Gaming Laptop RTX",
        description: "RTX 4060, 16GB RAM, 1TB SSD",
        price: 1299,
        brand: "Aorus",
        thumbnail: "/images/remote/remote-0040.jpg",
        images: ["/images/remote/remote-0041.jpg"],
        rating: { avg: 4.8, count: 220 },
        stats: { views: 2200, likes: 640, purchases: 410 }
      },
      {
        id: "pc-2",
        name: "Ultrabook Pro",
        description: "13\" ultrabook, 16GB RAM, 512GB SSD",
        price: 1099,
        brand: "Zen",
        thumbnail: "/images/remote/remote-0042.jpg",
        images: ["/images/remote/remote-0043.jpg"],
        rating: { avg: 4.7, count: 190 },
        stats: { views: 1800, likes: 520, purchases: 360 }
      },
      {
        id: "pc-3",
        name: "Desktop Creator",
        description: "Ryzen 7, 32GB RAM, RTX 4070",
        price: 1499,
        brand: "Creator",
        thumbnail: "/images/remote/remote-0042.jpg",
        images: ["/images/remote/remote-0043.jpg"],
        rating: { avg: 4.9, count: 150 },
        stats: { views: 2100, likes: 590, purchases: 320 }
      }
    ],
    mobile: [
      {
        id: "mobile-1",
        name: "Flagship X",
        description: "AMOLED 120Hz, 256GB, 50MP",
        price: 899,
        brand: "Fenix",
        thumbnail: "/images/remote/remote-0044.jpg",
        images: ["/images/remote/remote-0045.jpg"],
        rating: { avg: 4.8, count: 310 },
        stats: { views: 2800, likes: 840, purchases: 470 }
      },
      {
        id: "mobile-2",
        name: "Compact 5G",
        description: "5G, 8GB RAM, 128GB",
        price: 599,
        brand: "Nano",
        thumbnail: "/images/remote/remote-0046.jpg",
        images: ["/images/remote/remote-0047.jpg"],
        rating: { avg: 4.5, count: 210 },
        stats: { views: 1900, likes: 520, purchases: 330 }
      },
      {
        id: "mobile-3",
        name: "Camera Phone Pro",
        description: "Periscope 10x, 256GB",
        price: 999,
        brand: "Optica",
        thumbnail: "/images/remote/remote-0048.jpg",
        images: ["/images/remote/remote-0049.jpg"],
        rating: { avg: 4.7, count: 260 },
        stats: { views: 2400, likes: 700, purchases: 380 }
      }
    ],
    tv: [
      {
        id: "tv-1",
        name: "OLED Vision 65\"",
        description: "4K OLED, Dolby Vision",
        price: 1899,
        brand: "Vista",
        thumbnail: "/images/remote/remote-0050.jpg",
        images: ["/images/remote/remote-0051.jpg"],
        rating: { avg: 4.9, count: 140 },
        stats: { views: 1600, likes: 520, purchases: 210 }
      },
      {
        id: "tv-2",
        name: "QLED Bright 55\"",
        description: "4K QLED, 120Hz",
        price: 1299,
        brand: "Bright",
        thumbnail: "/images/remote/remote-0052.jpg",
        images: ["/images/remote/remote-0053.jpg"],
        rating: { avg: 4.7, count: 160 },
        stats: { views: 1500, likes: 440, purchases: 190 }
      },
      {
        id: "tv-3",
        name: "Smart LED 43\"",
        description: "Full HD, smart TV",
        price: 499,
        brand: "Lite",
        thumbnail: "/images/remote/remote-0054.jpg",
        images: ["/images/remote/remote-0055.jpg"],
        rating: { avg: 4.4, count: 190 },
        stats: { views: 1300, likes: 360, purchases: 220 }
      }
    ],
    game: [
      {
        id: "game-1",
        name: "Next-gen Console",
        description: "1TB SSD, 4K gaming",
        price: 599,
        brand: "PlayOne",
        thumbnail: "/images/remote/remote-0056.jpg",
        images: ["/images/remote/remote-0057.jpg"],
        rating: { avg: 4.9, count: 310 },
        stats: { views: 2600, likes: 900, purchases: 520 }
      },
      {
        id: "game-2",
        name: "VR Headset",
        description: "6DOF tracking, high-res display",
        price: 399,
        brand: "Immersive",
        thumbnail: "/images/remote/remote-0058.jpg",
        images: ["/images/remote/remote-0059.jpg"],
        rating: { avg: 4.6, count: 170 },
        stats: { views: 1500, likes: 520, purchases: 260 }
      },
      {
        id: "game-3",
        name: "Pro Controller",
        description: "Customizable buttons, Hall sensors",
        price: 149,
        brand: "ProX",
        thumbnail: "/images/remote/remote-0060.jpg",
        images: ["/images/remote/remote-0061.jpg"],
        rating: { avg: 4.5, count: 130 },
        stats: { views: 900, likes: 280, purchases: 180 }
      }
    ],
    cameras: [
      {
        id: "cam-1",
        name: "Mirrorless Pro",
        description: "Full-frame, 24MP, 4K video",
        price: 1799,
        brand: "Lumina",
        thumbnail: "/images/remote/remote-0062.jpg",
        images: ["/images/remote/remote-0063.jpg"],
        rating: { avg: 4.8, count: 210 },
        stats: { views: 1700, likes: 520, purchases: 240 }
      },
      {
        id: "cam-2",
        name: "Action Cam 5K",
        description: "5K60, stabilization",
        price: 499,
        brand: "GoWave",
        thumbnail: "/images/remote/remote-0064.jpg",
        images: ["/images/remote/remote-0065.jpg"],
        rating: { avg: 4.6, count: 160 },
        stats: { views: 1200, likes: 340, purchases: 190 }
      },
      {
        id: "cam-3",
        name: "Compact Vlog Cam",
        description: "Flip screen, fast AF",
        price: 799,
        brand: "VlogX",
        thumbnail: "/images/remote/remote-0066.jpg",
        images: ["/images/remote/remote-0067.jpg"],
        rating: { avg: 4.7, count: 140 },
        stats: { views: 1300, likes: 380, purchases: 200 }
      }
    ],
    others: [
      {
        id: "oth-1",
        name: "Wireless earbuds",
        description: "ANC, 24h battery",
        price: 159,
        brand: "ZenSound",
        thumbnail: "/images/remote/remote-0068.jpg",
        images: ["/images/remote/remote-0069.jpg"],
        rating: { avg: 4.6, count: 240 },
        stats: { views: 1400, likes: 420, purchases: 260 }
      },
      {
        id: "oth-2",
        name: "Smartwatch",
        description: "AMOLED, GPS, ECG",
        price: 249,
        brand: "Pulse",
        thumbnail: "/images/remote/remote-0070.jpg",
        images: ["/images/remote/remote-0071.jpg"],
        rating: { avg: 4.5, count: 210 },
        stats: { views: 1300, likes: 380, purchases: 220 }
      },
      {
        id: "oth-3",
        name: "Bluetooth speaker",
        description: "Waterproof, 12h playtime",
        price: 129,
        brand: "Boom",
        thumbnail: "/images/remote/remote-0068.jpg",
        images: ["/images/remote/remote-0069.jpg"],
        rating: { avg: 4.6, count: 180 },
        stats: { views: 1100, likes: 320, purchases: 190 }
      }
    ]
  }, "technical", { "mobile-1": 8 });

  const autoProductsMock: Record<string, Product[]> = withProductImages({
    cars: [
      {
        id: "car-1",
        name: "Hyundai Sonata 2019",
        description: "2.0, avtomat, 85 000 km, servisda ko‘rilgan",
        price: 17500,
        brand: "Hyundai",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0072.jpg",
        images: ["/images/remote/remote-0073.jpg"],
        rating: { avg: 4.7, count: 90 },
        stats: { views: 2200, likes: 520, purchases: 140 },
        condition: "used"
      },
      {
        id: "car-2",
        name: "Kia K5 2022",
        description: "1.6T, 18 000 km, ADAS paketi",
        price: 24500,
        brand: "Kia",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0074.jpg",
        images: ["/images/remote/remote-0075.jpg"],
        rating: { avg: 4.8, count: 110 },
        stats: { views: 2500, likes: 610, purchases: 160 },
        condition: "used"
      },
      {
        id: "car-3",
        name: "Chevrolet Malibu 2020",
        description: "2.0 turbo, 60 000 km, qora salon",
        price: 19800,
        brand: "Chevrolet",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0076.jpg",
        images: ["/images/remote/remote-0077.jpg"],
        rating: { avg: 4.6, count: 95 },
        stats: { views: 2100, likes: 480, purchases: 130 },
        condition: "used"
      }
    ],
    "car-parts": [
      {
        id: "carpart-1",
        name: "Brake pads set (Sonata/K5)",
        description: "Old va orqa, original sifatdagi analog",
        price: 120,
        brand: "Hankook Parts",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0078.jpg",
        images: ["/images/remote/remote-0079.jpg"],
        rating: { avg: 4.7, count: 75 },
        stats: { views: 740, likes: 210, purchases: 150 },
        condition: "new"
      },
      {
        id: "carpart-2",
        name: "LED headlight (Malibu)",
        description: "Ong/chap to‘plam, moslama va lampalar bilan",
        price: 320,
        brand: "Vision",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0080.jpg",
        images: ["/images/remote/remote-0081.jpg"],
        rating: { avg: 4.6, count: 68 },
        stats: { views: 660, likes: 190, purchases: 120 },
        condition: "new"
      },
      {
        id: "carpart-3",
        name: "All-season tires 215/55 R17",
        description: "4 dona, balansi tekshirilgan",
        price: 420,
        brand: "Nexen",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0082.jpg",
        images: ["/images/remote/remote-0083.jpg"],
        rating: { avg: 4.7, count: 82 },
        stats: { views: 780, likes: 210, purchases: 130 },
        condition: "new"
      }
    ],
    tech: [
      {
        id: "tech-1",
        name: "Generator 5kW inverter",
        description: "Uy/garaj uchun, past shovqinli",
        price: 980,
        brand: "GenX",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.5, count: 70 },
        stats: { views: 620, likes: 180, purchases: 110 },
        condition: "new"
      },
      {
        id: "tech-2",
        name: "Industrial pressure washer",
        description: "180 bar, 2500W, metall pompali",
        price: 650,
        brand: "Pressa",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.6, count: 64 },
        stats: { views: 570, likes: 170, purchases: 100 },
        condition: "new"
      },
      {
        id: "tech-3",
        name: "Mini loader (used)",
        description: "Bobcat S70, 2018, 1800 soat",
        price: 15500,
        brand: "Bobcat",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.4, count: 40 },
        stats: { views: 820, likes: 200, purchases: 70 },
        condition: "used"
      }
    ],
    "tech-parts": [
      {
        id: "techpart-1",
        name: "Compressor pump kit",
        description: "Qurilish kompressorlari uchun 3 kVt, 8 bar",
        price: 240,
        brand: "AirPro",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.5, count: 55 },
        stats: { views: 480, likes: 140, purchases: 95 },
        condition: "new"
      },
      {
        id: "techpart-2",
        name: "Pressure washer lance set",
        description: "Moslashuvchan shlang + nozullar, 180 bar gacha",
        price: 120,
        brand: "WashKit",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.4, count: 48 },
        stats: { views: 430, likes: 120, purchases: 80 },
        condition: "new"
      },
      {
        id: "techpart-3",
        name: "Generator carburetor kit",
        description: "4-6 kVt benzin generatorlar uchun",
        price: 85,
        brand: "GenKit",
        category: "avto-texnika",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.5, count: 44 },
        stats: { views: 400, likes: 110, purchases: 70 },
        condition: "new"
      }
    ]
  }, "taxi");

  const homeProductsMock: Record<string, Product[]> = withProductImages({
    vacuum: [
      {
        id: "vac-1",
        name: "Dyson V11 Absolute",
        description: "Simssiz, kuchli siklon tizimi",
        price: 650,
        brand: "Dyson",
        thumbnail: "/images/remote/remote-0086.jpg",
        images: ["/images/remote/remote-0087.jpg"],
        rating: { avg: 4.8, count: 210 },
        stats: { views: 1300, likes: 380, purchases: 220 },
        condition: "new"
      },
      {
        id: "vac-2",
        name: "Samsung Jet 90",
        description: "Ko'p-bosqichli filtr va kuchli tortish",
        price: 520,
        brand: "Samsung",
        thumbnail: "/images/remote/remote-0086.jpg",
        images: ["/images/remote/remote-0087.jpg"],
        rating: { avg: 4.6, count: 170 },
        stats: { views: 980, likes: 290, purchases: 180 },
        condition: "new"
      },
      {
        id: "vac-3",
        name: "Robot vacuum S7",
        description: "Lidar navigatsiya, mop funksiyasi",
        price: 480,
        brand: "Roborock",
        thumbnail: "/images/remote/remote-0086.jpg",
        images: ["/images/remote/remote-0087.jpg"],
        rating: { avg: 4.7, count: 150 },
        stats: { views: 920, likes: 270, purchases: 170 },
        condition: "new"
      }
    ],
    washer: [
      {
        id: "wash-1",
        name: "LG WashTower",
        description: "Yig'ma kir yuvish va quritish, AI DD",
        price: 1200,
        brand: "LG",
        thumbnail: "/images/remote/remote-0088.jpg",
        images: ["/images/remote/remote-0089.jpg"],
        rating: { avg: 4.8, count: 130 },
        stats: { views: 880, likes: 250, purchases: 140 },
        condition: "new"
      },
      {
        id: "wash-2",
        name: "Samsung EcoBubble 9kg",
        description: "Pufakchali yuvish, energiya tejamkor",
        price: 780,
        brand: "Samsung",
        thumbnail: "/images/remote/remote-0088.jpg",
        images: ["/images/remote/remote-0089.jpg"],
        rating: { avg: 4.7, count: 120 },
        stats: { views: 760, likes: 220, purchases: 130 },
        condition: "new"
      },
      {
        id: "wash-3",
        name: "Bosch Series 6",
        description: "5 yil ishlatilgan, toza holatda",
        price: 420,
        brand: "Bosch",
        thumbnail: "/images/remote/remote-0088.jpg",
        images: ["/images/remote/remote-0089.jpg"],
        rating: { avg: 4.5, count: 90 },
        stats: { views: 640, likes: 180, purchases: 110 },
        condition: "used"
      }
    ],
    kitchen: [
      {
        id: "kitchen-1",
        name: "KitchenAid Stand Mixer",
        description: "5 qt, ko'p nasadkali, premium",
        price: 480,
        brand: "KitchenAid",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.8, count: 140 },
        stats: { views: 900, likes: 260, purchases: 150 },
        condition: "new"
      },
      {
        id: "kitchen-2",
        name: "Philips Air Fryer XXL",
        description: "Sog'lom pishirish, 1.4 kg sig'im",
        price: 260,
        brand: "Philips",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.7, count: 110 },
        stats: { views: 780, likes: 230, purchases: 130 },
        condition: "new"
      },
      {
        id: "kitchen-3",
        name: "Delonghi Coffee Maker",
        description: "Espresso va cappuccino, 15 bar",
        price: 320,
        brand: "Delonghi",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.6, count: 100 },
        stats: { views: 720, likes: 200, purchases: 120 },
        condition: "used"
      }
    ],
    fridge: [
      {
        id: "fridge-1",
        name: "LG InstaView 550L",
        description: "No frost, shisha panel, yangi",
        price: 1400,
        brand: "LG",
        thumbnail: "/images/remote/remote-0090.jpg",
        images: ["/images/remote/remote-0091.jpg"],
        rating: { avg: 4.8, count: 120 },
        stats: { views: 860, likes: 250, purchases: 140 },
        condition: "new"
      },
      {
        id: "fridge-2",
        name: "Samsung Side-by-Side 650L",
        description: "Inverter, musaffo sovutish",
        price: 1250,
        brand: "Samsung",
        thumbnail: "/images/remote/remote-0090.jpg",
        images: ["/images/remote/remote-0091.jpg"],
        rating: { avg: 4.7, count: 110 },
        stats: { views: 810, likes: 230, purchases: 130 },
        condition: "new"
      },
      {
        id: "fridge-3",
        name: "Beko 320L",
        description: "3 yil ishlatilgan, toza holatda",
        price: 420,
        brand: "Beko",
        thumbnail: "/images/remote/remote-0090.jpg",
        images: ["/images/remote/remote-0091.jpg"],
        rating: { avg: 4.4, count: 80 },
        stats: { views: 620, likes: 170, purchases: 100 },
        condition: "used"
      }
    ],
    ac: [
      {
        id: "ac-1",
        name: "Daikin inverter 12k BTU",
        description: "Sovutish/isitish, A++",
        price: 850,
        brand: "Daikin",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.7, count: 90 },
        stats: { views: 730, likes: 210, purchases: 120 },
        condition: "new"
      },
      {
        id: "ac-2",
        name: "Gree U-Crown 18k BTU",
        description: "Inverter, Wi-Fi, 2021",
        price: 980,
        brand: "Gree",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.6, count: 80 },
        stats: { views: 680, likes: 190, purchases: 110 },
        condition: "used"
      },
      {
        id: "ac-3",
        name: "Portable AC 9000 BTU",
        description: "Ofis va kichik xonalar uchun",
        price: 350,
        brand: "Cooler",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.3, count: 70 },
        stats: { views: 520, likes: 140, purchases: 90 },
        condition: "used"
      }
    ],
    "air-purifier": [
      {
        id: "air-1",
        name: "Xiaomi Air Purifier 4 Pro",
        description: "HEPA H13 filtr, 60 m² gacha",
        price: 280,
        brand: "Xiaomi",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.6, count: 100 },
        stats: { views: 610, likes: 180, purchases: 120 },
        condition: "new"
      },
      {
        id: "air-2",
        name: "Philips Series 3000i",
        description: "True HEPA, smart sensor",
        price: 360,
        brand: "Philips",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.7, count: 95 },
        stats: { views: 580, likes: 170, purchases: 110 },
        condition: "new"
      },
      {
        id: "air-3",
        name: "Coway Mighty AP-1512HH",
        description: "Uch bosqichli filtr, 50 m²",
        price: 240,
        brand: "Coway",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.5, count: 85 },
        stats: { views: 520, likes: 150, purchases: 100 },
        condition: "used"
      }
    ],
    "others-home": [
      {
        id: "otherhome-1",
        name: "Steam iron",
        description: "Kerakli bug' darajasi, keramika tovon",
        price: 65,
        brand: "Tefal",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.4, count: 70 },
        stats: { views: 430, likes: 120, purchases: 85 },
        condition: "new"
      },
      {
        id: "otherhome-2",
        name: "Humidifier 5L",
        description: "Tungi chiroq, avtomatik o'chish",
        price: 55,
        brand: "Airly",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.5, count: 60 },
        stats: { views: 400, likes: 110, purchases: 80 },
        condition: "new"
      },
      {
        id: "otherhome-3",
        name: "Smart curtain motor",
        description: "Wi-Fi, ovozli boshqaruv",
        price: 130,
        brand: "SmartHome",
        thumbnail: "/images/remote/remote-0084.jpg",
        images: ["/images/remote/remote-0085.jpg"],
        rating: { avg: 4.4, count: 55 },
        stats: { views: 360, likes: 100, purchases: 70 },
        condition: "new"
      }
    ]
  }, "cleaning");

  const clothingProductsMock: Record<string, Product[]> = withProductImages({
    men: [
      {
        id: "men-1",
        name: "Classic blazer",
        description: "Slim fit, 100% jun, ko'k rang",
        price: 220,
        brand: "Tailor",
        thumbnail: "/images/remote/remote-0092.jpg",
        images: ["/images/remote/remote-0093.jpg"],
        rating: { avg: 4.7, count: 90 },
        stats: { views: 620, likes: 180, purchases: 120 },
        size: "l",
        season: "allseason"
      },
      {
        id: "men-2",
        name: "Sport krossovka",
        description: "Yengil va nafas oluvchi, yugurish uchun",
        price: 140,
        brand: "Runner",
        thumbnail: "/images/remote/remote-0094.jpg",
        images: ["/images/remote/remote-0095.jpg"],
        rating: { avg: 4.6, count: 110 },
        stats: { views: 540, likes: 150, purchases: 100 },
        size: "m",
        season: "summer"
      },
      {
        id: "men-3",
        name: "Qishki kurtka",
        description: "Suv o'tkazmaydigan, kapyushonli",
        price: 180,
        brand: "Nord",
        thumbnail: "/images/remote/remote-0096.jpg",
        images: ["/images/remote/remote-0097.jpg"],
        rating: { avg: 4.7, count: 85 },
        stats: { views: 580, likes: 170, purchases: 110 },
        size: "l",
        season: "winter"
      }
    ],
    women: [
      {
        id: "women-1",
        name: "Midi dress",
        description: "Yozgi, paxta mato, gul naqsh",
        price: 95,
        brand: "Flora",
        thumbnail: "/images/remote/remote-0098.jpg",
        images: ["/images/remote/remote-0099.jpg"],
        rating: { avg: 4.8, count: 140 },
        stats: { views: 720, likes: 210, purchases: 150 },
        size: "m",
        season: "summer"
      },
      {
        id: "women-2",
        name: "Office kostyum",
        description: "Blazer + shim, neytral kulrang",
        price: 210,
        brand: "Linea",
        thumbnail: "/images/remote/remote-0100.jpg",
        images: ["/images/remote/remote-0101.jpg"],
        rating: { avg: 4.7, count: 100 },
        stats: { views: 640, likes: 180, purchases: 120 },
        size: "m",
        season: "allseason"
      },
      {
        id: "women-3",
        name: "Trench coat",
        description: "Yengil, bahor-kuz uchun",
        price: 160,
        brand: "Urban",
        thumbnail: "/images/remote/remote-0100.jpg",
        images: ["/images/remote/remote-0101.jpg"],
        rating: { avg: 4.6, count: 95 },
        stats: { views: 610, likes: 170, purchases: 115 },
        size: "l",
        season: "allseason"
      }
    ],
    kids: [
      {
        id: "kids-cloth-1",
        name: "Bolalar sport kiyimi",
        description: "Paxta to'plam, 6-8 yosh",
        price: 45,
        brand: "KidSport",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.5, count: 80 },
        stats: { views: 420, likes: 130, purchases: 90 },
        size: "s",
        season: "allseason"
      },
      {
        id: "kids-cloth-2",
        name: "Qishki kombinezon",
        description: "Suv o'tkazmas, issiq astar, 3-5 yosh",
        price: 70,
        brand: "SnowKids",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.6, count: 65 },
        stats: { views: 380, likes: 110, purchases: 75 },
        size: "s",
        season: "winter"
      },
      {
        id: "kids-cloth-3",
        name: "Yozgi futbolka to‘plami",
        description: "3 dona, 100% paxta",
        price: 35,
        brand: "Sunny",
        thumbnail: "/images/remote/remote-0038.jpg",
        images: ["/images/remote/remote-0039.jpg"],
        rating: { avg: 4.4, count: 70 },
        stats: { views: 360, likes: 100, purchases: 70 },
        size: "s",
        season: "summer"
      }
    ],
    elderly: [
      {
        id: "elder-1",
        name: "Ortopedik poyabzal",
        description: "Yumshoq tagcharm, qo‘shimcha tayanch",
        price: 85,
        brand: "Orto",
        thumbnail: "/images/remote/remote-0094.jpg",
        images: ["/images/remote/remote-0095.jpg"],
        rating: { avg: 4.5, count: 60 },
        stats: { views: 320, likes: 90, purchases: 65 },
        size: "m",
        season: "allseason"
      },
      {
        id: "elder-2",
        name: "Issiq kardigan",
        description: "Jun aralash, pastelli rang",
        price: 95,
        brand: "Warm",
        thumbnail: "/images/remote/remote-0102.jpg",
        images: ["/images/remote/remote-0103.jpg"],
        rating: { avg: 4.6, count: 55 },
        stats: { views: 300, likes: 85, purchases: 60 },
        size: "l",
        season: "winter"
      },
      {
        id: "elder-3",
        name: "Quvvatlovchi paypoqlar",
        description: "Kompression, 2 juft",
        price: 28,
        brand: "Support",
        thumbnail: "/images/remote/remote-0102.jpg",
        images: ["/images/remote/remote-0103.jpg"],
        rating: { avg: 4.4, count: 50 },
        stats: { views: 260, likes: 70, purchases: 55 },
        size: "m",
        season: "allseason"
      }
    ],
    special: [
      {
        id: "spec-1",
        name: "Haj kiyimlari to‘plami",
        description: "Yupqa, nafas oluvchi mato",
        price: 75,
        brand: "Makkah",
        thumbnail: "/images/remote/remote-0102.jpg",
        images: ["/images/remote/remote-0103.jpg"],
        rating: { avg: 4.6, count: 58 },
        stats: { views: 310, likes: 90, purchases: 65 },
        size: "l",
        season: "summer"
      },
      {
        id: "spec-2",
        name: "Sport Performance set",
        description: "UV himoya, tez quriydigan material",
        price: 110,
        brand: "Active",
        thumbnail: "/images/remote/remote-0102.jpg",
        images: ["/images/remote/remote-0103.jpg"],
        rating: { avg: 4.7, count: 70 },
        stats: { views: 340, likes: 100, purchases: 70 },
        size: "m",
        season: "summer"
      },
      {
        id: "spec-3",
        name: "Tibbiy kiyim to‘plami",
        description: "Antibakterial mato, ko‘k rang",
        price: 95,
        brand: "MedPro",
        thumbnail: "/images/remote/remote-0102.jpg",
        images: ["/images/remote/remote-0103.jpg"],
        rating: { avg: 4.6, count: 62 },
        stats: { views: 320, likes: 95, purchases: 68 },
        size: "l",
        season: "allseason"
      }
    ]
  }, "sport");

  const showFoodStub = isFoodCategory && !!foodSubcategory;
  const showElectronicsStub = isElectronicsCategory;

  const filteredElectronics = useMemo(() => {
    if (!isElectronicsCategory) return [];
    const list = electronicsSubcategory
      ? electronicsProductsMock[electronicsSubcategory] || []
      : Object.values(electronicsProductsMock).flat();

    return list.filter((item) => {
      const brandMatch = electronicsFilters.brand
        ? item.brand?.toLowerCase().includes(electronicsFilters.brand.toLowerCase())
        : true;
      const priceMatch =
        (electronicsFilters.priceMin === undefined || (item.price ?? 0) >= electronicsFilters.priceMin) &&
        (electronicsFilters.priceMax === undefined || (item.price ?? 0) <= electronicsFilters.priceMax);
      const conditionMatch =
        electronicsFilters.condition === "any" ||
        (electronicsFilters.condition === "new" ? (item as any).condition !== "used" : (item as any).condition === "used");
      return brandMatch && priceMatch && conditionMatch;
    });
  }, [electronicsFilters.brand, electronicsFilters.condition, electronicsFilters.priceMax, electronicsFilters.priceMin, electronicsProductsMock, electronicsSubcategory, isElectronicsCategory]);

  const filteredFood = useMemo(() => {
    if (!isFoodCategory) return [];
    const list = foodSubcategory
      ? foodProductsMock[foodSubcategory] || []
      : Object.values(foodProductsMock).flat();

    const applyFilters = list.filter((item) => {
      const brandMatch = foodFilters.brand
        ? (item as any).brand?.toLowerCase?.().includes(foodFilters.brand.toLowerCase()) ?? false
        : true;
      const priceMatch =
        (foodFilters.priceMin === undefined || (item.price ?? 0) >= foodFilters.priceMin) &&
        (foodFilters.priceMax === undefined || (item.price ?? 0) <= foodFilters.priceMax);
      const conditionMatch =
        foodFilters.condition === "any" ||
        (foodFilters.condition === "fresh"
          ? (item as any).condition !== "frozen"
          : (item as any).condition === "frozen");
      return brandMatch && priceMatch && conditionMatch;
    });

    const score = (p: Product) => {
      const stats = p.stats || { purchases: p.orders ?? 0, likes: p.likes ?? 0, views: p.views ?? 0 };
      return {
        purchases: stats.purchases ?? stats.orders ?? 0,
        likes: stats.likes ?? 0,
        views: stats.views ?? 0
      };
    };

    return [...applyFilters].sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sb.purchases !== sa.purchases) return sb.purchases - sa.purchases;
      if (sb.likes !== sa.likes) return sb.likes - sa.likes;
      return sb.views - sa.views;
    });
  }, [
    foodFilters.brand,
    foodFilters.condition,
    foodFilters.priceMax,
    foodFilters.priceMin,
    foodProductsMock,
    foodSubcategory,
    isFoodCategory
  ]);

  const filteredBeauty = useMemo(() => {
    if (!isBeautyCategory) return [];
    const list = beautySubcategory
      ? beautyProductsMock[beautySubcategory] || []
      : Object.values(beautyProductsMock).flat();
    return list.filter((item) => {
      const brandMatch = beautyFilters.brand
        ? (item as any).brand?.toLowerCase?.().includes(beautyFilters.brand.toLowerCase()) ?? false
        : true;
      const priceMatch =
        (beautyFilters.priceMin === undefined || (item.price ?? 0) >= beautyFilters.priceMin) &&
        (beautyFilters.priceMax === undefined || (item.price ?? 0) <= beautyFilters.priceMax);
      const audienceMatch =
        beautyFilters.audience === "any" ||
        (item as any).audience === beautyFilters.audience ||
        ((item as any).audience === "unisex" && beautyFilters.audience !== "kids");
      return brandMatch && priceMatch && audienceMatch;
    });
  }, [beautyFilters.audience, beautyFilters.brand, beautyFilters.priceMax, beautyFilters.priceMin, beautyProductsMock, beautySubcategory, isBeautyCategory]);

  const filteredAuto = useMemo(() => {
    if (!isAutoCategory) return [];
    const list = autoSubcategory
      ? autoProductsMock[autoSubcategory] || []
      : Object.values(autoProductsMock).flat();
    return list.filter((item) => {
      const brandMatch = autoFilters.brand
        ? (item as any).brand?.toLowerCase?.().includes(autoFilters.brand.toLowerCase()) ?? false
        : true;
      const priceMatch =
        (autoFilters.priceMin === undefined || (item.price ?? 0) >= autoFilters.priceMin) &&
        (autoFilters.priceMax === undefined || (item.price ?? 0) <= autoFilters.priceMax);
      const conditionMatch =
        autoFilters.condition === "any" ||
        (autoFilters.condition === "new"
          ? (item as any).condition !== "used"
          : (item as any).condition === "used");
      return brandMatch && priceMatch && conditionMatch;
    });
  }, [autoFilters.brand, autoFilters.condition, autoFilters.priceMax, autoFilters.priceMin, autoProductsMock, autoSubcategory, isAutoCategory]);

  const filteredHome = useMemo(() => {
    if (!isHomeCategory) return [];
    const list = homeSubcategory
      ? homeProductsMock[homeSubcategory] || []
      : Object.values(homeProductsMock).flat();
    return list.filter((item) => {
      const brandMatch = homeFilters.brand
        ? (item as any).brand?.toLowerCase?.().includes(homeFilters.brand.toLowerCase()) ?? false
        : true;
      const priceMatch =
        (homeFilters.priceMin === undefined || (item.price ?? 0) >= homeFilters.priceMin) &&
        (homeFilters.priceMax === undefined || (item.price ?? 0) <= homeFilters.priceMax);
      const conditionMatch =
        homeFilters.condition === "any" ||
        (homeFilters.condition === "new"
          ? (item as any).condition !== "used"
          : (item as any).condition === "used");
      return brandMatch && priceMatch && conditionMatch;
    });
  }, [homeFilters.brand, homeFilters.condition, homeFilters.priceMax, homeFilters.priceMin, homeProductsMock, homeSubcategory, isHomeCategory]);

  const filteredClothing = useMemo(() => {
    if (!isClothingCategory) return [];
    const list =
      clothingSubcategory && clothingProductsMock[clothingSubcategory]
        ? clothingProductsMock[clothingSubcategory]
        : Object.values(clothingProductsMock).flat();

    return list.filter((item) => {
      const brandMatch = clothingFilters.brand
        ? (item as any).brand?.toLowerCase?.().includes(clothingFilters.brand.toLowerCase()) ?? false
        : true;
      const priceMatch =
        (clothingFilters.priceMin === undefined || (item.price ?? 0) >= clothingFilters.priceMin) &&
        (clothingFilters.priceMax === undefined || (item.price ?? 0) <= clothingFilters.priceMax);
      const sizeMatch =
        clothingFilters.size === "any" ||
        (item as any).size === clothingFilters.size;
      const seasonMatch =
        clothingFilters.season === "any" ||
        (clothingFilters.season === "allseason"
          ? (item as any).season === "allseason"
          : (item as any).season === clothingFilters.season || (item as any).season === "allseason");
      return brandMatch && priceMatch && sizeMatch && seasonMatch;
    });
  }, [
    clothingFilters.brand,
    clothingFilters.priceMax,
    clothingFilters.priceMin,
    clothingFilters.season,
    clothingFilters.size,
    clothingProductsMock,
    clothingSubcategory,
    isClothingCategory
  ]);

  const allMockProducts = useMemo(() => {
    const flatten = <T extends Product>(map: Record<string, T[]>) =>
      Object.values(map).reduce<T[]>((acc, arr) => acc.concat(arr), []);
    return [
      ...flatten(foodProductsMock),
      ...flatten(beautyProductsMock),
      ...flatten(electronicsProductsMock),
      ...flatten(autoProductsMock),
      ...flatten(homeProductsMock),
      ...flatten(clothingProductsMock)
    ];
  }, [autoProductsMock, beautyProductsMock, clothingProductsMock, electronicsProductsMock, foodProductsMock, homeProductsMock]);

  const defaultSorted = useMemo(() => {
    const combined = [...items, ...allMockProducts];
    const score = (p: Product) => {
      const stats = p.stats || { purchases: p.orders ?? 0, likes: p.likes ?? 0, views: p.views ?? 0 };
      const purchases = stats.purchases ?? stats.orders ?? 0;
      const likes = stats.likes ?? 0;
      const views = stats.views ?? 0;
      return { purchases, likes, views };
    };
    return [...combined].sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sb.purchases !== sa.purchases) return sb.purchases - sa.purchases;
      if (sb.likes !== sa.likes) return sb.likes - sa.likes;
      return sb.views - sa.views;
    });
  }, [allMockProducts, items]);

  const displayItems = isFoodCategory
    ? filteredFood
    : isBeautyCategory
      ? filteredBeauty
      : isAutoCategory
        ? filteredAuto
        : isHomeCategory
          ? filteredHome
          : isClothingCategory
            ? filteredClothing
            : showElectronicsStub
              ? filteredElectronics
              : defaultSorted;

  const uniqueDisplayItems = useMemo(() => {
    const seen = new Set<string>();
    return displayItems.filter((item, idx) => {
      const keyBase = (item._id ?? item.id ?? (item as any).slug ?? item.name ?? idx).toString().trim();
      const key = keyBase.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [displayItems]);

  const filteredDisplayItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const minPrice = quickFilters.priceMin ? Number(quickFilters.priceMin) : undefined;
    const maxPrice = quickFilters.priceMax ? Number(quickFilters.priceMax) : undefined;
    return uniqueDisplayItems.filter((item) => {
      const name = (item.name || item.title || "").toLowerCase();
      const brand = (item.brand || "").toLowerCase();
      const desc = (item.description || "").toLowerCase();
      const matchesQuery = query ? name.includes(query) || brand.includes(query) || desc.includes(query) : true;
      const price = item.price ?? 0;
      const priceMatch =
        (minPrice === undefined || price >= minPrice) && (maxPrice === undefined || price <= maxPrice);
      const brandMatch = quickFilters.brand
        ? brand.includes(quickFilters.brand.toLowerCase())
        : true;
      const ratingMatch = quickFilters.rating45 ? (item.rating?.avg ?? 0) >= 4.5 : true;
      const deliveryMeta = getDeliveryMeta(item);
      const deliveryMatch =
        quickFilters.delivery === "any"
          ? true
          : deliveryMeta.delivery === quickFilters.delivery;
      const stockMatch = quickFilters.inStock ? deliveryMeta.inStock : true;
      const condition = (item as any).condition || "new";
      const conditionMatch =
        quickFilters.condition === "any" ? true : condition === quickFilters.condition;
      const fastMatch = fastOnly ? deliveryMeta.delivery === "fast" : true;
      return matchesQuery && priceMatch && brandMatch && ratingMatch && deliveryMatch && stockMatch && conditionMatch && fastMatch;
    });
  }, [fastOnly, quickFilters, searchQuery, uniqueDisplayItems]);

  const sortedDisplayItems = useMemo(() => {
    const base = [...filteredDisplayItems];
    const score = (item: Product) => ({
      purchases: item.stats?.purchases ?? item.orders ?? 0,
      rating: item.rating?.avg ?? 0,
      price: item.price ?? 0,
      views: item.stats?.views ?? item.views ?? 0
    });
    return base.sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      switch (sortBy) {
        case "bestseller":
          return sb.purchases - sa.purchases;
        case "toprated":
          return sb.rating - sa.rating;
        case "priceLow":
          return sa.price - sb.price;
        case "priceHigh":
          return sb.price - sa.price;
        case "newest":
          return (new Date(b.createdAt ?? 0).getTime() || 0) - (new Date(a.createdAt ?? 0).getTime() || 0);
        default:
          if (sb.purchases !== sa.purchases) return sb.purchases - sa.purchases;
          if (sb.views !== sa.views) return sb.views - sa.views;
          return sb.rating - sa.rating;
      }
    });
  }, [filteredDisplayItems, sortBy]);

  const resolveProductKey = (product: Product, idx: number) => {
    const keyBase = (product._id ?? product.id ?? (product as any).slug ?? product.name ?? idx).toString().trim();
    return `${keyBase}-${idx}`;
  };

  const displayLoading = isFoodCategory
    ? false
    : isBeautyCategory
      ? false
      : isAutoCategory
        ? false
        : isHomeCategory
          ? false
          : isClothingCategory
            ? false
            : showElectronicsStub
        ? false
        : loading;

  const commonAllLabel = tp("common.all", "All");
  const searchLabel = tp("products.filters.search", "Search");
  const categoryFilterLabel = tp("products.filters.category", "Category");
  const priceFilterLabel = tp("products.filters.price", "Price");
  const brandFilterLabel = tp("products.filters.brand", "Brand");
  const rating45Label = tp("products.filters.rating45", "Rating 4.5+");
  const inStockLabel = tp("products.filters.inStock", "In stock");
  const conditionLabel = tp("products.filters.condition", "Condition");
  const deliveryLabel = tp("products.filters.delivery", "Delivery");
  const clearFiltersLabel = tp("products.filters.clear", "Clear filters");
  const minPriceLabel = tp("products.filters.priceMin", "Min price");
  const maxPriceLabel = tp("products.filters.priceMax", "Max price");
  const audienceLabel = tp("products.filters.audience", "Audience");
  const sizeLabel = tp("products.filters.size", "Size");
  const seasonLabel = tp("products.filters.season", "Season");
  const sortLabel = tp("products.filters.sort", "Sort");
  const mobileFiltersLabel = tp("products.filters.mobileTitle", "Filters");
  const closeLabel = tp("products.filters.close", "Close");
  const productsTitle = tp("products.page.title", "Products");
  const sortOptions: Array<{
    value: "relevance" | "bestseller" | "toprated" | "priceLow" | "priceHigh" | "newest";
    label: string;
  }> = [
    { value: "relevance", label: tp("common.bestMatch", "Best match") },
    { value: "bestseller", label: tp("products.filters.sort.bestseller", "Best seller") },
    { value: "toprated", label: tp("products.filters.sort.toprated", "Top rated") },
    { value: "priceLow", label: tp("products.filters.sort.priceLow", "Price: low to high") },
    { value: "priceHigh", label: tp("products.filters.sort.priceHigh", "Price: high to low") },
    { value: "newest", label: tp("products.filters.sort.newest", "Newest") }
  ];

  const visibleCount = sortedDisplayItems.length;
  const resultCountText = formatProductResultCount(visibleCount, language);

  const deliveryFilterLabel =
    quickFilters.delivery === "fast"
      ? getProductDeliveryLabel("fast", language)
      : quickFilters.delivery === "tomorrow"
        ? getProductDeliveryLabel("tomorrow", language)
        : quickFilters.delivery === "standard"
          ? getProductDeliveryLabel("standard", language)
          : "";

  const conditionFilterLabel =
    quickFilters.condition === "new"
      ? getProductConditionLabel("new", language)
      : quickFilters.condition === "used"
        ? getProductConditionLabel("used", language)
        : "";

  const activeFilters = [
    activeCategory !== "all"
      ? {
          key: "category",
          label: `${categoryFilterLabel}: ${resolveLocalizedText(activeCategoryMeta.label, language)}`
        }
      : null,
    searchQuery.trim()
      ? {
          key: "search",
          label: `${searchLabel}: ${searchQuery.trim()}`
        }
      : null,
    fastOnly
      ? {
          key: "fast-only",
          label: tp("products.filters.fastOnly", "Fast delivery only")
        }
      : null,
    quickFilters.priceMin || quickFilters.priceMax
      ? {
          key: "price",
          label: `${priceFilterLabel}: ${quickFilters.priceMin || "0"} - ${quickFilters.priceMax || commonAllLabel}`
        }
      : null,
    quickFilters.brand
      ? {
          key: "brand",
          label: `${brandFilterLabel}: ${quickFilters.brand}`
        }
      : null,
    quickFilters.rating45
      ? {
          key: "rating",
          label: rating45Label
        }
      : null,
    quickFilters.inStock
      ? {
          key: "stock",
          label: inStockLabel
        }
      : null,
    deliveryFilterLabel
      ? {
          key: "delivery",
          label: deliveryFilterLabel
        }
      : null,
    conditionFilterLabel
      ? {
          key: "condition",
          label: `${conditionLabel}: ${conditionFilterLabel}`
        }
      : null
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));

  const headerBgOverride = useMemo(() => {
    switch (activeCategory) {
      case "electronics":
        return "linear-gradient(135deg, rgba(8,47,73,0.96), rgba(14,116,144,0.92) 52%, rgba(59,130,246,0.82))";
      case "food":
        return "linear-gradient(135deg, rgba(17,94,89,0.96), rgba(22,163,74,0.88) 50%, rgba(163,230,53,0.7))";
      case "beauty":
        return "linear-gradient(135deg, rgba(131,24,67,0.95), rgba(225,29,72,0.84) 50%, rgba(251,113,133,0.72))";
      case "auto-tech":
        return "linear-gradient(135deg, rgba(30,41,59,0.96), rgba(71,85,105,0.9) 48%, rgba(245,158,11,0.72))";
      case "home-appliances":
        return "linear-gradient(135deg, rgba(88,28,135,0.95), rgba(147,51,234,0.82) 48%, rgba(236,72,153,0.72))";
      case "fashion":
        return "linear-gradient(135deg, rgba(76,5,25,0.96), rgba(190,24,93,0.84) 48%, rgba(251,146,60,0.72))";
      default:
        return "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.92) 48%, rgba(16,185,129,0.76))";
    }
  }, [activeCategory]);

  const surfaceBg = useMemo(() => {
    switch (activeCategory) {
      case "food":
        return "linear-gradient(180deg, #e8f7ec 0%, #f6fff9 100%)";
      case "electronics":
        return "linear-gradient(180deg, #e8f2ff 0%, #f6fbff 100%)";
      case "beauty":
        return "linear-gradient(180deg, #fde7f3 0%, #fff5fb 100%)";
      case "auto-tech":
        return "linear-gradient(180deg, #e8ecf3 0%, #f7f9fc 100%)";
      case "home-appliances":
        return "linear-gradient(180deg, #f4fbda 0%, #fcfff0 100%)";
      case "fashion":
        return "linear-gradient(180deg, #fff0f5 0%, #fff8fb 100%)";
      default:
        return "linear-gradient(180deg, #f9fafb 0%, #ffffff 100%)";
    }
  }, [activeCategory]);
  const topSearchTags = useMemo(() => getLocalizedProductSearchChips(language), [language]);
  const categoryQuick = useMemo(
    () => [
      { key: "electronics", icon: "💻", label: resolveLocalizedText(getShopCategoryMeta("electronics").label, language) },
      { key: "auto-tech", icon: "🚗", label: resolveLocalizedText(getShopCategoryMeta("auto-tech").label, language) },
      { key: "home-appliances", icon: "🏠", label: resolveLocalizedText(getShopCategoryMeta("home-appliances").label, language) },
      { key: "fashion", icon: "👟", label: resolveLocalizedText(getShopCategoryMeta("fashion").label, language) },
      { key: "beauty", icon: "✨", label: resolveLocalizedText(getShopCategoryMeta("beauty").label, language) },
      { key: "food", icon: "🥗", label: resolveLocalizedText(getShopCategoryMeta("food").label, language) }
    ],
    [language]
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6" style={{ backgroundImage: surfaceBg, borderRadius: "28px", padding: "16px" }}>
      <div className="sticky top-0 z-40 rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={tp("products.page.searchPlaceholder", "Search products")}
              placeholder={tp("products.page.searchPlaceholder", "Search products (adapter, SSD, iPhone case...)")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
              {tp("products.tags.securePayment", "Secure payment")}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {tp("products.tags.easyReturns", "Easy returns")}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {tp("products.tags.fastDelivery", "Fast delivery")}
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="text-slate-400">
            {tp("products.tags.topSearch", "Top search:")}
          </span>
          {topSearchTags.map((tag) => (
            <button
              key={tag.query}
              type="button"
              aria-label={tag.label}
              title={tag.label}
              onClick={() => setSearchQuery(tag.query)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1"
            >
              {tag.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFastOnly((prev) => !prev)}
            aria-pressed={fastOnly}
            aria-label={tp("products.filters.fastOnly", "Fast delivery only")}
            className={`rounded-full px-3 py-1 ${fastOnly ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {tp("products.tags.fastDelivery", "Fast delivery")}
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categoryQuick.map((cat) => (
            <button
              key={cat.label}
              type="button"
              aria-label={cat.label}
              title={cat.label}
              onClick={() => handleCategorySelect(cat.key)}
              className={`flex min-w-[140px] items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${
                filters.category === cat.key ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="font-semibold">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      <header
        className="rounded-[2rem] px-7 py-9 text-white shadow-lg"
        style={{
          backgroundImage: headerBgOverride,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <p className="text-sm uppercase tracking-[0.15em]">
          {tp("products.page.marketplaceEyebrow", "UniServe · Marketplace")}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold">
          {resolveLocalizedText(activeCategoryMeta.heroTitle, language)}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-100/90">
          {resolveLocalizedText(activeCategoryMeta.heroSubtitle, language)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-emerald-50/90">
          {activeCategoryMeta.filterTags.map((tag) => (
            <span key={resolveLocalizedText(tag, language)} className="rounded-full bg-white/15 px-3 py-1">
              {resolveLocalizedText(tag, language)}
            </span>
          ))}
        </div>
      </header>

      <div className="products-layout">
        <div className="sidebar-stack">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              {tp("products.filters.quickTitle", "Quick filters")}
            </p>
            <div className="mt-3 grid gap-3 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  aria-label={minPriceLabel}
                  placeholder={minPriceLabel}
                  value={quickFilters.priceMin}
                  onChange={(e) => setQuickFilters((prev) => ({ ...prev, priceMin: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2"
                />
                <input
                  type="number"
                  aria-label={maxPriceLabel}
                  placeholder={maxPriceLabel}
                  value={quickFilters.priceMax}
                  onChange={(e) => setQuickFilters((prev) => ({ ...prev, priceMax: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <input
                type="text"
                aria-label={brandFilterLabel}
                placeholder={brandFilterLabel}
                value={quickFilters.brand}
                onChange={(e) => setQuickFilters((prev) => ({ ...prev, brand: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={quickFilters.rating45}
                  onChange={(e) => setQuickFilters((prev) => ({ ...prev, rating45: e.target.checked }))}
                />
                {rating45Label}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={quickFilters.inStock}
                  onChange={(e) => setQuickFilters((prev) => ({ ...prev, inStock: e.target.checked }))}
                />
                {inStockLabel}
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={quickFilters.delivery}
                  onChange={(e) =>
                    setQuickFilters((prev) => ({
                      ...prev,
                      delivery: e.target.value as QuickFiltersState["delivery"]
                    }))
                  }
                  aria-label={deliveryLabel}
                  className="rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="any">{deliveryLabel}</option>
                  <option value="fast">{getProductDeliveryLabel("fast", language)}</option>
                  <option value="tomorrow">{getProductDeliveryLabel("tomorrow", language)}</option>
                  <option value="standard">{getProductDeliveryLabel("standard", language)}</option>
                </select>
                <select
                  value={quickFilters.condition}
                  onChange={(e) =>
                    setQuickFilters((prev) => ({
                      ...prev,
                      condition: e.target.value as QuickFiltersState["condition"]
                    }))
                  }
                  aria-label={conditionLabel}
                  className="rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="any">{conditionLabel}</option>
                  <option value="new">{getProductConditionLabel("new", language)}</option>
                  <option value="used">{getProductConditionLabel("used", language)}</option>
                </select>
              </div>
              <button
                type="button"
                onClick={resetQuickFilterState}
                className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600"
              >
                {clearFiltersLabel}
              </button>
            </div>
          </div>
          <CategoriesSidebar
            selected={activeCategory}
            onSelect={(slug) => {
              handleCategorySelect(slug);
              resetCategoryPanels();
            }}
          />

          {isFoodCategory && (
            <div className="food-subpanel">
              <p className="subpanel-title">{tp("products.sidebar.foodTitle", "Food section")}</p>
              <div className="subpanel-items">
                {foodSubcategories.map((sub) => {
                  const active = foodSubcategory === sub.key;
                  return (
                    <button
                      key={sub.key}
                      type="button"
                      className={`subcat-chip ${active ? "active" : ""}`}
                      onClick={() => setFoodSubcategory(sub.key)}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
              <div className="subpanel-filter">
                <div className="subpanel-row">
                  <label className="subpanel-label">{tp("products.filters.brandOrSupplier", "Brand or supplier")}</label>
                  <input
                    type="text"
                    aria-label={tp("products.filters.brandOrSupplier", "Brand or supplier")}
                    placeholder={tp("products.filters.placeholder.nestle", "Example: Nestle")}
                    value={foodFilters.brand}
                    onChange={(e) => setFoodFilters((f) => ({ ...f, brand: e.target.value }))}
                    className="subpanel-input"
                  />
                </div>
                <div className="subpanel-row two-cols">
                  <div>
                    <label className="subpanel-label">{minPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={foodFilters.priceMin ?? ""}
                      onChange={(e) =>
                        setFoodFilters((f) => ({
                          ...f,
                          priceMin: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                  <div>
                    <label className="subpanel-label">{maxPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="500"
                      value={foodFilters.priceMax ?? ""}
                      onChange={(e) =>
                        setFoodFilters((f) => ({
                          ...f,
                          priceMax: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                </div>
                <div className="subpanel-row">
                  <label className="subpanel-label">{conditionLabel}</label>
                  <select
                    value={foodFilters.condition}
                    onChange={(e) =>
                      setFoodFilters((f) => ({
                        ...f,
                        condition: e.target.value as "any" | "fresh" | "frozen"
                      }))
                    }
                    className="subpanel-input"
                  >
                    <option value="any">{commonAllLabel}</option>
                    <option value="fresh">{getProductConditionLabel("fresh", language)}</option>
                    <option value="frozen">{getProductConditionLabel("frozen", language)}</option>
                  </select>
                </div>
                <div className="subpanel-actions">
                  <button
                    type="button"
                    className="subcat-chip active"
                    onClick={() =>
                      setFoodFilters({
                        brand: "",
                        priceMin: undefined,
                        priceMax: undefined,
                        condition: "any"
                      })
                    }
                  >
                    {clearFiltersLabel}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isElectronicsCategory && (
            <div className="food-subpanel">
              <p className="subpanel-title">{tp("products.sidebar.electronicsTitle", "Electronics section")}</p>
              <div className="subpanel-items">
                {electronicsSubcategories.map((sub) => {
                  const active = electronicsSubcategory === sub.key;
                  return (
                    <button
                      key={sub.key}
                      type="button"
                      className={`subcat-chip ${active ? "active" : ""}`}
                      onClick={() => setElectronicsSubcategory(sub.key)}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>

              <div className="subpanel-filter">
                <div className="subpanel-row">
                  <label className="subpanel-label">{brandFilterLabel}</label>
                  <input
                    type="text"
                    aria-label={brandFilterLabel}
                    placeholder={tp("products.filters.placeholder.samsung", "Example: Samsung")}
                    value={electronicsFilters.brand}
                    onChange={(e) => setElectronicsFilters((f) => ({ ...f, brand: e.target.value }))}
                    className="subpanel-input"
                  />
                </div>
                <div className="subpanel-row two-cols">
                  <div>
                    <label className="subpanel-label">{minPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={electronicsFilters.priceMin ?? ""}
                      onChange={(e) =>
                        setElectronicsFilters((f) => ({
                          ...f,
                          priceMin: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                  <div>
                    <label className="subpanel-label">{maxPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="3000"
                      value={electronicsFilters.priceMax ?? ""}
                      onChange={(e) =>
                        setElectronicsFilters((f) => ({
                          ...f,
                          priceMax: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                </div>
                <div className="subpanel-row">
                  <label className="subpanel-label">{conditionLabel}</label>
                  <select
                    value={electronicsFilters.condition}
                    onChange={(e) =>
                      setElectronicsFilters((f) => ({
                        ...f,
                        condition: e.target.value as "any" | "new" | "used"
                      }))
                    }
                    className="subpanel-input"
                  >
                    <option value="any">{commonAllLabel}</option>
                    <option value="new">{getProductConditionLabel("new", language)}</option>
                    <option value="used">{getProductConditionLabel("used", language)}</option>
                  </select>
                </div>
                <div className="subpanel-actions">
                  <button
                    type="button"
                    className="subcat-chip active"
                    onClick={() =>
                      setElectronicsFilters({
                        brand: "",
                        priceMin: undefined,
                        priceMax: undefined,
                        condition: "any"
                      })
                    }
                  >
                    {clearFiltersLabel}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isBeautyCategory && (
            <div className="food-subpanel">
              <p className="subpanel-title">{tp("products.sidebar.beautyTitle", "Beauty section")}</p>
              <div className="subpanel-items">
                {beautySubcategories.map((sub) => {
                  const active = beautySubcategory === sub.key;
                  return (
                    <button
                      key={sub.key}
                      type="button"
                      className={`subcat-chip ${active ? "active" : ""}`}
                      onClick={() => setBeautySubcategory(sub.key)}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
              <div className="subpanel-filter">
                <div className="subpanel-row">
                  <label className="subpanel-label">{brandFilterLabel}</label>
                  <input
                    type="text"
                    aria-label={brandFilterLabel}
                    placeholder={tp("products.filters.placeholder.dior", "Example: Dior")}
                    value={beautyFilters.brand}
                    onChange={(e) => setBeautyFilters((f) => ({ ...f, brand: e.target.value }))}
                    className="subpanel-input"
                  />
                </div>
                <div className="subpanel-row two-cols">
                  <div>
                    <label className="subpanel-label">{minPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={beautyFilters.priceMin ?? ""}
                      onChange={(e) =>
                        setBeautyFilters((f) => ({
                          ...f,
                          priceMin: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                  <div>
                    <label className="subpanel-label">{maxPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="300"
                      value={beautyFilters.priceMax ?? ""}
                      onChange={(e) =>
                        setBeautyFilters((f) => ({
                          ...f,
                          priceMax: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                </div>
                <div className="subpanel-row">
                  <label className="subpanel-label">{audienceLabel}</label>
                  <select
                    value={beautyFilters.audience}
                    onChange={(e) =>
                      setBeautyFilters((f) => ({
                        ...f,
                        audience: e.target.value as "any" | "women" | "men" | "kids" | "unisex"
                      }))
                    }
                    className="subpanel-input"
                  >
                    <option value="any">{commonAllLabel}</option>
                    <option value="women">{getProductAudienceLabel("women", language)}</option>
                    <option value="men">{getProductAudienceLabel("men", language)}</option>
                    <option value="kids">{getProductAudienceLabel("kids", language)}</option>
                    <option value="unisex">{getProductAudienceLabel("unisex", language)}</option>
                  </select>
                </div>
                <div className="subpanel-actions">
                  <button
                    type="button"
                    className="subcat-chip active"
                    onClick={() =>
                      setBeautyFilters({
                        brand: "",
                        priceMin: undefined,
                        priceMax: undefined,
                        audience: "any"
                      })
                    }
                  >
                    {clearFiltersLabel}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isAutoCategory && (
            <div className="food-subpanel">
              <p className="subpanel-title">{tp("products.sidebar.autoTitle", "Auto & tech section")}</p>
              <div className="subpanel-items">
                {autoSubcategories.map((sub) => {
                  const active = autoSubcategory === sub.key;
                  return (
                    <button
                      key={sub.key}
                      type="button"
                      className={`subcat-chip ${active ? "active" : ""}`}
                      onClick={() => setAutoSubcategory(sub.key)}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
              <div className="subpanel-filter">
                <div className="subpanel-row">
                  <label className="subpanel-label">{tp("products.filters.brandOrModel", "Brand / model")}</label>
                  <input
                    type="text"
                    aria-label={tp("products.filters.brandOrModel", "Brand / model")}
                    placeholder={tp("products.filters.placeholder.hyundai", "Example: Hyundai")}
                    value={autoFilters.brand}
                    onChange={(e) => setAutoFilters((f) => ({ ...f, brand: e.target.value }))}
                    className="subpanel-input"
                  />
                </div>
                <div className="subpanel-row two-cols">
                  <div>
                    <label className="subpanel-label">{minPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={autoFilters.priceMin ?? ""}
                      onChange={(e) =>
                        setAutoFilters((f) => ({
                          ...f,
                          priceMin: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                  <div>
                    <label className="subpanel-label">{maxPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="50000"
                      value={autoFilters.priceMax ?? ""}
                      onChange={(e) =>
                        setAutoFilters((f) => ({
                          ...f,
                          priceMax: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                </div>
                <div className="subpanel-row">
                  <label className="subpanel-label">{conditionLabel}</label>
                  <select
                    value={autoFilters.condition}
                    onChange={(e) =>
                      setAutoFilters((f) => ({
                        ...f,
                        condition: e.target.value as "any" | "new" | "used"
                      }))
                    }
                    className="subpanel-input"
                  >
                    <option value="any">{commonAllLabel}</option>
                    <option value="new">{getProductConditionLabel("new", language)}</option>
                    <option value="used">{getProductConditionLabel("used", language)}</option>
                  </select>
                </div>
                <div className="subpanel-actions">
                  <button
                    type="button"
                    className="subcat-chip active"
                    onClick={() =>
                      setAutoFilters({
                        brand: "",
                        priceMin: undefined,
                        priceMax: undefined,
                        condition: "any"
                      })
                    }
                  >
                    {clearFiltersLabel}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isHomeCategory && (
            <div className="food-subpanel">
              <p className="subpanel-title">{tp("products.sidebar.homeTitle", "Home appliances section")}</p>
              <div className="subpanel-items">
                {homeSubcategories.map((sub) => {
                  const active = homeSubcategory === sub.key;
                  return (
                    <button
                      key={sub.key}
                      type="button"
                      className={`subcat-chip ${active ? "active" : ""}`}
                      onClick={() => setHomeSubcategory(sub.key)}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
              <div className="subpanel-filter">
                <div className="subpanel-row">
                  <label className="subpanel-label">{tp("products.filters.brandOrModel", "Brand / model")}</label>
                  <input
                    type="text"
                    aria-label={tp("products.filters.brandOrModel", "Brand / model")}
                    placeholder={tp("products.filters.placeholder.lg", "Example: LG")}
                    value={homeFilters.brand}
                    onChange={(e) => setHomeFilters((f) => ({ ...f, brand: e.target.value }))}
                    className="subpanel-input"
                  />
                </div>
                <div className="subpanel-row two-cols">
                  <div>
                    <label className="subpanel-label">{minPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={homeFilters.priceMin ?? ""}
                      onChange={(e) =>
                        setHomeFilters((f) => ({
                          ...f,
                          priceMin: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                  <div>
                    <label className="subpanel-label">{maxPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="2000"
                      value={homeFilters.priceMax ?? ""}
                      onChange={(e) =>
                        setHomeFilters((f) => ({
                          ...f,
                          priceMax: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                </div>
                <div className="subpanel-row">
                  <label className="subpanel-label">{conditionLabel}</label>
                  <select
                    value={homeFilters.condition}
                    onChange={(e) =>
                      setHomeFilters((f) => ({
                        ...f,
                        condition: e.target.value as "any" | "new" | "used"
                      }))
                    }
                    className="subpanel-input"
                  >
                    <option value="any">{commonAllLabel}</option>
                    <option value="new">{getProductConditionLabel("new", language)}</option>
                    <option value="used">{getProductConditionLabel("used", language)}</option>
                  </select>
                </div>
                <div className="subpanel-actions">
                  <button
                    type="button"
                    className="subcat-chip active"
                    onClick={() =>
                      setHomeFilters({
                        brand: "",
                        priceMin: undefined,
                        priceMax: undefined,
                        condition: "any"
                      })
                    }
                  >
                    {clearFiltersLabel}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isClothingCategory && (
            <div className="food-subpanel">
              <p className="subpanel-title">{tp("products.sidebar.fashionTitle", "Fashion section")}</p>
              <div className="subpanel-items">
                {clothingSubcategories.map((sub) => {
                  const active = clothingSubcategory === sub.key;
                  return (
                    <button
                      key={sub.key}
                      type="button"
                      className={`subcat-chip ${active ? "active" : ""}`}
                      onClick={() => setClothingSubcategory(sub.key)}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
              <div className="subpanel-filter">
                <div className="subpanel-row">
                  <label className="subpanel-label">{brandFilterLabel}</label>
                  <input
                    type="text"
                    aria-label={brandFilterLabel}
                    placeholder={tp("products.filters.placeholder.zara", "Example: Zara")}
                    value={clothingFilters.brand}
                    onChange={(e) => setClothingFilters((f) => ({ ...f, brand: e.target.value }))}
                    className="subpanel-input"
                  />
                </div>
                <div className="subpanel-row two-cols">
                  <div>
                    <label className="subpanel-label">{minPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={clothingFilters.priceMin ?? ""}
                      onChange={(e) =>
                        setClothingFilters((f) => ({
                          ...f,
                          priceMin: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                  <div>
                    <label className="subpanel-label">{maxPriceLabel}</label>
                    <input
                      type="number"
                      placeholder="500"
                      value={clothingFilters.priceMax ?? ""}
                      onChange={(e) =>
                        setClothingFilters((f) => ({
                          ...f,
                          priceMax: e.target.value ? Number(e.target.value) : undefined
                        }))
                      }
                      className="subpanel-input"
                    />
                  </div>
                </div>
                <div className="subpanel-row two-cols">
                  <div>
                    <label className="subpanel-label">{sizeLabel}</label>
                    <select
                      value={clothingFilters.size}
                      onChange={(e) =>
                        setClothingFilters((f) => ({
                          ...f,
                          size: e.target.value as "any" | "s" | "m" | "l" | "xl"
                        }))
                      }
                      className="subpanel-input"
                    >
                      <option value="any">{commonAllLabel}</option>
                      <option value="s">S</option>
                      <option value="m">M</option>
                      <option value="l">L</option>
                      <option value="xl">XL</option>
                    </select>
                  </div>
                  <div>
                    <label className="subpanel-label">{seasonLabel}</label>
                    <select
                      value={clothingFilters.season}
                      onChange={(e) =>
                        setClothingFilters((f) => ({
                          ...f,
                          season: e.target.value as "any" | "summer" | "winter" | "allseason"
                        }))
                      }
                      className="subpanel-input"
                    >
                      <option value="any">{commonAllLabel}</option>
                      <option value="summer">{getProductSeasonLabel("summer", language)}</option>
                      <option value="winter">{getProductSeasonLabel("winter", language)}</option>
                      <option value="allseason">{getProductSeasonLabel("allseason", language)}</option>
                    </select>
                  </div>
                </div>
                <div className="subpanel-actions">
                  <button
                    type="button"
                    className="subcat-chip active"
                    onClick={() =>
                      setClothingFilters({
                        brand: "",
                        priceMin: undefined,
                        priceMax: undefined,
                        size: "any",
                        season: "any"
                      })
                    }
                  >
                    {clearFiltersLabel}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="products-main space-y-4">
          <CatalogTopbar
            resultCount={visibleCount}
            resultLabel={
              activeCategory === "all"
                ? productsTitle
                : resolveLocalizedText(activeCategoryMeta.shortLabel, language)
            }
            resultCountText={resultCountText}
            sortValue={sortBy}
            sortOptions={sortOptions}
            onSortChange={(value) => setSortBy(value)}
            activeFilters={activeFilters}
            onClearFilters={activeFilters.length > 0 ? clearAllListingFilters : undefined}
            sortLabel={sortLabel}
            emptyFiltersLabel={tp(
              "products.filters.emptyState",
              "Refine this catalog with search, category, price, or delivery filters."
            )}
            clearFiltersLabel={clearFiltersLabel}
          />

          <ProductGrid
            className={displayLoading ? "relative" : ""}
            empty={
              !displayLoading && sortedDisplayItems.length === 0 ? (
                <div className="mt-4 rounded-[1.7rem] border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-lg font-black text-slate-400 shadow-sm">
                    0
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">
                    {tp("products.states.emptyTitle", "Nothing matched these filters")}
                  </h3>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    {tp(
                      "products.states.emptyDescription",
                      "Try widening the price range, changing the category, or clearing a few filters to see more products."
                    )}
                  </p>
                  {activeFilters.length > 0 ? (
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={clearAllListingFilters}
                        className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        {tp("products.filters.resetAll", "Reset all filters")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : undefined
            }
            footer={
              !displayLoading && sortedDisplayItems.length > 0 ? (
                <Pagination
                  page={pagination.page}
                  total={pagination.total ?? items.length}
                  limit={pagination.limit}
                  onPageChange={handlePageChange}
                  labels={{
                    previous: tp("products.pagination.previous", "Previous"),
                    next: tp("products.pagination.next", "Next"),
                    summary: ({ total, totalPages }) =>
                      formatProductPaginationSummary(total, totalPages, language)
                  }}
                />
              ) : undefined
            }
          >
            {displayLoading ? <span className="sr-only">{tp("products.states.loading", "Loading products")}</span> : null}
            {displayLoading
              ? Array.from({ length: 8 }, (_, idx) => <ProductCardSkeleton key={`product-skeleton-${idx}`} />)
              : sortedDisplayItems.map((p, idx) => <ProductCard key={resolveProductKey(p, idx)} data={p} />)}
          </ProductGrid>

          {!displayLoading && sortedDisplayItems.length > 0 && (
            <div className="rounded-[1.9rem] border border-slate-200/85 bg-white/92 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {tp("products.page.recentlyViewed", "Recently viewed")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {tp("products.page.recentlyViewedSubtitle", "Quick revisit")}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                  {tp("products.page.recentlyViewedHint", "Keep high-intent products visible")}
                </span>
              </div>
              <div className="mt-4 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {sortedDisplayItems.slice(0, 4).map((item, idx) => (
                  <ProductCard key={`recent-${resolveProductKey(item, idx)}`} data={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-4 left-4 right-4 z-40 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          aria-label={tp("products.filters.mobileOpen", "Open filters")}
          className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          {tp("products.filters.button", "Filter")}
        </button>
        <button
          type="button"
          onClick={() => setMobileSortOpen(true)}
          aria-label={tp("products.filters.mobileSortOpen", "Open sort options")}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
        >
          {sortLabel}
        </button>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 lg:hidden">
          <div className="w-full rounded-t-3xl bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {mobileFiltersLabel}
              </p>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
              >
                {closeLabel}
              </button>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  aria-label={minPriceLabel}
                  placeholder={minPriceLabel}
                  value={quickFilters.priceMin}
                  onChange={(e) => setQuickFilters((prev) => ({ ...prev, priceMin: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2"
                />
                <input
                  type="number"
                  aria-label={maxPriceLabel}
                  placeholder={maxPriceLabel}
                  value={quickFilters.priceMax}
                  onChange={(e) => setQuickFilters((prev) => ({ ...prev, priceMax: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <input
                type="text"
                aria-label={brandFilterLabel}
                placeholder={brandFilterLabel}
                value={quickFilters.brand}
                onChange={(e) => setQuickFilters((prev) => ({ ...prev, brand: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={quickFilters.rating45}
                  onChange={(e) => setQuickFilters((prev) => ({ ...prev, rating45: e.target.checked }))}
                />
                {rating45Label}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={quickFilters.inStock}
                  onChange={(e) => setQuickFilters((prev) => ({ ...prev, inStock: e.target.checked }))}
                />
                {inStockLabel}
              </label>
              <select
                value={quickFilters.delivery}
                onChange={(e) =>
                  setQuickFilters((prev) => ({
                    ...prev,
                    delivery: e.target.value as QuickFiltersState["delivery"]
                  }))
                }
                aria-label={deliveryLabel}
                className="rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="any">{deliveryLabel}</option>
                <option value="fast">{getProductDeliveryLabel("fast", language)}</option>
                <option value="tomorrow">{getProductDeliveryLabel("tomorrow", language)}</option>
                <option value="standard">{getProductDeliveryLabel("standard", language)}</option>
              </select>
              <select
                value={quickFilters.condition}
                onChange={(e) =>
                  setQuickFilters((prev) => ({
                    ...prev,
                    condition: e.target.value as QuickFiltersState["condition"]
                  }))
                }
                aria-label={conditionLabel}
                className="rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="any">{conditionLabel}</option>
                <option value="new">{getProductConditionLabel("new", language)}</option>
                <option value="used">{getProductConditionLabel("used", language)}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {mobileSortOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 lg:hidden">
          <div className="w-full rounded-t-3xl bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {sortLabel}
              </p>
              <button
                type="button"
                onClick={() => setMobileSortOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
              >
                {closeLabel}
              </button>
            </div>
            <div className="mt-3 grid gap-2 text-xs">
              {sortOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setSortBy(item.value);
                    setMobileSortOpen(false);
                  }}
                  className={`rounded-xl border px-3 py-2 text-left ${
                    sortBy === item.value ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
