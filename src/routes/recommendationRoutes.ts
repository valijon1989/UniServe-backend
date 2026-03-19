import { Router } from "express";
import { authOptional, authRequired } from "../middlewares/auth";
import {
  createRecommendationSignal,
  getCartRecommendations,
  getDetailRecommendations,
  getHomeRecommendations,
  getOrderSuccessRecommendations
} from "../controllers/recommendationController";

const router = Router();

router.get("/home", authOptional, getHomeRecommendations);
router.get("/detail/:entityType/:identifier", authOptional, getDetailRecommendations);
router.get("/cart", authRequired, getCartRecommendations);
router.get("/orders/:orderId/success", authRequired, getOrderSuccessRecommendations);
router.post("/signals", authOptional, createRecommendationSignal);

export default router;
