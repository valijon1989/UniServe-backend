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
