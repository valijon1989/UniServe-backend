import { Router } from "express";
import { Product } from "../models/Product";
import { authRequired } from "../middlewares/auth";
import { resolveAvatarUrl } from "../utils/avatarImage";

const router = Router();

// GET /api/agent/listings - public list of active products
router.get("/", async (_req, res, next) => {
  try {
    const listings = await Product.find({ status: "ACTIVE" })
      .sort({ createdAt: -1 })
      .populate("createdBy", "name username role avatarUrl")
      .lean();

    const normalized = listings.map((item: any) => ({
      ...item,
      createdBy: item?.createdBy
        ? {
            ...item.createdBy,
            avatarUrl: resolveAvatarUrl(item.createdBy.avatarUrl, item.createdBy._id)
          }
        : item.createdBy
    }));

    res.json(normalized);
  } catch (err) {
    next(err);
  }
});

// POST /api/agent/listings - agent creates listing
router.post("/", authRequired, async (req, res, next) => {
  try {
    const { title, description, price, currency, images, category } = req.body;
    const listing = await Product.create({
      title,
      description,
      price,
      currency,
      images: images || [],
      category,
      status: "ACTIVE",
      createdBy: req.user!._id
    });
    res.status(201).json(listing);
  } catch (err) {
    next(err);
  }
});

export default router;
