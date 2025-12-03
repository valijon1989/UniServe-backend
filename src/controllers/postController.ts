import { Request, Response } from "express";
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
    return res.json({ posts });
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
