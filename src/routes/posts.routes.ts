import { Router } from "express";
import { authRequired, authOptional } from "../middlewares/auth";
import { postMediaUpload } from "../middlewares/upload";
import {
  commentPost,
  createPost,
  createPostComment,
  dislikePost,
  feed,
  getPostByIdOrSlug,
  likePost,
  listPostComments,
  listPosts,
  markBestAnswer,
  reportPost,
  sharePost,
  topDiscussions
} from "../controllers/posts.controller";

const router = Router();

const postMediaUploadMiddleware = (req: any, res: any, next: any) => {
  const uploadMediaArray = (fieldName: string) => postMediaUpload.array(fieldName, 4);

  uploadMediaArray("media[]")(req, res, (firstErr: any) => {
    if (!firstErr) return next();
    const isUnexpectedField = firstErr?.code === "LIMIT_UNEXPECTED_FILE";
    if (!isUnexpectedField) return next(firstErr);
    uploadMediaArray("media")(req, res, (secondErr: any) => {
      if (!secondErr) return next();
      return next(firstErr);
    });
  });
};

// Social feed endpoints
router.get("/", authOptional, listPosts);
router.post("/", authRequired, postMediaUploadMiddleware, createPost);
router.get("/feed", authOptional, feed);
router.get("/top/discussions", topDiscussions);

// Reactions and counters
router.post("/:id/like", authRequired, likePost);
router.post("/:id/dislike", authRequired, dislikePost);
router.post("/:id/share", authRequired, sharePost);
router.post("/:id/report", authRequired, reportPost);
router.post("/:id/best-answer", authRequired, markBestAnswer);

// Comments
router.get("/:id/comments", listPostComments);
router.post("/:id/comments", authRequired, createPostComment);

// Legacy alias
router.post("/:id/comment", authRequired, commentPost);

// Detail
router.get("/:idOrSlug", authOptional, getPostByIdOrSlug);

export default router;
