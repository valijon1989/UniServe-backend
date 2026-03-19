import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { getCurrentUserProfile, updateCurrentUserProfile } from "../controllers/users.controller";

const router = Router();

router.get("/me", authRequired, getCurrentUserProfile);
router.patch("/me", authRequired, updateCurrentUserProfile);

export default router;
