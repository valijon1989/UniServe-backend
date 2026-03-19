import mongoose from "mongoose";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { AgentProfile } from "../models/AgentProfile";
import { User } from "../models/User";
import { EducationListing } from "../models/EducationListing";
import { CommunityGroupModel } from "../models/CommunityGroup";
import { NewsPost } from "../models/NewsPost";
import { RecommendationSignal, type RecommendationEntityType, type RecommendationSignalAction } from "../models/RecommendationSignal";
import { RecommendationSnapshot } from "../models/RecommendationSnapshot";
import { type AppLocale } from "../i18n";
import { buildCategoryMeta } from "./categoryTaxonomy";
import { getAgentKindLabel, localizeKeywordList, resolveLocalizedTextField } from "./localizedContent";
import { resolveAvatarUrl } from "../utils/avatarImage";

type RecommendationSurface = "HOME" | "DETAIL" | "CART" | "CHECKOUT" | "ORDER_SUCCESS";

type RecommendationContext = {
  surface: RecommendationSurface;
  locale?: AppLocale;
  userId?: string | null;
  sessionId?: string | null;
  region?: string | null;
  location?: string | null;
  categoryKey?: string | null;
  entityType?: Exclude<RecommendationEntityType, "QUERY"> | null;
  entityId?: string | null;
  entityIdentifier?: string | null;
  cartProductIds?: string[];
  limitPerModule?: number;
};

type RecommendationModuleId =
  | "products_for_you"
  | "services_for_you"
  | "agents_for_you"
  | "courses_for_you"
  | "groups_for_you"
  | "related_products"
  | "similar_services"
  | "similar_agents"
  | "related_courses"
  | "groups_you_may_like"
  | "popular_now"
  | "continue_shopping";

type RecommendationReasonKey = "for_you" | "related" | "popular_area" | "recent_searches" | "also_viewed";

type RecommendationItem = {
  entityType: Exclude<RecommendationEntityType, "QUERY">;
  entityId: string;
  entityIdentifier?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  route: string;
  imageUrl?: string | null;
  price?: number | null;
  currency?: string | null;
  rating?: number | null;
  categoryKey?: string | null;
  categoryMeta?: ReturnType<typeof buildCategoryMeta> | null;
  reasonKey?: RecommendationReasonKey | null;
  reasonLabel?: string | null;
  score: number;
};

type RecommendationModule = {
  id: RecommendationModuleId;
  titleKey: string;
  title: string;
  reasonKey?: RecommendationReasonKey | null;
  reasonLabel?: string | null;
  items: RecommendationItem[];
};

type PreferenceProfile = {
  categories: Map<string, number>;
  entityScores: Map<string, number>;
  queryTerms: string[];
  dominantLocale?: string | null;
};

const normalizeText = (value: unknown) => String(value ?? "").trim();
const normalizeLocale = (locale?: AppLocale | string | null): AppLocale =>
  locale === "ru" || locale === "en" || locale === "ko" ? locale : "uz";

const RECOMMENDATION_TITLES: Record<RecommendationModuleId, Record<AppLocale, string>> = {
  products_for_you: { uz: "Siz uchun mahsulotlar", ru: "Товары для вас", en: "Products for you", ko: "맞춤 상품" },
  services_for_you: { uz: "Mos xizmatlar", ru: "Подходящие услуги", en: "Services for you", ko: "맞춤 서비스" },
  agents_for_you: { uz: "Mos agentlar", ru: "Подходящие агенты", en: "Agents for you", ko: "추천 에이전트" },
  courses_for_you: { uz: "Mos kurslar", ru: "Подходящие курсы", en: "Courses for you", ko: "추천 강좌" },
  groups_for_you: { uz: "Sizga mos guruhlar", ru: "Группы для вас", en: "Groups for you", ko: "추천 그룹" },
  related_products: { uz: "O'xshash mahsulotlar", ru: "Похожие товары", en: "Related products", ko: "관련 상품" },
  similar_services: { uz: "O'xshash xizmatlar", ru: "Похожие услуги", en: "Similar services", ko: "유사 서비스" },
  similar_agents: { uz: "Mos agentlar", ru: "Подходящие агенты", en: "Similar agents", ko: "유사 에이전트" },
  related_courses: { uz: "Davomiy kurslar", ru: "Похожие курсы", en: "Related courses", ko: "관련 강좌" },
  groups_you_may_like: { uz: "Qiziq bo'lishi mumkin", ru: "Может понравиться", en: "You may like", ko: "관심 있을 그룹" },
  popular_now: { uz: "Hozir ommabop", ru: "Популярно сейчас", en: "Popular now", ko: "지금 인기" },
  continue_shopping: { uz: "Davom eting", ru: "Продолжайте выбирать", en: "Continue browsing", ko: "계속 둘러보기" }
};

const RECOMMENDATION_REASONS: Record<RecommendationReasonKey, Record<AppLocale, string>> = {
  for_you: { uz: "Qiziqishingiz asosida", ru: "С учетом ваших интересов", en: "Based on your interests", ko: "관심사 기반" },
  related: { uz: "Ko'rganingizga o'xshash", ru: "Похоже на просмотренное", en: "Similar to what you viewed", ko: "최근 본 항목과 유사" },
  popular_area: { uz: "Hududingizda ommabop", ru: "Популярно рядом с вами", en: "Popular in your area", ko: "내 주변 인기" },
  recent_searches: { uz: "So'nggi qidiruvlaringiz asosida", ru: "На основе ваших поисков", en: "Based on recent searches", ko: "최근 검색 기반" },
  also_viewed: { uz: "Boshqalar ham ko'rgan", ru: "Пользователи также смотрели", en: "Users also viewed", ko: "다른 사용자도 본 항목" }
};

const SIGNAL_WEIGHTS: Partial<Record<RecommendationSignalAction, number>> = {
  VIEW: 1,
  CLICK: 2,
  SEARCH: 2,
  LIKE: 4,
  DISLIKE: -4,
  SAVE: 5,
  CART_ADD: 6,
  CART_REMOVE: -3,
  PURCHASE: 10,
  ORDER_COMPLETED: 12,
  CONTACT: 4,
  RATE: 4,
  JOIN_COMMUNITY: 7
};

const memoryCache = new Map<string, { expiresAt: number; modules: RecommendationModule[] }>();
const SNAPSHOT_TTL_MS = 15 * 60 * 1000;

const toObjectId = (value: string | mongoose.Types.ObjectId) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

const buildCacheKey = (context: RecommendationContext) =>
  [
    context.surface,
    normalizeLocale(context.locale),
    context.userId || "",
    context.sessionId || "",
    context.region || "",
    context.location || "",
    context.categoryKey || "",
    context.entityType || "",
    context.entityId || "",
    (context.cartProductIds || []).slice().sort().join(",")
  ].join("|");

export const getRecommendationModuleTitle = (moduleId: RecommendationModuleId, locale: AppLocale) =>
  RECOMMENDATION_TITLES[moduleId][locale];
export const getRecommendationReasonLabel = (reasonKey: RecommendationReasonKey, locale: AppLocale) =>
  RECOMMENDATION_REASONS[reasonKey][locale];

const buildProfile = (signals: Array<any>): PreferenceProfile => {
  const categories = new Map<string, number>();
  const entityScores = new Map<string, number>();
  const queryTerms: string[] = [];

  for (const signal of signals) {
    const weight = Number(signal.weight || SIGNAL_WEIGHTS[signal.action as RecommendationSignalAction] || 1);
    if (signal.categoryKey) {
      categories.set(signal.categoryKey, (categories.get(signal.categoryKey) || 0) + weight);
    }
    const entityType = normalizeText(signal.entityType).toUpperCase();
    const entityId = signal.entityId ? String(signal.entityId) : normalizeText(signal.entityIdentifier);
    if (entityType && entityId) {
      entityScores.set(`${entityType}:${entityId}`, (entityScores.get(`${entityType}:${entityId}`) || 0) + weight);
    }
    if (signal.queryText) {
      queryTerms.push(...normalizeText(signal.queryText).toLowerCase().split(/\s+/g).filter(Boolean).slice(0, 4));
    }
  }

  return { categories, entityScores, queryTerms: Array.from(new Set(queryTerms)) };
};

const scoreCandidate = (payload: {
  popularity: number;
  rating?: number | null;
  categoryKey?: string | null;
  entityType: string;
  entityId: string;
  profile: PreferenceProfile;
  reasonKey: RecommendationReasonKey;
  localeMatch?: boolean;
  locationMatch?: boolean;
}) => {
  let score = payload.popularity;
  if (typeof payload.rating === "number" && Number.isFinite(payload.rating)) score += payload.rating * 10;
  if (payload.categoryKey) score += (payload.profile.categories.get(payload.categoryKey) || 0) * 3;
  score += payload.profile.entityScores.get(`${payload.entityType}:${payload.entityId}`) || 0;
  if (payload.reasonKey === "recent_searches" && payload.profile.queryTerms.length) score += 12;
  if (payload.localeMatch) score += 8;
  if (payload.locationMatch) score += 8;
  return score;
};

const toPlainObject = (value: any) => (value?.toObject ? value.toObject() : { ...value });

const serializeProductCandidate = (product: any, locale: AppLocale, score: number, reasonKey: RecommendationReasonKey): RecommendationItem => {
  const raw = toPlainObject(product);
  const title = resolveLocalizedTextField(raw, "title", locale, raw.title || "");
  const description = resolveLocalizedTextField(raw, "description", locale, raw.description || "");
  const categoryMeta = buildCategoryMeta(raw.category, locale, "products");
  return {
    entityType: "PRODUCT",
    entityId: String(raw._id),
    entityIdentifier: raw.slug || String(raw._id),
    title,
    subtitle: categoryMeta?.displayName || null,
    description,
    route: `/products/${String(raw.slug || raw._id)}`,
    imageUrl: raw.coverImageUrl || raw.imageUrl || raw.image || raw.images?.[0] || null,
    price: Number(raw.salePrice ?? raw.price ?? 0) || null,
    currency: raw.currency || "USD",
    rating: Number(raw.ratingAvg ?? raw.rating?.avg ?? 0) || 0,
    categoryKey: raw.category || null,
    categoryMeta,
    reasonKey,
    reasonLabel: getRecommendationReasonLabel(reasonKey, locale),
    score
  };
};

const serializeServiceCandidate = (service: any, locale: AppLocale, score: number, reasonKey: RecommendationReasonKey): RecommendationItem => {
  const raw = toPlainObject(service);
  const title = resolveLocalizedTextField(raw, "title", locale, raw.title || "");
  const description = resolveLocalizedTextField(raw, "description", locale, raw.description || "");
  const categoryMeta = buildCategoryMeta(raw.category, locale, "services");
  return {
    entityType: "SERVICE",
    entityId: String(raw._id),
    entityIdentifier: raw.slug || String(raw._id),
    title,
    subtitle: categoryMeta?.displayName || raw.location || null,
    description,
    route: `/services/${String(raw.slug || raw._id)}`,
    imageUrl: raw.coverImageUrl || raw.cardImageUrl || raw.imageUrl || raw.images?.[0] || null,
    price: Number(raw.salePrice ?? raw.price ?? raw.hourlyRate ?? 0) || null,
    currency: raw.currency || "USD",
    rating: Number(raw.ratingAvg ?? raw.rating?.avg ?? 0) || 0,
    categoryKey: raw.category || null,
    categoryMeta,
    reasonKey,
    reasonLabel: getRecommendationReasonLabel(reasonKey, locale),
    score
  };
};

const serializeAgentCandidate = (agent: any, locale: AppLocale, score: number, reasonKey: RecommendationReasonKey): RecommendationItem => {
  const raw = toPlainObject(agent);
  const user = raw.user || {};
  const categoryMeta = buildCategoryMeta(raw.serviceCategory, locale, "services");
  return {
    entityType: "AGENT",
    entityId: String(raw._id),
    entityIdentifier: String(user._id || raw._id),
    title: user.name || user.username || "Agent",
    subtitle: categoryMeta?.displayName || getAgentKindLabel(raw.kind, locale),
    description: raw.serviceQualification || raw.serviceOfficeAddress || null,
    route: `/agents/${String(user._id || raw._id)}`,
    imageUrl: resolveAvatarUrl(user.avatarUrl, String(user._id || raw._id)),
    rating: Number(raw.rating || 0),
    categoryKey: raw.serviceCategory || null,
    categoryMeta,
    reasonKey,
    reasonLabel: getRecommendationReasonLabel(reasonKey, locale),
    score
  };
};

const serializeCourseCandidate = (course: any, locale: AppLocale, score: number, reasonKey: RecommendationReasonKey): RecommendationItem => {
  const raw = toPlainObject(course);
  const title = resolveLocalizedTextField(raw, "title", locale, raw.title || "");
  const description = resolveLocalizedTextField(raw, "description", locale, raw.description || "");
  const categoryMeta = buildCategoryMeta(raw.subcategory || raw.category, locale, "courses");
  return {
    entityType: "COURSE",
    entityId: String(raw._id),
    entityIdentifier: String(raw._id),
    title,
    subtitle: categoryMeta?.displayName || raw.format || null,
    description,
    route: `/education/${String(raw._id)}`,
    imageUrl: raw.images?.[0] || null,
    rating: Number(raw.agentRating || 0),
    categoryKey: raw.subcategory || raw.category || null,
    categoryMeta,
    reasonKey,
    reasonLabel: getRecommendationReasonLabel(reasonKey, locale),
    score
  };
};

const serializeGroupCandidate = (group: any, locale: AppLocale, score: number, reasonKey: RecommendationReasonKey): RecommendationItem => {
  const raw = toPlainObject(group);
  const title = resolveLocalizedTextField(raw, "title", locale, raw.title || "");
  const description = resolveLocalizedTextField(raw, "description", locale, raw.description || "");
  const categoryMeta = buildCategoryMeta(raw.category, locale, "community");
  return {
    entityType: "COMMUNITY_GROUP",
    entityId: String(raw._id),
    entityIdentifier: raw.slug || String(raw._id),
    title,
    subtitle: categoryMeta?.displayName || localizeKeywordList(raw.tags || [], locale).slice(0, 2).join(" · ") || null,
    description,
    route: `/community/${String(raw.slug || raw._id)}`,
    imageUrl: null,
    rating: Number(raw.rating || 0),
    categoryKey: raw.category || null,
    categoryMeta,
    reasonKey,
    reasonLabel: getRecommendationReasonLabel(reasonKey, locale),
    score
  };
};

const serializeNewsCandidate = (post: any, locale: AppLocale, score: number, reasonKey: RecommendationReasonKey): RecommendationItem => {
  const raw = toPlainObject(post);
  const title = resolveLocalizedTextField(raw, "title", locale, raw.title || "");
  const description =
    resolveLocalizedTextField(raw, "excerpt", locale, raw.excerpt || "") ||
    resolveLocalizedTextField(raw, "content", locale, raw.content || "") ||
    null;
  return {
    entityType: "NEWS",
    entityId: String(raw._id),
    entityIdentifier: raw.slug || String(raw._id),
    title,
    subtitle: raw.category || null,
    description,
    route: `/news/${String(raw.slug || raw._id)}`,
    imageUrl: raw.coverImage || null,
    categoryKey: raw.category || null,
    categoryMeta: null,
    reasonKey,
    reasonLabel: getRecommendationReasonLabel(reasonKey, locale),
    score
  };
};

const pickTopCategories = (profile: PreferenceProfile, fallbackCategory?: string | null) => {
  const ranked = Array.from(profile.categories.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([category]) => category)
    .filter(Boolean);
  if (fallbackCategory && !ranked.includes(fallbackCategory)) ranked.unshift(fallbackCategory);
  return ranked.slice(0, 4);
};

const loadPreferenceProfile = async (context: RecommendationContext) => {
  if (!context.userId && !context.sessionId) {
    return buildProfile([]);
  }
  const filter: Record<string, unknown> = {
    createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
  };
  if (context.userId && mongoose.Types.ObjectId.isValid(context.userId)) {
    filter.userId = toObjectId(context.userId);
  } else if (context.sessionId) {
    filter.sessionId = context.sessionId;
  }
  const signals = await RecommendationSignal.find(filter).sort({ createdAt: -1 }).limit(250).lean();
  return buildProfile(signals);
};

const fetchProductCandidates = async (context: RecommendationContext, profile: PreferenceProfile, reasonKey: RecommendationReasonKey) => {
  const categories = pickTopCategories(profile, context.categoryKey);
  const filter: Record<string, unknown> = { status: "ACTIVE" };
  if (categories.length) filter.category = { $in: categories };
  const docs = await Product.find(filter).sort({ orders: -1, views: -1, likeCount: -1, createdAt: -1 }).limit(36).lean();
  return docs
    .filter((doc) => String(doc._id) !== String(context.entityId || ""))
    .map((doc) => {
      const score = scoreCandidate({
        entityType: "PRODUCT",
        entityId: String(doc._id),
        categoryKey: doc.category,
        popularity: Number(doc.orders || 0) * 3 + Number(doc.views || 0) * 0.1 + Number(doc.likeCount || doc.likes || 0),
        rating: Number(doc.ratingAvg || 0),
        profile,
        reasonKey
      });
      return serializeProductCandidate(doc, normalizeLocale(context.locale), score, reasonKey);
    })
    .sort((left, right) => right.score - left.score);
};

const fetchServiceCandidates = async (context: RecommendationContext, profile: PreferenceProfile, reasonKey: RecommendationReasonKey) => {
  const categories = pickTopCategories(profile, context.categoryKey);
  const filter: Record<string, unknown> = {};
  if (categories.length) filter.category = { $in: categories };
  const docs = await Service.find(filter).sort({ orders: -1, views: -1, likes: -1, createdAt: -1 }).limit(36).lean();
  return docs
    .filter((doc) => String(doc._id) !== String(context.entityId || ""))
    .map((doc) => {
      const locationText = normalizeText(doc.location).toLowerCase();
      const expectedLocation = normalizeText(context.location || context.region).toLowerCase();
      const score = scoreCandidate({
        entityType: "SERVICE",
        entityId: String(doc._id),
        categoryKey: doc.category,
        popularity: Number(doc.orders || 0) * 3 + Number(doc.views || 0) * 0.1 + Number(doc.likes || 0),
        rating: Number(doc.ratingAvg || 0),
        profile,
        reasonKey,
        locationMatch: Boolean(expectedLocation && locationText && locationText.includes(expectedLocation))
      });
      return serializeServiceCandidate(doc, normalizeLocale(context.locale), score, reasonKey);
    })
    .sort((left, right) => right.score - left.score);
};

const fetchAgentCandidates = async (context: RecommendationContext, profile: PreferenceProfile, reasonKey: RecommendationReasonKey) => {
  const categories = pickTopCategories(profile, context.categoryKey);
  const docs = await AgentProfile.find(categories.length ? { serviceCategory: { $in: categories } } : {})
    .populate("user", "name username avatarUrl")
    .sort({ rating: -1, profileViews: -1, profileLikes: -1, verifiedByAdmin: -1 })
    .limit(24)
    .lean();
  return docs
    .filter((doc) => String((doc as any).user?._id || doc._id) !== String(context.entityId || ""))
    .map((doc) => {
      const score = scoreCandidate({
        entityType: "AGENT",
        entityId: String(doc._id),
        categoryKey: doc.serviceCategory || null,
        popularity: Number(doc.profileViews || 0) * 0.15 + Number(doc.profileLikes || 0) + (doc.verifiedByAdmin ? 15 : 0),
        rating: Number(doc.rating || 0),
        profile,
        reasonKey
      });
      return serializeAgentCandidate(doc, normalizeLocale(context.locale), score, reasonKey);
    })
    .sort((left, right) => right.score - left.score);
};

const fetchCourseCandidates = async (context: RecommendationContext, profile: PreferenceProfile, reasonKey: RecommendationReasonKey) => {
  const categories = pickTopCategories(profile, context.categoryKey);
  const filter: Record<string, unknown> = { status: "active" };
  if (categories.length) filter.$or = [{ category: { $in: categories } }, { subcategory: { $in: categories } }];
  const docs = await EducationListing.find(filter).sort({ studentsCount: -1, createdAt: -1 }).limit(24).lean();
  return docs
    .filter((doc) => String(doc._id) !== String(context.entityId || ""))
    .map((doc) => {
      const score = scoreCandidate({
        entityType: "COURSE",
        entityId: String(doc._id),
        categoryKey: doc.subcategory || doc.category,
        popularity: Number(doc.studentsCount || 0) * 0.25,
        profile,
        reasonKey
      });
      return serializeCourseCandidate(doc, normalizeLocale(context.locale), score, reasonKey);
    })
    .sort((left, right) => right.score - left.score);
};

const fetchGroupCandidates = async (context: RecommendationContext, profile: PreferenceProfile, reasonKey: RecommendationReasonKey) => {
  const categories = pickTopCategories(profile, context.categoryKey);
  const filter: Record<string, unknown> = { isActive: true };
  if (categories.length) filter.category = { $in: categories };
  const docs = await CommunityGroupModel.find(filter).sort({ members: -1, rating: -1, lastActivity: -1 }).limit(24).lean();
  return docs
    .filter((doc) => String(doc._id) !== String(context.entityId || ""))
    .map((doc) => {
      const score = scoreCandidate({
        entityType: "COMMUNITY_GROUP",
        entityId: String(doc._id),
        categoryKey: doc.category,
        popularity: Number(doc.members || 0) * 0.12 + (doc.isVerified ? 12 : 0),
        rating: Number(doc.rating || 0),
        profile,
        reasonKey
      });
      return serializeGroupCandidate(doc, normalizeLocale(context.locale), score, reasonKey);
    })
    .sort((left, right) => right.score - left.score);
};

const fetchNewsCandidates = async (context: RecommendationContext, profile: PreferenceProfile, reasonKey: RecommendationReasonKey) => {
  const docs = await NewsPost.find({ status: "published", isActive: true })
    .sort({ isFeatured: -1, views: -1, createdAt: -1 })
    .limit(12)
    .lean();
  return docs
    .filter((doc) => String(doc._id) !== String(context.entityId || ""))
    .map((doc) => {
      const localeLabel =
        normalizeLocale(context.locale) === "ko"
          ? "Korean"
          : normalizeLocale(context.locale) === "ru"
            ? "Russian"
            : normalizeLocale(context.locale) === "en"
              ? "English"
              : "Uzbek";
      const score = scoreCandidate({
        entityType: "NEWS",
        entityId: String(doc._id),
        categoryKey: doc.category,
        popularity: Number(doc.views || 0) * 0.1 + (doc.isFeatured ? 20 : 0),
        profile,
        reasonKey,
        localeMatch: doc.language === localeLabel
      });
      return serializeNewsCandidate(doc, normalizeLocale(context.locale), score, reasonKey);
    })
    .sort((left, right) => right.score - left.score);
};

const buildModule = (
  id: RecommendationModuleId,
  locale: AppLocale,
  items: RecommendationItem[],
  reasonKey?: RecommendationReasonKey | null
): RecommendationModule | null => {
  if (!items.length) return null;
  return {
    id,
    titleKey: `recommendations.${id}.title`,
    title: getRecommendationModuleTitle(id, locale),
    reasonKey: reasonKey || null,
    reasonLabel: reasonKey ? getRecommendationReasonLabel(reasonKey, locale) : null,
    items
  };
};

const pickTopItems = (items: RecommendationItem[], limit: number) =>
  items
    .filter((item, index, list) => list.findIndex((candidate) => candidate.entityType === item.entityType && candidate.entityId === item.entityId) === index)
    .slice(0, limit);

const buildHomeModules = async (context: RecommendationContext, profile: PreferenceProfile) => {
  const limit = context.limitPerModule || 6;
  const [products, services, agents, courses, groups] = await Promise.all([
    fetchProductCandidates(context, profile, profile.queryTerms.length ? "recent_searches" : "for_you"),
    fetchServiceCandidates(context, profile, context.location || context.region ? "popular_area" : "for_you"),
    fetchAgentCandidates(context, profile, "for_you"),
    fetchCourseCandidates(context, profile, "for_you"),
    fetchGroupCandidates(context, profile, "for_you")
  ]);

  return [
    buildModule("products_for_you", normalizeLocale(context.locale), pickTopItems(products, limit), products[0]?.reasonKey || "for_you"),
    buildModule("services_for_you", normalizeLocale(context.locale), pickTopItems(services, limit), services[0]?.reasonKey || "for_you"),
    buildModule("agents_for_you", normalizeLocale(context.locale), pickTopItems(agents, Math.min(limit, 4)), "for_you"),
    buildModule("courses_for_you", normalizeLocale(context.locale), pickTopItems(courses, Math.min(limit, 4)), "for_you"),
    buildModule("groups_for_you", normalizeLocale(context.locale), pickTopItems(groups, Math.min(limit, 4)), "for_you")
  ].filter(Boolean) as RecommendationModule[];
};

const buildDetailModules = async (context: RecommendationContext, profile: PreferenceProfile) => {
  const limit = context.limitPerModule || 6;
  const locale = normalizeLocale(context.locale);

  if (context.entityType === "PRODUCT") {
    const [relatedProducts, services, agents] = await Promise.all([
      fetchProductCandidates(context, profile, "related"),
      fetchServiceCandidates(context, profile, "also_viewed"),
      fetchAgentCandidates(context, profile, "also_viewed")
    ]);
    return [
      buildModule("related_products", locale, pickTopItems(relatedProducts, limit), "related"),
      buildModule("similar_services", locale, pickTopItems(services, Math.min(limit, 4)), "also_viewed"),
      buildModule("similar_agents", locale, pickTopItems(agents, Math.min(limit, 3)), "also_viewed")
    ].filter(Boolean) as RecommendationModule[];
  }

  if (context.entityType === "SERVICE" || context.entityType === "AGENT") {
    const [services, agents, groups] = await Promise.all([
      fetchServiceCandidates(context, profile, "related"),
      fetchAgentCandidates(context, profile, "also_viewed"),
      fetchGroupCandidates(context, profile, "popular_area")
    ]);
    return [
      buildModule("similar_services", locale, pickTopItems(services, limit), "related"),
      buildModule("similar_agents", locale, pickTopItems(agents, Math.min(limit, 4)), "also_viewed"),
      buildModule("groups_you_may_like", locale, pickTopItems(groups, Math.min(limit, 4)), "popular_area")
    ].filter(Boolean) as RecommendationModule[];
  }

  if (context.entityType === "COURSE") {
    const [courses, groups] = await Promise.all([
      fetchCourseCandidates(context, profile, "related"),
      fetchGroupCandidates(context, profile, "recent_searches")
    ]);
    return [
      buildModule("related_courses", locale, pickTopItems(courses, limit), "related"),
      buildModule("groups_you_may_like", locale, pickTopItems(groups, Math.min(limit, 4)), "recent_searches")
    ].filter(Boolean) as RecommendationModule[];
  }

  const [groups, news] = await Promise.all([
    fetchGroupCandidates(context, profile, "related"),
    fetchNewsCandidates(context, profile, "popular_area")
  ]);
  return [
    buildModule("groups_you_may_like", locale, pickTopItems(groups, limit), "related"),
    buildModule("popular_now", locale, pickTopItems(news, Math.min(limit, 4)), "popular_area")
  ].filter(Boolean) as RecommendationModule[];
};

const buildCartModules = async (context: RecommendationContext, profile: PreferenceProfile) => {
  const locale = normalizeLocale(context.locale);
  const productFilter = context.cartProductIds?.filter((value) => mongoose.Types.ObjectId.isValid(value)) || [];
  if (productFilter.length) {
    const cartProducts = await Product.find({ _id: { $in: productFilter.map((id) => toObjectId(id)) } }).select("category").lean();
    for (const product of cartProducts) {
      if (product.category) profile.categories.set(product.category, (profile.categories.get(product.category) || 0) + 4);
    }
  }
  const [products, services] = await Promise.all([
    fetchProductCandidates(context, profile, "for_you"),
    fetchServiceCandidates(context, profile, "popular_area")
  ]);
  return [
    buildModule("continue_shopping", locale, pickTopItems(products, context.limitPerModule || 6), "for_you"),
    buildModule("similar_services", locale, pickTopItems(services, Math.min(context.limitPerModule || 6, 4)), "popular_area")
  ].filter(Boolean) as RecommendationModule[];
};

const buildOrderSuccessModules = async (context: RecommendationContext, profile: PreferenceProfile) => {
  const locale = normalizeLocale(context.locale);
  const [products, services, groups] = await Promise.all([
    fetchProductCandidates(context, profile, "recent_searches"),
    fetchServiceCandidates(context, profile, "for_you"),
    fetchGroupCandidates(context, profile, "for_you")
  ]);
  return [
    buildModule("continue_shopping", locale, pickTopItems(products, context.limitPerModule || 6), "recent_searches"),
    buildModule("similar_services", locale, pickTopItems(services, Math.min(context.limitPerModule || 6, 4)), "for_you"),
    buildModule("groups_you_may_like", locale, pickTopItems(groups, Math.min(context.limitPerModule || 6, 4)), "for_you")
  ].filter(Boolean) as RecommendationModule[];
};

const buildModules = async (context: RecommendationContext, profile: PreferenceProfile) => {
  switch (context.surface) {
    case "DETAIL":
      return buildDetailModules(context, profile);
    case "CART":
    case "CHECKOUT":
      return buildCartModules(context, profile);
    case "ORDER_SUCCESS":
      return buildOrderSuccessModules(context, profile);
    case "HOME":
    default:
      return buildHomeModules(context, profile);
  }
};

export const recordRecommendationSignal = async (payload: {
  userId?: string | null;
  sessionId?: string | null;
  entityType: RecommendationEntityType;
  entityId?: string | null;
  entityIdentifier?: string | null;
  action: RecommendationSignalAction;
  queryText?: string | null;
  categoryKey?: string | null;
  subcategoryKey?: string | null;
  locale?: AppLocale | null;
  languagePreference?: string | null;
  region?: string | null;
  location?: string | null;
  weight?: number;
  metadata?: Record<string, unknown> | null;
}) => {
  const hasUserId = payload.userId && mongoose.Types.ObjectId.isValid(payload.userId);
  const entityId = payload.entityId && mongoose.Types.ObjectId.isValid(payload.entityId) ? toObjectId(payload.entityId) : null;
  return RecommendationSignal.create({
    userId: hasUserId ? toObjectId(String(payload.userId)) : null,
    sessionId: payload.sessionId || null,
    entityType: payload.entityType,
    entityId,
    entityIdentifier: payload.entityIdentifier || null,
    action: payload.action,
    queryText: payload.queryText || null,
    categoryKey: payload.categoryKey || null,
    subcategoryKey: payload.subcategoryKey || null,
    locale: normalizeLocale(payload.locale),
    languagePreference: payload.languagePreference || null,
    region: payload.region || null,
    location: payload.location || null,
    weight: Number.isFinite(Number(payload.weight)) ? Number(payload.weight) : SIGNAL_WEIGHTS[payload.action] || 1,
    metadata: payload.metadata || null
  });
};

export const buildRecommendationModules = async (context: RecommendationContext) => {
  const locale = normalizeLocale(context.locale);
  const cacheKey = buildCacheKey({ ...context, locale });
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.modules;

  const profile = await loadPreferenceProfile(context);
  const modules = await buildModules({ ...context, locale }, profile);

  memoryCache.set(cacheKey, { modules, expiresAt: Date.now() + SNAPSHOT_TTL_MS });
  await RecommendationSnapshot.findOneAndUpdate(
    { cacheKey },
    {
      $set: {
        surface: context.surface,
        locale,
        region: context.region || null,
        userId: context.userId && mongoose.Types.ObjectId.isValid(context.userId) ? toObjectId(context.userId) : null,
        sessionId: context.sessionId || null,
        entityType: context.entityType || null,
        entityId: context.entityId && mongoose.Types.ObjectId.isValid(context.entityId) ? toObjectId(context.entityId) : null,
        modules: modules.map((module) => ({
          id: module.id,
          titleKey: module.titleKey,
          reasonKey: module.reasonKey || null,
          items: module.items.map((item) => ({
            entityType: item.entityType,
            entityId: mongoose.Types.ObjectId.isValid(item.entityId) ? toObjectId(item.entityId) : null,
            entityIdentifier: item.entityIdentifier || null,
            score: item.score,
            reasonKey: item.reasonKey || null
          }))
        })),
        expiresAt: new Date(Date.now() + SNAPSHOT_TTL_MS)
      }
    },
    { upsert: true, new: true }
  );

  return modules;
};

export const buildRecommendationModulesSafe = async (
  context: RecommendationContext,
  loggerLabel = "buildRecommendationModulesSafe"
) => {
  if (mongoose.connection.readyState !== 1) {
    return [] as RecommendationModule[];
  }
  try {
    return await buildRecommendationModules(context);
  } catch (error) {
    console.error(`${loggerLabel} error`, error);
    return [] as RecommendationModule[];
  }
};
