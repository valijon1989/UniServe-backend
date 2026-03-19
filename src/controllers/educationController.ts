import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { AgentProfile } from "../models/AgentProfile";
import { User } from "../models/User";
import { EducationListing } from "../models/EducationListing";
import { buildCategoryMeta, listMarketplaceSections, normalizeMarketplaceCategory } from "../services/categoryTaxonomy";
import { buildListingUiMeta } from "../services/sharedFilters";
import { t } from "../i18n";
import { parsePositiveInt } from "../utils/pagination";
import { respondAuthRequired, respondForbidden, respondServerError } from "../utils/controllerResponses";

const normalizeText = (value: unknown) => String(value || "").trim();
const normalizeCourseCategory = (value: unknown) => normalizeMarketplaceCategory(value, "courses");
const isValidCourseCategory = (value: unknown) => Boolean(buildCategoryMeta(value, undefined, "courses"));

const toEducationListingDto = (listing: any, locale: Request["locale"], agentProfile?: any | null, agentUser?: any | null) => ({
  ...listing,
  category: normalizeCourseCategory(listing.category) || normalizeText(listing.category),
  categoryMeta: buildCategoryMeta(listing.category, locale, "courses"),
  subcategoryLabel: normalizeText(listing.subcategory) || null,
  agent:
    agentProfile || agentUser
      ? {
          profile: agentProfile || null,
          user: agentUser || null
        }
      : undefined
});

const buildListMatch = (query: Request["query"]) => {
  const match: Record<string, any> = { status: "active" };
  if (typeof query.category === "string") {
    match.category = normalizeCourseCategory(query.category) || normalizeText(query.category);
  }
  if (typeof query.subcategory === "string") {
    match.subcategory = query.subcategory;
  }
  if (typeof query.format === "string") {
    match.format = query.format;
  }
  if (typeof query.language === "string") {
    match.languageOfInstruction = new RegExp(query.language, "i");
  }
  if (typeof query.onlineDay === "string") {
    match["onlineSchedule.days"] = query.onlineDay;
  }
  if (typeof query.onlineTime === "string") {
    match["onlineSchedule.time"] = new RegExp(query.onlineTime, "i");
  }
  return match;
};

export const getEducationCategories = async (req: Request, res: Response) => {
  const [courses] = listMarketplaceSections(["courses"], req.locale);
  return res.json({ categories: courses?.subcategories || [] });
};

export const createEducationListing = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const profile = await AgentProfile.findOne({ user: req.user._id });
    if (!profile || profile.serviceCategory !== "education") {
      return res.status(403).json({ message: t(req, "education.access.agent_required.message") });
    }

    const {
      title,
      category,
      subcategory,
      description,
      weeklyHours,
      weeklyDays,
      totalDurationValue,
      totalDurationUnit,
      format,
      onlineSchedule,
      offlineLocation,
      languageOfInstruction,
      outcomes,
      certificates,
      images,
      studentsCount
    } = req.body;

    if (!title || !category || !subcategory || !description || !format) {
      return res.status(400).json({ message: t(req, "education.validation.required_fields.message") });
    }
    const normalizedCategory = normalizeCourseCategory(category);
    if (!normalizedCategory || !isValidCourseCategory(normalizedCategory)) {
      return res.status(400).json({ message: t(req, "education.validation.invalid_category.message") });
    }
    if (format === "online") {
      if (!onlineSchedule?.days?.length || !onlineSchedule?.time || !onlineSchedule?.durationMinutes) {
        return res.status(400).json({ message: t(req, "education.validation.online_schedule_required.message") });
      }
    }
    if (format === "offline") {
      if (!offlineLocation?.address || !offlineLocation?.schedule) {
        return res.status(400).json({ message: t(req, "education.validation.offline_location_required.message") });
      }
    }
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: t(req, "education.validation.images_required.message") });
    }

    const listing = await EducationListing.create({
      agentId: req.user._id,
      title,
      category: normalizedCategory,
      subcategory: normalizeText(subcategory),
      description,
      weeklyHours,
      weeklyDays,
      totalDurationValue,
      totalDurationUnit,
      format,
      onlineSchedule,
      offlineLocation,
      languageOfInstruction,
      outcomes,
      certificates: Array.isArray(certificates) ? certificates : [],
      images,
      studentsCount: Number.isFinite(Number(studentsCount)) ? Number(studentsCount) : 0
    });

    return res.status(201).json({ listing: toEducationListingDto(listing.toObject(), req.locale) });
  } catch (err) {
    console.error("createEducationListing error", err);
    return respondServerError(req, res);
  }
};

export const listEducationListings = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 12, 50);
    const match = buildListMatch(req.query);

    const sortMode = typeof req.query.sort === "string" ? req.query.sort : "newest";

    const items = await EducationListing.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "agentprofiles",
          localField: "agentId",
          foreignField: "user",
          as: "agentProfile"
        }
      },
      { $unwind: { path: "$agentProfile", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "agentId",
          foreignField: "_id",
          as: "agentUser"
        }
      },
      { $unwind: { path: "$agentUser", preserveNullAndEmptyArrays: true } },
      { $addFields: { agentRating: { $ifNull: ["$agentProfile.rating", 0] } } }
    ]);

    const certificate = normalizeText(req.query.certificate).toLowerCase();
    const filteredItems = items
      .filter((item) => {
        if (!certificate) return true;
        return (item.certificates || []).some((value: unknown) => normalizeText(value).toLowerCase().includes(certificate));
      })
      .sort((left, right) => {
        if (sortMode === "rating") return Number(right.agentRating || 0) - Number(left.agentRating || 0);
        return new Date(String(right.createdAt || 0)).getTime() - new Date(String(left.createdAt || 0)).getTime();
      });

    const total = filteredItems.length;
    const skip = (page - 1) * limit;
    const pagedItems = filteredItems.slice(skip, skip + limit);

    return res.json({
      items: pagedItems.map((item) => toEducationListingDto(item, req.locale, item.agentProfile, item.agentUser)),
      total,
      page,
      limit,
      uiMeta: buildListingUiMeta(req, "courses", {
        categoryKey: normalizeCourseCategory(req.query.category) || null,
        resultCount: total,
        sortValue: sortMode
      })
    });
  } catch (err) {
    console.error("listEducationListings error", err);
    return respondServerError(req, res);
  }
};

export const getEducationListingDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: t(req, "education.validation.invalid_listing_id.message") });
    }
    const listing = await EducationListing.findById(id).lean();
    if (!listing || listing.status !== "active") {
      return res.status(404).json({ message: t(req, "education.lookup.listing_not_found.message") });
    }
    const [agentProfile, agentUser] = await Promise.all([
      AgentProfile.findOne({ user: listing.agentId }).lean(),
      User.findById(listing.agentId).lean()
    ]);

    return res.json({
      listing: toEducationListingDto(listing, req.locale, agentProfile, agentUser || null)
    });
  } catch (err) {
    console.error("getEducationListingDetail error", err);
    return respondServerError(req, res);
  }
};

export const myEducationListings = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const listings = await EducationListing.find({ agentId: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json({ listings: listings.map((listing) => toEducationListingDto(listing, req.locale)) });
  } catch (err) {
    console.error("myEducationListings error", err);
    return respondServerError(req, res);
  }
};

export const updateEducationListing = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: t(req, "education.validation.invalid_listing_id.message") });
    }
    const listing = await EducationListing.findById(id);
    if (!listing) return res.status(404).json({ message: t(req, "education.lookup.listing_not_found.message") });
    if (listing.agentId.toString() !== req.user._id) {
      return respondForbidden(req, res);
    }

    const allowedFields = [
      "title",
      "category",
      "subcategory",
      "description",
      "weeklyHours",
      "weeklyDays",
      "totalDurationValue",
      "totalDurationUnit",
      "format",
      "onlineSchedule",
      "offlineLocation",
      "languageOfInstruction",
      "outcomes",
      "certificates",
      "images",
      "studentsCount",
      "status"
    ];

    for (const key of allowedFields) {
      if (key in req.body) {
        (listing as any)[key] = req.body[key];
      }
    }

    if (listing.category) {
      listing.category = normalizeCourseCategory(listing.category) || listing.category;
    }
    if (!listing.category || !isValidCourseCategory(listing.category)) {
      return res.status(400).json({ message: t(req, "education.validation.invalid_category.message") });
    }
    if (listing.format === "online") {
      if (!listing.onlineSchedule?.days?.length || !listing.onlineSchedule?.time || !listing.onlineSchedule?.durationMinutes) {
        return res.status(400).json({ message: t(req, "education.validation.online_schedule_required.message") });
      }
    }
    if (listing.format === "offline") {
      if (!listing.offlineLocation?.address || !listing.offlineLocation?.schedule) {
        return res.status(400).json({ message: t(req, "education.validation.offline_location_required.message") });
      }
    }
    if (!listing.images?.length) {
      return res.status(400).json({ message: t(req, "education.validation.images_required.message") });
    }

    await listing.save();
    return res.json({ listing: toEducationListingDto(listing.toObject(), req.locale) });
  } catch (err) {
    console.error("updateEducationListing error", err);
    return respondServerError(req, res);
  }
};
