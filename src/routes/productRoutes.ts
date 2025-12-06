import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  createProduct,
  getPopularProducts,
  getTrendingProducts,
  listProducts,
  myProducts,
  updateProductStatus
} from "../controllers/productController";

const router = Router();

router.post("/", authRequired, roleRequired(["AGENT"]), createProduct);
router.get("/", listProducts);
router.get("/popular", getPopularProducts);
router.get("/trending", getTrendingProducts);
router.get("/me", authRequired, roleRequired(["AGENT", "ADMIN"]), myProducts);
router.patch("/:id/status", authRequired, roleRequired(["AGENT", "ADMIN"]), updateProductStatus);

export default router;
