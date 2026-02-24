import { Request, Response } from "express";
import { isValidObjectId, PipelineStage } from "mongoose";
import { AgentProfile } from "../models/AgentProfile";
import { User } from "../models/User";
import { AgentReview } from "../models/AgentReview";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { parsePositiveInt } from "../utils/pagination";
import { resolveAvatarUrl } from "../utils/avatarImage";
import { resolveCoverImage, sanitizeImageArray } from "../utils/resolveCoverImage";
import { sanitizeUser } from "../utils/userSanitizer";

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
    const profileObj = profile.toObject();
    const user = sanitizeUser(profileObj.user);
    return res.json({ profile: { ...profileObj, user } });
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
    const verifiedParam = typeof req.query.verified === "string" ? req.query.verified : "";
    const verifiedOnly = ["true", "1", "yes"].includes(verifiedParam.toLowerCase());
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
    const withListingsParam = typeof req.query.withListings === "string" ? req.query.withListings : "";
    const withListingsOnly = ["true", "1", "yes"].includes(withListingsParam.toLowerCase());

    const userSearch = search || username;
    const userMatch: Record<string, any> = { "user.role": "AGENT" };
    if (userSearch) {
      const regex = new RegExp(userSearch, "i");
      userMatch.$or = [{ "user.username": regex }, { "user.name": regex }];
    }
    const matchProfile: Record<string, any> = {};
    if (verifiedOnly) {
      userMatch["user.isVerified"] = true;
      matchProfile.verifiedByAdmin = true;
    }

    const runQuery = async (profileMatch: Record<string, any>, userQuery: Record<string, any>) => {
      const [agents, total] = await Promise.all([
        AgentProfile.aggregate([
          Object.keys(profileMatch).length ? { $match: profileMatch } : { $match: {} },
          {
            $lookup: {
              from: "users",
              localField: "user",
              foreignField: "_id",
              as: "user"
            }
          },
          { $unwind: "$user" },
          { $match: userQuery },
          {
            $lookup: {
              from: "products",
              let: { userId: "$user._id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [{ $eq: ["$createdBy", "$$userId"] }, { $eq: ["$status", "ACTIVE"] }]
                    }
                  }
                },
                { $count: "count" }
              ],
              as: "productsCount"
            }
          },
          {
            $lookup: {
              from: "services",
              let: { userId: "$user._id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$createdBy", "$$userId"] }
                  }
                },
                { $count: "count" }
              ],
              as: "servicesCount"
            }
          },
          {
            $addFields: {
              productsCount: { $ifNull: [{ $arrayElemAt: ["$productsCount.count", 0] }, 0] },
              servicesCount: { $ifNull: [{ $arrayElemAt: ["$servicesCount.count", 0] }, 0] }
            }
          },
          {
            $addFields: {
              listingsCount: { $add: ["$productsCount", "$servicesCount"] }
            }
          },
          ...(withListingsOnly ? [{ $match: { listingsCount: { $gt: 0 } } }] : []),
          { $sort: sortStage },
          { $skip: skip },
          { $limit: limit }
        ]),
        AgentProfile.aggregate([
          Object.keys(profileMatch).length ? { $match: profileMatch } : { $match: {} },
          {
            $lookup: {
              from: "users",
              localField: "user",
              foreignField: "_id",
              as: "user"
            }
          },
          { $unwind: "$user" },
          { $match: userQuery },
          {
            $lookup: {
              from: "products",
              let: { userId: "$user._id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [{ $eq: ["$createdBy", "$$userId"] }, { $eq: ["$status", "ACTIVE"] }]
                    }
                  }
                },
                { $count: "count" }
              ],
              as: "productsCount"
            }
          },
          {
            $lookup: {
              from: "services",
              let: { userId: "$user._id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$createdBy", "$$userId"] }
                  }
                },
                { $count: "count" }
              ],
              as: "servicesCount"
            }
          },
          {
            $addFields: {
              productsCount: { $ifNull: [{ $arrayElemAt: ["$productsCount.count", 0] }, 0] },
              servicesCount: { $ifNull: [{ $arrayElemAt: ["$servicesCount.count", 0] }, 0] }
            }
          },
          {
            $addFields: {
              listingsCount: { $add: ["$productsCount", "$servicesCount"] }
            }
          },
          ...(withListingsOnly ? [{ $match: { listingsCount: { $gt: 0 } } }] : []),
          { $count: "total" }
        ])
      ]);

      return { agents, total: total[0]?.total || 0 };
    };

    const normalizeAgentAvatar = (items: any[]) =>
      items.map((agent) => ({
        ...agent,
        user: agent?.user
          ? {
              ...(sanitizeUser(agent.user) || {}),
              avatarUrl: resolveAvatarUrl(agent.user.avatarUrl, agent.user._id || agent._id)
            }
          : agent.user
      }));

    let result = await runQuery(matchProfile, userMatch);
    result = { ...result, agents: normalizeAgentAvatar(result.agents) };

    if (verifiedOnly && result.total === 0) {
      const fallbackUserMatch = { ...userMatch };
      delete fallbackUserMatch["user.isVerified"];
      result = await runQuery({}, fallbackUserMatch);
      result = { ...result, agents: normalizeAgentAvatar(result.agents) };
      return res.json({ ...result, page, limit, verifiedFallback: true });
    }

    return res.json({ ...result, page, limit });
  } catch (err) {
    console.error("listAgents error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAgentDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid agent id" });
    const listingLimit = parsePositiveInt(req.query.listingLimit, 12, 40);

    let user = await User.findById(id).lean();
    let profile: any = null;
    if (user && user.role === "AGENT") {
      profile = await AgentProfile.findOne({ user: user._id }).lean();
    } else {
      const profileById = await AgentProfile.findById(id).lean();
      if (profileById) {
        const userByProfile = await User.findById(profileById.user).lean();
        if (userByProfile && userByProfile.role === "AGENT") {
          user = userByProfile;
          profile = profileById;
        }
      }
    }

    if (!user || user.role !== "AGENT") {
      return res.status(404).json({ message: "Agent not found" });
    }

    if (!profile) {
      profile = await AgentProfile.findOne({ user: user._id }).lean();
    }
    if (!profile) {
      return res.status(404).json({ message: "Agent profile not found" });
    }

    await AgentProfile.updateOne({ _id: profile._id }, { $inc: { profileViews: 1 } });

    const [products, services] = await Promise.all([
      Product.find({ createdBy: user._id, status: "ACTIVE" })
        .sort({ createdAt: -1 })
        .limit(listingLimit)
        .lean(),
      Service.find({ createdBy: user._id })
        .sort({ createdAt: -1 })
        .limit(listingLimit)
        .lean()
    ]);

    const mapListing = (type: "product" | "service", item: any) => {
      const coverImageUrl = resolveCoverImage(item);
      const images = sanitizeImageArray(item.images);
      return {
        _id: item._id,
        type,
        title: item.title || item.name || "",
        description: item.description || "",
        category: item.category || null,
        price: type === "product" ? Number(item.price || 0) : Number(item.hourlyRate || item.price || 0),
        currency: item.currency || "USD",
        coverImageUrl,
        images: coverImageUrl ? [coverImageUrl, ...images.filter((img) => img !== coverImageUrl)].slice(0, 5) : images.slice(0, 5),
        ratingAvg: Number(item.ratingAvg || 0),
        ratingCount: Number(item.ratingCount || 0),
        stats: {
          likes: Number(item.likes || 0),
          views: Number(item.views || 0),
          orders: Number(item.orders || 0)
        },
        createdAt: item.createdAt
      };
    };

    const productItems = products.map((item) => mapListing("product", item));
    const serviceItems = services.map((item) => mapListing("service", item));
    const listingsCount = productItems.length + serviceItems.length;
    const listingsOrders = [...productItems, ...serviceItems].reduce((acc, item) => acc + Number(item.stats?.orders || 0), 0);

    return res.json({
      _id: profile._id,
      kind: profile.kind,
      rating: profile.rating ?? 0,
      ratingCount: profile.ratingCount ?? 0,
      verifiedByAdmin: Boolean(profile.verifiedByAdmin),
      serviceCategory: profile.serviceCategory ?? null,
      listingsCount,
      listingsOrders,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        avatarUrl: resolveAvatarUrl(user.avatarUrl, user._id),
        bio: user.bio ?? "",
        region: user.region ?? ""
      },
      listings: {
        products: productItems,
        services: serviceItems
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

    const normalizedReviews = reviews.map((review: any) => ({
      ...review,
      userId: review?.userId
        ? {
            ...review.userId,
            avatarUrl: resolveAvatarUrl(review.userId.avatarUrl, review.userId._id)
          }
        : review.userId
    }));

    return res.json({ reviews: normalizedReviews, total, page, limit });
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
    const limit = parsePositiveInt(req.query.limit, 10, 50);
    const kindRaw = typeof req.query.kind === "string" ? req.query.kind.trim().toUpperCase() : "";
    const kindFilter = kindRaw === "SELLER" || kindRaw === "SERVICE" ? kindRaw : null;
    const requireVerifiedByAdmin = String(process.env.TOP_AGENTS_REQUIRE_VERIFIED_ADMIN ?? "true").toLowerCase() !== "false";
    const weeklyOrdersWeight = Number(process.env.AGENT_WEEKLY_ORDERS_WEIGHT ?? 5);
    const weeklyViewsWeight = Number(process.env.AGENT_WEEKLY_VIEWS_WEIGHT ?? 0.05);
    const weeklyLikesWeight = Number(process.env.AGENT_WEEKLY_LIKES_WEIGHT ?? 2);
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const profileMatch: Record<string, unknown> = {};
    if (requireVerifiedByAdmin) profileMatch.verifiedByAdmin = true;
    if (kindFilter) profileMatch.kind = kindFilter;

    const agents = await AgentProfile.aggregate([
      { $match: profileMatch },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "products",
          let: { userId: "$user._id" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$createdBy", "$$userId"] }, { $eq: ["$status", "ACTIVE"] }] } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                weeklyCount: {
                  $sum: {
                    $cond: [{ $gte: ["$createdAt", weekStart] }, 1, 0]
                  }
                },
                orders: { $sum: { $ifNull: ["$orders", 0] } },
                views: { $sum: { $ifNull: ["$views", 0] } },
                weeklyOrders: { $sum: { $ifNull: ["$orders_7d", { $ifNull: ["$orders7d", 0] }] } },
                weeklyViews: { $sum: { $ifNull: ["$views_7d", { $ifNull: ["$views7d", 0] }] } },
                weeklyLikes: { $sum: { $ifNull: ["$likes_7d", { $ifNull: ["$likes7d", 0] }] } }
              }
            }
          ],
          as: "productStats"
        }
      },
      {
        $lookup: {
          from: "services",
          let: { userId: "$user._id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$createdBy", "$$userId"] } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                weeklyCount: {
                  $sum: {
                    $cond: [{ $gte: ["$createdAt", weekStart] }, 1, 0]
                  }
                },
                orders: { $sum: { $ifNull: ["$orders", 0] } },
                views: { $sum: { $ifNull: ["$views", 0] } },
                weeklyOrders: { $sum: { $ifNull: ["$orders_7d", { $ifNull: ["$orders7d", 0] }] } },
                weeklyViews: { $sum: { $ifNull: ["$views_7d", { $ifNull: ["$views7d", 0] }] } },
                weeklyLikes: { $sum: { $ifNull: ["$likes_7d", { $ifNull: ["$likes7d", 0] }] } }
              }
            }
          ],
          as: "serviceStats"
        }
      },
      {
        $addFields: {
          productStats: { $ifNull: [{ $arrayElemAt: ["$productStats", 0] }, {}] },
          serviceStats: { $ifNull: [{ $arrayElemAt: ["$serviceStats", 0] }, {}] }
        }
      },
      {
        $addFields: {
          listingsCount: {
            $add: [{ $ifNull: ["$productStats.count", 0] }, { $ifNull: ["$serviceStats.count", 0] }]
          },
          weeklyListingsCount: {
            $add: [{ $ifNull: ["$productStats.weeklyCount", 0] }, { $ifNull: ["$serviceStats.weeklyCount", 0] }]
          },
          listingsOrders: {
            $add: [{ $ifNull: ["$productStats.orders", 0] }, { $ifNull: ["$serviceStats.orders", 0] }]
          },
          listingsViews: {
            $add: [{ $ifNull: ["$productStats.views", 0] }, { $ifNull: ["$serviceStats.views", 0] }]
          },
          weeklyOrders: {
            $add: [{ $ifNull: ["$productStats.weeklyOrders", 0] }, { $ifNull: ["$serviceStats.weeklyOrders", 0] }]
          },
          weeklyViews: {
            $add: [{ $ifNull: ["$productStats.weeklyViews", 0] }, { $ifNull: ["$serviceStats.weeklyViews", 0] }]
          },
          weeklyLikes: {
            $add: [{ $ifNull: ["$productStats.weeklyLikes", 0] }, { $ifNull: ["$serviceStats.weeklyLikes", 0] }]
          }
        }
      },
      {
        $addFields: {
          weeklyScore: {
            $add: [
              { $multiply: [{ $ifNull: ["$weeklyOrders", 0] }, weeklyOrdersWeight] },
              { $multiply: [{ $ifNull: ["$weeklyViews", 0] }, weeklyViewsWeight] },
              { $multiply: [{ $ifNull: ["$weeklyLikes", 0] }, weeklyLikesWeight] }
            ]
          }
        }
      },
      { $sort: { weeklyScore: -1, rating: -1, createdAt: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          rating: 1,
          verifiedByAdmin: 1,
          faceIdVerified: 1,
          kind: 1,
          serviceCategory: 1,
          listingsCount: 1,
          weeklyListingsCount: 1,
          listingsOrders: 1,
          listingsViews: 1,
          weeklyOrders: 1,
          weeklyViews: 1,
          weeklyLikes: 1,
          weeklyScore: 1,
          "user.name": 1,
          "user.username": 1,
          "user.avatarUrl": 1
        }
      }
    ]);

    const normalizedAgents = agents.map((agent) => ({
      ...agent,
      user: agent?.user
        ? {
            ...agent.user,
            avatarUrl: resolveAvatarUrl(agent.user.avatarUrl, agent._id)
          }
        : agent.user
    }));

    return res.json({
      agents: normalizedAgents,
      limit,
      kind: kindFilter,
      verifiedByAdminRequired: requireVerifiedByAdmin
    });
  } catch (err) {
    console.error("topVerifiedAgents error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
