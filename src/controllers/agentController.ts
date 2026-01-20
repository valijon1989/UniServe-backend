import { Request, Response } from "express";
import { isValidObjectId, PipelineStage } from "mongoose";
import { AgentProfile } from "../models/AgentProfile";
import { User } from "../models/User";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { EducationListing } from "../models/EducationListing";
import { ConstructionListing } from "../models/ConstructionListing";
import { TaxiListing } from "../models/TaxiListing";
import { AgentReview } from "../models/AgentReview";
import { parsePositiveInt } from "../utils/pagination";

const constructionAreas = ["interior", "exterior"];
const constructionServices = [
  "facade",
  "concrete",
  "bricklaying",
  "roofing",
  "roof-repair",
  "painting",
  "wallpaper",
  "interior-design",
  "doors-windows",
  "ceiling-repair",
  "plastering",
  "tile",
  "other"
];

export const becomeAgent = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const {
      kind,
      socialServices,
      materialServices,
      serviceCategory,
      constructionAreas: requestedConstructionAreas,
      constructionServices: requestedConstructionServices,
      serviceOfficeAddress,
      serviceQualification,
      taxi,
      educationCategories,
      educationLanguages,
      educationSkills,
      educationSpecialties
    } = req.body;
    const allowedSeatCapacities = [4, 7, 9, 13, 20, 30, 40];
    const educationLists = [
      educationCategories,
      educationLanguages,
      educationSkills,
      educationSpecialties
    ].filter((items) => Array.isArray(items) && items.length > 0);

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "ADMIN") {
      return res.status(400).json({ message: "Admin cannot become agent" });
    }

    const existing = await AgentProfile.findOne({ user: user._id });
    if (existing) return res.status(400).json({ message: "Agent profile already exists" });

    if (serviceCategory === "taxi" && taxi?.seatCapacity && !allowedSeatCapacities.includes(Number(taxi.seatCapacity))) {
      return res.status(400).json({ message: "Seat capacity not allowed" });
    }
    if (serviceCategory === "education" && educationLists.length === 0) {
      return res.status(400).json({ message: "Education agent must choose at least one category" });
    }
    if (serviceCategory === "construction") {
      if (!Array.isArray(requestedConstructionServices) || requestedConstructionServices.length === 0) {
        return res.status(400).json({ message: "Construction agent must choose at least one service" });
      }
      const invalidArea = Array.isArray(requestedConstructionAreas)
        ? requestedConstructionAreas.find((area) => !constructionAreas.includes(area))
        : undefined;
      if (invalidArea) {
        return res.status(400).json({ message: "Invalid construction area" });
      }
      const invalidService = requestedConstructionServices.find(
        (service: string) => !constructionServices.includes(service)
      );
      if (invalidService) {
        return res.status(400).json({ message: "Invalid construction service" });
      }
    }

    const profile = await AgentProfile.create({
      user: user._id,
      kind,
      socialServices: socialServices ?? [],
      materialServices: materialServices ?? [],
      serviceCategory,
      constructionAreas: requestedConstructionAreas ?? [],
      constructionServices: requestedConstructionServices ?? [],
      serviceOfficeAddress,
      serviceQualification,
      taxi: taxi ?? undefined,
      educationCategories: educationCategories ?? [],
      educationLanguages: educationLanguages ?? [],
      educationSkills: educationSkills ?? [],
      educationSpecialties: educationSpecialties ?? []
    });

    user.role = "AGENT";
    await user.save();

    return res.status(201).json({ profile });
  } catch (err) {
    console.error("becomeAgent error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const verifyFaceId = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const profile = await AgentProfile.findOneAndUpdate(
      { user: req.user._id },
      { faceIdVerified: true },
      { new: true }
    );
    if (!profile) return res.status(404).json({ message: "Agent profile not found" });
    return res.json({ profile });
  } catch (err) {
    console.error("verifyFaceId error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const myAgentProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const profile = await AgentProfile.findOne({ user: req.user._id }).populate("user");
    if (!profile) return res.status(404).json({ message: "Agent profile not found" });
    return res.json({ profile });
  } catch (err) {
    console.error("myAgentProfile error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listAgents = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 12, 50);
    const skip = (page - 1) * limit;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const username = typeof req.query.username === "string" ? req.query.username.trim() : "";
    const activeParam = typeof req.query.active === "string" ? req.query.active : "true";
    const activeOnly = !["false", "0", "no"].includes(activeParam.toLowerCase());
    const sortMode = typeof req.query.sort === "string" ? req.query.sort : "rating";

    const sortOptions: Record<string, PipelineStage.Sort["$sort"]> = {
      recent: { createdAt: -1 },
      new: { createdAt: -1 },
      oldest: { createdAt: 1 },
      likes: { profileLikes: -1, createdAt: -1 },
      views: { profileViews: -1, createdAt: -1 },
      rating: { rating: -1, ratingCount: -1, createdAt: -1 }
    };
    const sortStage = sortOptions[sortMode] ?? sortOptions.rating;

    const userSearch = search || username;
    const userMatch: Record<string, any> = { role: "AGENT" };
    if (userSearch) {
      const regex = new RegExp(userSearch, "i");
      userMatch.$or = [{ username: regex }, { name: regex }];
    }
    if (activeOnly) {
      userMatch.isVerified = true;
    }

    const matchProfile: Record<string, any> = {};
    if (activeOnly) {
      matchProfile.verifiedByAdmin = true;
    }

    const [agents, total] = await Promise.all([
      AgentProfile.aggregate([
        Object.keys(matchProfile).length ? { $match: matchProfile } : { $match: {} },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        { $match: userMatch },
        { $sort: sortStage },
        { $skip: skip },
        { $limit: limit }
      ]),
      AgentProfile.aggregate([
        Object.keys(matchProfile).length ? { $match: matchProfile } : { $match: {} },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        { $match: userMatch },
        { $count: "total" }
      ])
    ]);

    return res.json({ agents, total: total[0]?.total || 0, page, limit });
  } catch (err) {
    console.error("listAgents error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAgentDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid agent id" });

    const user = await User.findById(id).lean();
    if (!user || user.role !== "AGENT") {
      return res.status(404).json({ message: "Agent not found" });
    }

    const profile = await AgentProfile.findOne({ user: user._id }).lean();
    if (!profile) {
      return res.status(404).json({ message: "Agent profile not found" });
    }

    await AgentProfile.updateOne({ _id: profile._id }, { $inc: { profileViews: 1 } });

    const [products, services, educationListings, constructionListings, taxiListings] = await Promise.all([
      Product.find({ createdBy: user._id, status: "ACTIVE" })
        .select("title price currency images category createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Service.find({ createdBy: user._id })
        .select("title kind category hourlyRate currency location createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      EducationListing.find({ agentId: user._id, status: "active" })
        .select("title category subcategory images format createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      ConstructionListing.find({ agentId: user._id, status: "active" })
        .select("title category subcategory images priceFrom priceTo currency createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      TaxiListing.find({ agentId: user._id, status: "active" })
        .select("title city images pricePerHour currency createdAt")
        .sort({ createdAt: -1 })
        .lean()
    ]);

    const listingCards = [
      ...products.map((item) => ({
        type: "product",
        id: item._id,
        title: item.title,
        image: item.images?.[0],
        price: item.price,
        currency: item.currency,
        category: item.category,
        createdAt: item.createdAt
      })),
      ...services.map((item) => ({
        type: "service",
        id: item._id,
        title: item.title,
        image: undefined,
        price: item.hourlyRate,
        currency: item.currency,
        category: item.category,
        createdAt: item.createdAt
      })),
      ...educationListings.map((item) => ({
        type: "education",
        id: item._id,
        title: item.title,
        image: item.images?.[0],
        category: item.subcategory,
        createdAt: item.createdAt
      })),
      ...constructionListings.map((item) => ({
        type: "construction",
        id: item._id,
        title: item.title,
        image: item.images?.[0],
        price: item.priceFrom,
        currency: item.currency,
        category: item.subcategory,
        createdAt: item.createdAt
      })),
      ...taxiListings.map((item) => ({
        type: "taxi",
        id: item._id,
        title: item.title,
        image: item.images?.[0],
        price: item.pricePerHour,
        currency: item.currency,
        category: item.city,
        createdAt: item.createdAt
      }))
    ].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));

    return res.json({
      agent: { user, profile },
      listings: {
        products,
        services,
        educationListings,
        constructionListings,
        taxiListings,
        listingCards
      }
    });
  } catch (err) {
    console.error("getAgentDetail error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listAgentReviews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid agent id" });
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 10, 50);
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      AgentReview.find({ agentId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name username avatarUrl")
        .lean(),
      AgentReview.countDocuments({ agentId: id })
    ]);

    return res.json({ reviews, total, page, limit });
  } catch (err) {
    console.error("listAgentReviews error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const upsertAgentReview = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid agent id" });

    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const user = await User.findById(id).lean();
    if (!user || user.role !== "AGENT") {
      return res.status(404).json({ message: "Agent not found" });
    }

    const review = await AgentReview.findOneAndUpdate(
      { agentId: user._id, userId: req.user._id },
      { rating, comment },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const ratingStats = await AgentReview.aggregate([
      { $match: { agentId: user._id } },
      {
        $group: {
          _id: "$agentId",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 }
        }
      }
    ]);

    if (ratingStats.length) {
      await AgentProfile.updateOne(
        { user: user._id },
        {
          $set: {
            rating: Number(ratingStats[0].avgRating.toFixed(2)),
            ratingCount: ratingStats[0].count
          }
        }
      );
    }

    return res.status(201).json({ review });
  } catch (err) {
    console.error("upsertAgentReview error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
export const topVerifiedAgents = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const agents = await AgentProfile.aggregate([
      { $match: { verifiedByAdmin: true } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      { $sort: { rating: -1, createdAt: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          rating: 1,
          verifiedByAdmin: 1,
          faceIdVerified: 1,
          kind: 1,
          serviceCategory: 1,
          createdAt: 1,
          updatedAt: 1,
          "user._id": 1,
          "user.name": 1,
          "user.username": 1,
          "user.avatarUrl": 1,
          "user.bio": 1,
          "user.region": 1
        }
      }
    ]);

    return res.json({ agents, limit });
  } catch (err) {
    console.error("topVerifiedAgents error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
