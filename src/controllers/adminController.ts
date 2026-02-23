import { Request, Response } from "express";
import { User } from "../models/User";
import { AgentProfile } from "../models/AgentProfile";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { Post } from "../models/Post";
import { NewsPost } from "../models/NewsPost";
import { CommunityGroupModel } from "../models/CommunityGroup";

export const adminOverview = async (_req: Request, res: Response) => {
  try {
    const [users, agents, products, services] = await Promise.all([
      User.countDocuments(),
      AgentProfile.countDocuments(),
      Product.countDocuments(),
      Service.countDocuments()
    ]);
    return res.json({ users, agents, products, services });
  } catch (err) {
    console.error("adminOverview error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.find().select("-passwordHash");
    return res.json({ users });
  } catch (err) {
    console.error("listUsers error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const verifyAgent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await AgentProfile.findById(id).populate("user");
    if (!profile) return res.status(404).json({ message: "Agent profile not found" });

    profile.verifiedByAdmin = true;
    await profile.save();

    const user = await User.findById(profile.user._id);
    if (user) {
      user.isVerified = true;
      await user.save();
    }

    return res.json({ profile });
  } catch (err) {
    console.error("verifyAgent error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listFlaggedContent = async (_req: Request, res: Response) => {
  try {
    const [posts, news, groups] = await Promise.all([
      Post.find({ reports: { $gt: 0 } }).sort({ reports: -1, createdAt: -1 }).limit(40),
      NewsPost.find({ reports: { $gt: 0 } }).sort({ reports: -1, createdAt: -1 }).limit(40),
      CommunityGroupModel.find({ spamReports: { $gt: 0 } }).sort({ spamReports: -1 }).limit(20)
    ]);
    return res.json({ posts, news, groups });
  } catch (err) {
    console.error("listFlaggedContent error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updatePostStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, isActive } = req.body;
    if (!["active", "blocked", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    post.status = status as any;
    if (typeof isActive === "boolean") {
      post.isActive = isActive;
    }
    await post.save();
    return res.json({ post });
  } catch (err) {
    console.error("updatePostStatus error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const moderateGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const group = await CommunityGroupModel.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (typeof isActive === "boolean") {
      group.isActive = isActive;
    } else {
      group.isActive = false;
    }
    await group.save();
    return res.json({ group });
  } catch (err) {
    console.error("moderateGroup error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
