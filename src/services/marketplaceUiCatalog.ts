import type { AppLocale } from "../i18n";

export const UI_ICON_LIBRARY = "lucide" as const;

export type UiIconKey =
  | "products"
  | "services"
  | "consulting"
  | "courses"
  | "community"
  | "digital_services"
  | "agents"
  | "profile"
  | "cart"
  | "wishlist"
  | "share"
  | "filter"
  | "sort"
  | "search"
  | "notification"
  | "message"
  | "chat"
  | "call"
  | "location"
  | "price"
  | "rating"
  | "stock"
  | "verified"
  | "time"
  | "delivery"
  | "views"
  | "like"
  | "dislike"
  | "category"
  | "subcategory"
  | "brand"
  | "condition"
  | "language"
  | "experience"
  | "availability"
  | "schedule"
  | "certificate"
  | "format"
  | "level"
  | "city"
  | "jurisdiction"
  | "subject"
  | "country"
  | "date"
  | "privacy"
  | "region"
  | "industry"
  | "best_match"
  | "newest"
  | "popular";

export interface UiIconSpec {
  key: UiIconKey;
  library: typeof UI_ICON_LIBRARY;
  icon: string;
  symbol: string;
  tooltip: string;
  title: string;
  ariaLabel: string;
}

type LocalizedLabel = Record<AppLocale, string>;

const normalizeText = (value: unknown) => String(value ?? "").trim();

const ICON_DEFINITIONS: Record<UiIconKey, { icon: string; symbol: string; label: LocalizedLabel }> = {
  products: { icon: "ShoppingBag", symbol: "🛍", label: { uz: "Mahsulotlar", ru: "Товары", en: "Products", ko: "상품" } },
  services: { icon: "BriefcaseBusiness", symbol: "🧰", label: { uz: "Xizmatlar", ru: "Услуги", en: "Services", ko: "서비스" } },
  consulting: { icon: "Briefcase", symbol: "📊", label: { uz: "Konsalting", ru: "Консалтинг", en: "Consulting", ko: "컨설팅" } },
  courses: { icon: "GraduationCap", symbol: "🎓", label: { uz: "Kurslar", ru: "Курсы", en: "Courses", ko: "강좌" } },
  community: { icon: "Users", symbol: "👥", label: { uz: "Hamjamiyat", ru: "Сообщество", en: "Community", ko: "커뮤니티" } },
  digital_services: { icon: "Code2", symbol: "💻", label: { uz: "Raqamli xizmatlar", ru: "Цифровые услуги", en: "Digital Services", ko: "디지털 서비스" } },
  agents: { icon: "UserRound", symbol: "👤", label: { uz: "Agentlar", ru: "Агенты", en: "Agents", ko: "에이전트" } },
  profile: { icon: "Settings", symbol: "⚙", label: { uz: "Profil", ru: "Профиль", en: "Profile", ko: "프로필" } },
  cart: { icon: "ShoppingCart", symbol: "🛒", label: { uz: "Savatcha", ru: "Корзина", en: "Cart", ko: "장바구니" } },
  wishlist: { icon: "Heart", symbol: "❤️", label: { uz: "Saqlanganlar", ru: "Избранное", en: "Wishlist", ko: "찜" } },
  share: { icon: "Share2", symbol: "🔗", label: { uz: "Ulashish", ru: "Поделиться", en: "Share", ko: "공유" } },
  filter: { icon: "SlidersHorizontal", symbol: "⚙", label: { uz: "Filter", ru: "Фильтр", en: "Filter", ko: "필터" } },
  sort: { icon: "ArrowUpDown", symbol: "↕", label: { uz: "Saralash", ru: "Сортировка", en: "Sort", ko: "정렬" } },
  search: { icon: "Search", symbol: "🔍", label: { uz: "Qidirish", ru: "Поиск", en: "Search", ko: "검색" } },
  notification: { icon: "Bell", symbol: "🔔", label: { uz: "Bildirishnoma", ru: "Уведомление", en: "Notification", ko: "알림" } },
  message: { icon: "MessageCircle", symbol: "💬", label: { uz: "Xabar", ru: "Сообщение", en: "Message", ko: "메시지" } },
  chat: { icon: "MessageCircle", symbol: "💬", label: { uz: "Chat", ru: "Чат", en: "Chat", ko: "채팅" } },
  call: { icon: "Phone", symbol: "📞", label: { uz: "Qo'ng'iroq", ru: "Звонок", en: "Call", ko: "전화" } },
  location: { icon: "MapPinned", symbol: "📍", label: { uz: "Joylashuv", ru: "Локация", en: "Location", ko: "위치" } },
  price: { icon: "BadgeDollarSign", symbol: "💰", label: { uz: "Narx", ru: "Цена", en: "Price", ko: "가격" } },
  rating: { icon: "Star", symbol: "⭐", label: { uz: "Reyting", ru: "Рейтинг", en: "Rating", ko: "평점" } },
  stock: { icon: "PackageCheck", symbol: "📦", label: { uz: "Zaxira", ru: "Наличие", en: "Stock", ko: "재고" } },
  verified: { icon: "BadgeCheck", symbol: "✔", label: { uz: "Tasdiqlangan", ru: "Проверено", en: "Verified", ko: "인증" } },
  time: { icon: "Clock3", symbol: "⏱", label: { uz: "Vaqt", ru: "Время", en: "Time", ko: "시간" } },
  delivery: { icon: "Truck", symbol: "🚚", label: { uz: "Yetkazib berish", ru: "Доставка", en: "Delivery", ko: "배송" } },
  views: { icon: "Eye", symbol: "👁", label: { uz: "Ko'rishlar", ru: "Просмотры", en: "Views", ko: "조회수" } },
  like: { icon: "ThumbsUp", symbol: "👍", label: { uz: "Yoqdi", ru: "Нравится", en: "Like", ko: "좋아요" } },
  dislike: { icon: "ThumbsDown", symbol: "👎", label: { uz: "Yoqmadi", ru: "Не нравится", en: "Dislike", ko: "싫어요" } },
  category: { icon: "LayoutGrid", symbol: "🗂", label: { uz: "Kategoriya", ru: "Категория", en: "Category", ko: "카테고리" } },
  subcategory: { icon: "FolderTree", symbol: "🗃", label: { uz: "Subkategoriya", ru: "Подкатегория", en: "Subcategory", ko: "하위 카테고리" } },
  brand: { icon: "Badge", symbol: "🏷", label: { uz: "Brend", ru: "Бренд", en: "Brand", ko: "브랜드" } },
  condition: { icon: "ShieldCheck", symbol: "🧾", label: { uz: "Holati", ru: "Состояние", en: "Condition", ko: "상태" } },
  language: { icon: "Languages", symbol: "🌐", label: { uz: "Til", ru: "Язык", en: "Language", ko: "언어" } },
  experience: { icon: "Award", symbol: "🏅", label: { uz: "Tajriba", ru: "Опыт", en: "Experience", ko: "경력" } },
  availability: { icon: "CalendarClock", symbol: "📅", label: { uz: "Mavjudlik", ru: "Доступность", en: "Availability", ko: "가능 일정" } },
  schedule: { icon: "CalendarRange", symbol: "🗓", label: { uz: "Jadval", ru: "Расписание", en: "Schedule", ko: "일정" } },
  certificate: { icon: "FileBadge", symbol: "📜", label: { uz: "Sertifikat", ru: "Сертификат", en: "Certificate", ko: "수료증" } },
  format: { icon: "PanelTop", symbol: "🪟", label: { uz: "Format", ru: "Формат", en: "Format", ko: "형식" } },
  level: { icon: "BarChart3", symbol: "📶", label: { uz: "Daraja", ru: "Уровень", en: "Level", ko: "레벨" } },
  city: { icon: "Building2", symbol: "🏙", label: { uz: "Shahar", ru: "Город", en: "City", ko: "도시" } },
  jurisdiction: { icon: "Scale", symbol: "⚖", label: { uz: "Yurisdiksiya", ru: "Юрисдикция", en: "Jurisdiction", ko: "관할" } },
  subject: { icon: "BookOpen", symbol: "📘", label: { uz: "Fan", ru: "Предмет", en: "Subject", ko: "과목" } },
  country: { icon: "Globe", symbol: "🌍", label: { uz: "Mamlakat", ru: "Страна", en: "Country", ko: "국가" } },
  date: { icon: "CalendarDays", symbol: "📆", label: { uz: "Sana", ru: "Дата", en: "Date", ko: "날짜" } },
  privacy: { icon: "Shield", symbol: "🛡", label: { uz: "Maxfiylik", ru: "Приватность", en: "Privacy", ko: "공개 범위" } },
  region: { icon: "Map", symbol: "🗺", label: { uz: "Hudud", ru: "Регион", en: "Region", ko: "지역" } },
  industry: { icon: "BriefcaseBusiness", symbol: "🏢", label: { uz: "Soha", ru: "Сфера", en: "Industry", ko: "업종" } },
  best_match: { icon: "Sparkles", symbol: "✨", label: { uz: "Eng mos", ru: "Лучшее совпадение", en: "Best match", ko: "가장 적합" } },
  newest: { icon: "ClockArrowDown", symbol: "🆕", label: { uz: "Yangi", ru: "Сначала новые", en: "Newest", ko: "최신순" } },
  popular: { icon: "TrendingUp", symbol: "📈", label: { uz: "Mashhur", ru: "Популярное", en: "Most popular", ko: "인기순" } }
};

const FILTER_ICON_MAP: Record<string, UiIconKey> = {
  category: "category",
  subcategory: "subcategory",
  price: "price",
  brand: "brand",
  rating: "rating",
  stock: "stock",
  condition: "condition",
  delivery: "delivery",
  location: "location",
  language: "language",
  experience: "experience",
  availability: "availability",
  verification: "verified",
  delivery_time: "time",
  schedule: "schedule",
  certificate: "certificate",
  format: "format",
  level: "level",
  city: "city",
  jurisdiction: "jurisdiction",
  subject: "subject",
  country: "country",
  date: "date",
  privacy: "privacy",
  region: "region",
  industry: "industry"
};

const FILTER_LABELS: Record<string, LocalizedLabel> = {
  category: { uz: "Kategoriya", ru: "Категория", en: "Category", ko: "카테고리" },
  subcategory: { uz: "Subkategoriya", ru: "Подкатегория", en: "Subcategory", ko: "하위 카테고리" },
  price: { uz: "Narx", ru: "Цена", en: "Price", ko: "가격" },
  brand: { uz: "Brend", ru: "Бренд", en: "Brand", ko: "브랜드" },
  rating: { uz: "Reyting", ru: "Рейтинг", en: "Rating", ko: "평점" },
  stock: { uz: "Zaxira", ru: "Наличие", en: "Stock", ko: "재고" },
  condition: { uz: "Holati", ru: "Состояние", en: "Condition", ko: "상태" },
  delivery: { uz: "Yetkazish", ru: "Доставка", en: "Delivery", ko: "배송" },
  location: { uz: "Joylashuv", ru: "Локация", en: "Location", ko: "위치" },
  language: { uz: "Til", ru: "Язык", en: "Language", ko: "언어" },
  experience: { uz: "Tajriba", ru: "Опыт", en: "Experience", ko: "경력" },
  availability: { uz: "Mavjudlik", ru: "Доступность", en: "Availability", ko: "가능 일정" },
  verification: { uz: "Tasdiqlash", ru: "Проверка", en: "Verification", ko: "인증" },
  delivery_time: { uz: "Muddat", ru: "Срок", en: "Delivery time", ko: "소요 시간" },
  schedule: { uz: "Jadval", ru: "Расписание", en: "Schedule", ko: "일정" },
  certificate: { uz: "Sertifikat", ru: "Сертификат", en: "Certificate", ko: "수료증" },
  format: { uz: "Format", ru: "Формат", en: "Format", ko: "형식" },
  level: { uz: "Daraja", ru: "Уровень", en: "Level", ko: "레벨" },
  city: { uz: "Shahar", ru: "Город", en: "City", ko: "도시" },
  jurisdiction: { uz: "Yurisdiksiya", ru: "Юрисдикция", en: "Jurisdiction", ko: "관할" },
  subject: { uz: "Fan", ru: "Предмет", en: "Subject", ko: "과목" },
  country: { uz: "Mamlakat", ru: "Страна", en: "Country", ko: "국가" },
  date: { uz: "Sana", ru: "Дата", en: "Date", ko: "날짜" },
  privacy: { uz: "Maxfiylik", ru: "Приватность", en: "Privacy", ko: "공개 범위" },
  region: { uz: "Hudud", ru: "Регион", en: "Region", ko: "지역" },
  industry: { uz: "Soha", ru: "Сфера", en: "Industry", ko: "업종" }
};

const SORT_OPTIONS: Array<{ key: UiIconKey; value: string; label: LocalizedLabel }> = [
  { key: "best_match", value: "best_match", label: { uz: "Eng mos", ru: "Лучшее совпадение", en: "Best match", ko: "가장 적합" } },
  { key: "price", value: "price_asc", label: { uz: "Narx arzon", ru: "Цена по возрастанию", en: "Price low-high", ko: "낮은 가격순" } },
  { key: "price", value: "price_desc", label: { uz: "Narx qimmat", ru: "Цена по убыванию", en: "Price high-low", ko: "높은 가격순" } },
  { key: "rating", value: "top_rated", label: { uz: "Top reyting", ru: "По рейтингу", en: "Top rated", ko: "평점순" } },
  { key: "popular", value: "popular", label: { uz: "Mashhur", ru: "Популярное", en: "Most popular", ko: "인기순" } },
  { key: "newest", value: "newest", label: { uz: "Yangi", ru: "Сначала новые", en: "Newest", ko: "최신순" } }
];

const resolveLabel = (label: LocalizedLabel, locale?: AppLocale) => label[locale || "uz"] || label.en || label.uz;

export const getUiIconSpec = (key: UiIconKey, locale?: AppLocale, fallbackLabel?: string): UiIconSpec => {
  const definition = ICON_DEFINITIONS[key];
  const label = fallbackLabel || resolveLabel(definition.label, locale);
  return {
    key,
    library: UI_ICON_LIBRARY,
    icon: definition.icon,
    symbol: definition.symbol,
    tooltip: label,
    title: label,
    ariaLabel: label
  };
};

export const buildFilterUiSchema = (keys: string[], locale?: AppLocale) =>
  keys.map((key) => {
    const iconKey = FILTER_ICON_MAP[key] || "filter";
    const label = resolveLabel(FILTER_LABELS[key] || FILTER_LABELS.price, locale);
    return {
      key,
      label,
      icon: getUiIconSpec(iconKey, locale, label),
      tooltip: label
    };
  });

export const listMarketplaceSortOptions = (locale?: AppLocale) =>
  SORT_OPTIONS.map((option) => ({
    value: option.value,
    label: resolveLabel(option.label, locale),
    icon: getUiIconSpec(option.key, locale, resolveLabel(option.label, locale))
  }));

export const buildSearchUiHints = (locale?: AppLocale) => ({
  library: UI_ICON_LIBRARY,
  actions: {
    search: getUiIconSpec("search", locale),
    filter: getUiIconSpec("filter", locale),
    sort: getUiIconSpec("sort", locale),
    cart: getUiIconSpec("cart", locale),
    message: getUiIconSpec("message", locale),
    share: getUiIconSpec("share", locale),
    wishlist: getUiIconSpec("wishlist", locale)
  }
});

export const toUiToken = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
