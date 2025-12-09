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
  productStat
} from "../controllers/productController";
import { authOptional } from "../middlewares/auth";

const router = Router();

router.post("/", authRequired, roleRequired(["AGENT"]), createProduct);
router.get("/popular", getPopularProducts);
router.get("/trending", getTrendingProducts);
router.get("/me", authRequired, roleRequired(["AGENT", "ADMIN"]), myProducts);
router.patch("/:id/status", authRequired, roleRequired(["AGENT", "ADMIN"]), updateProductStatus);
router.get("/", listProducts);
router.get("/:id", productDetail);
router.post("/:id/:action(view|like|purchase)", authOptional, productStat);

export default router;
