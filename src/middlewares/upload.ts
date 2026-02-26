import multer from "multer";
import path from "path";
import fs from "fs";

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    const dest = path.join(__dirname, "..", "..", "static", "products");
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `product-${unique}${ext}`);
  }
});

const fileFilter = (_req: any, file: any, cb: any) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Faqat rasm fayllarini yuklash mumkin"));
  }
  cb(null, true);
};

export const productImageUpload = multer({
  storage,
  fileFilter,
  limits: { files: 20, fileSize: 5 * 1024 * 1024 }
});

const postMediaStorage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    const dest = path.join(__dirname, "..", "..", "static", "posts");
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname) || (file.mimetype.startsWith("video/") ? ".mp4" : ".jpg");
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `post-${unique}${ext.toLowerCase()}`);
  }
});

const postMediaFileFilter = (_req: any, file: any, cb: any) => {
  const allowedImage = file.mimetype.startsWith("image/");
  const allowedVideo = file.mimetype.startsWith("video/");
  if (!allowedImage && !allowedVideo) {
    return cb(new Error("Only image/video files are allowed"));
  }
  return cb(null, true);
};

export const postMediaUpload = multer({
  storage: postMediaStorage,
  fileFilter: postMediaFileFilter,
  limits: {
    files: 4,
    fileSize: 20 * 1024 * 1024
  }
});
