import mongoose from "mongoose";
import { Request, Response } from "express";
import { AgentListing, AgentListingMedia, AgentListingStatus } from "../models/AgentListing";
import { parsePositiveInt } from "../utils/pagination";
import { buildCategoryMeta } from "../services/categoryTaxonomy";
import { localizeKeywordList, resolveLocalizedTextField } from "../services/localizedContent";
import { respondAuthRequired } from "../utils/controllerResponses";

const ALLOWED_STATUSES: AgentListingStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"];
const MAX_LIMIT = 50;
type ListingSortField = "updatedAt" | "createdAt";

const parseStatus = (value: unknown): AgentListingStatus | null => {
  const status = String(value || "")
    .trim()
    .toUpperCase();
  if (!status) return null;
  return ALLOWED_STATUSES.includes(status as AgentListingStatus) ? (status as AgentListingStatus) : null;
};

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 30);
};

const normalizeImages = (value: unknown): AgentListingMedia[] => {
  if (!Array.isArray(value)) return [];
  const out: AgentListingMedia[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item === "string") {
      const url = item.trim();
      if (!url) continue;
      const dedupeKey = `url:${url}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ url });
      continue;
    }
    if (item && typeof item === "object") {
      const rawUrl = (item as { url?: unknown }).url;
      const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
      if (!url) continue;
      const rawId = (item as { id?: unknown }).id;
      const id = typeof rawId === "string" ? rawId.trim() : undefined;
      const dedupeKey = `${id || ""}|${url}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ id, url });
    }
  }

  return out.slice(0, 20);
};

const normalizePrice = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  return parsed;
};

const parseSortField = (value: unknown): ListingSortField => {
  const sort = String(value || "").trim();
  return sort === "createdAt" ? "createdAt" : "updatedAt";
};

const toDto = (listing: any, locale?: Request["locale"]) => ({
  _id: String(listing._id),
  ownerId: String(listing.ownerId),
  title: resolveLocalizedTextField(listing, "title", locale, listing.title),
  description: resolveLocalizedTextField(listing, "description", locale, listing.description || ""),
  category: listing.category || "",
  categoryMeta: buildCategoryMeta(listing.category, locale),
  type: listing.type || "",
  price: typeof listing.price === "number" ? listing.price : null,
  currency: listing.currency || "USD",
  location: listing.location || "",
  tags: localizeKeywordList(Array.isArray(listing.tags) ? listing.tags : [], locale),
  images: Array.isArray(listing.images) ? listing.images : [],
  status: listing.status,
  isDeleted: Boolean(listing.isDeleted),
  publishedAt: listing.publishedAt || null,
  createdAt: listing.createdAt,
  updatedAt: listing.updatedAt
});

const parseIdOr400 = (res: Response, id: string): mongoose.Types.ObjectId | null => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid listing id" });
    return null;
  }
  return new mongoose.Types.ObjectId(id);
};

export const listMyAgentListings = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const page = parsePositiveInt(req.query.page, 1, 1_000_000);
    const limit = parsePositiveInt(req.query.limit, 12, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const q = normalizeText(req.query.q);
    const sortField = parseSortField(req.query.sort);
    const statusQuery = String(req.query.status || "")
      .trim()
      .toUpperCase();

    const filter: Record<string, any> = {
      ownerId: req.user._id,
      isDeleted: false
    };

    if (statusQuery && statusQuery !== "ALL") {
      const parsedStatus = parseStatus(statusQuery);
      if (!parsedStatus) {
        return res.status(400).json({ message: `status must be one of: ALL, ${ALLOWED_STATUSES.join(", ")}` });
      }
      filter.status = parsedStatus;
    }

    if (q) {
      const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: pattern, $options: "i" };
    }

    const [items, total] = await Promise.all([
      AgentListing.find(filter).sort({ [sortField]: -1 }).skip(skip).limit(limit).lean(),
      AgentListing.countDocuments(filter)
    ]);

    return res.json({
      items: items.map((item) => toDto(item, req.locale)),
      page,
      limit,
      total
    });
  } catch (err) {
    console.error("listMyAgentListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listPublicAgentListings = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1_000_000);
    const limit = parsePositiveInt(req.query.limit, 12, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const q = normalizeText(req.query.q);
    const sortField = parseSortField(req.query.sort);

    const filter: Record<string, any> = {
      status: "ACTIVE",
      isDeleted: false
    };

    if (q) {
      const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: pattern, $options: "i" };
    }

    const [items, total] = await Promise.all([
      AgentListing.find(filter).sort({ [sortField]: -1 }).skip(skip).limit(limit).lean(),
      AgentListing.countDocuments(filter)
    ]);

    return res.json({
      items: items.map((item) => toDto(item, req.locale)),
      page,
      limit,
      total
    });
  } catch (err) {
    console.error("listPublicAgentListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getMyAgentListingById = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const parsedId = parseIdOr400(res, req.params.id);
    if (!parsedId) return;

    const item = await AgentListing.findOne({
      _id: parsedId,
      ownerId: req.user._id,
      isDeleted: false
    }).lean();

    if (!item) return res.status(404).json({ message: "Listing not found" });
    return res.json({ item: toDto(item, req.locale) });
  } catch (err) {
    console.error("getMyAgentListingById error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const createAgentListing = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const title = normalizeText(req.body.title);
    if (!title) return res.status(400).json({ message: "title is required" });

    const price = normalizePrice(req.body.price);
    if (Number.isNaN(price)) {
      return res.status(400).json({ message: "price must be a positive number" });
    }

    const status = req.body.status ? parseStatus(req.body.status) : "DRAFT";
    if (req.body.status && !status) {
      return res.status(400).json({ message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` });
    }

    const item = await AgentListing.create({
      ownerId: req.user._id,
      title,
      description: normalizeText(req.body.description),
      category: normalizeText(req.body.category),
      type: normalizeText(req.body.type),
      price,
      currency: normalizeText(req.body.currency) || "USD",
      location: normalizeText(req.body.location),
      tags: normalizeTags(req.body.tags),
      images: normalizeImages(req.body.images),
      status,
      publishedAt: status === "ACTIVE" ? new Date() : undefined
    });

    return res.status(201).json({ item: toDto(item, req.locale) });
  } catch (err) {
    console.error("createAgentListing error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateAgentListing = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const parsedId = parseIdOr400(res, req.params.id);
    if (!parsedId) return;

    const item = await AgentListing.findOne({
      _id: parsedId,
      ownerId: req.user._id,
      isDeleted: false
    });
    if (!item) return res.status(404).json({ message: "Listing not found" });

    if (req.body.title !== undefined) {
      const title = normalizeText(req.body.title);
      if (!title) return res.status(400).json({ message: "title cannot be empty" });
      item.title = title;
    }

    if (req.body.description !== undefined) item.description = normalizeText(req.body.description);
    if (req.body.category !== undefined) item.category = normalizeText(req.body.category);
    if (req.body.type !== undefined) item.type = normalizeText(req.body.type);
    if (req.body.location !== undefined) item.location = normalizeText(req.body.location);
    if (req.body.currency !== undefined) item.currency = normalizeText(req.body.currency) || "USD";
    if (req.body.tags !== undefined) item.tags = normalizeTags(req.body.tags);
    if (req.body.images !== undefined) item.images = normalizeImages(req.body.images);

    if (req.body.price !== undefined) {
      const price = normalizePrice(req.body.price);
      if (Number.isNaN(price)) return res.status(400).json({ message: "price must be a positive number" });
      item.price = price;
    }

    if (req.body.status !== undefined) {
      const status = parseStatus(req.body.status);
      if (!status) {
        return res.status(400).json({ message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` });
      }
      item.status = status;
      if (status === "ACTIVE") item.publishedAt = new Date();
    }

    await item.save();
    return res.json({ item: toDto(item, req.locale) });
  } catch (err) {
    console.error("updateAgentListing error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateAgentListingStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const parsedId = parseIdOr400(res, req.params.id);
    if (!parsedId) return;

    const status = parseStatus(req.body.status);
    if (!status) {
      return res.status(400).json({ message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` });
    }

    const item = await AgentListing.findOne({
      _id: parsedId,
      ownerId: req.user._id,
      isDeleted: false
    });
    if (!item) return res.status(404).json({ message: "Listing not found" });

    item.status = status;
    if (status === "ACTIVE") item.publishedAt = new Date();
    await item.save();

    return res.json({ item: toDto(item, req.locale) });
  } catch (err) {
    console.error("updateAgentListingStatus error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteAgentListing = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const parsedId = parseIdOr400(res, req.params.id);
    if (!parsedId) return;

    const item = await AgentListing.findOne({
      _id: parsedId,
      ownerId: req.user._id,
      isDeleted: false
    });
    if (!item) return res.status(404).json({ message: "Listing not found" });

    item.isDeleted = true;
    item.status = "ARCHIVED";
    await item.save();

    return res.json({ item: toDto(item) });
  } catch (err) {
    console.error("deleteAgentListing error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
