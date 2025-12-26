import { Request, Response } from "express";
import { AgentProfile } from "../models/AgentProfile";
import { User } from "../models/User";

export const becomeAgent = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { kind, socialServices, materialServices, serviceCategory, taxi } = req.body;
    const allowedSeatCapacities = [4, 7, 9, 13, 20, 30, 40];

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

    const profile = await AgentProfile.create({
      user: user._id,
      kind,
      socialServices: socialServices ?? [],
      materialServices: materialServices ?? [],
      serviceCategory,
      taxi: taxi ?? undefined
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
    const agents = await AgentProfile.find().populate("user");
    return res.json({ agents });
  } catch (err) {
    console.error("listAgents error", err);
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
