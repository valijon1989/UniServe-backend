import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  forgotPassword,
  forgotUsername,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword
} from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/requireAuth";

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const loginLimiter = rateLimit({
  windowMs: toNumber(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: toNumber(process.env.LOGIN_RATE_LIMIT_MAX, 10),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." }
});

const recoveryLimiter = rateLimit({
  windowMs: toNumber(process.env.RECOVERY_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: toNumber(process.env.RECOVERY_RATE_LIMIT_MAX, 10),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." }
});

const router = Router();

router.post("/register", register);
router.post("/login", loginLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

router.post("/forgot-username", recoveryLimiter, forgotUsername);
router.post("/forgot-password", recoveryLimiter, forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
