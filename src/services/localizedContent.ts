import type { AppLocale } from "../i18n";
import { buildCategoryMeta, type MainCategorySlug } from "./categoryTaxonomy";

export type LocalizedText = Partial<Record<AppLocale, string>>;
export type LocalizedStringArray = Partial<Record<AppLocale, string[]>>;

type LocalizedSource = string | LocalizedText | null | undefined;
type LocalizedArraySource = string[] | LocalizedStringArray | null | undefined;

const LOCALE_PRIORITY: AppLocale[] = ["uz", "en", "ru", "ko"];
const LOCALE_TAGS: Record<AppLocale, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
  ko: "ko-KR"
};

const normalizeText = (value: unknown) => String(value ?? "").trim();
const normalizeToken = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const pickLocalizedString = (value: Record<string, unknown>, locale?: AppLocale) => {
  const preferred = locale ? [locale, ...LOCALE_PRIORITY.filter((entry) => entry !== locale)] : LOCALE_PRIORITY;
  for (const key of preferred) {
    const candidate = normalizeText(value[key]);
    if (candidate) return candidate;
  }
  return "";
};

const pickLocalizedArray = (value: Record<string, unknown>, locale?: AppLocale) => {
  const preferred = locale ? [locale, ...LOCALE_PRIORITY.filter((entry) => entry !== locale)] : LOCALE_PRIORITY;
  for (const key of preferred) {
    const candidate = value[key];
    if (!Array.isArray(candidate)) continue;
    const items = candidate.map((entry) => normalizeText(entry)).filter(Boolean);
    if (items.length) return items;
  }
  return [] as string[];
};

export const resolveLocalizedText = (value: LocalizedSource, locale?: AppLocale, fallback = "") => {
  if (typeof value === "string") return value;
  if (isPlainRecord(value)) {
    const localized = pickLocalizedString(value, locale);
    if (localized) return localized;
  }
  return fallback;
};

export const resolveLocalizedArray = (value: LocalizedArraySource, locale?: AppLocale, fallback: string[] = []) => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean);
  }
  if (isPlainRecord(value)) {
    const localized = pickLocalizedArray(value, locale);
    if (localized.length) return localized;
  }
  return fallback;
};

const localizedFieldCandidates = (field: string) => [
  `${field}I18n`,
  `${field}Localized`,
  `${field}Locales`,
  `${field}Translations`,
  field
];

export const resolveLocalizedTextField = (
  source: Record<string, unknown> | null | undefined,
  field: string,
  locale?: AppLocale,
  fallback = ""
) => {
  if (!source) return fallback;
  for (const key of localizedFieldCandidates(field)) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const resolved = resolveLocalizedText(source[key] as LocalizedSource, locale, "");
    if (resolved) return resolved;
  }
  return fallback;
};

export const resolveLocalizedArrayField = (
  source: Record<string, unknown> | null | undefined,
  field: string,
  locale?: AppLocale,
  fallback: string[] = []
) => {
  if (!source) return fallback;
  for (const key of localizedFieldCandidates(field)) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const resolved = resolveLocalizedArray(source[key] as LocalizedArraySource, locale, []);
    if (resolved.length) return resolved;
  }
  return fallback;
};

const KEYWORD_LABELS: Record<string, LocalizedText> = {
  seller: { uz: "Sotuvchi", ru: "Продавец", en: "Seller", ko: "판매자" },
  service: { uz: "Xizmat", ru: "Услуга", en: "Service", ko: "서비스" },
  "service-agent": { uz: "Xizmat agenti", ru: "Сервисный агент", en: "Service Agent", ko: "서비스 에이전트" },
  "seller-agent": { uz: "Sotuvchi agent", ru: "Агент продавца", en: "Seller Agent", ko: "판매 에이전트" },
  group: { uz: "Guruh", ru: "Группа", en: "Group", ko: "그룹" },
  channel: { uz: "Kanal", ru: "Канал", en: "Channel", ko: "채널" },
  public: { uz: "Ochiq", ru: "Открытая", en: "Public", ko: "공개" },
  private: { uz: "Yopiq", ru: "Закрытая", en: "Private", ko: "비공개" },
  secret: { uz: "Maxfiy", ru: "Секретная", en: "Secret", ko: "비밀" },
  question: { uz: "Savol", ru: "Вопрос", en: "Question", ko: "질문" },
  post: { uz: "Post", ru: "Публикация", en: "Post", ko: "게시물" },
  comment: { uz: "Izoh", ru: "Комментарий", en: "Comment", ko: "댓글" },
  file: { uz: "Fayl", ru: "Файл", en: "File", ko: "파일" },
  like: { uz: "Layk", ru: "Лайк", en: "Like", ko: "좋아요" },
  new: { uz: "Yangi", ru: "Новый", en: "New", ko: "신상품" },
  fast: { uz: "Tezkor", ru: "Быстрая", en: "Fast", ko: "빠른 배송" },
  korea: { uz: "Koreya", ru: "Корея", en: "Korea", ko: "한국" },
  business: { uz: "Biznes", ru: "Бизнес", en: "Business", ko: "비즈니스" },
  mentoring: { uz: "Mentorlik", ru: "Менторство", en: "Mentoring", ko: "멘토링" },
  documents: { uz: "Hujjatlar", ru: "Документы", en: "Documents", ko: "문서" },
  visa: { uz: "Visa", ru: "Виза", en: "Visa", ko: "비자" },
  verified: { uz: "Tasdiqlangan", ru: "Проверено", en: "Verified", ko: "인증됨" },
  consulting: { uz: "Konsalting", ru: "Консалтинг", en: "Consulting", ko: "컨설팅" },
  translation: { uz: "Tarjima", ru: "Перевод", en: "Translation", ko: "번역" },
  community: { uz: "Hamjamiyat", ru: "Сообщество", en: "Community", ko: "커뮤니티" },
  technology: { uz: "Texnologiya", ru: "Технологии", en: "Technology", ko: "기술" },
  education: { uz: "Ta'lim", ru: "Образование", en: "Education", ko: "교육" },
  government: { uz: "Rasmiy yangiliklar", ru: "Официальные обновления", en: "Official Updates", ko: "공식 안내" },
  entertainment: { uz: "Ko'ngilochar", ru: "Развлечения", en: "Entertainment", ko: "엔터테인먼트" },
  tech: { uz: "Texnologiya", ru: "Технологии", en: "Tech", ko: "기술" },
  startup: { uz: "Startap", ru: "Стартап", en: "Startup", ko: "스타트업" },
  media: { uz: "Media", ru: "Медиа", en: "Media", ko: "미디어" },
  english: { uz: "Ingliz tili", ru: "Английский язык", en: "English", ko: "영어" },
  seoul: { uz: "Seul", ru: "Сеул", en: "Seoul", ko: "서울" },
  conversation: { uz: "Suhbat", ru: "Разговорная практика", en: "Conversation", ko: "회화" },
  logistics: { uz: "Logistika", ru: "Логистика", en: "Logistics", ko: "물류" },
  shipping: { uz: "Yetkazish", ru: "Доставка", en: "Shipping", ko: "배송" },
  cargo: { uz: "Yuk", ru: "Груз", en: "Cargo", ko: "화물" },
  design: { uz: "Dizayn", ru: "Дизайн", en: "Design", ko: "디자인" },
  video: { uz: "Video", ru: "Видео", en: "Video", ko: "비디오" },
  creative: { uz: "Ijodiy", ru: "Креатив", en: "Creative", ko: "크리에이티브" },
  food: { uz: "Taom", ru: "Еда", en: "Food", ko: "음식" },
  korean: { uz: "Koreyscha", ru: "Корейский", en: "Korean", ko: "한국어" },
  cooking: { uz: "Pazandachilik", ru: "Кулинария", en: "Cooking", ko: "요리" },
  kpop: { uz: "K-Pop", ru: "K-Pop", en: "K-Pop", ko: "K-Pop" },
  music: { uz: "Musiqa", ru: "Музыка", en: "Music", ko: "음악" },
  culture: { uz: "Madaniyat", ru: "Культура", en: "Culture", ko: "문화" },
  ai: { uz: "Sun'iy intellekt", ru: "Искусственный интеллект", en: "AI", ko: "AI" },
  learning: { uz: "O'rganish", ru: "Обучение", en: "Learning", ko: "학습" },
  investor: { uz: "Investor", ru: "Инвестор", en: "Investor", ko: "투자자" },
  travel: { uz: "Sayohat", ru: "Путешествия", en: "Travel", ko: "여행" },
  voyage: { uz: "Safar", ru: "Путешествие", en: "Voyage", ko: "여행" },
  ux: { uz: "UX", ru: "UX", en: "UX", ko: "UX" },
  mobile: { uz: "Mobil", ru: "Мобильный", en: "Mobile", ko: "모바일" },
  career: { uz: "Karyera", ru: "Карьера", en: "Career", ko: "커리어" },
  jobs: { uz: "Ish o'rinlari", ru: "Вакансии", en: "Jobs", ko: "채용" },
  agents: { uz: "Agentlar", ru: "Агенты", en: "Agents", ko: "에이전트" },
  venture: { uz: "Venchur", ru: "Венчур", en: "Venture", ko: "벤처" },
  fund: { uz: "Fond", ru: "Фонд", en: "Fund", ko: "펀드" },
  iot: { uz: "IoT", ru: "IoT", en: "IoT", ko: "IoT" },
  smartcity: { uz: "Smart city", ru: "Умный город", en: "Smart City", ko: "스마트 시티" },
  urban: { uz: "Shahar muhiti", ru: "Городская среда", en: "Urban", ko: "도시" },
  code: { uz: "Kod", ru: "Код", en: "Code", ko: "코드" },
  web: { uz: "Veb", ru: "Веб", en: "Web", ko: "웹" },
  trade: { uz: "Savdo", ru: "Торговля", en: "Trade", ko: "무역" },
  global: { uz: "Global", ru: "Глобальный", en: "Global", ko: "글로벌" },
  import: { uz: "Import", ru: "Импорт", en: "Import", ko: "수입" },
  art: { uz: "San'at", ru: "Искусство", en: "Art", ko: "예술" },
  gallery: { uz: "Galereya", ru: "Галерея", en: "Gallery", ko: "갤러리" },
  nft: { uz: "NFT", ru: "NFT", en: "NFT", ko: "NFT" },
  sustainability: { uz: "Barqarorlik", ru: "Устойчивость", en: "Sustainability", ko: "지속가능성" },
  green: { uz: "Yashil", ru: "Зелёный", en: "Green", ko: "친환경" },
  climate: { uz: "Iqlim", ru: "Климат", en: "Climate", ko: "기후" }
};

export const localizeKeyword = (value: unknown, locale?: AppLocale) => {
  const token = normalizeToken(value);
  if (!token) return normalizeText(value);
  return resolveLocalizedText(KEYWORD_LABELS[token], locale, normalizeText(value));
};

export const localizeKeywordList = (values: unknown, locale?: AppLocale) =>
  resolveLocalizedArray(values as LocalizedArraySource, locale, Array.isArray(values) ? (values as string[]) : []).map((entry) =>
    localizeKeyword(entry, locale)
  );

export const getAgentKindLabel = (kind: unknown, locale?: AppLocale) =>
  localizeKeyword(String(kind || "").toLowerCase() === "seller" ? "seller_agent" : "service_agent", locale);

export const getCommunityTypeLabel = (value: unknown, locale?: AppLocale) => localizeKeyword(value, locale);
export const getCommunityPrivacyLabel = (value: unknown, locale?: AppLocale) => localizeKeyword(value, locale);
export const getPostTypeLabel = (value: unknown, locale?: AppLocale) => localizeKeyword(value, locale);

export const getCategoryDisplay = (value: unknown, locale?: AppLocale, mainHint?: MainCategorySlug | null) => {
  const meta = buildCategoryMeta(value, locale, mainHint);
  return {
    label: meta?.displayName || localizeKeyword(value, locale),
    meta
  };
};

export const formatLocaleDateRange = (locale: AppLocale | undefined, fromDays = 1, toDays = 2) => {
  const start = new Date(Date.now() + fromDays * 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() + toDays * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat(LOCALE_TAGS[locale || "uz"], {
    month: "short",
    day: "numeric"
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

const PRODUCT_COPY: Record<AppLocale, {
  sellerName: string;
  officialSellerName: string;
  defaultBadges: string[];
  packagingBadge: string;
  deliveryPromise: string;
  origin: string;
  returnWindow: string;
  exchange: string;
  warranty: string;
  support: string;
  specCategory: string;
  specBrand: string;
  specCondition: string;
  genericCategory: string;
  selectedBrand: string;
  conditionNew: string;
  colorName: string;
  sizeName: string;
  white: string;
  black: string;
  couponLabel: string;
  couponDescription: string;
  bonusLabel: string;
  bonusDescription: string;
  installmentPartner: string;
  freeDelivery: string;
  paidDelivery: string;
  highlightDelivery: string;
  highlightOriginal: string;
  highlightPrice: string;
  highlightPricePending: string;
  sectionOverview: string;
  sectionSpecs: string;
  sectionDelivery: string;
  sectionSeller: string;
  sectionPolicies: string;
  deliveryServiceLabel: string;
  deliveryPriceLabel: string;
  deliveryDateLabel: string;
  sellerLabel: string;
  sellerRatingLabel: string;
  sellerSalesLabel: string;
  sellerContactLabel: string;
}> = {
  uz: {
    sellerName: "UniServe Market",
    officialSellerName: "UniServe Mall",
    defaultBadges: ["Tez yetkazib berish", "Original mahsulot", "15 kun qaytarish"],
    packagingBadge: "Qadoqlash videosi",
    deliveryPromise: "Buyurtma 18:00 gacha tasdiqlansa, ertasi kuni yetkaziladi",
    origin: "Toshkent ombori",
    returnWindow: "15 kun ichida bepul qaytarish",
    exchange: "Oson almashtirish va pulni qaytarish",
    warranty: "12 oy ishlab chiqaruvchi kafolati",
    support: "24/7 qo'llab-quvvatlash",
    specCategory: "Kategoriya",
    specBrand: "Brend",
    specCondition: "Holati",
    genericCategory: "Umumiy",
    selectedBrand: "UniServe tanlovi",
    conditionNew: "Yangi",
    colorName: "Rangi",
    sizeName: "O'lcham",
    white: "Oq",
    black: "Qora",
    couponLabel: "5% kupon",
    couponDescription: "Checkout paytida avtomatik qo'llanadi",
    bonusLabel: "10 000 so'm bonus",
    bonusDescription: "Yangi foydalanuvchilar uchun",
    installmentPartner: "Paymart",
    freeDelivery: "Yetkazib berish bepul",
    paidDelivery: "Tez yetkazish xizmati mavjud",
    highlightDelivery: "{name} uchun tez yetkazib berish ({estimated})",
    highlightOriginal: "{seller} tomonidan kafolatlangan original mahsulot",
    highlightPrice: "Hozirgi narx: {price}",
    highlightPricePending: "Narx aniqlanmoqda",
    sectionOverview: "Asosiy ma'lumotlar",
    sectionSpecs: "Texnik xususiyatlar",
    sectionDelivery: "Yetkazib berish",
    sectionSeller: "Sotuvchi",
    sectionPolicies: "Qaytarish va kafolat",
    deliveryServiceLabel: "Xizmat",
    deliveryPriceLabel: "Narx",
    deliveryDateLabel: "Taxminiy sana",
    sellerLabel: "Sotuvchi",
    sellerRatingLabel: "Reyting",
    sellerSalesLabel: "Sotuvlar",
    sellerContactLabel: "Kontakt"
  },
  ru: {
    sellerName: "UniServe Market",
    officialSellerName: "UniServe Mall",
    defaultBadges: ["Быстрая доставка", "Оригинальный товар", "Возврат 15 дней"],
    packagingBadge: "Видео упаковки",
    deliveryPromise: "Если заказ подтверждён до 18:00, доставка возможна на следующий день",
    origin: "Склад в Ташкенте",
    returnWindow: "Бесплатный возврат в течение 15 дней",
    exchange: "Простой обмен и возврат средств",
    warranty: "Гарантия производителя 12 месяцев",
    support: "Поддержка 24/7",
    specCategory: "Категория",
    specBrand: "Бренд",
    specCondition: "Состояние",
    genericCategory: "Общее",
    selectedBrand: "Выбор UniServe",
    conditionNew: "Новый",
    colorName: "Цвет",
    sizeName: "Размер",
    white: "Белый",
    black: "Чёрный",
    couponLabel: "Купон 5%",
    couponDescription: "Применяется автоматически на checkout",
    bonusLabel: "Бонус 10 000 сум",
    bonusDescription: "Для новых пользователей",
    installmentPartner: "Paymart",
    freeDelivery: "Доставка бесплатно",
    paidDelivery: "Доступна экспресс-доставка",
    highlightDelivery: "Быстрая доставка для {name} ({estimated})",
    highlightOriginal: "Оригинальный товар с гарантией от {seller}",
    highlightPrice: "Текущая цена: {price}",
    highlightPricePending: "Цена уточняется",
    sectionOverview: "Основная информация",
    sectionSpecs: "Характеристики",
    sectionDelivery: "Доставка",
    sectionSeller: "Продавец",
    sectionPolicies: "Возврат и гарантия",
    deliveryServiceLabel: "Сервис",
    deliveryPriceLabel: "Стоимость",
    deliveryDateLabel: "Ожидаемая дата",
    sellerLabel: "Продавец",
    sellerRatingLabel: "Рейтинг",
    sellerSalesLabel: "Продажи",
    sellerContactLabel: "Контакт"
  },
  en: {
    sellerName: "UniServe Market",
    officialSellerName: "UniServe Mall",
    defaultBadges: ["Fast delivery", "Original product", "15-day return"],
    packagingBadge: "Packaging video",
    deliveryPromise: "If confirmed before 6:00 PM, next-day delivery is available",
    origin: "Tashkent warehouse",
    returnWindow: "Free return within 15 days",
    exchange: "Easy exchange and refund",
    warranty: "12-month manufacturer warranty",
    support: "24/7 support",
    specCategory: "Category",
    specBrand: "Brand",
    specCondition: "Condition",
    genericCategory: "General",
    selectedBrand: "UniServe Pick",
    conditionNew: "New",
    colorName: "Color",
    sizeName: "Size",
    white: "White",
    black: "Black",
    couponLabel: "5% coupon",
    couponDescription: "Applied automatically at checkout",
    bonusLabel: "10,000 UZS bonus",
    bonusDescription: "For new users",
    installmentPartner: "Paymart",
    freeDelivery: "Free delivery",
    paidDelivery: "Express delivery available",
    highlightDelivery: "Fast delivery for {name} ({estimated})",
    highlightOriginal: "Original product backed by {seller}",
    highlightPrice: "Current price: {price}",
    highlightPricePending: "Price available on request",
    sectionOverview: "Overview",
    sectionSpecs: "Specifications",
    sectionDelivery: "Delivery",
    sectionSeller: "Seller",
    sectionPolicies: "Returns & Warranty",
    deliveryServiceLabel: "Service",
    deliveryPriceLabel: "Price",
    deliveryDateLabel: "Estimated date",
    sellerLabel: "Seller",
    sellerRatingLabel: "Rating",
    sellerSalesLabel: "Sales",
    sellerContactLabel: "Contact"
  },
  ko: {
    sellerName: "UniServe Market",
    officialSellerName: "UniServe Mall",
    defaultBadges: ["빠른 배송", "정품 보장", "15일 반품"],
    packagingBadge: "포장 영상",
    deliveryPromise: "오후 6시 이전 확정 시 다음 날 배송이 가능합니다",
    origin: "타슈켄트 물류창고",
    returnWindow: "15일 이내 무료 반품",
    exchange: "간편 교환 및 환불",
    warranty: "제조사 12개월 보증",
    support: "24/7 고객지원",
    specCategory: "카테고리",
    specBrand: "브랜드",
    specCondition: "상태",
    genericCategory: "일반",
    selectedBrand: "UniServe 추천",
    conditionNew: "신상품",
    colorName: "색상",
    sizeName: "사이즈",
    white: "화이트",
    black: "블랙",
    couponLabel: "5% 쿠폰",
    couponDescription: "결제 단계에서 자동 적용",
    bonusLabel: "10,000 UZS 보너스",
    bonusDescription: "신규 사용자 전용",
    installmentPartner: "Paymart",
    freeDelivery: "무료 배송",
    paidDelivery: "빠른 배송 옵션 제공",
    highlightDelivery: "{name} 빠른 배송 ({estimated})",
    highlightOriginal: "{seller}가 보증하는 정품",
    highlightPrice: "현재 가격: {price}",
    highlightPricePending: "가격 확인 중",
    sectionOverview: "핵심 정보",
    sectionSpecs: "상세 사양",
    sectionDelivery: "배송",
    sectionSeller: "판매자",
    sectionPolicies: "반품 및 보증",
    deliveryServiceLabel: "서비스",
    deliveryPriceLabel: "가격",
    deliveryDateLabel: "예상 날짜",
    sellerLabel: "판매자",
    sellerRatingLabel: "평점",
    sellerSalesLabel: "판매 수",
    sellerContactLabel: "연락처"
  }
};

export const getProductCopy = (locale?: AppLocale) => PRODUCT_COPY[locale || "uz"];

export const interpolateTemplate = (template: string, params: Record<string, string | number | null | undefined>) =>
  template.replace(/\{(\w+)\}/g, (_match, key) => String(params[key] ?? ""));
