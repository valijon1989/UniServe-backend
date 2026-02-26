import { NextFunction, Request, Response, Router } from "express";
import { authRequired } from "../middlewares/auth";
import { avatarUpload } from "../middlewares/uploadAvatar";
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
  uploadCurrentUserAvatar
} from "../controllers/users.controller";

const router = Router();

const avatarUploadHandler = (req: Request, res: Response, next: NextFunction) => {
  avatarUpload.single("avatar")(req, res, (err: any) => {
    if (!err) return next();

    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Avatar image must be 5MB or smaller" });
    }

    if (err?.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: "Upload field must be named avatar" });
    }

    return res.status(400).json({ message: err?.message || "Invalid avatar upload" });
  });
};

router.get("/me", authRequired, getCurrentUserProfile);
router.patch("/me", authRequired, updateCurrentUserProfile);
router.post("/me/avatar", authRequired, avatarUploadHandler, uploadCurrentUserAvatar);

export default router;
