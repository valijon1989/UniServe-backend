import { Request, Response } from "express";
import { Service } from "../models/Service";
import { parsePositiveInt } from "../utils/pagination";

export const createService = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { title, description, kind, category, hourlyRate, currency, location } = req.body;
    if (!title || !kind || !category) {
      return res.status(400).json({ message: "title, kind, category required" });
    }
    const service = await Service.create({
      title,
      description,
      kind,
      category,
      hourlyRate,
      currency: currency || "USD",
      location,
      createdBy: req.user._id
    });
    return res.status(201).json({ service });
  } catch (err) {
    console.error("createService error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listServices = async (req: Request, res: Response) => {
  try {
    const services = await Service.find().populate("createdBy", "name username role");
    return res.json({ services });
  } catch (err) {
    console.error("listServices error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const myServices = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const services = await Service.find({ createdBy: req.user._id });
    return res.json({ services });
  } catch (err) {
    console.error("myServices error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getTrendingServices = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 9, 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Service.find({})
        .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      Service.countDocuments({})
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      items
    });
  } catch (err) {
    console.error("getTrendingServices error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
