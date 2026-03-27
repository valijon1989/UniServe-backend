import type { Product } from "@/api/products";
import {
  DEFAULT_LOCALE,
  resolveLocalizedText,
  tx,
  type LocalizedText,
  type SupportedLocale
} from "@/lib/localization";
import {
  getProductAudienceLabel,
  getProductConditionLabel,
  getProductSeasonLabel
} from "@/lib/productsPresentation";

export type ShopCategorySlug =
  | "all"
  | "electronics"
  | "fashion"
  | "food"
  | "auto-tech"
  | "home-appliances"
  | "beauty";

export interface ShopCategoryMeta {
  slug: ShopCategorySlug;
  label: LocalizedText;
  shortLabel: LocalizedText;
  icon: string;
  description: LocalizedText;
  heroTitle: LocalizedText;
  heroSubtitle: LocalizedText;
  filterTags: LocalizedText[];
  heroAccent: string;
  subcategories: Array<{ key: string; label: LocalizedText }>;
}

const sharedSubcategoryFallback: ShopCategoryMeta["subcategories"] = [];

export const SHOP_CATEGORY_TAXONOMY: ShopCategoryMeta[] = [
  {
    slug: "all",
    label: tx("All products", "Barcha mahsulotlar", "Все товары", "전체 상품"),
    shortLabel: tx("All", "Barchasi", "Все", "전체"),
    icon: "🛍️",
    description: tx(
      "One premium marketplace catalog for comparison, discovery, and checkout.",
      "Premium marketplace katalogi: mahsulot tanlash, solishtirish va checkout uchun yagona oqim.",
      "Единый премиальный каталог для поиска, сравнения и checkout.",
      "탐색, 비교, 체크아웃을 하나로 묶는 프리미엄 마켓플레이스 카탈로그."
    ),
    heroTitle: tx("Marketplace catalog", "Marketplace katalogi", "Каталог маркетплейса", "마켓플레이스 카탈로그"),
    heroSubtitle: tx(
      "Search, filters, and trust signals in one professional shopping experience.",
      "Qidiruv, filtr va ishonch signallarini bitta professional shopping tajribasiga yig'adi.",
      "Поиск, фильтры и сигналы доверия в одном профессиональном shopping-сценарии.",
      "검색, 필터, 신뢰 신호를 하나의 전문적인 쇼핑 경험으로 제공합니다."
    ),
    filterTags: [
      tx("Secure payments", "Xavfsiz to'lov", "Безопасная оплата", "안전 결제"),
      tx("Fast delivery", "Tez yetkazish", "Быстрая доставка", "빠른 배송"),
      tx("Verified sellers", "Tasdiqlangan sotuvchilar", "Проверенные продавцы", "검증된 판매자")
    ],
    heroAccent: "from-slate-950 via-slate-900 to-emerald-700",
    subcategories: sharedSubcategoryFallback
  },
  {
    slug: "electronics",
    label: tx("Electronics", "Elektronika", "Электроника", "전자제품"),
    shortLabel: tx("Electronics", "Elektronika", "Электроника", "전자"),
    icon: "💻",
    description: tx(
      "A catalog built for fast comparison by brand, RAM/storage, warranty, and condition.",
      "Brand, RAM/storage, kafolat va condition bo'yicha tez baholashga mo'ljallangan katalog.",
      "Каталог для быстрой оценки по бренду, RAM/storage, гарантии и состоянию.",
      "브랜드, RAM/저장공간, 보증, 상태를 빠르게 비교하는 카탈로그."
    ),
    heroTitle: tx("Electronics", "Elektronika", "Электроника", "전자제품"),
    heroSubtitle: tx(
      "Specs, warranty, and delivery are visible at a glance.",
      "Texnik xususiyat, kafolat va yetkazishni bir qarashda ko'rsatadigan conversion-focused sahifa.",
      "Характеристики, гарантия и доставка видны с первого взгляда.",
      "사양, 보증, 배송 정보를 한눈에 보여주는 전환 중심 레이아웃."
    ),
    filterTags: [
      tx("RAM / Storage", "RAM / Storage", "RAM / Память", "RAM / 저장공간"),
      tx("Warranty", "Kafolat", "Гарантия", "보증"),
      tx("Verified seller", "Tasdiqlangan seller", "Проверенный продавец", "검증된 판매자")
    ],
    heroAccent: "from-slate-950 via-sky-900 to-cyan-600",
    subcategories: [
      { key: "pc", label: tx("PC", "Kompyuter", "ПК", "PC") },
      { key: "mobile", label: tx("Mobile", "Telefon", "Телефоны", "모바일") },
      { key: "tv", label: tx("TV", "Televizor", "Телевизоры", "TV") },
      { key: "game", label: tx("Gaming", "O'yin uchun", "Игровое", "게이밍") },
      { key: "cameras", label: tx("Cameras", "Kameralar", "Камеры", "카메라") },
      { key: "others", label: tx("Other", "Boshqa", "Другое", "기타") }
    ]
  },
  {
    slug: "fashion",
    label: tx("Fashion", "Kiyim-kechak", "Одежда", "패션"),
    shortLabel: tx("Fashion", "Fashion", "Мода", "패션"),
    icon: "👟",
    description: tx(
      "Clean discovery by size, color, season, and audience.",
      "O'lcham, rang, mavsum va audience bo'yicha toza discovery tajribasi.",
      "Удобный подбор по размеру, цвету, сезону и аудитории.",
      "사이즈, 색상, 시즌, 대상별로 깔끔하게 탐색할 수 있습니다."
    ),
    heroTitle: tx("Fashion", "Kiyim-kechak", "Одежда", "패션"),
    heroSubtitle: tx(
      "A premium retail flow for look, fit, and season.",
      "Look, fit va mavsumiy filterlarni premium retail uslubida ko'rsatadi.",
      "Премиальная retail-структура для образа, посадки и сезона.",
      "룩, 핏, 시즌 필터를 프리미엄 리테일 스타일로 제공합니다."
    ),
    filterTags: [
      tx("Size", "O'lcham", "Размер", "사이즈"),
      tx("Season", "Mavsum", "Сезон", "시즌"),
      tx("Audience", "Audience", "Аудитория", "대상")
    ],
    heroAccent: "from-slate-950 via-rose-900 to-orange-500",
    subcategories: [
      { key: "men", label: tx("Men", "Erkaklar", "Мужское", "남성") },
      { key: "women", label: tx("Women", "Ayollar", "Женское", "여성") },
      { key: "kids", label: tx("Kids", "Bolalar", "Детское", "아동") },
      { key: "elderly", label: tx("Elderly", "Keksalar", "Для пожилых", "시니어") },
      { key: "special", label: tx("Special line", "Maxsus bo'lim", "Спецлинейка", "스페셜 라인") }
    ]
  },
  {
    slug: "food",
    label: tx("Food", "Oziq-ovqat", "Продукты", "식품"),
    shortLabel: tx("Food", "Food", "Еда", "푸드"),
    icon: "🥗",
    description: tx(
      "A grocery catalog centered on freshness, weight, packaging, and delivery speed.",
      "Freshness, weight, package va delivery speed signaliga tayangan grocery katalogi.",
      "Grocery-каталог с упором на свежесть, вес, упаковку и скорость доставки.",
      "신선도, 중량, 포장, 배송 속도 중심의 식품 카탈로그."
    ),
    heroTitle: tx("Food & grocery", "Oziq-ovqat", "Продукты и гастрономия", "식품 및 그로서리"),
    heroSubtitle: tx(
      "Freshness and delivery expectations are clear before checkout.",
      "Yangi mahsulot, tez yetkazish va paket turi bo'yicha xaridni tezlashtiradi.",
      "Свежесть и параметры доставки понятны до checkout.",
      "신선도와 배송 기대치를 결제 전부터 명확히 보여줍니다."
    ),
    filterTags: [
      tx("Freshness", "Freshness", "Свежесть", "신선도"),
      tx("Weight", "Weight", "Вес", "중량"),
      tx("Fast delivery", "Tez yetkazish", "Быстрая доставка", "빠른 배송")
    ],
    heroAccent: "from-slate-950 via-emerald-900 to-lime-500",
    subcategories: [
      { key: "tayyor", label: tx("Ready-made", "Tayyor mahsulotlar", "Готовая еда", "완제품") },
      { key: "yarim-tayyor", label: tx("Semi-prepared", "Yarim tayyor", "Полуфабрикаты", "반조리") },
      { key: "bolalar", label: tx("Kids", "Bolalar", "Детское", "어린이용") },
      { key: "goshtli", label: tx("Meat products", "Go'shtli mahsulotlar", "Мясные продукты", "육류 제품") },
      { key: "exclusive", label: tx("Exclusive", "Exclusive", "Эксклюзив", "프리미엄 셀렉션") }
    ]
  },
  {
    slug: "auto-tech",
    label: tx("Auto & tech", "Avto va texnika", "Авто и техника", "자동차 & 기술"),
    shortLabel: tx("Auto", "Auto", "Авто", "오토"),
    icon: "🚘",
    description: tx(
      "Reliable discovery by compatibility, condition, model, and region.",
      "Moslik, holat, model va region bo'yicha xaridor uchun ishonchli discovery.",
      "Надежный выбор по совместимости, состоянию, модели и региону.",
      "호환성, 상태, 모델, 지역 기준으로 신뢰성 있게 탐색합니다."
    ),
    heroTitle: tx("Auto & tools", "Avto va texnika", "Авто и техника", "자동차 및 기술"),
    heroSubtitle: tx(
      "Compatibility and condition stay visible throughout the listing flow.",
      "Compatibility, vehicle type va conditionni aniq ko'rsatadigan bozor sahifasi.",
      "Совместимость и состояние видны на всем пути выбора.",
      "호환성과 상태를 목록 전반에서 명확히 보여줍니다."
    ),
    filterTags: [
      tx("Compatibility", "Compatibility", "Совместимость", "호환성"),
      tx("Vehicle type", "Vehicle type", "Тип транспорта", "차량 유형"),
      tx("Condition", "Condition", "Состояние", "상태")
    ],
    heroAccent: "from-slate-950 via-amber-900 to-orange-600",
    subcategories: [
      { key: "cars", label: tx("Cars", "Avtomobillar", "Автомобили", "자동차") },
      { key: "car-parts", label: tx("Car parts", "Avto ehtiyot qismlar", "Автозапчасти", "자동차 부품") },
      { key: "tech", label: tx("Tech", "Texnika", "Техника", "기술 제품") },
      { key: "tech-parts", label: tx("Tech parts", "Texnika ehtiyot qismlar", "Запчасти для техники", "기술 부품") }
    ]
  },
  {
    slug: "home-appliances",
    label: tx("Home appliances", "Maishiy uskunalar", "Бытовая техника", "가전제품"),
    shortLabel: tx("Home", "Home", "Для дома", "홈"),
    icon: "🏠",
    description: tx(
      "Capacity, dimensions, power, and condition in one complete home catalog.",
      "Sig'im, o'lcham, quvvat va holat signalini to'liq ko'rsatadigan home catalog.",
      "Полный home-каталог с емкостью, размерами, мощностью и состоянием.",
      "용량, 크기, 출력, 상태를 한 번에 보여주는 홈 카탈로그."
    ),
    heroTitle: tx("Home appliances", "Maishiy uskunalar", "Бытовая техника", "가전제품"),
    heroSubtitle: tx(
      "Kitchen and air-care products with category-aware filters.",
      "Oshxona, kir yuvish va havo texnikasini category-aware filtrlar bilan ko'rsatadi.",
      "Кухонная, стиральная и климатическая техника с category-aware фильтрами.",
      "주방, 세탁, 공기 관리 제품을 카테고리 맞춤 필터와 함께 제공합니다."
    ),
    filterTags: [
      tx("Capacity", "Capacity", "Вместимость", "용량"),
      tx("Dimensions", "Dimensions", "Размеры", "크기"),
      tx("Power", "Power", "Мощность", "출력")
    ],
    heroAccent: "from-slate-950 via-violet-900 to-fuchsia-600",
    subcategories: [
      { key: "vacuum", label: tx("Vacuum cleaners", "Chang yutkich", "Пылесосы", "청소기") },
      { key: "washer", label: tx("Washing machines", "Kir yuvish mashinalari", "Стиральные машины", "세탁기") },
      { key: "kitchen", label: tx("Kitchen appliances", "Oshxona texnikalari", "Кухонная техника", "주방 가전") },
      { key: "fridge", label: tx("Fridges & freezers", "Sovutkich/Muzlatkichlar", "Холодильники и морозильники", "냉장/냉동") },
      { key: "ac", label: tx("Air conditioning", "Havo sovutgich", "Кондиционеры", "에어컨") },
      { key: "air-purifier", label: tx("Air purifiers", "Havo tozalagich", "Очистители воздуха", "공기청정기") },
      { key: "others-home", label: tx("Other", "Boshqa", "Другое", "기타") }
    ]
  },
  {
    slug: "beauty",
    label: tx("Beauty", "Go'zallik", "Красота", "뷰티"),
    shortLabel: tx("Beauty", "Beauty", "Бьюти", "뷰티"),
    icon: "✨",
    description: tx(
      "A beauty storefront built around formula, audience, and premium-brand signals.",
      "Material, audience va premium brand signaliga urg'u berilgan beauty landing.",
      "Beauty-витрина с акцентом на формулу, аудиторию и premium-бренды.",
      "포뮬러, 대상, 프리미엄 브랜드 신호에 집중한 뷰티 스토어프런트."
    ),
    heroTitle: tx("Beauty & care", "Go'zallik va parvarish", "Красота и уход", "뷰티 & 케어"),
    heroSubtitle: tx(
      "Shopping pages focused on routines, finishes, and brand trust.",
      "Mahsulot natijasi, audience va brend signalini premium discovery formatiga yig'adi.",
      "Страницы покупок с акцентом на уход, финиш и доверие к бренду.",
      "루틴, 마감감, 브랜드 신뢰를 중심으로 구성한 쇼핑 경험."
    ),
    filterTags: [
      tx("Audience", "Audience", "Аудитория", "대상"),
      tx("Premium brands", "Premium brands", "Премиум-бренды", "프리미엄 브랜드"),
      tx("Care routine", "Care routine", "Рутина ухода", "케어 루틴")
    ],
    heroAccent: "from-slate-950 via-pink-900 to-rose-500",
    subcategories: [
      { key: "fragrance", label: tx("Fragrance", "Atirlar", "Парфюмерия", "향수") },
      { key: "skincare", label: tx("Skincare", "Yuz kremlari", "Уход за кожей", "스킨케어") },
      { key: "haircare", label: tx("Hair care", "Soch uchun", "Уход за волосами", "헤어 케어") },
      { key: "makeup", label: tx("Makeup", "Bo'yanish vositalari", "Макияж", "메이크업") },
      { key: "bodycare", label: tx("Body care", "Tana parvarishi", "Уход за телом", "바디 케어") },
      { key: "nails", label: tx("Nails", "Manikyur/Pedikyur", "Маникюр / педикюр", "네일") },
      { key: "tools", label: tx("Tools & accessories", "Asboblar va aksessuarlar", "Инструменты и аксессуары", "도구 및 액세서리") },
      { key: "bathspa", label: tx("Bath & spa", "Vannalar va spa", "Ванна и spa", "배스 & 스파") },
      { key: "suncare", label: tx("Sun care", "Quyoshdan himoya", "Защита от солнца", "선케어") }
    ]
  }
];

const CATEGORY_ALIASES: Record<string, ShopCategorySlug> = {
  all: "all",
  "all-products": "all",
  "barcha-mahsulotlar": "all",
  "все-товары": "all",
  "전체-상품": "all",
  electronics: "electronics",
  elektronika: "electronics",
  электроника: "electronics",
  "전자제품": "electronics",
  fashion: "fashion",
  clothing: "fashion",
  "kiyim-kechak": "fashion",
  одежда: "fashion",
  패션: "fashion",
  food: "food",
  grocery: "food",
  "oziq-ovqat": "food",
  продукты: "food",
  식품: "food",
  beauty: "beauty",
  "gozallik": "beauty",
  "go'zallik": "beauty",
  красота: "beauty",
  뷰티: "beauty",
  auto: "auto-tech",
  "auto-tech": "auto-tech",
  "avto-va-texnika": "auto-tech",
  "avto-texnika": "auto-tech",
  "авто-и-техника": "auto-tech",
  "자동차-&-기술": "auto-tech",
  "home-appliances": "home-appliances",
  "maishiy-uskunalar": "home-appliances",
  "бытовая-техника": "home-appliances",
  "가전제품": "home-appliances",
  "home-appliances-catalog": "home-appliances"
};

const normalizeKey = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[']/g, "")
    .replace(/\s+/g, "-");

export const resolveShopCategorySlug = (value?: string | null): ShopCategorySlug =>
  CATEGORY_ALIASES[normalizeKey(value)] || "all";

export const getShopCategoryMeta = (value?: string | null) =>
  SHOP_CATEGORY_TAXONOMY.find((item) => item.slug === resolveShopCategorySlug(value)) || SHOP_CATEGORY_TAXONOMY[0];

export const getShopCategoryLabel = (value?: string | null, locale: SupportedLocale = DEFAULT_LOCALE) =>
  resolveLocalizedText(getShopCategoryMeta(value).label, locale);

const pickSpecification = (product: Product, keys: string[]) => {
  const record = product.specifications || {};
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  const match = Object.entries(record).find(([key]) => normalizedKeys.includes(key.toLowerCase()));
  return match?.[1];
};

export const buildProductSpecSnippet = (product: Product, locale: SupportedLocale = DEFAULT_LOCALE): string[] => {
  const meta = getShopCategoryMeta(product.category);
  const snippets: string[] = [];

  if (meta.slug === "electronics") {
    const brand = product.brand || pickSpecification(product, ["brand"]);
    const memory = pickSpecification(product, ["ram", "memory"]);
    const storage = pickSpecification(product, ["storage", "ssd", "rom"]);
    const warranty = pickSpecification(product, ["warranty", "guarantee"]);
    if (brand) snippets.push(brand);
    if (memory) snippets.push(`${resolveLocalizedText(tx("RAM", "RAM", "RAM", "RAM"), locale)} ${memory}`);
    if (storage) snippets.push(storage);
    if (warranty) snippets.push(`${resolveLocalizedText(tx("Warranty", "Kafolat", "Гарантия", "보증"), locale)} ${warranty}`);
    if (product.condition) snippets.push(getProductConditionLabel(product.condition, locale));
  } else if (meta.slug === "fashion") {
    if (product.size) snippets.push(`${resolveLocalizedText(tx("Size", "O'lcham", "Размер", "사이즈"), locale)} ${product.size.toUpperCase()}`);
    if (product.season) snippets.push(getProductSeasonLabel(product.season, locale));
    if (product.audience) snippets.push(getProductAudienceLabel(product.audience, locale));
    const material = pickSpecification(product, ["material", "fabric"]);
    if (material) snippets.push(material);
  } else if (meta.slug === "food") {
    const weight = pickSpecification(product, ["weight", "net weight", "vazn"]);
    const packageType = pickSpecification(product, ["package", "package type", "qadoq"]);
    if (product.brand) snippets.push(product.brand);
    if (weight) snippets.push(weight);
    if (packageType) snippets.push(packageType);
    snippets.push(resolveLocalizedText(tx("Fresh check", "Yangi tekshiruv", "Проверка свежести", "신선도 확인"), locale));
  } else if (meta.slug === "auto-tech") {
    const vehicleType = pickSpecification(product, ["vehicle type", "model", "compatible"]);
    const compatibility = pickSpecification(product, ["compatibility", "compatible"]);
    if (product.brand) snippets.push(product.brand);
    if (vehicleType) snippets.push(vehicleType);
    if (compatibility) snippets.push(compatibility);
    if (product.condition) snippets.push(getProductConditionLabel(product.condition, locale));
  } else if (meta.slug === "home-appliances") {
    const capacity = pickSpecification(product, ["capacity", "sig'im"]);
    const power = pickSpecification(product, ["power", "quvvat"]);
    const dimensions = pickSpecification(product, ["dimensions", "size"]);
    if (product.brand) snippets.push(product.brand);
    if (capacity) snippets.push(capacity);
    if (power) snippets.push(power);
    if (dimensions) snippets.push(dimensions);
    if (product.condition) snippets.push(getProductConditionLabel(product.condition, locale));
  } else if (meta.slug === "beauty") {
    if (product.brand) snippets.push(product.brand);
    if (product.audience) snippets.push(getProductAudienceLabel(product.audience, locale));
    const formula = pickSpecification(product, ["formula", "finish", "type"]);
    const size = pickSpecification(product, ["size", "volume", "ml"]);
    if (formula) snippets.push(formula);
    if (size) snippets.push(size);
  }

  if (snippets.length === 0) {
    if (product.brand) snippets.push(product.brand);
    if (product.condition) snippets.push(getProductConditionLabel(product.condition, locale));
    if (product.category) snippets.push(getShopCategoryLabel(product.category, locale));
  }

  return Array.from(new Set(snippets.filter(Boolean))).slice(0, 4);
};

export const buildSellerTrustSnippet = (product: Product, locale: SupportedLocale = DEFAULT_LOCALE) => {
  const rating = product.rating?.avg ?? product.vendor?.rating ?? 0;
  if (rating >= 4.8) return resolveLocalizedText(tx("Top-rated seller", "Yuqori baholangan seller", "Продавец с высоким рейтингом", "최고 평점 판매자"), locale);
  if (rating >= 4.5) return resolveLocalizedText(tx("Trusted seller", "Ishonchli seller", "Надежный продавец", "신뢰할 수 있는 판매자"), locale);
  return resolveLocalizedText(tx("Growing seller", "Rivojlanayotgan seller", "Развивающийся продавец", "성장 중인 판매자"), locale);
};
