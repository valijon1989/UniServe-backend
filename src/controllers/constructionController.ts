import { Request, Response } from "express";
import { isValidObjectId, PipelineStage } from "mongoose";
import { AgentProfile } from "../models/AgentProfile";
import { User } from "../models/User";
import { ConstructionListing } from "../models/ConstructionListing";
import { parsePositiveInt } from "../utils/pagination";

const constructionCategories = [
  {
    key: "exterior",
    name: "Tashqi qurilish",
    items: ["facade", "concrete", "bricklaying", "roofing", "roof-repair", "other"]
  },
  {
    key: "interior",
    name: "Ichki qurilish",
    items: [
      "painting",
      "wallpaper",
      "interior-design",
      "doors-windows",
      "ceiling-repair",
      "plastering",
      "tile",
      "other"
    ]
  }
];

const allowedSubcategories = new Set(
  constructionCategories.flatMap((category) => category.items)
);

const isSubcategoryAllowedForCategory = (category: string, subcategory: string) => {
  const entry = constructionCategories.find((item) => item.key === category);
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
  if (typeof query.location === "string") {
    match.location = new RegExp(query.location, "i");
  }
  if (typeof query.search === "string") {
    match.$or = [
      { title: new RegExp(query.search, "i") },
      { description: new RegExp(query.search, "i") }
    ];
  }
  return match;
};

export const getConstructionCategories = async (_req: Request, res: Response) => {
  return res.json({ categories: constructionCategories });
};

export const createConstructionListing = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const profile = await AgentProfile.findOne({ user: req.user._id });
    if (!profile || profile.serviceCategory !== "construction") {
      return res.status(403).json({ message: "Only construction agents can create listings" });
    }

    const {
      title,
      category,
      subcategory,
      description,
      location,
      priceFrom,
      priceTo,
      currency,
      images
    } = req.body;

    if (!title || !category || !subcategory || !description) {
      return res.status(400).json({ message: "title, category, subcategory, description required" });
    }
    if (!allowedSubcategories.has(subcategory)) {
      return res.status(400).json({ message: "Invalid subcategory" });
    }
    if (!isSubcategoryAllowedForCategory(category, subcategory)) {
      return res.status(400).json({ message: "Subcategory does not match category" });
    }
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    const listing = await ConstructionListing.create({
      agentId: req.user._id,
      title,
      category,
      subcategory,
      description,
      location,
      priceFrom,
      priceTo,
      currency,
      images
    });

    return res.status(201).json({ listing });
  } catch (err) {
    console.error("createConstructionListing error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listConstructionListings = async (req: Request, res: Response) => {
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

    const [items, total, topRated] = await Promise.all([
      ConstructionListing.aggregate([
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
      ConstructionListing.countDocuments(match),
      ConstructionListing.aggregate([
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
        { $addFields: { agentRating: { $ifNull: ["$agentProfile.rating", 0] } } },
        { $sort: { agentRating: -1, createdAt: -1 } },
        { $limit: 4 }
      ])
    ]);

    return res.json({ items, total, page, limit, topRated });
  } catch (err) {
    console.error("listConstructionListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getConstructionListingDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid listing id" });
    const listing = await ConstructionListing.findById(id).lean();
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
    console.error("getConstructionListingDetail error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const myConstructionListings = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const listings = await ConstructionListing.find({ agentId: req.user._id }).sort({ createdAt: -1 });
    return res.json({ listings });
  } catch (err) {
    console.error("myConstructionListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateConstructionListing = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid listing id" });
    const listing = await ConstructionListing.findById(id);
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (listing.agentId.toString() !== req.user._id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const allowedFields = [
      "title",
      "category",
      "subcategory",
      "description",
      "location",
      "priceFrom",
      "priceTo",
      "currency",
      "images",
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
    if (!listing.images?.length) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    await listing.save();
    return res.json({ listing });
  } catch (err) {
    console.error("updateConstructionListing error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
