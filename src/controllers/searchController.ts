import { Request, Response } from "express";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { AgentProfile } from "../models/AgentProfile";
import { Post } from "../models/Post";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const globalSearch = async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string)?.trim();
    if (!query) return res.status(400).json({ message: "q query parameter is required" });

    const regex = new RegExp(escapeRegex(query), "i");
    const limit = Math.min(Number(req.query.limit) || 8, 30);

    const [products, services, agents, posts] = await Promise.all([
      Product.find({
        $or: [{ title: regex }, { description: regex }, { category: regex }]
      })
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      Service.find({
        $or: [{ title: regex }, { description: regex }, { category: regex }, { location: regex }]
      })
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      AgentProfile.aggregate([
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
          $match: {
            $or: [
              { "user.name": regex },
              { "user.username": regex },
              { socialServices: regex },
              { materialServices: regex },
              { serviceCategory: regex }
            ]
          }
        },
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
      ]),
      Post.aggregate([
        {
          $match: {
            $or: [{ content: regex }, { text: regex }, { category: regex }, { type: regex }]
          }
        },
        {
          $addFields: {
            likesCount: { $size: { $ifNull: ["$likes", []] } },
            commentsCount: { $size: { $ifNull: ["$comments", []] } }
          }
        },
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "users",
            localField: "author",
            foreignField: "_id",
            as: "author"
          }
        },
        { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            text: 1,
            content: 1,
            images: 1,
            videoUrl: 1,
            category: 1,
            type: 1,
            likesCount: 1,
            commentsCount: 1,
            createdAt: 1,
            updatedAt: 1,
            "author._id": 1,
            "author.name": 1,
            "author.username": 1,
            "author.avatarUrl": 1
          }
        }
      ])
    ]);

    return res.json({
      success: true,
      query,
      limit,
      products,
      services,
      agents,
      posts
    });
  } catch (err) {
    console.error("globalSearch error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
