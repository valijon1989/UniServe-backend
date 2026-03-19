import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  getAgentDashboard,
  getAgentVerificationStatus,
  requestAgentVerification
} from "../controllers/agentController";

const router = Router();

router.post("/verification/request", authRequired, roleRequired(["AGENT"]), requestAgentVerification);
router.get("/verification/status", authRequired, roleRequired(["AGENT"]), getAgentVerificationStatus);
router.get("/dashboard", authRequired, roleRequired(["AGENT"]), getAgentDashboard);

export default router;
