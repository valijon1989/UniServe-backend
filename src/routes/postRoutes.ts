import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import {
  commentPost,
  createPost,
  feed,
  getPostDetail,
  likePost,
  markBestAnswer,
  reportPost,
  topDiscussions
} from "../controllers/postController";

const router = Router();

router.post("/", authRequired, createPost);
router.get("/feed", feed);
router.get("/top/discussions", topDiscussions);
router.get("/:id", getPostDetail);
router.post("/:id/like", authRequired, likePost);
router.post("/:id/report", authRequired, reportPost);
router.post("/:id/best-answer", authRequired, markBestAnswer);
router.post("/:id/comment", authRequired, commentPost);

export default router;
