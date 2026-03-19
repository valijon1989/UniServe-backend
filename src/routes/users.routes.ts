import { NextFunction, Request, Response, Router } from "express";
import { authRequired } from "../middlewares/auth";
import { avatarUpload } from "../middlewares/uploadAvatar";
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
  uploadCurrentUserAvatar
} from "../controllers/users.controller";
import { t } from "../i18n";

const router = Router();

const avatarUploadHandler = (req: Request, res: Response, next: NextFunction) => {
  avatarUpload.single("avatar")(req, res, (err: any) => {
    if (!err) return next();

    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: t(req, "users.profile.validation.avatar_too_large.message") });
    }

    if (err?.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: t(req, "users.profile.validation.avatar_field_name.message") });
    }

    if (err?.code === "AVATAR_INVALID_TYPE") {
      return res.status(400).json({ message: t(req, "users.profile.validation.avatar_invalid_upload.message") });
    }

    return res
      .status(400)
      .json({ message: t(req, "users.profile.validation.avatar_invalid_upload.message") });
  });
};

router.get("/me", authRequired, getCurrentUserProfile);
router.patch("/me", authRequired, updateCurrentUserProfile);
router.post("/me/avatar", authRequired, avatarUploadHandler, uploadCurrentUserAvatar);

export default router;
