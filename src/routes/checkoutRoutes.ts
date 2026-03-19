import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import {
  buyNowCheckout,
  createCheckoutSession,
  getCheckoutSession,
  getCheckoutConfirmation,
  previewCheckout,
  submitCheckout,
  updateCheckoutSession
} from "../controllers/checkoutController";

const router = Router();

router.post("/session", authRequired, createCheckoutSession);
router.patch("/session/:sessionId", authRequired, updateCheckoutSession);
router.get("/session/:sessionId", authRequired, getCheckoutSession);
router.post("/buy-now", authRequired, buyNowCheckout);
router.post("/preview", authRequired, previewCheckout);
router.post("/submit", authRequired, submitCheckout);
router.get("/orders/:id/confirmation", authRequired, getCheckoutConfirmation);

export default router;
