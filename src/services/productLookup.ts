import mongoose from "mongoose";
import { Product } from "../models/Product";

const normalizeIdentifier = (value: unknown) => String(value || "").trim();
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const LEGACY_PRODUCT_SLUG_MAP: Record<string, string> = {
  "pc-1": "office-pc",
  "pc-2": "mini-pc",
  "pc-3": "gaming-pc",
  "game-1": "gaming-pc",
  "mobile-1": "mobile-2",
  "mobile-3": "mobile-2",
  "kids-cloth-1": "kiyim-kechak-product-1",
  "ready-1": "tayyor-taom-box",
  "ready-2": "tayyor-salat",
  "ready-3": "tayyor-shorva",
  "cam-1": "camcorder-4k",
  "cam-3": "camcorder-4k",
  "frag-1": "atir",
  "skin-1": "yuz-kremi",
  "car-1": "sedan-2020",
  "carpart-1": "tormoz-diski",
  "tech-1": "notebook-i7",
  "vac-1": "chang-yutkich",
  "vac-2": "maishiy-uskunalar-product-1",
  "wash-1": "kir-yuvish-mashinasi",
  "oth-2": "oziq-ovqat-product-1",
  "men-1": "erkaklar-t-shirt",
  "women-1": "ayollar-bluzka"
};

const buildExactProductFilter = (identifier: string) => {
  const escaped = escapeRegExp(identifier);
  const titleCandidate = identifier.replace(/-/g, " ").trim();

  return {
    $or: [
      { slug: identifier.toLowerCase() },
      { title: { $regex: `^${escaped}$`, $options: "i" } },
      { title: titleCandidate }
    ]
  };
};

async function findProductByLegacyAlias(identifier: string) {
  const alias = LEGACY_PRODUCT_SLUG_MAP[identifier.toLowerCase()];
  if (!alias) return null;

  return await Product.findOne(buildExactProductFilter(alias));
}

const buildIdentifierTokens = (identifier: string): string[] =>
  identifier
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token && !/^\d+$/.test(token));

const inferLegacyCategory = (tokens: string[]): string | null => {
  if (!tokens.length) return null;
  const joined = tokens.join(" ");
  if (tokens.includes("vac") || joined.includes("vacuum")) return "maishiy-uskunalar";
  if (tokens.includes("kids") || tokens.includes("cloth") || joined.includes("clothes")) return "kiyim-kechak";
  if (tokens.includes("mobile") || tokens.includes("ready") || tokens.includes("oth") || tokens.includes("food")) {
    return "oziq-ovqat";
  }
  if (
    tokens.includes("pc") ||
    tokens.includes("game") ||
    tokens.includes("cam") ||
    tokens.includes("tv") ||
    tokens.includes("monitor") ||
    joined.includes("tech") ||
    joined.includes("smart tv")
  ) {
    return "elektronika";
  }
  return null;
};

async function findProductByLegacyIdentifier(identifier: string) {
  const byAlias = await findProductByLegacyAlias(identifier);
  if (byAlias) return byAlias;

  const tokens = buildIdentifierTokens(identifier);
  if (!tokens.length) return null;
  const pattern = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (!pattern) return null;

  const candidates = await Product.find({
    $or: [{ slug: { $regex: pattern, $options: "i" } }, { title: { $regex: pattern, $options: "i" } }]
  })
    .sort({ createdAt: -1 })
    .limit(20);

  if (candidates.length) {
    const scored = candidates
      .map((item) => {
        const haystack = `${String(item.slug || "")} ${String(item.title || "")}`.toLowerCase();
        const score = tokens.reduce((acc, token) => (haystack.includes(token) ? acc + 1 : acc), 0);
        return { item, score };
      })
      .sort((a, b) => b.score - a.score);

    if (scored[0]?.score > 0) return scored[0].item;
  }

  const inferredCategory = inferLegacyCategory(tokens);
  if (inferredCategory) {
    const byCategory = await Product.findOne({ category: inferredCategory, status: "ACTIVE" }).sort({ createdAt: -1 });
    if (byCategory) return byCategory;
  }

  return await Product.findOne({ status: "ACTIVE" }).sort({ createdAt: -1 });
}

export const findProductByIdentifier = async (identifier: unknown) => {
  const raw = normalizeIdentifier(identifier);
  if (!raw) return null;

  if (mongoose.Types.ObjectId.isValid(raw)) {
    const byId = await Product.findById(raw);
    if (byId) return byId;
  }

  let product = await Product.findOne(buildExactProductFilter(raw));

  if (!product) {
    product = await findProductByLegacyIdentifier(raw);
  }

  return product;
};

export const findStrictProductByIdentifier = async (identifier: unknown) => {
  const raw = normalizeIdentifier(identifier);
  if (!raw) return null;

  if (mongoose.Types.ObjectId.isValid(raw)) {
    const byId = await Product.findById(raw);
    if (byId) return byId;
    return null;
  }

  const exact = await Product.findOne(buildExactProductFilter(raw));
  if (exact) return exact;

  return await findProductByLegacyAlias(raw);
};

export const normalizePurchasableProductId = (product: { _id?: unknown; id?: unknown }) =>
  String(product?._id || product?.id || "").trim();
