import { Request, Response } from "express";
import { User } from "../models/User";
import { AgentProfile } from "../models/AgentProfile";
import { Product } from "../models/Product";
import { Service } from "../models/Service";

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
