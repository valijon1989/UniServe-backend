import { Request, Response } from "express";
import { Product } from "../models/Product";

export const createProduct = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { title, description, price, currency, images, category } = req.body;
    if (!title || !price) {
      return res.status(400).json({ message: "title and price required" });
    }
    const product = await Product.create({
      title,
      description,
      price,
      currency: currency || "USD",
      images: images || [],
      category,
      createdBy: req.user._id
    });
    return res.status(201).json({ product });
  } catch (err) {
    console.error("createProduct error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listProducts = async (req: Request, res: Response) => {
  try {
    const products = await Product.find().populate("createdBy", "name username role");
    return res.json({ products });
  } catch (err) {
    console.error("listProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const myProducts = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const products = await Product.find({ createdBy: req.user._id });
    return res.json({ products });
  } catch (err) {
    console.error("myProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateProductStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id } = req.params;
    const { status } = req.body;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (String(product.createdBy) !== req.user._id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden" });
    }
    product.status = status;
    await product.save();
    return res.json({ product });
  } catch (err) {
    console.error("updateProductStatus error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
