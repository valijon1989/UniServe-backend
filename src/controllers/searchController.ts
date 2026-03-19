import { Request, Response } from "express";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { AgentProfile } from "../models/AgentProfile";
import { EducationListing } from "../models/EducationListing";
import { CommunityGroupModel } from "../models/CommunityGroup";
import { NewsPost } from "../models/NewsPost";
import { Post } from "../models/Post";
import { resolveAvatarUrl } from "../utils/avatarImage";
import { attachServiceCover } from "./serviceController";
import { formatPost } from "./posts.controller";
import { buildCategoryMeta, listMarketplaceCategories, normalizeMarketplaceCategory } from "../services/categoryTaxonomy";
import { getAgentKindLabel, resolveLocalizedTextField } from "../services/localizedContent";
import { getUiIconSpec, UI_ICON_LIBRARY } from "../services/marketplaceUiCatalog";
import {
  buildProductCardContext,
  PRODUCT_CARD_SELECT,
  serializeProductCards
} from "../services/productCard";
import {
  buildEmptySearchSuggestions,
  clearRecentSearchHistory,
  detectSearchIntent,
  listRecentSearchHistory,
  normalizeSearchQuery,
  rankTextMatch,
  recordSearchHistory,
  suggestCorrectedQuery
} from "../services/searchIntelligence";
import { recordRecommendationSignal } from "../services/recommendationEngine";
import { t } from "../i18n";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeText = (value: unknown) => String(value ?? "").trim();

const buildLocalizedRegexClauses = (fields: string[], regex: RegExp) => {
  const clauses: Array<Record<string, RegExp>> = [];
  for (const field of fields) {
    clauses.push({ [field]: regex });
    clauses.push({ [`${field}I18n.uz`]: regex });
    clauses.push({ [`${field}I18n.ru`]: regex });
    clauses.push({ [`${field}I18n.en`]: regex });
    clauses.push({ [`${field}I18n.ko`]: regex });
  }
  return clauses;
};

const SEARCH_SECTION_LABELS = {
  products: { uz: "Mahsulotlar", ru: "Товары", en: "Products", ko: "상품" },
  services: { uz: "Xizmatlar", ru: "Услуги", en: "Services", ko: "서비스" },
  agents: { uz: "Agentlar", ru: "Агенты", en: "Agents", ko: "에이전트" },
  courses: { uz: "Kurslar", ru: "Курсы", en: "Courses", ko: "강좌" },
  categories: { uz: "Kategoriyalar", ru: "Категории", en: "Categories", ko: "카테고리" },
  community: { uz: "Jamiyat", ru: "Сообщество", en: "Community", ko: "커뮤니티" },
  news: { uz: "Yangiliklar", ru: "Новости", en: "News", ko: "뉴스" }
} as const;

const getSearchSectionLabel = (key: keyof typeof SEARCH_SECTION_LABELS, locale?: Request["locale"]) =>
  SEARCH_SECTION_LABELS[key][locale || "uz"];

const parseNumberQuery = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const serializeAgentSearch = (agent: any, locale?: Request["locale"]) => {
  const serviceCategoryMeta = buildCategoryMeta(agent.serviceCategory, locale, "services");
  return {
    _id: String(agent._id),
    type: "agent",
    title: agent.user?.name || agent.user?.username || "Agent",
    subtitle: serviceCategoryMeta?.displayName || null,
    kind: agent.kind,
    kindLabel: getAgentKindLabel(agent.kind, locale),
    serviceCategory: agent.serviceCategory || null,
    serviceCategoryMeta,
    rating: Number(agent.rating || 0),
    verifiedByAdmin: Boolean(agent.verifiedByAdmin),
    avatarUrl: resolveAvatarUrl(agent.user?.avatarUrl, agent.user?._id || agent._id),
    route: `/agents/${String(agent.user?._id || agent._id)}`,
    icon: getUiIconSpec("agents", locale)
  };
};

const serializeCourseSearch = (listing: any, locale?: Request["locale"]) => {
  const categoryMeta = buildCategoryMeta(listing.subcategory || listing.category, locale, "courses");
  return {
    _id: String(listing._id),
    type: "course",
    title: resolveLocalizedTextField(listing, "title", locale, listing.title || ""),
    subtitle: categoryMeta?.displayName || listing.format || null,
    route: `/education/${String(listing._id)}`,
    icon: getUiIconSpec("courses", locale)
  };
};

const serializeCommunityGroupSearch = (group: any, locale?: Request["locale"]) => {
  const categoryMeta = buildCategoryMeta(group.category, locale, "community");
  return {
    _id: String(group._id),
    type: "group",
    title: resolveLocalizedTextField(group, "title", locale, group.title || ""),
    subtitle: categoryMeta?.displayName || null,
    route: `/community/${String(group.slug || group._id)}`,
    icon: getUiIconSpec("community", locale)
  };
};

const serializeNewsSearch = (post: any, locale?: Request["locale"]) => ({
  _id: String(post._id),
  type: "news",
  title: resolveLocalizedTextField(post, "title", locale, post.title || ""),
  subtitle: normalizeText(post.category) || null,
  route: `/news/${String(post.slug || post._id)}`,
  icon: getUiIconSpec("community", locale)
});

const pushSuggestion = (
  target: any[],
  seen: Set<string>,
  query: string,
  item: {
    type: string;
    text: string;
    subtitle?: string | null;
    route?: string | null;
    icon: any;
  }
) => {
  const text = normalizeText(item.text);
  if (!text) return;
  const key = `${item.type}:${text.toLowerCase()}`;
  if (seen.has(key)) return;
  const score = Math.max(rankTextMatch(query, text), item.subtitle ? rankTextMatch(query, item.subtitle) - 10 : 0);
  if (!score) return;
  seen.add(key);
  target.push({
    ...item,
    score
  });
};

const applySharedFilters = (req: Request, items: any[], type: string) => {
  const ratingMin = parseNumberQuery(req.query.rating);
  const location = normalizeText(req.query.location).toLowerCase();
  const priceMin = parseNumberQuery(req.query.priceMin ?? req.query.minPrice);
  const priceMax = parseNumberQuery(req.query.priceMax ?? req.query.maxPrice);

  return items.filter((item) => {
    const rating = Number(item.trust?.ratingAverage ?? item.ratingAvg ?? item.rating ?? 0);
    const price = Number(item.pricing?.currentPrice ?? item.price ?? item.salePrice ?? item.hourlyRate ?? 0);
    const itemLocation = normalizeText(
      item.location ||
        item.subtitle ||
        item.display?.subtitle ||
        item.display?.values?.subcategory ||
        item.display?.values?.category
    ).toLowerCase();
    if (ratingMin !== null && rating < ratingMin) return false;
    if (location && !itemLocation.includes(location)) return false;
    if ((type === "product" || type === "service" || type === "course") && priceMin !== null && price < priceMin) return false;
    if ((type === "product" || type === "service" || type === "course") && priceMax !== null && price > priceMax) return false;
    return true;
  });
};

const selectSearchType = (requestedType: string, intent: string) => {
  const normalized = normalizeText(requestedType).toLowerCase();
  if (normalized) return normalized;
  return intent === "marketplace" ? "" : intent;
};

export const searchSuggestions = async (req: Request, res: Response) => {
  try {
    const rawQuery = normalizeText(req.query.q);
    if (!rawQuery) return res.status(400).json({ message: t(req, "search.validation.query_required.message") });

    const correctedQuery = suggestCorrectedQuery(rawQuery);
    const activeQuery = correctedQuery && correctedQuery !== normalizeSearchQuery(rawQuery) ? correctedQuery : rawQuery;
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const regex = new RegExp(escapeRegex(activeQuery), "i");
    const suggestions: any[] = [];
    const seen = new Set<string>();

    const categories = listMarketplaceCategories(req.locale);
    for (const category of categories) {
      pushSuggestion(suggestions, seen, activeQuery, {
        type: "category",
        text: category.displayName,
        subtitle: null,
        route: category.route,
        icon: getUiIconSpec(category.slug as any, req.locale, category.displayName)
      });
      for (const subcategory of category.subcategories) {
        pushSuggestion(suggestions, seen, activeQuery, {
          type: "subcategory",
          text: subcategory.displayName,
          subtitle: category.displayName,
          route: subcategory.route,
          icon: getUiIconSpec("subcategory", req.locale, subcategory.displayName)
        });
      }
    }

    const [products, services, agents, courses, groups, posts, news] = await Promise.all([
      Product.find({
        status: "ACTIVE",
        $or: buildLocalizedRegexClauses(["title", "description"], regex).concat([{ category: regex }])
      })
        .select(PRODUCT_CARD_SELECT)
        .limit(limit)
        .lean(),
      Service.find({ $or: buildLocalizedRegexClauses(["title", "description"], regex).concat([{ category: regex }, { location: regex }]) })
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl")
        .lean(),
      AgentProfile.find({
        $or: [{ socialServices: regex }, { materialServices: regex }, { serviceCategory: regex }, { serviceQualification: regex }]
      })
        .limit(limit)
        .populate("user", "name username avatarUrl")
        .lean(),
      EducationListing.find({
        $or: buildLocalizedRegexClauses(["title", "description"], regex).concat([
          { category: regex },
          { subcategory: regex },
          { languageOfInstruction: regex }
        ])
      })
        .limit(limit)
        .lean(),
      CommunityGroupModel.find({
        $or: buildLocalizedRegexClauses(["title", "description"], regex).concat([{ category: regex }, { tags: regex }])
      })
        .limit(limit)
        .lean(),
      Post.find({
        $or: buildLocalizedRegexClauses(["title", "text", "content", "excerpt"], regex).concat([{ category: regex }, { type: regex }])
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("author", "name username avatarUrl")
        .lean(),
      NewsPost.find({
        $or: buildLocalizedRegexClauses(["title", "excerpt", "content"], regex).concat([{ category: regex }, { type: regex }])
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
    ]);

    const productSuggestionCards = serializeProductCards(products, req.locale);
    for (let index = 0; index < products.length; index += 1) {
      const product = products[index];
      const dto = productSuggestionCards[index];
      pushSuggestion(suggestions, seen, activeQuery, {
        type: "product",
        text: dto.display.title,
        subtitle: dto.display.values.subcategory || dto.display.values.category,
        route: `/products/${String(product.slug || product._id)}`,
        icon: getUiIconSpec("products", req.locale)
      });
    }

    for (const service of services) {
      const dto = attachServiceCover(service, req.locale);
      pushSuggestion(suggestions, seen, activeQuery, {
        type: "service",
        text: dto.title,
        subtitle: dto.categoryMeta?.displayName || dto.location || null,
        route: `/services/${String(service.slug || service._id)}`,
        icon: getUiIconSpec("services", req.locale)
      });
    }

    for (const agent of agents) {
      const dto = serializeAgentSearch(agent, req.locale);
      pushSuggestion(suggestions, seen, activeQuery, {
        type: "agent",
        text: dto.title,
        subtitle: dto.subtitle,
        route: dto.route,
        icon: dto.icon
      });
    }

    for (const course of courses) {
      const dto = serializeCourseSearch(course, req.locale);
      pushSuggestion(suggestions, seen, activeQuery, {
        type: "course",
        text: dto.title,
        subtitle: dto.subtitle,
        route: dto.route,
        icon: dto.icon
      });
    }

    for (const group of groups) {
      const dto = serializeCommunityGroupSearch(group, req.locale);
      pushSuggestion(suggestions, seen, activeQuery, {
        type: "group",
        text: dto.title,
        subtitle: dto.subtitle,
        route: dto.route,
        icon: dto.icon
      });
    }

    for (const post of posts) {
      const dto = formatPost(post, { locale: req.locale });
      pushSuggestion(suggestions, seen, activeQuery, {
        type: "post",
        text: dto.title || dto.text,
        subtitle: dto.categoryLabel || dto.typeLabel || null,
        route: `/posts/${String(post.slug || post._id)}`,
        icon: getUiIconSpec("community", req.locale)
      });
    }

    for (const newsItem of news) {
      const dto = serializeNewsSearch(newsItem, req.locale);
      pushSuggestion(suggestions, seen, activeQuery, {
        type: "news",
        text: dto.title,
        subtitle: dto.subtitle,
        route: dto.route,
        icon: dto.icon
      });
    }

    suggestions.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));

    return res.json({
      success: true,
      query: rawQuery,
      correctedQuery: correctedQuery && correctedQuery !== normalizeSearchQuery(rawQuery) ? correctedQuery : null,
      limit,
      iconLibrary: UI_ICON_LIBRARY,
      items: suggestions.slice(0, limit)
    });
  } catch (err) {
    console.error("searchSuggestions error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const globalSearch = async (req: Request, res: Response) => {
  try {
    const rawQuery = normalizeText(req.query.q);
    if (!rawQuery) return res.status(400).json({ message: t(req, "search.validation.query_required.message") });

    const correctedQuery = suggestCorrectedQuery(rawQuery);
    const activeQuery = correctedQuery && correctedQuery !== normalizeSearchQuery(rawQuery) ? correctedQuery : rawQuery;
    const regex = new RegExp(escapeRegex(activeQuery), "i");
    const limit = Math.min(Number(req.query.limit) || 8, 30);
    const categoryQuery = normalizeMarketplaceCategory(req.query.category || req.query.categoryKey);
    const intent = detectSearchIntent(activeQuery, categoryQuery || null);
    const selectedType = selectSearchType(String(req.query.type || ""), intent);

    const productFilter: Record<string, unknown> = {
      status: "ACTIVE",
      $or: buildLocalizedRegexClauses(["title", "description"], regex).concat([{ category: regex }])
    };
    const serviceFilter: Record<string, unknown> = {
      $or: buildLocalizedRegexClauses(["title", "description"], regex).concat([{ category: regex }, { location: regex }])
    };
    const courseFilter: Record<string, unknown> = {
      $or: buildLocalizedRegexClauses(["title", "description"], regex).concat([
        { category: regex },
        { subcategory: regex },
        { languageOfInstruction: regex }
      ])
    };
    const communityFilter: Record<string, unknown> = {
      $or: buildLocalizedRegexClauses(["title", "description"], regex).concat([{ category: regex }, { tags: regex }])
    };
    const postFilter: Record<string, unknown> = {
      $or: buildLocalizedRegexClauses(["title", "text", "content", "excerpt"], regex).concat([{ category: regex }, { type: regex }])
    };
    const newsFilter: Record<string, unknown> = {
      $or: buildLocalizedRegexClauses(["title", "excerpt", "content"], regex).concat([{ category: regex }, { type: regex }]),
      status: "published",
      isActive: true
    };
    if (categoryQuery && categoryQuery !== "products") {
      productFilter.category = categoryQuery;
      serviceFilter.category = categoryQuery;
      courseFilter.$or = [{ category: categoryQuery }, { subcategory: categoryQuery }];
      communityFilter.category = categoryQuery;
    }

    const [products, services, agents, courses, groups, posts, news] = await Promise.all([
      selectedType && selectedType !== "product"
        ? Promise.resolve([])
        : Product.find(productFilter).select(PRODUCT_CARD_SELECT).limit(limit).lean(),
      selectedType && selectedType !== "service"
        ? Promise.resolve([])
        : Service.find(serviceFilter).limit(limit).populate("createdBy", "name username role avatarUrl").lean(),
      selectedType && selectedType !== "agent"
        ? Promise.resolve([])
        : AgentProfile.find({
            $or: [{ socialServices: regex }, { materialServices: regex }, { serviceCategory: regex }, { serviceQualification: regex }]
          })
            .sort({ rating: -1, profileViews: -1 })
            .limit(limit)
            .populate("user", "name username avatarUrl")
            .lean(),
      selectedType && selectedType !== "course"
        ? Promise.resolve([])
        : EducationListing.find(courseFilter).sort({ studentsCount: -1, createdAt: -1 }).limit(limit).lean(),
      selectedType && !["community", "group"].includes(selectedType)
        ? Promise.resolve([])
        : CommunityGroupModel.find(communityFilter).sort({ members: -1, rating: -1 }).limit(limit).lean(),
      selectedType && !["post", "community"].includes(selectedType)
        ? Promise.resolve([])
        : Post.find(postFilter).sort({ createdAt: -1 }).limit(limit).populate("author", "name username avatarUrl").lean(),
      selectedType && selectedType !== "news"
        ? Promise.resolve([])
        : NewsPost.find(newsFilter).sort({ isFeatured: -1, views: -1, createdAt: -1 }).limit(limit).lean()
    ]);

    const productContext = await buildProductCardContext(products, req.user?._id || null);
    const productDtos = applySharedFilters(req, serializeProductCards(products, req.locale, productContext), "product");
    const serviceDtos = applySharedFilters(req, services.map((service) => attachServiceCover(service, req.locale)), "service");
    const agentDtos = applySharedFilters(req, agents.map((agent) => serializeAgentSearch(agent, req.locale)), "agent");
    const courseDtos = applySharedFilters(req, courses.map((course) => serializeCourseSearch(course, req.locale)), "course");
    const groupDtos = groups.map((group) => serializeCommunityGroupSearch(group, req.locale));
    const postDtos = posts.map((post) => formatPost(post, { locale: req.locale }));
    const newsDtos = news.map((item) => serializeNewsSearch(item, req.locale));

    const categoryMatches = listMarketplaceCategories(req.locale)
      .flatMap((section) => [
        { type: "category", label: section.displayName, slug: section.slug, route: section.route },
        ...section.subcategories.map((subcategory) => ({
          type: "subcategory",
          label: subcategory.displayName,
          slug: subcategory.slug,
          route: subcategory.route,
          parent: section.displayName
        }))
      ])
      .filter((item) => rankTextMatch(activeQuery, item.label) > 0)
      .slice(0, 8);

    const totalResults =
      productDtos.length +
      serviceDtos.length +
      agentDtos.length +
      courseDtos.length +
      groupDtos.length +
      postDtos.length +
      newsDtos.length +
      categoryMatches.length;

    if (req.user?._id) {
      await Promise.all([
        recordSearchHistory({
          userId: req.user._id,
          locale: req.locale,
          queryText: rawQuery,
          correctedQuery: correctedQuery && correctedQuery !== normalizeSearchQuery(rawQuery) ? correctedQuery : null,
          intent,
          resultCount: totalResults
        }),
        recordRecommendationSignal({
          userId: req.user._id,
          entityType: "QUERY",
          action: "SEARCH",
          queryText: rawQuery,
          locale: req.locale,
          categoryKey: categoryQuery || null,
          weight: 2,
          metadata: {
            correctedQuery: correctedQuery && correctedQuery !== normalizeSearchQuery(rawQuery) ? correctedQuery : null,
            resultCount: totalResults,
            intent
          }
        })
      ]);
    }

    return res.json({
      success: true,
      query: rawQuery,
      correctedQuery: correctedQuery && correctedQuery !== normalizeSearchQuery(rawQuery) ? correctedQuery : null,
      didYouMean:
        correctedQuery && correctedQuery !== normalizeSearchQuery(rawQuery) && totalResults === 0 ? correctedQuery : null,
      intent,
      total: totalResults,
      sections: [
        { key: "products", label: getSearchSectionLabel("products", req.locale), count: productDtos.length },
        { key: "services", label: getSearchSectionLabel("services", req.locale), count: serviceDtos.length },
        { key: "agents", label: getSearchSectionLabel("agents", req.locale), count: agentDtos.length },
        { key: "courses", label: getSearchSectionLabel("courses", req.locale), count: courseDtos.length },
        { key: "categories", label: getSearchSectionLabel("categories", req.locale), count: categoryMatches.length },
        { key: "community", label: getSearchSectionLabel("community", req.locale), count: groupDtos.length + postDtos.length },
        { key: "news", label: getSearchSectionLabel("news", req.locale), count: newsDtos.length }
      ],
      categories: categoryMatches,
      products: productDtos,
      services: serviceDtos,
      agents: agentDtos,
      courses: courseDtos,
      groups: groupDtos,
      posts: postDtos,
      news: newsDtos,
      suggestions: totalResults === 0 ? buildEmptySearchSuggestions(activeQuery, req.locale) : []
    });
  } catch (err) {
    console.error("globalSearch error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const getSearchHistory = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const items = await listRecentSearchHistory(req.user._id, req.locale, Math.min(Number(req.query.limit) || 8, 20));
    return res.json({
      items: items.map((item) => ({
        id: String(item._id),
        queryText: item.queryText,
        correctedQuery: item.correctedQuery || null,
        intent: item.intent || null,
        resultCount: item.resultCount,
        searchCount: item.searchCount,
        lastSearchedAt: item.lastSearchedAt
      }))
    });
  } catch (err) {
    console.error("getSearchHistory error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const clearSearchHistoryHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    await clearRecentSearchHistory(req.user._id);
    return res.json({ success: true });
  } catch (err) {
    console.error("clearSearchHistoryHandler error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
