import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
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
import {
  getProductFeedbackSummary,
  registerProductView,
  toggleProductFeedback,
  toggleProductLike
} from "../controllers/productInteractionController";
import { reportProductInteraction } from "../controllers/interactionReportController";
import { respondRateLimited } from "../utils/controllerResponses";

const router = Router();

const interactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = String(req.user?._id || "").trim();
    if (userId) return `user:${userId}`;
    return `ip:${ipKeyGenerator(req.ip || "")}`;
  },
  handler: (req, res) => respondRateLimited(req, res, "products.interactions.rate_limited.message")
});

router.post("/", authRequired, roleRequired(["AGENT"]), createProduct);
router.post(
  "/upload",
  authRequired,
  roleRequired(["AGENT", "ADMIN"]),
  productImageUpload.array("images", 20),
  uploadProductImagesHandler
);
router.get("/popular", authOptional, getPopularProducts);
router.get("/trending", authOptional, getTrendingProducts);
router.get("/me", authRequired, roleRequired(["AGENT", "ADMIN"]), myProducts);
router.patch("/:id/status", authRequired, roleRequired(["AGENT", "ADMIN"]), updateProductStatus);
router.post("/:id/like/toggle", authRequired, interactionLimiter, toggleProductLike);
router.get("/:id/feedback", authOptional, interactionLimiter, getProductFeedbackSummary);
router.post("/:id/feedback", authRequired, interactionLimiter, toggleProductFeedback);
router.post("/:id/view", authOptional, interactionLimiter, registerProductView);
router.post("/:id/report", authRequired, interactionLimiter, reportProductInteraction);
router.get("/", authOptional, listProducts);
router.get("/:identifier", productDetail);
router.post("/:id/:action(view|like|purchase)", authOptional, productStat);

export default router;
