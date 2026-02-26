import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { User } from "../models/User";
import { sanitizeUser } from "../utils/userSanitizer";
import { ensureAbsoluteUrl } from "../utils/imageHelpers";
import { resolveAvatarUrl } from "../utils/avatarImage";
import { avatarUploadDir } from "../middlewares/uploadAvatar";

const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
const AVATAR_PUBLIC_PREFIX = "/api/media/avatars/";

const toSafeUser = (value: unknown) => {
  const sanitized = sanitizeUser(value);
  if (!sanitized) return null;
  const id = String(sanitized.id || "user");
  return {
    ...sanitized,
    avatarUrl: resolveAvatarUrl(sanitized.avatarUrl, id)
  };
};

const toAvatarPublicUrl = (filename: string) => {
  const routePath = `${AVATAR_PUBLIC_PREFIX}${encodeURIComponent(filename)}`;
  return ensureAbsoluteUrl(routePath) || routePath;
};

const extractAvatarFilename = (avatarUrl: string | undefined) => {
  if (!avatarUrl || typeof avatarUrl !== "string") return null;

  let pathname = avatarUrl.trim();
  if (!pathname) return null;

  try {
    pathname = new URL(pathname).pathname;
  } catch {
    // already a relative path
  }

  if (!pathname.startsWith(AVATAR_PUBLIC_PREFIX)) return null;
  const rawFilename = decodeURIComponent(pathname.slice(AVATAR_PUBLIC_PREFIX.length));
  if (!rawFilename || rawFilename.includes("/") || rawFilename.includes("\\")) return null;
  return rawFilename;
};

const removeAvatarByFilename = async (filename: string | null) => {
  if (!filename) return;
  const fullPath = path.join(avatarUploadDir, filename);
  try {
    await fs.promises.unlink(fullPath);
  } catch {
    // ignore missing file/remove failures
  }
};

export const getCurrentUserProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    console.error("getCurrentUserProfile error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateCurrentUserProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "avatarUrl")) {
      return res
        .status(400)
        .json({ message: "avatarUrl can only be updated via POST /api/users/me/avatar" });
    }

    const { name, bio, isPrivate, username, displayName } = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "name must be a non-empty string" });
      }
      updates.name = name.trim();
    }

    if (displayName !== undefined) {
      if (typeof displayName !== "string") {
        return res.status(400).json({ message: "displayName must be a string" });
      }
      updates.displayName = displayName.trim();
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
        _id: { $ne: req.user._id }
      });
      if (exists) return res.status(409).json({ message: "Username already taken" });
      updates.username = normalizedUsername;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true
    }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user: toSafeUser(user) });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Username already taken" });
    }
    console.error("updateCurrentUserProfile error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const uploadCurrentUserAvatar = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    const file = req.file as any;
    if (!file?.filename || typeof file.filename !== "string") {
      return res.status(400).json({ message: "avatar image is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      await removeAvatarByFilename(file.filename);
      return res.status(404).json({ message: "User not found" });
    }

    const previousFilename = extractAvatarFilename(user.avatarUrl);
    const nextAvatarUrl = toAvatarPublicUrl(file.filename);

    user.avatarUrl = nextAvatarUrl;
    await user.save();

    if (previousFilename && previousFilename !== file.filename) {
      await removeAvatarByFilename(previousFilename);
    }

    return res.json({
      avatarUrl: resolveAvatarUrl(user.avatarUrl, user._id),
      user: toSafeUser(user)
    });
  } catch (err) {
    console.error("uploadCurrentUserAvatar error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
