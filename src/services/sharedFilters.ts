import type { Request } from "express";
import { buildFilterUiSchema, listMarketplaceSortOptions } from "./marketplaceUiCatalog";
import { buildCategoryMeta, normalizeMarketplaceCategory } from "./categoryTaxonomy";

const normalizeText = (value: unknown) => String(value ?? "").trim();

const parseNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export type ListingSurface = "products" | "services" | "courses";

export const PRODUCT_FILTER_KEYS = [
  "category",
  "subcategory",
  "brand",
  "price",
  "rating",
  "stock",
  "condition",
  "delivery",
  "location",
  "verification"
] as const;

export const SERVICE_FILTER_KEYS = [
  "category",
  "subcategory",
  "price",
  "rating",
  "language",
  "experience",
  "availability",
  "location",
  "verification"
] as const;

export const COURSE_FILTER_KEYS = [
  "category",
  "subcategory",
  "format",
  "level",
  "schedule",
  "certificate",
  "language",
  "price"
] as const;

export const buildListingFilterSchema = (
  surface: ListingSurface,
  locale?: Request["locale"],
  categoryKey?: string | null
) => {
  const baseKeys =
    surface === "products"
      ? [...PRODUCT_FILTER_KEYS]
      : surface === "services"
        ? [...SERVICE_FILTER_KEYS]
        : [...COURSE_FILTER_KEYS];

  const normalizedCategory = normalizeMarketplaceCategory(categoryKey, surface === "courses" ? "courses" : surface);
  const extraVerticalKeys =
    normalizedCategory === "translation"
      ? ["language", "delivery_time"]
      : normalizedCategory === "legal_services" || normalizedCategory === "legal"
        ? ["jurisdiction", "format", "privacy"]
        : normalizedCategory === "psychology"
          ? ["format", "language", "time"]
          : normalizedCategory === "sport_coaching" || normalizedCategory === "sport"
            ? ["level", "format", "location"]
            : [];

  return buildFilterUiSchema(Array.from(new Set([...baseKeys, ...extraVerticalKeys])), locale);
};

export const buildAppliedFilters = (req: Request) => {
  const query = req.query;
  const filters = [
    ["category", normalizeMarketplaceCategory(query.category)],
    ["subcategory", normalizeText(query.subcategory ?? query.subCategory)],
    ["brand", normalizeText(query.brand)],
    ["condition", normalizeText(query.condition)],
    ["location", normalizeText(query.location)],
    ["language", normalizeText(query.language)],
    ["availability", normalizeText(query.availability)],
    ["format", normalizeText(query.format)],
    ["level", normalizeText(query.level)],
    ["schedule", normalizeText(query.schedule)],
    ["certificate", normalizeText(query.certificate)],
    ["delivery", normalizeText(query.delivery)],
    ["stock", normalizeText(query.stock || query.availability)],
    ["verification", normalizeText(query.verification || query.verified)],
    ["minPrice", parseNumber(query.minPrice ?? query.priceMin)],
    ["maxPrice", parseNumber(query.maxPrice ?? query.priceMax)],
    ["rating", parseNumber(query.rating ?? query.minRating)]
  ]
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => ({
      key,
      value
    }));

  return filters;
};

export const buildListingUiMeta = (
  req: Request,
  surface: ListingSurface,
  options?: { categoryKey?: string | null; resultCount?: number; sortValue?: string | null }
) => {
  const categoryMeta = options?.categoryKey
    ? buildCategoryMeta(options.categoryKey, req.locale, surface === "courses" ? "courses" : surface)
    : null;
  return {
    resultCount: Number(options?.resultCount || 0),
    categoryMeta,
    appliedFilters: buildAppliedFilters(req),
    filterSchema: buildListingFilterSchema(surface, req.locale, options?.categoryKey || null),
    sortOptions: listMarketplaceSortOptions(req.locale),
    sortValue: normalizeText(options?.sortValue || req.query.sort || "newest") || "newest"
  };
};
