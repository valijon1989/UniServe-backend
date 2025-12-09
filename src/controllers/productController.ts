import { Request, Response } from "express";
import { Product } from "../models/Product";
import { parsePositiveInt } from "../utils/pagination";
import mongoose from "mongoose";

type StubProduct = {
  slug: string;
  name: string;
  price: number;
  images: string[];
  description: string;
  category: string;
  subCategory?: string;
  rating?: { avg: number; count: number };
  stats?: { views: number; likes: number; purchases: number };
};

const fallbackImage =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80";
const stubImage = (slug: string) =>
  `https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80&slug=${slug}`;
const baseStats = { views: 120, likes: 15, purchases: 6 };
const baseRating = { avg: 4.3, count: 12 };
const stubProducts: StubProduct[] = [
  { slug: "pc-1", name: "Office PC", price: 2800000, images: [stubImage("pc-1")], description: "Demo PC 1", category: "elektronika", subCategory: "pc", rating: baseRating, stats: baseStats },
  { slug: "pc-2", name: "Mini PC", price: 2600000, images: [stubImage("pc-2")], description: "Demo PC 2", category: "elektronika", subCategory: "pc", rating: baseRating, stats: baseStats },
  { slug: "pc-3", name: "Gaming PC", price: 4500000, images: [stubImage("pc-3")], description: "Demo PC 3", category: "elektronika", subCategory: "pc", rating: baseRating, stats: baseStats },
  { slug: "ready-1", name: "Tayyor taom box", price: 115000, images: [stubImage("ready-1")], description: "Ready meal box", category: "oziq-ovqat", subCategory: "tayyor-maxsulotlar", rating: baseRating, stats: baseStats },
  { slug: "ready-2", name: "Tayyor salat", price: 65000, images: [stubImage("ready-2")], description: "Ready salad", category: "oziq-ovqat", subCategory: "tayyor-maxsulotlar", rating: baseRating, stats: baseStats },
  { slug: "ready-3", name: "Tayyor sho'rva", price: 85000, images: [stubImage("ready-3")], description: "Ready soup", category: "oziq-ovqat", subCategory: "tayyor-maxsulotlar", rating: baseRating, stats: baseStats },
  { slug: "frag-1", name: "Atir", price: 520000, images: [stubImage("frag-1")], description: "Fragrance demo", category: "gozallik", subCategory: "atirlar", rating: baseRating, stats: baseStats },
  { slug: "skin-1", name: "Yuz kremi", price: 220000, images: [stubImage("skin-1")], description: "Skin care demo", category: "gozallik", subCategory: "yuz-kremlari", rating: baseRating, stats: baseStats },
  { slug: "car-1", name: "Sedan 2020", price: 145000000, images: [stubImage("car-1")], description: "Car demo", category: "avto-texnika", subCategory: "avtomobil", rating: baseRating, stats: baseStats },
  { slug: "carpart-1", name: "Tormoz diski", price: 1800000, images: [stubImage("carpart-1")], description: "Car part demo", category: "avto-texnika", subCategory: "avtomobil-extiyot-qismlari", rating: baseRating, stats: baseStats },
  { slug: "tech-1", name: "Notebook i7", price: 9500000, images: [stubImage("tech-1")], description: "Tech demo", category: "avto-texnika", subCategory: "texnika", rating: baseRating, stats: baseStats },
  { slug: "vac-1", name: "Chang yutkich", price: 1450000, images: [stubImage("vac-1")], description: "Vacuum demo", category: "maishiy-uskunalar", subCategory: "chang-yutkich", rating: baseRating, stats: baseStats },
  { slug: "wash-1", name: "Kir yuvish mashinasi", price: 4200000, images: [stubImage("wash-1")], description: "Washer demo", category: "maishiy-uskunalar", subCategory: "kir-yuvish", rating: baseRating, stats: baseStats },
  { slug: "men-1", name: "Erkaklar T-shirt", price: 180000, images: [stubImage("men-1")], description: "Men wear", category: "kiyim-kechak", subCategory: "erkaklar", rating: baseRating, stats: baseStats },
  { slug: "women-1", name: "Ayollar bluzka", price: 210000, images: [stubImage("women-1")], description: "Women wear", category: "kiyim-kechak", subCategory: "ayollar", rating: baseRating, stats: baseStats }
];

const toDetailDto = (p: any) => ({
  id: p._id?.toString?.() ?? p.slug ?? p.id,
  name: p.name || p.title,
  description: p.description || "",
  price: p.price || 0,
  oldPrice: p.oldPrice,
  thumbnail: p.thumbnail || p.images?.[0] || fallbackImage,
  images: p.images?.length ? p.images : [fallbackImage],
  rating: p.rating || { avg: 0, count: 0 },
  stats: p.stats || { views: p.views || 0, likes: p.likes || 0, purchases: p.orders || 0 },
  category: p.category,
  subCategory: p.subCategory,
  brand: p.brand,
  condition: p.condition,
  size: p.size,
  season: p.season,
  audience: p.audience,
  vendor: p.vendor || p.createdBy
});

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
    // Return only stubbed catalog to avoid duplicate keys and keep consistent slugs
    const products = stubProducts.map((s) => toDetailDto(s));
    return res.json({ products });
  } catch (err) {
    console.error("listProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const productDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let product: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id).populate("createdBy", "name username role");
    }
    if (!product) {
      const stub = stubProducts.find((s) => s.slug === id);
      if (stub) {
        product = stub;
      }
    }
    if (!product) {
      const fallback = {
        slug: id,
        name: id,
        price: 100000,
        images: [stubImage(id)],
        description: `${id} (stub)`,
        category: "oziq-ovqat",
        subCategory: "tayyor-maxsulotlar",
        rating: baseRating,
        stats: { views: 0, likes: 0, purchases: 0 }
      };
      return res.json(toDetailDto(fallback));
    }
    return res.json(toDetailDto(product));
  } catch (err) {
    console.error("productDetail error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const productStat = async (req: Request, res: Response) => {
  try {
    const { id, action } = req.params;
    if (action !== "view" && !req.user) {
      return res.status(401).json({ message: "Login required" });
    }

    let product: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id);
    }
    if (!product) {
      const stub = stubProducts.find((s) => s.slug === id);
      if (stub) {
        product = stub;
      }
    }
    if (!product) {
      product = {
        _id: id,
        stats: { views: 0, likes: 0, purchases: 0 }
      };
    }

    const stats = product.stats || { views: product.views || 0, likes: product.likes || 0, purchases: product.orders || 0 };
    if (action === "view") stats.views = (stats.views || 0) + 1;
    if (action === "like") stats.likes = (stats.likes || 0) + 1;
    if (action === "purchase") stats.purchases = (stats.purchases || 0) + 1;
    if (product.slug) {
      const stub = stubProducts.find((s) => s.slug === product.slug);
      if (stub) stub.stats = stats;
    }
    return res.json({ stats });
  } catch (err) {
    console.error("productStat error", err);
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

export const getPopularProducts = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 8, 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find({})
        .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      Product.countDocuments({})
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      items
    });
  } catch (err) {
    console.error("getPopularProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getTrendingProducts = async (req: Request, res: Response) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000000);
    const limit = parsePositiveInt(req.query.limit, 9, 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find({})
        .sort({ orders: -1, views: -1, likes: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name username role avatarUrl"),
      Product.countDocuments({})
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      items
    });
  } catch (err) {
    console.error("getTrendingProducts error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
