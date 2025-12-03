import { Request, Response } from "express";
import { Service } from "../models/Service";

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
