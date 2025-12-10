import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  createProduct,
  getPopularProducts,
  getTrendingProducts,
  listProducts,
  myProducts,
  updateProductStatus,
  productDetail,
  productStat,
  uploadProductImagesHandler
} from "../controllers/productController";
import { authOptional } from "../middlewares/auth";
import { productImageUpload } from "../middlewares/upload";

const router = Router();

router.post("/", authRequired, roleRequired(["AGENT"]), createProduct);
router.post(
  "/upload",
  authRequired,
  roleRequired(["AGENT", "ADMIN"]),
  productImageUpload.array("images", 20),
  uploadProductImagesHandler
);
router.get("/popular", getPopularProducts);
router.get("/trending", getTrendingProducts);
router.get("/me", authRequired, roleRequired(["AGENT", "ADMIN"]), myProducts);
router.patch("/:id/status", authRequired, roleRequired(["AGENT", "ADMIN"]), updateProductStatus);
router.get("/", listProducts);
router.get("/:id", productDetail);
router.post("/:id/:action(view|like|purchase)", authOptional, productStat);

export default router;
