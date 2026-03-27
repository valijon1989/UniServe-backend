import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { User } from "../models/User";
import { sanitizeUser } from "../utils/userSanitizer";
import { ensureAbsoluteUrl } from "../utils/imageHelpers";
import { resolveAvatarUrl } from "../utils/avatarImage";
import { avatarUploadDir } from "../middlewares/uploadAvatar";
import { t } from "../i18n";
import { respondAuthRequired } from "../utils/controllerResponses";

const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
const AVATAR_PUBLIC_PREFIX = "/api/media/avatars/";

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const normalizeLanguages = (value: unknown) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  return null;
};

const toSafeUser = (value: unknown) => {
  const sanitized = sanitizeUser(value);
  if (!sanitized) return null;
  const id = String(sanitized.id || "user");
  const languages = normalizeLanguages(sanitized.languages ?? sanitized.language) || [];
  const location =
    normalizeText(sanitized.location) ||
    normalizeText(sanitized.region) ||
    "";
  const phone = normalizeText(sanitized.phone);

  return {
    ...sanitized,
    phone,
    location,
    region: location,
    languages,
    language: languages.join(", "),
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
    if (!req.user) return respondAuthRequired(req, res);
    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ message: t(req, "users.profile.lookup.not_found.message") });
    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    console.error("getCurrentUserProfile error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const updateCurrentUserProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "avatarUrl")) {
      return res
        .status(400)
        .json({ message: t(req, "users.profile.validation.avatar_direct_update.message") });
    }

    const {
      name,
      bio,
      isPrivate,
      username,
      displayName,
      phone,
      location,
      region,
      languages,
      language
    } = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: t(req, "users.profile.validation.name_required.message") });
      }
      updates.name = name.trim();
    }

    if (displayName !== undefined) {
      if (typeof displayName !== "string") {
        return res.status(400).json({ message: t(req, "users.profile.validation.display_name_string.message") });
      }
      updates.displayName = displayName.trim();
    }

    if (bio !== undefined) {
      if (typeof bio !== "string") {
        return res.status(400).json({ message: t(req, "users.profile.validation.bio_string.message") });
      }
      updates.bio = bio.trim();
    }

    if (isPrivate !== undefined) {
      if (typeof isPrivate !== "boolean") {
        return res.status(400).json({ message: t(req, "users.profile.validation.is_private_boolean.message") });
      }
      updates.isPrivate = isPrivate;
    }

    if (username !== undefined) {
      if (typeof username !== "string") {
        return res.status(400).json({ message: t(req, "users.profile.validation.username_string.message") });
      }
      const normalizedUsername = username.trim().toLowerCase();
      if (!USERNAME_REGEX.test(normalizedUsername)) {
          return res.status(400).json({ message: t(req, "users.profile.validation.username_format.message") });
      }

      const exists = await User.exists({
        username: normalizedUsername,
        _id: { $ne: req.user._id }
      });
      if (exists) return res.status(409).json({ message: t(req, "users.profile.validation.username_taken.message") });
      updates.username = normalizedUsername;
    }

    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return res.status(400).json({ message: t(req, "users.profile.validation.phone_string.message") });
      }
      updates.phone = phone.trim();
    }

    const rawLocation = location ?? region;
    if (rawLocation !== undefined) {
      if (typeof rawLocation !== "string") {
        return res.status(400).json({ message: t(req, "users.profile.validation.location_string.message") });
      }
      const normalizedLocation = rawLocation.trim();
      updates.location = normalizedLocation;
      updates.region = normalizedLocation;
    }

    if (languages !== undefined || language !== undefined) {
      const normalizedLanguages = normalizeLanguages(languages ?? language);
      if (!normalizedLanguages) {
        return res.status(400).json({ message: t(req, "users.profile.validation.languages_array.message") });
      }
      updates.languages = normalizedLanguages;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: t(req, "users.profile.validation.no_fields.message") });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true
    }).lean();
    if (!user) return res.status(404).json({ message: t(req, "users.profile.lookup.not_found.message") });

    return res.json({ user: toSafeUser(user) });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: t(req, "users.profile.validation.username_taken.message") });
    }
    console.error("updateCurrentUserProfile error", err);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const uploadCurrentUserAvatar = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const file = req.file as any;
    if (!file?.filename || typeof file.filename !== "string") {
      return res.status(400).json({ message: t(req, "users.profile.validation.avatar_required.message") });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      await removeAvatarByFilename(file.filename);
      return res.status(404).json({ message: t(req, "users.profile.lookup.not_found.message") });
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
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
