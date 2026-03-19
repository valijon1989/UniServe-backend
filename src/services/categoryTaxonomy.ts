import type { AppLocale } from "../i18n";
import { buildFilterUiSchema, getUiIconSpec, listMarketplaceSortOptions } from "./marketplaceUiCatalog";

export type LocalizedName = Record<AppLocale, string>;

export type MainCategorySlug =
  | "products"
  | "services"
  | "courses"
  | "consulting"
  | "community"
  | "digital_services";

export interface MarketplaceSubcategory {
  slug: string;
  name: LocalizedName;
  route: string;
  filters?: string[];
  aliases?: string[];
}

export interface MarketplaceCategory {
  slug: MainCategorySlug;
  name: LocalizedName;
  route: string;
  icon?: string;
  aliases?: string[];
  subcategories: MarketplaceSubcategory[];
}

type SerializedSubcategory = MarketplaceSubcategory & {
  displayName: string;
};

type SerializedCategory = Omit<MarketplaceCategory, "subcategories"> & {
  displayName: string;
  subcategories: SerializedSubcategory[];
};

const normalizeSlug = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const toRouteSegment = (value: unknown) => normalizeSlug(value);

const routeFor = (root: MainCategorySlug, subcategory: string) =>
  `/${toRouteSegment(root)}/${toRouteSegment(subcategory)}`;

export const MARKETPLACE_TAXONOMY: MarketplaceCategory[] = [
  {
    slug: "products",
    route: "/products",
    icon: "ri-store-2-line",
    aliases: ["shop", "shopping", "product", "mall"],
    name: {
      uz: "Mahsulotlar",
      en: "Products",
      ru: "Товары",
      ko: "상품"
    },
    subcategories: [
      {
        slug: "electronics",
        route: routeFor("products", "electronics"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["elektronika", "electronic", "gadgets"],
        name: {
          uz: "Elektronika",
          en: "Electronics",
          ru: "Электроника",
          ko: "전자제품"
        }
      },
      {
        slug: "mobile_accessories",
        route: routeFor("products", "mobile-accessories"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["mobile", "phone-accessories", "mobile-accessory"],
        name: {
          uz: "Mobil aksessuarlar",
          en: "Mobile Accessories",
          ru: "Аксессуары для смартфонов",
          ko: "모바일 액세서리"
        }
      },
      {
        slug: "car_accessories",
        route: routeFor("products", "car-accessories"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["car", "auto-accessories", "avto-texnika", "avto-aksessuarlar"],
        name: {
          uz: "Avto aksessuarlar",
          en: "Car Accessories",
          ru: "Авто аксессуары",
          ko: "자동차 액세서리"
        }
      },
      {
        slug: "home_appliances",
        route: routeFor("products", "home-appliances"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["home", "appliances", "maishiy-uskunalar", "uy-texnikasi"],
        name: {
          uz: "Uy texnikasi",
          en: "Home Appliances",
          ru: "Бытовая техника",
          ko: "가전제품"
        }
      },
      {
        slug: "computers",
        route: routeFor("products", "computers"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["computer", "pc", "kompyuterlar"],
        name: {
          uz: "Kompyuterlar",
          en: "Computers",
          ru: "Компьютеры",
          ko: "컴퓨터"
        }
      },
      {
        slug: "tablets",
        route: routeFor("products", "tablets"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["tablet"],
        name: {
          uz: "Planshetlar",
          en: "Tablets",
          ru: "Планшеты",
          ko: "태블릿"
        }
      },
      {
        slug: "cameras",
        route: routeFor("products", "cameras"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["camera", "kamera", "cam"],
        name: {
          uz: "Kameralar",
          en: "Cameras",
          ru: "Камеры",
          ko: "카메라"
        }
      },
      {
        slug: "gaming",
        route: routeFor("products", "gaming"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["game", "games"],
        name: {
          uz: "Gaming",
          en: "Gaming",
          ru: "Гейминг",
          ko: "게이밍"
        }
      },
      {
        slug: "wearables",
        route: routeFor("products", "wearables"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["wearable", "smart-watch", "watch"],
        name: {
          uz: "Wearables",
          en: "Wearables",
          ru: "Носимые устройства",
          ko: "웨어러블"
        }
      },
      {
        slug: "smart_home",
        route: routeFor("products", "smart-home"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["smart-home", "smart-home-devices"],
        name: {
          uz: "Smart uy",
          en: "Smart Home",
          ru: "Умный дом",
          ko: "스마트 홈"
        }
      },
      {
        slug: "fashion",
        route: routeFor("products", "fashion"),
        filters: ["brand", "price", "rating", "condition", "delivery"],
        aliases: ["kiyim-kechak", "clothes", "apparel"],
        name: {
          uz: "Moda va kiyim",
          en: "Fashion",
          ru: "Одежда и мода",
          ko: "패션"
        }
      },
      {
        slug: "food_grocery",
        route: routeFor("products", "food-grocery"),
        filters: ["price", "rating", "delivery"],
        aliases: ["oziq-ovqat", "food", "grocery"],
        name: {
          uz: "Oziq-ovqat",
          en: "Food & Grocery",
          ru: "Продукты",
          ko: "식품"
        }
      },
      {
        slug: "beauty",
        route: routeFor("products", "beauty"),
        filters: ["brand", "price", "rating", "delivery"],
        aliases: ["gozallik", "beauty-care", "cosmetics"],
        name: {
          uz: "Gozallik",
          en: "Beauty",
          ru: "Красота",
          ko: "뷰티"
        }
      }
    ]
  },
  {
    slug: "services",
    route: "/services",
    icon: "ri-service-line",
    aliases: ["professional-services", "service"],
    name: {
      uz: "Professional xizmatlar",
      en: "Professional Services",
      ru: "Профессиональные услуги",
      ko: "전문 서비스"
    },
    subcategories: [
      {
        slug: "translation",
        route: routeFor("services", "translation"),
        filters: ["language", "delivery_time", "rating", "price", "verification"],
        aliases: ["translation-service", "tarjima"],
        name: {
          uz: "Tarjima xizmati",
          en: "Translation",
          ru: "Перевод",
          ko: "번역 서비스"
        }
      },
      {
        slug: "legal_services",
        route: routeFor("services", "legal"),
        filters: ["jurisdiction", "format", "language", "price", "verification"],
        aliases: ["legal", "law", "huquqiy-xizmatlar"],
        name: {
          uz: "Huquqiy xizmatlar",
          en: "Legal Services",
          ru: "Юридические услуги",
          ko: "법률 서비스"
        }
      },
      {
        slug: "psychology",
        route: routeFor("services", "psychology"),
        filters: ["format", "language", "rating", "price", "verification"],
        aliases: ["therapy", "therapist", "counseling"],
        name: {
          uz: "Psixologiya",
          en: "Psychology",
          ru: "Психология",
          ko: "심리 상담"
        }
      },
      {
        slug: "sport_coaching",
        route: routeFor("services", "sport"),
        filters: ["level", "format", "city", "rating", "price"],
        aliases: ["sports", "sport", "coach", "coaching"],
        name: {
          uz: "Sport murabbiyligi",
          en: "Sport Coaching",
          ru: "Спортивный тренер",
          ko: "스포츠 코칭"
        }
      },
      {
        slug: "tutoring",
        route: routeFor("services", "tutoring"),
        filters: ["subject", "format", "schedule", "price", "rating"],
        aliases: ["education", "teacher", "lesson"],
        name: {
          uz: "Repetitorlik",
          en: "Tutoring",
          ru: "Репетиторство",
          ko: "개인 교습"
        }
      },
      {
        slug: "design",
        route: routeFor("services", "design"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["designer"],
        name: {
          uz: "Dizayn",
          en: "Design",
          ru: "Дизайн",
          ko: "디자인"
        }
      },
      {
        slug: "marketing",
        route: routeFor("services", "marketing"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["marketer"],
        name: {
          uz: "Marketing",
          en: "Marketing",
          ru: "Маркетинг",
          ko: "마케팅"
        }
      },
      {
        slug: "it_services",
        route: routeFor("services", "it-services"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["it", "tech-support"],
        name: {
          uz: "IT xizmatlar",
          en: "IT Services",
          ru: "IT услуги",
          ko: "IT 서비스"
        }
      },
      {
        slug: "repair_services",
        route: routeFor("services", "repair"),
        filters: ["price", "rating", "location", "verification"],
        aliases: ["repair", "construction", "cleaning", "moving"],
        name: {
          uz: "Ta'mirlash xizmatlari",
          en: "Repair Services",
          ru: "Ремонтные услуги",
          ko: "수리 서비스"
        }
      },
      {
        slug: "delivery_services",
        route: routeFor("services", "delivery"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["delivery", "taxi", "logistics", "transport"],
        name: {
          uz: "Yetkazib berish xizmatlari",
          en: "Delivery Services",
          ru: "Службы доставки",
          ko: "배송 서비스"
        }
      }
    ]
  },
  {
    slug: "courses",
    route: "/courses",
    icon: "ri-book-open-line",
    aliases: ["education", "course", "courses"],
    name: {
      uz: "Ta'lim va kurslar",
      en: "Education & Courses",
      ru: "Образование и курсы",
      ko: "교육 및 강좌"
    },
    subcategories: [
      {
        slug: "language_courses",
        route: routeFor("courses", "language"),
        filters: ["level", "schedule", "format", "certificate", "price"],
        aliases: ["language", "til", "language-learning"],
        name: {
          uz: "Til kurslari",
          en: "Language Courses",
          ru: "Языковые курсы",
          ko: "언어 강좌"
        }
      },
      {
        slug: "job_skills",
        route: routeFor("courses", "job-skills"),
        filters: ["level", "schedule", "format", "certificate", "price"],
        aliases: ["skill", "kasb", "professional-skills"],
        name: {
          uz: "Ish ko'nikmalari",
          en: "Job Skills",
          ru: "Профессиональные навыки",
          ko: "직무 스킬"
        }
      },
      {
        slug: "business_courses",
        route: routeFor("courses", "business"),
        filters: ["level", "schedule", "format", "certificate", "price"],
        aliases: ["business"],
        name: {
          uz: "Biznes kurslari",
          en: "Business Courses",
          ru: "Бизнес-курсы",
          ko: "비즈니스 강좌"
        }
      },
      {
        slug: "technology_courses",
        route: routeFor("courses", "technology"),
        filters: ["level", "schedule", "format", "certificate", "price"],
        aliases: ["special", "technology", "it-programming", "informatics"],
        name: {
          uz: "Texnologiya kurslari",
          en: "Technology Courses",
          ru: "Технологические курсы",
          ko: "기술 강좌"
        }
      },
      {
        slug: "exam_preparation",
        route: routeFor("courses", "exam-preparation"),
        filters: ["level", "schedule", "format", "certificate", "price"],
        aliases: ["exam", "ielts", "topik"],
        name: {
          uz: "Imtihon tayyorlov",
          en: "Exam Preparation",
          ru: "Подготовка к экзаменам",
          ko: "시험 준비"
        }
      },
      {
        slug: "creative_courses",
        route: routeFor("courses", "creative"),
        filters: ["level", "schedule", "format", "certificate", "price"],
        aliases: ["creative", "design-course"],
        name: {
          uz: "Ijodiy kurslar",
          en: "Creative Courses",
          ru: "Творческие курсы",
          ko: "창의 강좌"
        }
      },
      {
        slug: "personal_development",
        route: routeFor("courses", "personal-development"),
        filters: ["level", "schedule", "format", "certificate", "price"],
        aliases: ["personal-growth"],
        name: {
          uz: "Shaxsiy rivojlanish",
          en: "Personal Development",
          ru: "Личное развитие",
          ko: "자기계발"
        }
      },
      {
        slug: "online_courses",
        route: routeFor("courses", "online"),
        filters: ["level", "schedule", "certificate", "price"],
        aliases: ["online"],
        name: {
          uz: "Online kurslar",
          en: "Online Courses",
          ru: "Онлайн-курсы",
          ko: "온라인 강좌"
        }
      },
      {
        slug: "offline_courses",
        route: routeFor("courses", "offline"),
        filters: ["level", "schedule", "certificate", "price"],
        aliases: ["offline"],
        name: {
          uz: "Offline kurslar",
          en: "Offline Courses",
          ru: "Офлайн-курсы",
          ko: "오프라인 강좌"
        }
      }
    ]
  },
  {
    slug: "consulting",
    route: "/consulting",
    icon: "ri-briefcase-4-line",
    aliases: ["advisory", "advisor"],
    name: {
      uz: "Konsalting va maslahat",
      en: "Consulting & Advisory",
      ru: "Консалтинг и консультации",
      ko: "컨설팅 및 자문"
    },
    subcategories: [
      {
        slug: "business_consulting",
        route: routeFor("consulting", "business"),
        filters: ["experience", "language", "format", "price", "rating"],
        aliases: ["business", "business-advisory"],
        name: {
          uz: "Biznes maslahat",
          en: "Business Consulting",
          ru: "Бизнес консультации",
          ko: "비즈니스 컨설팅"
        }
      },
      {
        slug: "startup_consulting",
        route: routeFor("consulting", "startup"),
        filters: ["experience", "language", "format", "price", "rating"],
        aliases: ["startup"],
        name: {
          uz: "Startap maslahat",
          en: "Startup Consulting",
          ru: "Консультации для стартапов",
          ko: "스타트업 컨설팅"
        }
      },
      {
        slug: "legal_consulting",
        route: routeFor("consulting", "legal"),
        filters: ["jurisdiction", "language", "format", "price", "rating"],
        aliases: ["legal", "law"],
        name: {
          uz: "Huquqiy maslahat",
          en: "Legal Consulting",
          ru: "Юридические консультации",
          ko: "법률 컨설팅"
        }
      },
      {
        slug: "financial_consulting",
        route: routeFor("consulting", "financial"),
        filters: ["experience", "language", "format", "price", "rating"],
        aliases: ["finance", "financial"],
        name: {
          uz: "Moliyaviy maslahat",
          en: "Financial Consulting",
          ru: "Финансовые консультации",
          ko: "재무 컨설팅"
        }
      },
      {
        slug: "career_consulting",
        route: routeFor("consulting", "career"),
        filters: ["experience", "language", "format", "price", "rating"],
        aliases: ["career"],
        name: {
          uz: "Karyera maslahat",
          en: "Career Consulting",
          ru: "Карьерные консультации",
          ko: "커리어 컨설팅"
        }
      },
      {
        slug: "immigration_consulting",
        route: routeFor("consulting", "immigration"),
        filters: ["country", "language", "format", "price", "rating"],
        aliases: ["immigration", "migration", "visa"],
        name: {
          uz: "Immigratsiya maslahat",
          en: "Immigration Consulting",
          ru: "Иммиграционные консультации",
          ko: "이민 컨설팅"
        }
      },
      {
        slug: "education_consulting",
        route: routeFor("consulting", "education"),
        filters: ["country", "language", "format", "price", "rating"],
        aliases: ["education"],
        name: {
          uz: "Ta'lim bo'yicha maslahat",
          en: "Education Consulting",
          ru: "Консультации по образованию",
          ko: "교육 컨설팅"
        }
      },
      {
        slug: "tax_consulting",
        route: routeFor("consulting", "tax"),
        filters: ["jurisdiction", "language", "format", "price", "rating"],
        aliases: ["tax", "taxation"],
        name: {
          uz: "Soliq maslahat",
          en: "Tax Consulting",
          ru: "Налоговые консультации",
          ko: "세무 컨설팅"
        }
      },
      {
        slug: "strategy_consulting",
        route: routeFor("consulting", "strategy"),
        filters: ["experience", "language", "format", "price", "rating"],
        aliases: ["strategy"],
        name: {
          uz: "Strategiya maslahat",
          en: "Strategy Consulting",
          ru: "Стратегические консультации",
          ko: "전략 컨설팅"
        }
      }
    ]
  },
  {
    slug: "community",
    route: "/community",
    icon: "ri-group-line",
    aliases: ["groups", "social"],
    name: {
      uz: "Hamjamiyat va guruhlar",
      en: "Community & Groups",
      ru: "Сообщество и группы",
      ko: "커뮤니티 및 그룹"
    },
    subcategories: [
      {
        slug: "interest_groups",
        route: routeFor("community", "interest-groups"),
        filters: ["region", "language", "privacy"],
        aliases: ["interest", "hobby"],
        name: {
          uz: "Qiziqish guruhlari",
          en: "Interest Groups",
          ru: "Группы по интересам",
          ko: "관심 그룹"
        }
      },
      {
        slug: "language_exchange",
        route: routeFor("community", "language-exchange"),
        filters: ["language", "region", "privacy"],
        aliases: ["language", "exchange", "translation"],
        name: {
          uz: "Til almashish",
          en: "Language Exchange",
          ru: "Языковой обмен",
          ko: "언어 교환"
        }
      },
      {
        slug: "professional_networks",
        route: routeFor("community", "professional-networks"),
        filters: ["industry", "region", "privacy"],
        aliases: ["network", "professional"],
        name: {
          uz: "Professional tarmoqlar",
          en: "Professional Networks",
          ru: "Профессиональные сообщества",
          ko: "전문 네트워크"
        }
      },
      {
        slug: "study_groups",
        route: routeFor("community", "study-groups"),
        filters: ["subject", "language", "privacy"],
        aliases: ["study", "education"],
        name: {
          uz: "O'quv guruhlari",
          en: "Study Groups",
          ru: "Учебные группы",
          ko: "스터디 그룹"
        }
      },
      {
        slug: "events",
        route: routeFor("community", "events"),
        filters: ["region", "date", "privacy"],
        aliases: ["event"],
        name: {
          uz: "Tadbirlar",
          en: "Events",
          ru: "События",
          ko: "이벤트"
        }
      },
      {
        slug: "announcements",
        route: routeFor("community", "announcements"),
        filters: ["region", "date", "privacy"],
        aliases: ["announcement", "notice"],
        name: {
          uz: "E'lonlar",
          en: "Announcements",
          ru: "Объявления",
          ko: "공지"
        }
      }
    ]
  },
  {
    slug: "digital_services",
    route: "/digital-services",
    icon: "ri-code-box-line",
    aliases: ["digital", "online-services"],
    name: {
      uz: "Raqamli xizmatlar",
      en: "Digital Services",
      ru: "Цифровые услуги",
      ko: "디지털 서비스"
    },
    subcategories: [
      {
        slug: "website_development",
        route: routeFor("digital_services", "website-development"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["website", "web", "web-development"],
        name: {
          uz: "Veb sayt yaratish",
          en: "Website Development",
          ru: "Разработка сайтов",
          ko: "웹사이트 개발"
        }
      },
      {
        slug: "mobile_app_development",
        route: routeFor("digital_services", "mobile-app-development"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["mobile-app", "app-development"],
        name: {
          uz: "Mobil ilova yaratish",
          en: "Mobile App Development",
          ru: "Разработка мобильных приложений",
          ko: "모바일 앱 개발"
        }
      },
      {
        slug: "seo_services",
        route: routeFor("digital_services", "seo-services"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["seo"],
        name: {
          uz: "SEO xizmatlari",
          en: "SEO Services",
          ru: "SEO услуги",
          ko: "SEO 서비스"
        }
      },
      {
        slug: "social_media_management",
        route: routeFor("digital_services", "social-media-management"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["smm", "social-media", "marketing"],
        name: {
          uz: "Ijtimoiy tarmoq boshqaruvi",
          en: "Social Media Management",
          ru: "Управление соцсетями",
          ko: "소셜 미디어 운영"
        }
      },
      {
        slug: "graphic_design",
        route: routeFor("digital_services", "graphic-design"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["graphic", "design"],
        name: {
          uz: "Grafik dizayn",
          en: "Graphic Design",
          ru: "Графический дизайн",
          ko: "그래픽 디자인"
        }
      },
      {
        slug: "video_editing",
        route: routeFor("digital_services", "video-editing"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["video", "editing"],
        name: {
          uz: "Video montaj",
          en: "Video Editing",
          ru: "Видеомонтаж",
          ko: "영상 편집"
        }
      },
      {
        slug: "content_writing",
        route: routeFor("digital_services", "content-writing"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["content", "copywriting", "writer"],
        name: {
          uz: "Kontent yozish",
          en: "Content Writing",
          ru: "Написание контента",
          ko: "콘텐츠 작성"
        }
      },
      {
        slug: "ui_ux_design",
        route: routeFor("digital_services", "ui-ux-design"),
        filters: ["price", "rating", "delivery_time", "verification"],
        aliases: ["ui", "ux", "ui-ux"],
        name: {
          uz: "UI/UX dizayn",
          en: "UI/UX Design",
          ru: "UI/UX дизайн",
          ko: "UI/UX 디자인"
        }
      }
    ]
  }
];

const MAIN_CATEGORY_INDEX = new Map(MARKETPLACE_TAXONOMY.map((category) => [category.slug, category] as const));
const MAIN_CATEGORY_LOOKUP = new Map<string, MarketplaceCategory>();
const SUBCATEGORY_INDEX = new Map<string, { main: MarketplaceCategory; subcategory: MarketplaceSubcategory }>();

for (const main of MARKETPLACE_TAXONOMY) {
  const mainCandidates = new Set<string>([
    main.slug,
    normalizeSlug(main.slug),
    ...Object.values(main.name).map(normalizeSlug),
    ...(main.aliases || []).map(normalizeSlug)
  ]);
  for (const candidate of mainCandidates) {
    if (!candidate) continue;
    MAIN_CATEGORY_LOOKUP.set(candidate, main);
  }

  for (const subcategory of main.subcategories) {
    const candidates = new Set<string>([
      subcategory.slug,
      normalizeSlug(subcategory.slug),
      ...Object.values(subcategory.name).map(normalizeSlug),
      ...(subcategory.aliases || []).map(normalizeSlug)
    ]);
    for (const candidate of candidates) {
      if (!candidate) continue;
      SUBCATEGORY_INDEX.set(candidate, { main, subcategory });
    }
  }
}

const getMainCategoryRecord = (slug: unknown): MarketplaceCategory | null => {
  const raw = String(slug || "").trim();
  const normalized = normalizeSlug(raw);
  return (
    MAIN_CATEGORY_INDEX.get(raw as MainCategorySlug) ||
    (normalized ? MAIN_CATEGORY_LOOKUP.get(normalized) || null : null)
  );
};

export const getLocalizedTaxonomyName = (name: LocalizedName, locale?: AppLocale) =>
  name[(locale || "uz") as AppLocale] || name.en || name.uz;

export const serializeMarketplaceCategory = (category: MarketplaceCategory, locale?: AppLocale): SerializedCategory => ({
  ...category,
  displayName: getLocalizedTaxonomyName(category.name, locale),
  subcategories: category.subcategories.map((subcategory) => ({
    ...subcategory,
    displayName: getLocalizedTaxonomyName(subcategory.name, locale)
  }))
});

export const listMarketplaceCategories = (locale?: AppLocale): SerializedCategory[] =>
  MARKETPLACE_TAXONOMY.map((category) => serializeMarketplaceCategory(category, locale));

export const getMarketplaceCategory = (slug: unknown, locale?: AppLocale): SerializedCategory | null => {
  const category = getMainCategoryRecord(slug);
  return category ? serializeMarketplaceCategory(category, locale) : null;
};

export const listMarketplaceSections = (slugs: MainCategorySlug[], locale?: AppLocale) =>
  slugs
    .map((slug) => MAIN_CATEGORY_INDEX.get(slug))
    .filter((category): category is MarketplaceCategory => Boolean(category))
    .map((category) => serializeMarketplaceCategory(category, locale));

export const buildMarketplaceBreadcrumbs = (
  main: MarketplaceCategory | SerializedCategory,
  subcategory?: MarketplaceSubcategory | SerializedSubcategory | null,
  locale?: AppLocale
) => {
  const homeLabel = {
    uz: "Bosh sahifa",
    ru: "Главная",
    en: "Home",
    ko: "홈"
  }[locale || "uz"];

  return [
    { key: "home", label: homeLabel, route: "/" },
    {
      key: `category:${main.slug}`,
      label: "displayName" in main ? main.displayName : getLocalizedTaxonomyName(main.name, locale),
      route: main.route
    },
    ...(subcategory
      ? [
          {
            key: `subcategory:${subcategory.slug}`,
            label: "displayName" in subcategory ? subcategory.displayName : getLocalizedTaxonomyName(subcategory.name, locale),
            route: subcategory.route
          }
        ]
      : [])
  ];
};

export const buildMarketplaceFilterSchema = (
  category: MarketplaceCategory | SerializedCategory,
  subcategory?: MarketplaceSubcategory | SerializedSubcategory | null,
  locale?: AppLocale
) => {
  const categoryFilters = new Set<string>(["price", "rating"]);
  for (const filterKey of subcategory?.filters || []) categoryFilters.add(filterKey);
  return buildFilterUiSchema(Array.from(categoryFilters), locale);
};

export const buildMarketplaceLanding = (mainSlug: unknown, subcategorySlug?: unknown, locale?: AppLocale) => {
  const category = getMarketplaceCategory(mainSlug, locale);
  if (!category) return null;
  const resolvedSubcategory = subcategorySlug
    ? resolveMarketplaceTaxonomy(subcategorySlug, locale, category.slug)?.subcategory
    : null;
  const subcategory = resolvedSubcategory
    ? category.subcategories.find((item) => item.slug === resolvedSubcategory.slug) || null
    : null;

  const targetRoute = subcategory?.route || category.route;
  return {
    category: {
      slug: category.slug,
      name: category.displayName,
      localizedName: category.name,
      route: category.route,
      icon: getUiIconSpec((category.slug as unknown as Parameters<typeof getUiIconSpec>[0]) || "category", locale, category.displayName)
    },
    subcategory: subcategory
      ? {
          slug: subcategory.slug,
          name: subcategory.displayName,
          localizedName: subcategory.name,
          route: subcategory.route,
          icon: getUiIconSpec("subcategory", locale, subcategory.displayName)
        }
      : null,
    route: targetRoute,
    breadcrumbs: buildMarketplaceBreadcrumbs(category, subcategory, locale),
    filterSchema: buildMarketplaceFilterSchema(category, subcategory, locale),
    sortOptions: listMarketplaceSortOptions(locale),
    listingTemplate: category.slug,
    searchHints: {
      queryTypes:
        category.slug === "products"
          ? ["keyword", "brand", "category"]
          : ["keyword", "category", "agent"],
      targetRoute
    }
  };
};

export const resolveMarketplaceTaxonomy = (
  rawCategory: unknown,
  locale?: AppLocale,
  mainHint?: MainCategorySlug | null
) => {
  const normalized = normalizeSlug(rawCategory);
  const hintedMain = mainHint ? getMainCategoryRecord(mainHint) : null;

  if (hintedMain) {
    const withinHint = hintedMain.subcategories.find((subcategory) => {
      const candidates = new Set<string>([
        subcategory.slug,
        normalizeSlug(subcategory.slug),
        ...Object.values(subcategory.name).map(normalizeSlug),
        ...(subcategory.aliases || []).map(normalizeSlug)
      ]);
      return normalized ? candidates.has(normalized) : false;
    });
    if (withinHint) {
      return {
        main: serializeMarketplaceCategory(hintedMain, locale),
        subcategory: {
          ...withinHint,
          displayName: getLocalizedTaxonomyName(withinHint.name, locale)
        }
      };
    }
    if (!normalized || getMainCategoryRecord(normalized)?.slug === hintedMain.slug) {
      return {
        main: serializeMarketplaceCategory(hintedMain, locale),
        subcategory: null
      };
    }
  }

  const resolved = normalized ? SUBCATEGORY_INDEX.get(normalized) : null;
  if (resolved) {
    return {
      main: serializeMarketplaceCategory(resolved.main, locale),
      subcategory: {
        ...resolved.subcategory,
        displayName: getLocalizedTaxonomyName(resolved.subcategory.name, locale)
      }
    };
  }

  const resolvedMain = normalized ? getMainCategoryRecord(normalized) : null;
  if (resolvedMain) {
    return {
      main: serializeMarketplaceCategory(resolvedMain, locale),
      subcategory: null
    };
  }

  if (!normalized && hintedMain) {
    return {
      main: serializeMarketplaceCategory(hintedMain, locale),
      subcategory: null
    };
  }

  return null;
};

export const buildCategoryMeta = (
  rawCategory: unknown,
  locale?: AppLocale,
  mainHint?: MainCategorySlug | null
) => {
  const resolved = resolveMarketplaceTaxonomy(rawCategory, locale, mainHint);
  if (!resolved) {
    const fallbackSlug = normalizeSlug(rawCategory);
    if (!fallbackSlug) return null;
    return {
      mainCategory: mainHint || null,
      categorySlug: fallbackSlug,
      displayName: String(rawCategory || fallbackSlug),
      route: mainHint ? routeFor(mainHint, fallbackSlug) : null,
      localizedName: null
    };
  }

  return {
    mainCategory: resolved.main.slug,
    categorySlug: resolved.subcategory?.slug || resolved.main.slug,
    displayName: resolved.subcategory?.displayName || resolved.main.displayName,
    route: resolved.subcategory?.route || resolved.main.route,
    localizedName: resolved.subcategory?.name || resolved.main.name
  };
};

export const normalizeMarketplaceCategory = (rawCategory: unknown, mainHint?: MainCategorySlug | null) => {
  const resolved = resolveMarketplaceTaxonomy(rawCategory, undefined, mainHint);
  return resolved?.subcategory?.slug || resolved?.main.slug || normalizeSlug(rawCategory);
};
