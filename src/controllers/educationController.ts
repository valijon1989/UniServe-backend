import { Request, Response } from "express";
import { isValidObjectId, PipelineStage } from "mongoose";
import { AgentProfile } from "../models/AgentProfile";
import { User } from "../models/User";
import { EducationListing } from "../models/EducationListing";
import { parsePositiveInt } from "../utils/pagination";

const educationCategories = [
  {
    key: "language",
    name: "Til o'rganish",
    items: ["korean", "english", "uzbek", "russian", "spanish", "chinese"]
  },
  {
    key: "skill",
    name: "Kasb o'rganish",
    items: ["auto-repair", "welding", "electrician", "cooking", "beauty", "nursing", "plumbing"]
  },
  {
    key: "special",
    name: "Maxsus bilimlar",
    items: ["it-programming", "informatics", "trading", "other"]
  }
];

const allowedSubcategories = new Set(
  educationCategories.flatMap((category) => category.items)
);

const isSubcategoryAllowedForCategory = (category: string, subcategory: string) => {
  const entry = educationCategories.find((item) => item.key === category);
  return !!entry?.items.includes(subcategory);
};

const buildListMatch = (query: Request["query"]) => {
  const match: Record<string, any> = { status: "active" };
  if (typeof query.category === "string") {
    match.category = query.category;
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

export const getEducationCategories = async (_req: Request, res: Response) => {
  return res.json({ categories: educationCategories });
};

export const createEducationListing = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const profile = await AgentProfile.findOne({ user: req.user._id });
    if (!profile || profile.serviceCategory !== "education") {
      return res.status(403).json({ message: "Only education agents can create listings" });
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
      return res.status(400).json({ message: "title, category, subcategory, description, format required" });
    }
    if (!allowedSubcategories.has(subcategory)) {
      return res.status(400).json({ message: "Invalid subcategory" });
    }
    if (!isSubcategoryAllowedForCategory(category, subcategory)) {
      return res.status(400).json({ message: "Subcategory does not match category" });
    }
    if (format === "online") {
      if (!onlineSchedule?.days?.length || !onlineSchedule?.time || !onlineSchedule?.durationMinutes) {
        return res.status(400).json({ message: "Online schedule requires days, time, durationMinutes" });
      }
    }
    if (format === "offline") {
      if (!offlineLocation?.address || !offlineLocation?.schedule) {
        return res.status(400).json({ message: "Offline location requires address and schedule" });
      }
    }
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    const listing = await EducationListing.create({
      agentId: req.user._id,
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
      certificates: Array.isArray(certificates) ? certificates : [],
      images,
      studentsCount: Number.isFinite(Number(studentsCount)) ? Number(studentsCount) : 0
    });

    return res.status(201).json({ listing });
  } catch (err) {
    console.error("createEducationListing error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listEducationListings = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 12, 50);
    const skip = (page - 1) * limit;
    const match = buildListMatch(req.query);

    const sortMode = typeof req.query.sort === "string" ? req.query.sort : "new";
    const sortStage: PipelineStage.Sort["$sort"] =
      sortMode === "rating"
        ? { agentRating: -1, createdAt: -1 }
        : { createdAt: -1 };

    const [items, total] = await Promise.all([
      EducationListing.aggregate([
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
        { $addFields: { agentRating: { $ifNull: ["$agentProfile.rating", 0] } } },
        { $sort: sortStage },
        { $skip: skip },
        { $limit: limit }
      ]),
      EducationListing.countDocuments(match)
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    console.error("listEducationListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getEducationListingDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid listing id" });
    const listing = await EducationListing.findById(id).lean();
    if (!listing || listing.status !== "active") {
      return res.status(404).json({ message: "Listing not found" });
    }
    const [agentProfile, agentUser] = await Promise.all([
      AgentProfile.findOne({ user: listing.agentId }).lean(),
      User.findById(listing.agentId).lean()
    ]);

    return res.json({
      listing,
      agent: {
        profile: agentProfile,
        user: agentUser || null
      }
    });
  } catch (err) {
    console.error("getEducationListingDetail error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const myEducationListings = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const listings = await EducationListing.find({ agentId: req.user._id }).sort({ createdAt: -1 });
    return res.json({ listings });
  } catch (err) {
    console.error("myEducationListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateEducationListing = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid listing id" });
    const listing = await EducationListing.findById(id);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (listing.agentId.toString() !== req.user._id) {
      return res.status(403).json({ message: "Forbidden" });
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

    if (listing.subcategory && !allowedSubcategories.has(listing.subcategory)) {
      return res.status(400).json({ message: "Invalid subcategory" });
    }
    if (listing.category && listing.subcategory && !isSubcategoryAllowedForCategory(listing.category, listing.subcategory)) {
      return res.status(400).json({ message: "Subcategory does not match category" });
    }
    if (listing.format === "online") {
      if (!listing.onlineSchedule?.days?.length || !listing.onlineSchedule?.time || !listing.onlineSchedule?.durationMinutes) {
        return res.status(400).json({ message: "Online schedule requires days, time, durationMinutes" });
      }
    }
    if (listing.format === "offline") {
      if (!listing.offlineLocation?.address || !listing.offlineLocation?.schedule) {
        return res.status(400).json({ message: "Offline location requires address and schedule" });
      }
    }
    if (!listing.images?.length) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    await listing.save();
    return res.json({ listing });
  } catch (err) {
    console.error("updateEducationListing error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
