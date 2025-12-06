import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { commentPost, createPost, feed, likePost, topDiscussions } from "../controllers/postController";

const router = Router();

router.post("/", authRequired, createPost);
router.get("/feed", feed);
router.get("/top/discussions", topDiscussions);
router.post("/:id/like", authRequired, likePost);
router.post("/:id/comment", authRequired, commentPost);

export default router;
