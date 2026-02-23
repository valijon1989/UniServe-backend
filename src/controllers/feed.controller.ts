import { Request, Response, NextFunction } from "express";
import { Post } from "../models/Post";

export const feed = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).populate("author", "name username role avatarUrl");
    const formattedPosts = posts.map((post) => {
      const attachments = (post.attachments || []).filter((attachment) => attachment.url);
      const attachmentImages = attachments
        .filter((attachment) => attachment.type === "image" || attachment.type === "photo")
        .map((attachment) => attachment.url);
      const uniqueImages = Array.from(
        new Set([...(post.images || []), ...attachmentImages].filter(Boolean))
      );
      const coverImage = uniqueImages[0] || (post.videoUrl ? post.videoUrl : "");
      return {
        id: post._id,
        author: post.author,
        content: (post as any).content ?? (post as any).text ?? "",
        images: uniqueImages,
        image: coverImage,
        coverImage,
        imageUrl: coverImage,
        attachments,
        category: (post as any).category ?? "",
        type: (post as any).type ?? "",
        createdAt: post.createdAt ? post.createdAt.toISOString() : new Date().toISOString()
      };
    });
    return res.json({
      success: true,
      items: formattedPosts
    });
  } catch (err) {
    next(err);
  }
};
