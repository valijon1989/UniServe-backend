import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  becomeAgent,
  getAgentDetail,
  listAgentReviews,
  listAgents,
  myAgentProfile,
  topVerifiedAgents,
  upsertAgentReview,
  verifyFaceId
} from "../controllers/agentController";

const router = Router();

router.post("/become", authRequired, roleRequired(["USER"]), becomeAgent);
router.post("/verify-faceid", authRequired, roleRequired(["AGENT"]), verifyFaceId);
router.get("/me", authRequired, roleRequired(["AGENT"]), myAgentProfile);
router.get("/top-weekly", topVerifiedAgents);
router.get("/top", topVerifiedAgents);
router.get("/", listAgents);
router.get("/:id", getAgentDetail);
router.get("/:id/reviews", listAgentReviews);
router.post("/:id/reviews", authRequired, upsertAgentReview);

export default router;
