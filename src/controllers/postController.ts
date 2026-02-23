import { Request, Response } from "express";
import mongoose, { PipelineStage } from "mongoose";
import { Post } from "../models/Post";
import { AgentProfile } from "../models/AgentProfile";
import { User } from "../models/User";

const slugifyText = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
};

const buildSlug = (title: string) => {
  const base = slugifyText(title) || "post";
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
};

const getRelatedAgentsByCategory = async (category?: string) => {
  if (!category) return [];
  const agents = await AgentProfile.find({
    serviceCategory: category,
    verifiedByAdmin: true
  })
    .limit(4)
    .populate("user", "name username avatarUrl bio region");
  return agents.map((profile) => ({
    id: profile._id,
    userId: profile.user._id,
    name: (profile.user as any)?.name,
    username: (profile.user as any)?.username,
    avatarUrl: (profile.user as any)?.avatarUrl,
    category: profile.serviceCategory,
    bio: (profile.user as any)?.bio,
    isVerifiedAgent: profile.verifiedByAdmin
  }));
};

export const formatPost = (post: any) => {
  const formatted = post.toObject ? post.toObject() : post;
  formatted.author = formatted.author || {};
  formatted.comments = (formatted.comments || []).map((comment: any) => {
    const commentCopy = { ...comment };
    if (commentCopy.createdAt instanceof Date) {
      commentCopy.createdAt = commentCopy.createdAt.toISOString();
    }
    return commentCopy;
  });
  formatted.createdAt =
    formatted.createdAt instanceof Date ? formatted.createdAt.toISOString() : formatted.createdAt;
  formatted.updatedAt =
    formatted.updatedAt instanceof Date ? formatted.updatedAt.toISOString() : formatted.updatedAt;
  return formatted;
};

export const createPost = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  const {
    title,
    text,
    content,
    excerpt,
    images,
    videoUrl,
    category,
    type,
    location,
    language,
    sourceUrl,
    isFeatured
  } = req.body;

  if (!title || title.toString().trim().length === 0) {
    return res.status(400).json({ message: "Title is required" });
  }
  const slug = buildSlug(title.toString());

  try {
    const post = await Post.create({
      author: req.user._id,
      title: title.toString(),
      slug,
      excerpt: excerpt || text || "",
      text: text || "",
      content: content || "",
      images: Array.isArray(images) ? images : [],
      videoUrl: videoUrl || "",
      category: category ? String(category).toLowerCase() : "community",
      type: type ? String(type).toLowerCase() : "question",
      location: location || "",
      language: language || "Uzbek",
      sourceUrl: sourceUrl || "",
      isFeatured: Boolean(isFeatured),
      isActive: true,
      status: "active"
    });
    return res.status(201).json({ post: formatPost(post) });
  } catch (err) {
    console.error("createPost error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const feed = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 12, 60);
    const skip = (page - 1) * limit;

    const filters: any = { isActive: true, status: "active" };
    if (req.query.category) filters.category = String(req.query.category).toLowerCase();
    if (req.query.type) filters.type = String(req.query.type).toLowerCase();
    if (req.query.language) filters.language = String(req.query.language);
    if (req.query.location) filters.location = String(req.query.location);
    if (req.query.featured === "true") filters.isFeatured = true;

    const queryTerm = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (queryTerm) {
      const regex = new RegExp(queryTerm, "i");
      filters.$or = [{ title: regex }, { text: regex }, { content: regex }, { excerpt: regex }];
    }

    const sort: Record<string, mongoose.SortOrder> =
      req.query.sort === "popular"
        ? { views: -1, likes: -1, createdAt: -1 }
        : { isFeatured: -1, views: -1, createdAt: -1 };

    const [total, posts] = await Promise.all([
      Post.countDocuments(filters),
      Post.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("author", "name username avatarUrl role region")
        .populate("comments.user", "name username avatarUrl role")
    ]);

    const formatted = posts.map((post) => formatPost(post));

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      posts: formatted
    });
  } catch (err) {
    console.error("feed error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getPostDetail = async (req: Request, res: Response) => {
  try {
    const identifier = req.params.id;
    const filter = mongoose.isValidObjectId(identifier) ? { _id: identifier } : { slug: identifier };
    const post = await Post.findOne(filter)
      .populate("author", "name username avatarUrl role region")
      .populate("comments.user", "name username avatarUrl role");
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.views = (post.views || 0) + 1;
    await post.save();

    const relatedAgents = await getRelatedAgentsByCategory(post.category);

    return res.json({
      post: formatPost(post),
      relatedAgents
    });
  } catch (err) {
    console.error("getPostDetail error", err);
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
    return res.json({ post: formatPost(post) });
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

    const isAgent = req.user.role === "AGENT";
    let isVerifiedAgent = false;
    if (isAgent) {
      const profile = await AgentProfile.findOne({ user: req.user._id });
      isVerifiedAgent = Boolean(profile?.verifiedByAdmin);
    }

    post.comments.push({
      user: req.user._id as any,
      text,
      createdAt: new Date(),
      isAgent,
      isVerifiedAgent
    });
    await post.save();
    const populated = await Post.findById(post._id)
      .populate("author", "name username avatarUrl")
      .populate("comments.user", "name username avatarUrl role");

    return res.json({ post: formatPost(populated || post) });
  } catch (err) {
    console.error("commentPost error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const reportPost = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id } = req.params;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.reports = (post.reports || 0) + 1;
    if (post.reports >= 5) {
      post.status = "pending";
      post.isActive = false;
    }
    await post.save();
    return res.json({ post: formatPost(post) });
  } catch (err) {
    console.error("reportPost error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const markBestAnswer = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id } = req.params;
    const { commentId } = req.body;
    if (!commentId) return res.status(400).json({ message: "commentId required" });

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (String(post.author) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const targetComment = post.comments.find(
      (comment) => comment._id && String(comment._id) === String(commentId)
    );
    if (!targetComment) return res.status(404).json({ message: "Comment not found" });
    post.bestAnswerId = targetComment._id;
    post.comments.forEach((comment) => {
      comment.isBestAnswer = String(comment._id) === String(commentId);
    });
    await post.save();
    const populated = await Post.findById(post._id)
      .populate("author", "name username avatarUrl")
      .populate("comments.user", "name username avatarUrl role");

    return res.json({ post: formatPost(populated || post) });
  } catch (err) {
    console.error("markBestAnswer error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const topDiscussions = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      { $match: { isActive: true, status: "active" } },
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
          title: 1,
          slug: 1,
          excerpt: 1,
          category: 1,
          type: 1,
          likesCount: 1,
          commentsCount: 1,
          views: 1,
          createdAt: 1,
          "author._id": 1,
          "author.name": 1,
          "author.username": 1,
          "author.avatarUrl": 1
        }
      }
    ];

    const [items, total] = await Promise.all([
      Post.aggregate(pipeline),
      Post.countDocuments({ isActive: true, status: "active" })
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      items
    });
  } catch (err) {
    console.error("topDiscussions error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
