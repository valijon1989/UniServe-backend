import crypto from "crypto";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { Product } from "../models/Product";
import { ProductFeedback, type ProductFeedbackValue } from "../models/ProductFeedback";
import { ProductView } from "../models/ProductView";
import { findProductByIdentifier } from "../services/productLookup";
import { recordRecommendationSignal } from "../services/recommendationEngine";
import { respondAuthRequired } from "../utils/controllerResponses";

const ANON_VIEWER_COOKIE = "uniserve_anon_id";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const createAnonId = () =>
  typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");

const getOrSetAnonId = (req: Request, res: Response): string => {
  const existing = String(req.cookies?.[ANON_VIEWER_COOKIE] || "").trim();
  if (existing) return existing;

  const anonId = createAnonId();
  res.cookie(ANON_VIEWER_COOKIE, anonId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: ONE_YEAR_MS,
    path: "/"
  });
  return anonId;
};

const resolveCount = (raw: any, modernKey: "likeCount" | "viewCount") => {
  const legacyKey = modernKey === "likeCount" ? "likes" : "views";
  const modern = Number(raw?.[modernKey]);
  if (Number.isFinite(modern)) return modern;
  const legacy = Number(raw?.[legacyKey]);
  if (Number.isFinite(legacy)) return legacy;
  return 0;
};

const normalizeFeedbackValue = (value: unknown): ProductFeedbackValue | null => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "HELPFUL") return "HELPFUL";
  if (normalized === "UNHELPFUL") return "UNHELPFUL";
  if (normalized === "LIKE") return "HELPFUL";
  if (normalized === "DISLIKE") return "UNHELPFUL";
  return null;
};

const syncHelpfulCounters = async (productId: mongoose.Types.ObjectId) => {
  const helpfulCount = await ProductFeedback.countDocuments({ productId, feedback: "HELPFUL" });
  await Product.updateOne({ _id: productId }, { $set: { likeCount: helpfulCount, likes: helpfulCount } });
  return helpfulCount;
};

const buildProductFeedbackSummary = async (productId: mongoose.Types.ObjectId, userId?: string | null) => {
  const [helpfulCount, unhelpfulCount, current] = await Promise.all([
    ProductFeedback.countDocuments({ productId, feedback: "HELPFUL" }),
    ProductFeedback.countDocuments({ productId, feedback: "UNHELPFUL" }),
    userId ? ProductFeedback.findOne({ productId, userId }).lean() : Promise.resolve(null)
  ]);

  await Product.updateOne({ _id: productId }, { $set: { likeCount: helpfulCount, likes: helpfulCount } });

  return {
    helpfulCount,
    unhelpfulCount,
    feedback:
      current?.feedback === "HELPFUL" ? "helpful" : current?.feedback === "UNHELPFUL" ? "unhelpful" : null,
    likeCount: helpfulCount,
    liked: current?.feedback === "HELPFUL"
  };
};

export const toggleProductLike = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const product = await findProductByIdentifier(req.params.id);
    if (!product?._id) return res.status(404).json({ message: "Product not found" });
    const productId = new mongoose.Types.ObjectId(String(product._id));

    const userIdRaw = String(req.user._id || "");
    if (!mongoose.Types.ObjectId.isValid(userIdRaw)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const userId = new mongoose.Types.ObjectId(userIdRaw);

    const existingFeedback = await ProductFeedback.findOne({ productId, userId });
    let liked = false;

    if (existingFeedback?.feedback === "HELPFUL") {
      await existingFeedback.deleteOne();
      liked = false;
    } else {
      if (existingFeedback) {
        existingFeedback.feedback = "HELPFUL";
        await existingFeedback.save();
      } else {
        await ProductFeedback.create({ productId, userId, feedback: "HELPFUL" });
      }
      liked = true;
    }

    const likeCount = await syncHelpfulCounters(productId);
    await recordRecommendationSignal({
      userId: req.user._id,
      entityType: "PRODUCT",
      entityId: String(productId),
      entityIdentifier: String((product as any).slug || productId),
      action: liked ? "LIKE" : "DISLIKE",
      categoryKey: String((product as any).category || "").trim() || null
    }).catch(() => null);

    return res.json({ liked, likeCount });
  } catch (err) {
    console.error("toggleProductLike error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getProductFeedbackSummary = async (req: Request, res: Response) => {
  try {
    const product = await findProductByIdentifier(req.params.id);
    if (!product?._id) return res.status(404).json({ message: "Product not found" });

    const summary = await buildProductFeedbackSummary(
      new mongoose.Types.ObjectId(String(product._id)),
      req.user?._id || null
    );
    return res.json(summary);
  } catch (err) {
    console.error("getProductFeedbackSummary error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const toggleProductFeedback = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const product = await findProductByIdentifier(req.params.id);
    if (!product?._id) return res.status(404).json({ message: "Product not found" });

    const feedback = normalizeFeedbackValue(req.body.feedback);
    if (!feedback) {
      return res.status(400).json({ message: "feedback must be helpful or unhelpful" });
    }

    const productId = new mongoose.Types.ObjectId(String(product._id));
    const userId = new mongoose.Types.ObjectId(String(req.user._id));
    const existingFeedback = await ProductFeedback.findOne({ productId, userId });

    if (existingFeedback?.feedback === feedback) {
      await existingFeedback.deleteOne();
    } else if (existingFeedback) {
      existingFeedback.feedback = feedback;
      await existingFeedback.save();
    } else {
      await ProductFeedback.create({ productId, userId, feedback });
    }

    const summary = await buildProductFeedbackSummary(productId, req.user._id);
    await recordRecommendationSignal({
      userId: req.user._id,
      entityType: "PRODUCT",
      entityId: String(productId),
      entityIdentifier: String((product as any).slug || productId),
      action: feedback === "HELPFUL" ? "LIKE" : "DISLIKE",
      categoryKey: String((product as any).category || "").trim() || null
    }).catch(() => null);
    return res.json(summary);
  } catch (err) {
    console.error("toggleProductFeedback error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const registerProductView = async (req: Request, res: Response) => {
  try {
    const product = await findProductByIdentifier(req.params.id);
    if (!product?._id) return res.status(404).json({ message: "Product not found" });
    const productId = new mongoose.Types.ObjectId(String(product._id));

    let createdNewView = false;

    if (req.user?._id && mongoose.Types.ObjectId.isValid(String(req.user._id))) {
      const userId = new mongoose.Types.ObjectId(String(req.user._id));
      const result = await ProductView.updateOne(
        { productId, userId },
        { $setOnInsert: { productId, userId } },
        { upsert: true }
      );
      createdNewView = Boolean((result as any).upsertedCount || (result as any).upsertedId);
    } else {
      const anonId = getOrSetAnonId(req, res);
      const result = await ProductView.updateOne(
        { productId, anonId },
        { $setOnInsert: { productId, anonId } },
        { upsert: true }
      );
      createdNewView = Boolean((result as any).upsertedCount || (result as any).upsertedId);
    }

    if (createdNewView) {
      await Product.updateOne({ _id: productId }, { $inc: { viewCount: 1, views: 1 } });
      await recordRecommendationSignal({
        userId: req.user?._id || null,
        entityType: "PRODUCT",
        entityId: String(productId),
        entityIdentifier: String((product as any).slug || productId),
        action: "VIEW",
        categoryKey: String((product as any).category || "").trim() || null
      }).catch(() => null);
    }

    const updated = await Product.findById(productId).select("viewCount views").lean();
    const viewCount = resolveCount(updated, "viewCount");

    return res.json({ viewCount });
  } catch (err) {
    console.error("registerProductView error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
