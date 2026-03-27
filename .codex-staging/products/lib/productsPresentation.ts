import {
  DEFAULT_LOCALE,
  formatMoneyByLocale,
  resolveLocalizedText,
  tx,
  type LocalizedText,
  type SupportedLocale
} from "./localization";

const LOCALE_TAGS: Record<SupportedLocale, string> = {
  en: "en-US",
  uz: "uz-UZ",
  ru: "ru-RU",
  ko: "ko-KR"
};

const normalizeToken = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const DELIVERY_LABELS: Record<string, LocalizedText> = {
  fast: tx("Fast delivery", "Tez yetkazish", "Быстрая доставка", "빠른 배송"),
  tomorrow: tx("Tomorrow delivery", "Ertaga yetkazish", "Доставка завтра", "내일 배송"),
  standard: tx("Standard delivery", "Standart yetkazish", "Стандартная доставка", "일반 배송")
};

const CONDITION_LABELS: Record<string, LocalizedText> = {
  any: tx("All", "Barchasi", "Все", "전체"),
  new: tx("New", "Yangi", "Новый", "새 상품"),
  used: tx("Used", "Ishlatilgan", "Б/у", "중고"),
  fresh: tx("Fresh / freshly prepared", "Yangi / yangi tayyorlangan", "Свежее / только приготовленное", "신선 / 즉석 준비"),
  frozen: tx("Frozen", "Muzlatilgan", "Замороженное", "냉동")
};

const AUDIENCE_LABELS: Record<string, LocalizedText> = {
  any: tx("All", "Barchasi", "Все", "전체"),
  women: tx("Women", "Ayollar", "Женщины", "여성"),
  men: tx("Men", "Erkaklar", "Мужчины", "남성"),
  kids: tx("Kids", "Bolalar", "Дети", "아동"),
  unisex: tx("Unisex", "Unisex", "Унисекс", "유니섹스")
};

const SEASON_LABELS: Record<string, LocalizedText> = {
  any: tx("All", "Barchasi", "Все", "전체"),
  summer: tx("Summer", "Yozgi", "Летнее", "여름"),
  winter: tx("Winter", "Qishki", "Зимнее", "겨울"),
  allseason: tx("All season", "Barcha mavsum", "На все сезоны", "사계절")
};

const SEARCH_TAGS: Record<
  string,
  { label: LocalizedText; query: string }
> = {
  carplay: {
    label: tx("CarPlay", "CarPlay", "CarPlay", "CarPlay"),
    query: "CarPlay"
  },
  ssd: {
    label: tx("SSD", "SSD", "SSD", "SSD"),
    query: "SSD"
  },
  hdmi: {
    label: tx("HDMI", "HDMI", "HDMI", "HDMI"),
    query: "HDMI"
  },
  powerbank: {
    label: tx("Power bank", "Powerbank", "Пауэрбанк", "보조배터리"),
    query: "Powerbank"
  },
  "iphone-case": {
    label: tx("iPhone case", "iPhone g'ilofi", "Чехол для iPhone", "아이폰 케이스"),
    query: "iPhone case"
  },
  adapter: {
    label: tx("Adapter", "Adapter", "Адаптер", "어댑터"),
    query: "Adapter"
  }
};

export const formatProductNumber = (value: number, locale: SupportedLocale) =>
  new Intl.NumberFormat(LOCALE_TAGS[locale]).format(Math.max(0, Number(value) || 0));

export const formatProductCompactNumber = (value: number, locale: SupportedLocale) =>
  new Intl.NumberFormat(LOCALE_TAGS[locale], {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Math.max(0, Number(value) || 0));

export const resolveProductLabel = (
  map: Record<string, LocalizedText>,
  value: unknown,
  locale: SupportedLocale,
  fallback = ""
) => {
  const token = normalizeToken(value);
  if (!token) return fallback;
  return resolveLocalizedText(map[token], locale, DEFAULT_LOCALE) || fallback || String(value);
};

export const getProductDeliveryLabel = (value: unknown, locale: SupportedLocale) =>
  resolveProductLabel(DELIVERY_LABELS, value, locale, String(value || ""));

export const getProductConditionLabel = (value: unknown, locale: SupportedLocale) =>
  resolveProductLabel(CONDITION_LABELS, value, locale, String(value || ""));

export const getProductAudienceLabel = (value: unknown, locale: SupportedLocale) =>
  resolveProductLabel(AUDIENCE_LABELS, value, locale, String(value || ""));

export const getProductSeasonLabel = (value: unknown, locale: SupportedLocale) =>
  resolveProductLabel(SEASON_LABELS, value, locale, String(value || ""));

export const getLocalizedProductSearchChips = (locale: SupportedLocale) =>
  Object.values(SEARCH_TAGS).map((item) => ({
    query: item.query,
    label: resolveLocalizedText(item.label, locale, DEFAULT_LOCALE) || item.query
  }));

const parseTimestamp = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const formatProductRelativeTime = (
  value: unknown,
  locale: SupportedLocale,
  now = Date.now()
) => {
  const timestamp = parseTimestamp(value);
  if (!timestamp) return "—";

  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  const formatter = new Intl.RelativeTimeFormat(LOCALE_TAGS[locale], { numeric: "always" });

  if (diffMinutes < 60) return formatter.format(-diffMinutes, "minute");

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return formatter.format(-diffHours, "hour");

  const diffDays = Math.max(1, Math.floor(diffHours / 24));
  return formatter.format(-diffDays, "day");
};

export const formatProductResultCount = (value: number, locale: SupportedLocale) => {
  const count = formatProductNumber(value, locale);
  if (locale === "uz") return `${count} ta mahsulot`;
  if (locale === "ru") return `${count} товаров`;
  if (locale === "ko") return `${count}개 상품`;
  return `${count} products`;
};

export const formatProductPaginationSummary = (
  total: number,
  totalPages: number,
  locale: SupportedLocale
) => {
  const totalLabel = formatProductNumber(total, locale);
  const pagesLabel = formatProductNumber(totalPages, locale);
  if (locale === "uz") return `Jami: ${totalLabel} ta mahsulot · ${pagesLabel} sahifa`;
  if (locale === "ru") return `Всего: ${totalLabel} товаров · ${pagesLabel} страниц`;
  if (locale === "ko") return `총 ${totalLabel}개 상품 · ${pagesLabel}페이지`;
  return `Total: ${totalLabel} products · ${pagesLabel} pages`;
};

export const formatProductReviewLabel = (count: number, locale: SupportedLocale) => {
  const formatted = formatProductCompactNumber(count, locale);
  if (count <= 0) {
    if (locale === "uz") return "Baho yo'q";
    if (locale === "ru") return "Без отзывов";
    if (locale === "ko") return "리뷰 없음";
    return "No reviews";
  }
  if (locale === "uz") return `${formatted} ta baho`;
  if (locale === "ru") return `${formatted} отзывов`;
  if (locale === "ko") return `리뷰 ${formatted}개`;
  return `${formatted} reviews`;
};

export const formatProductDemandLabel = (
  soldCount: number,
  viewCount: number,
  locale: SupportedLocale
) => {
  const sold = formatProductCompactNumber(soldCount, locale);
  const views = formatProductCompactNumber(viewCount, locale);
  if (soldCount > 0) {
    if (locale === "uz") return `${sold} sotilgan`;
    if (locale === "ru") return `${sold} продано`;
    if (locale === "ko") return `${sold} 판매`;
    return `${sold} sold`;
  }
  if (locale === "uz") return `${views} ko'rilgan`;
  if (locale === "ru") return `${views} просмотров`;
  if (locale === "ko") return `조회 ${views}회`;
  return `${views} views`;
};

export const formatProductInstallmentLabel = (
  value: number,
  currency: string,
  locale: SupportedLocale
) => {
  const amount = formatMoneyByLocale(value, currency, locale);
  if (locale === "uz") return `oyiga ${amount} dan`;
  if (locale === "ru") return `от ${amount}/мес`;
  if (locale === "ko") return `월 ${amount}부터`;
  return `from ${amount}/mo`;
};

export const formatProductImageCountLabel = (count: number, locale: SupportedLocale) => {
  if (!Number.isFinite(count) || count <= 1) return "";
  const total = formatProductNumber(count, locale);
  if (locale === "uz") return `${total} ta rasm`;
  if (locale === "ru") return `${total} фото`;
  if (locale === "ko") return `사진 ${total}장`;
  return `${total} photos`;
};

export const formatProductStockLabel = (
  params: {
    stockCount?: number | null;
    isOutOfStock?: boolean;
    isLimitedStock?: boolean;
  },
  locale: SupportedLocale
) => {
  if (params.isOutOfStock) {
    if (locale === "uz") return "Tugagan";
    if (locale === "ru") return "Нет в наличии";
    if (locale === "ko") return "품절";
    return "Out of stock";
  }

  if (typeof params.stockCount === "number" && params.stockCount > 0) {
    const total = formatProductNumber(params.stockCount, locale);
    if (locale === "uz") return `${total} dona`;
    if (locale === "ru") return `${total} в наличии`;
    if (locale === "ko") return `${total}개 재고`;
    return `${total} in stock`;
  }

  if (params.isLimitedStock) {
    if (locale === "uz") return "Kam qoldi";
    if (locale === "ru") return "Осталось мало";
    if (locale === "ko") return "재고 적음";
    return "Limited stock";
  }

  if (locale === "uz") return "Jo'natishga tayyor";
  if (locale === "ru") return "Готово к отправке";
  if (locale === "ko") return "즉시 발송 가능";
  return "Ready to ship";
};
