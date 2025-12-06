import { Request, Response } from "express";
import { PipelineStage } from "mongoose";
import { Post } from "../models/Post";

export const createPost = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { text, images, videoUrl } = req.body;
    const post = await Post.create({
      author: req.user._id,
      text,
      images: images || [],
      videoUrl
    });
    return res.status(201).json({ post });
  } catch (err) {
    console.error("createPost error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const feed = async (req: Request, res: Response) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("author", "name username role avatarUrl");
    const formattedPosts = posts.map((post) => {
      const plain = post.toObject();
      return {
        ...plain,
        category: plain.category ?? "",
        type: plain.type ?? "",
        createdAt: plain.createdAt instanceof Date ? plain.createdAt.toISOString() : plain.createdAt,
        updatedAt: plain.updatedAt instanceof Date ? plain.updatedAt.toISOString() : plain.updatedAt,
        comments: plain.comments?.map((comment: any) => ({
          ...comment,
          createdAt: comment.createdAt instanceof Date ? comment.createdAt.toISOString() : comment.createdAt
        }))
      };
    });
    return res.json({ posts: formattedPosts });
  } catch (err) {
    console.error("feed error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const likePost = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!post.likes.find((u) => String(u) === req.user!._id)) {
      post.likes.push(req.user._id as any);
      await post.save();
    }
    return res.json({ post });
  } catch (err) {
    console.error("likePost error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const commentPost = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "text required" });

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({
      user: req.user._id as any,
      text,
      createdAt: new Date()
    });
    await post.save();
    return res.json({ post });
  } catch (err) {
    console.error("commentPost error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const topDiscussions = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ["$likes", []] } },
          commentsCount: { $size: { $ifNull: ["$comments", []] } }
        }
      },
      { $sort: { likesCount: -1, commentsCount: -1, createdAt: -1 } },
      { $skip: skip },
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
    ];

    const [items, total] = await Promise.all([Post.aggregate(pipeline), Post.countDocuments()]);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return res.json({
      page,
      limit,
      total,
      totalPages,
      items
    });
  } catch (err) {
    console.error("topDiscussions error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
