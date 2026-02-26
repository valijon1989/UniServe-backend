import multer from "multer";
import fs from "fs";
import path from "path";

const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml"
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg"
};

const ensureAvatarDir = () => {
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }
};

const getSafeExtension = (file: any) => {
  const mimeExt = EXT_BY_MIME[file.mimetype];
  if (mimeExt) return mimeExt;

  const originalExt = path.extname(file.originalname || "").toLowerCase();
  if (originalExt) return originalExt;
  return ".jpg";
};

const avatarStorage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    ensureAvatarDir();
    cb(null, AVATAR_DIR);
  },
  filename: (_req: any, file: any, cb: any) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = getSafeExtension(file);
    cb(null, `avatar-${unique}${ext}`);
  }
});

const avatarFileFilter = (_req: any, file: any, cb: any) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, WEBP or SVG images are allowed"));
  }
  return cb(null, true);
};

export const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: {
    files: 1,
    fileSize: MAX_AVATAR_SIZE_BYTES
  }
});

export const avatarUploadDir = AVATAR_DIR;
