import mongoose from "mongoose";
import { Service } from "../models/Service";

const LEGACY_SERVICE_SLUG_MAP: Record<string, string> = {
  "build-brick-1": "construction-service-1",
  "build-brick-2": "construction-service-2",
  "taxi-limuzin-1-1-v9": "seed-airport-delivery-support",
  "taxi-limuzin-1-1": "seed-airport-delivery-support",
  "taxi-limuzin-1-2-v10": "seed-airport-delivery-support",
  "taxi-limuzin-1-2": "seed-airport-delivery-support",
  "taxi-limuzin-2-1-v11": "seed-airport-delivery-support",
  "taxi-limuzin-2-1": "seed-airport-delivery-support"
};

const normalizeIdentifier = (value: unknown) => String(value || "").trim();

const stripVersionSuffix = (identifier: string) => identifier.replace(/-v\d+$/i, "");

const buildIdentifierTokens = (identifier: string): string[] =>
  identifier
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token && !/^\d+$/.test(token) && !/^v\d+$/i.test(token));

const inferServiceFallback = (tokens: string[]) => {
  const tokenSet = new Set(tokens);
  const hasAny = (values: string[]) => values.some((value) => tokenSet.has(value));

  if (hasAny(["taxi", "limuzin", "delivery", "moving", "logistics", "cargo", "courier", "freight", "transport"])) {
    return { category: "Delivery", kind: "MATERIAL" as const };
  }

  if (hasAny(["translation", "document", "translator", "localization", "interpretation"])) {
    return { category: "Translation", kind: "SOCIAL" as const };
  }

  if (hasAny(["language", "korean", "english", "teaching", "education", "course", "tutor", "learning"])) {
    return { category: "Language teaching", kind: "SOCIAL" as const };
  }

  if (hasAny(["technical", "construction", "cleaning"])) {
    return { kind: "MATERIAL" as const };
  }

  if (hasAny(["consulting", "consult", "psychology", "legal", "sport", "marketing", "employment", "nanny"])) {
    return { kind: "SOCIAL" as const };
  }

  return null;
};

async function findServiceByInferredFallback(tokens: string[]) {
  const inferred = inferServiceFallback(tokens);
  if (!inferred) return null;

  const filters: Record<string, unknown> = {};
  if (inferred.kind) filters.kind = inferred.kind;
  if (inferred.category) {
    filters.category = {
      $regex: `^${String(inferred.category).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i"
    };
  }

  let service = await Service.findOne(filters)
    .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
    .populate("createdBy", "name username role avatarUrl");

  if (!service && inferred.kind) {
    service = await Service.findOne({ kind: inferred.kind })
      .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
      .populate("createdBy", "name username role avatarUrl");
  }

  if (!service) {
    service = await Service.findOne({})
      .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
      .populate("createdBy", "name username role avatarUrl");
  }

  return service;
}

async function findServiceByLegacyIdentifier(identifier: string) {
  const alias = LEGACY_SERVICE_SLUG_MAP[identifier.toLowerCase()];
  if (alias) {
    const aliasTitle = alias.replace(/-/g, " ").trim();
    const byAlias = await Service.findOne({
      $or: [
        { slug: alias },
        { title: { $regex: `^${aliasTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }
      ]
    }).populate("createdBy", "name username role avatarUrl");
    if (byAlias) return byAlias;
  }

  const tokens = buildIdentifierTokens(identifier);
  if (!tokens.length) return null;
  const pattern = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (!pattern) return null;

  const candidates = await Service.find({
    $or: [{ slug: { $regex: pattern, $options: "i" } }, { title: { $regex: pattern, $options: "i" } }]
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("createdBy", "name username role avatarUrl");

  if (!candidates.length) {
    return findServiceByInferredFallback(tokens);
  }

  const scored = candidates
    .map((item) => {
      const haystack = `${String(item.slug || "")} ${String(item.title || "")} ${String(item.category || "")}`.toLowerCase();
      const score = tokens.reduce((acc, token) => (haystack.includes(token) ? acc + 1 : acc), 0);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) return scored[0].item;

  return findServiceByInferredFallback(tokens);
}

export async function findServiceByIdentifier(identifier: string) {
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return null;
  const withoutVersion = stripVersionSuffix(normalized);

  const escaped = withoutVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const titleCandidate = withoutVersion.replace(/-/g, " ").trim();

  let service = mongoose.Types.ObjectId.isValid(withoutVersion)
    ? await Service.findById(withoutVersion).populate("createdBy", "name username role avatarUrl")
    : await Service.findOne({
        $or: [
          { slug: withoutVersion.toLowerCase() },
          { title: { $regex: `^${escaped}$`, $options: "i" } },
          { title: titleCandidate }
        ]
      }).populate("createdBy", "name username role avatarUrl");

  if (!service) {
    service = await findServiceByLegacyIdentifier(withoutVersion);
  }

  if (!service && withoutVersion !== normalized) {
    service = await findServiceByLegacyIdentifier(normalized);
  }

  return service;
}
