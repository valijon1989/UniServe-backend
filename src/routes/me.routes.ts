import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { User } from "../models/User";
import { sanitizeUser } from "../utils/userSanitizer";

const router = Router();

const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;

router.get("/me", authRequired, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!._id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    return next(err);
  }
});

router.patch("/me", authRequired, async (req, res, next) => {
  try {
    const { name, bio, isPrivate, username } = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "name must be a non-empty string" });
      }
      updates.name = name.trim();
    }

    if (bio !== undefined) {
      if (typeof bio !== "string") {
        return res.status(400).json({ message: "bio must be a string" });
      }
      updates.bio = bio.trim();
    }

    if (isPrivate !== undefined) {
      if (typeof isPrivate !== "boolean") {
        return res.status(400).json({ message: "isPrivate must be boolean" });
      }
      updates.isPrivate = isPrivate;
    }

    if (username !== undefined) {
      if (typeof username !== "string") {
        return res.status(400).json({ message: "username must be a string" });
      }
      const normalizedUsername = username.trim().toLowerCase();
      if (!USERNAME_REGEX.test(normalizedUsername)) {
        return res.status(400).json({ message: "username must be 3-30 chars and contain only a-z, 0-9, ., _, -" });
      }

      const exists = await User.exists({
        username: normalizedUsername,
        _id: { $ne: req.user!._id }
      });
      if (exists) return res.status(409).json({ message: "Username already taken" });

      updates.username = normalizedUsername;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const user = await User.findByIdAndUpdate(req.user!._id, updates, {
      new: true,
      runValidators: true
    }).lean();

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user: sanitizeUser(user) });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Username already taken" });
    }
    return next(err);
  }
});

export default router;
