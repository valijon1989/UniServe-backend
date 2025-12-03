import { Router } from "express";
import { Post } from "../models/Post";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).populate("author", "name username role");
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

export default router;
