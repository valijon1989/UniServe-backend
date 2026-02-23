import { Router } from "express";
import {
  adminOverview,
  listUsers,
  verifyAgent,
  listFlaggedContent,
  updatePostStatus,
  moderateGroup
} from "../controllers/adminController";
import { authRequired, roleRequired } from "../middlewares/auth";

const router = Router();

router.use(authRequired, roleRequired(["ADMIN"]));

router.get("/overview", adminOverview);
router.get("/users", listUsers);
router.post("/agents/:id/verify", verifyAgent);
router.get("/content/reports", listFlaggedContent);
router.post("/posts/:id/status", updatePostStatus);
router.post("/community/groups/:id/status", moderateGroup);

export default router;
