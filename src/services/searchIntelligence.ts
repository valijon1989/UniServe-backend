import mongoose from "mongoose";
import { SearchHistory } from "../models/SearchHistory";
import { type AppLocale, SUPPORTED_LOCALES } from "../i18n";
import { buildCategoryMeta, listMarketplaceCategories } from "./categoryTaxonomy";

const normalizeText = (value: unknown) => String(value ?? "").trim();

export const normalizeSearchQuery = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokenizeSearchQuery = (value: unknown) =>
  normalizeSearchQuery(value)
    .split(/\s+/g)
    .filter(Boolean);

export const levenshteinDistance = (left: string, right: string) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const dp = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
  for (let row = 0; row <= left.length; row += 1) dp[row][0] = row;
  for (let col = 0; col <= right.length; col += 1) dp[0][col] = col;

  for (let row = 1; row <= left.length; row += 1) {
    for (let col = 1; col <= right.length; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1;
      dp[row][col] = Math.min(
        dp[row - 1][col] + 1,
        dp[row][col - 1] + 1,
        dp[row - 1][col - 1] + substitutionCost
      );
    }
  }

  return dp[left.length][right.length];
};

const TYPO_MAP: Record<string, string> = {
  transltion: "translation",
  transaltion: "translation",
  psycology: "psychology",
  psychlogy: "psychology",
  samsng: "samsung",
  samsumg: "samsung",
  consultng: "consulting",
  educaton: "education",
  cours: "course",
  courss: "course",
  koreean: "korean",
  korean: "korean",
  uzbekstan: "uzbekistan"
};

const SEARCH_INTENT_HINTS: Array<{ intent: string; patterns: RegExp[] }> = [
  { intent: "agent", patterns: [/\bagent\b/i, /\bmentor\b/i, /\bteacher\b/i, /\bcoach\b/i] },
  { intent: "course", patterns: [/\bcourse\b/i, /\bclass\b/i, /\blesson\b/i, /\btraining\b/i] },
  { intent: "community", patterns: [/\bgroup\b/i, /\bcommunity\b/i, /\bchannel\b/i] },
  { intent: "service", patterns: [/\bservice\b/i, /\btranslation\b/i, /\blegal\b/i, /\bpsychology\b/i] },
  { intent: "product", patterns: [/\bbuy\b/i, /\bphone\b/i, /\blaptop\b/i, /\bcamera\b/i] }
];

const lexiconCache = new Map<string, { expiresAt: number; values: string[] }>();
const LEXICON_TTL_MS = 10 * 60 * 1000;

const collectMarketplaceLexicon = (): string[] => {
  const values = new Set<string>();
  for (const locale of SUPPORTED_LOCALES) {
    for (const section of listMarketplaceCategories(locale)) {
      values.add(normalizeSearchQuery(section.displayName));
      for (const subcategory of section.subcategories) {
        values.add(normalizeSearchQuery(subcategory.displayName));
      }
    }
  }
  for (const term of Object.keys(TYPO_MAP)) values.add(normalizeSearchQuery(term));
  for (const term of Object.values(TYPO_MAP)) values.add(normalizeSearchQuery(term));
  return Array.from(values).filter(Boolean);
};

export const getSearchLexicon = () => {
  const cacheKey = "marketplace";
  const cached = lexiconCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.values;
  const values = collectMarketplaceLexicon();
  lexiconCache.set(cacheKey, { values, expiresAt: Date.now() + LEXICON_TTL_MS });
  return values;
};

export const detectSearchIntent = (query: string, categoryKey?: string | null) => {
  const normalized = normalizeSearchQuery(query);
  if (categoryKey) {
    const meta = buildCategoryMeta(categoryKey);
    if (meta?.mainCategory === "products") return "product";
    if (meta?.mainCategory === "services") return "service";
    if (meta?.mainCategory === "courses") return "course";
    if (meta?.mainCategory === "community") return "community";
  }
  for (const hint of SEARCH_INTENT_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(normalized))) return hint.intent;
  }
  return "marketplace";
};

export const rankTextMatch = (query: string, candidate: string) => {
  const normalizedQuery = normalizeSearchQuery(query);
  const normalizedCandidate = normalizeSearchQuery(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedQuery === normalizedCandidate) return 125;
  if (normalizedCandidate.startsWith(normalizedQuery)) return 100;
  if (normalizedCandidate.includes(normalizedQuery)) return 75;
  const queryTokens = tokenizeSearchQuery(normalizedQuery);
  const candidateTokens = tokenizeSearchQuery(normalizedCandidate);
  const matchedTokens = queryTokens.filter((token) => candidateTokens.some((candidateToken) => candidateToken.includes(token)));
  if (matchedTokens.length) return 35 + matchedTokens.length * 10;
  const distance = levenshteinDistance(normalizedQuery, normalizedCandidate);
  return distance <= 2 ? 25 - distance * 5 : 0;
};

export const suggestCorrectedQuery = (query: string) => {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return null;
  if (TYPO_MAP[normalized]) return TYPO_MAP[normalized];

  let bestValue: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of getSearchLexicon()) {
    if (!candidate) continue;
    const distance = levenshteinDistance(normalized, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestValue = candidate;
    }
  }

  if (bestValue && bestDistance <= Math.max(2, Math.floor(normalized.length / 4))) {
    return bestValue;
  }
  return null;
};

export const buildEmptySearchSuggestions = (query: string, locale?: AppLocale) => {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  const suggestions: Array<{ type: string; label: string; route: string | null }> = [];
  for (const section of listMarketplaceCategories(locale)) {
    const categoryScore = rankTextMatch(normalized, section.displayName);
    if (categoryScore > 0) {
      suggestions.push({ type: "category", label: section.displayName, route: section.route });
    }
    for (const subcategory of section.subcategories) {
      const subcategoryScore = Math.max(
        rankTextMatch(normalized, subcategory.displayName),
        rankTextMatch(normalized, `${section.displayName} ${subcategory.displayName}`)
      );
      if (subcategoryScore > 0) {
        suggestions.push({ type: "subcategory", label: subcategory.displayName, route: subcategory.route });
      }
    }
  }

  return suggestions.slice(0, 8);
};

const toObjectId = (value: string | mongoose.Types.ObjectId) =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

export const recordSearchHistory = async (payload: {
  userId: string | mongoose.Types.ObjectId;
  locale?: AppLocale | null;
  queryText: string;
  correctedQuery?: string | null;
  intent?: string | null;
  resultCount: number;
}) => {
  const normalizedQuery = normalizeSearchQuery(payload.queryText);
  if (!normalizedQuery) return null;

  return SearchHistory.findOneAndUpdate(
    {
      userId: toObjectId(payload.userId),
      normalizedQuery
    },
    {
      $set: {
        locale: payload.locale || null,
        queryText: normalizeText(payload.queryText),
        correctedQuery: payload.correctedQuery || null,
        intent: payload.intent || null,
        resultCount: Math.max(0, Number(payload.resultCount || 0)),
        lastSearchedAt: new Date()
      },
      $inc: { searchCount: 1 }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const listRecentSearchHistory = async (
  userId: string | mongoose.Types.ObjectId,
  locale?: AppLocale | null,
  limit = 8
) =>
  SearchHistory.find({
    userId: toObjectId(userId),
    ...(locale ? { locale } : {})
  })
    .sort({ lastSearchedAt: -1 })
    .limit(Math.max(1, Math.min(limit, 25)))
    .lean();

export const clearRecentSearchHistory = async (userId: string | mongoose.Types.ObjectId) =>
  SearchHistory.deleteMany({ userId: toObjectId(userId) });
