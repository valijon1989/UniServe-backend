import { Request, Response, NextFunction } from "express";
import { Post } from "../models/Post";

export const feed = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).populate("author", "name username role avatarUrl");
    const formattedPosts = posts.map((post) => ({
      id: post._id,
      author: post.author,
      content: (post as any).content ?? (post as any).text ?? "",
      images: post.images || [],
      category: (post as any).category ?? "",
      type: (post as any).type ?? "",
      createdAt: post.createdAt ? post.createdAt.toISOString() : new Date().toISOString()
    }));
    return res.json({
      success: true,
      items: formattedPosts
    });
  } catch (err) {
    next(err);
  }
};
