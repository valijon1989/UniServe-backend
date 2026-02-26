import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  becomeAgent,
  getAgentTypes,
  getAgentDetail,
  listAgentReviews,
  listAgents,
  myAgentProfile,
  topVerifiedAgents,
  updateMyAgentType,
  upsertAgentReview,
  verifyFaceId
} from "../controllers/agentController";

const router = Router();

router.post("/become", authRequired, roleRequired(["USER"]), becomeAgent);
router.patch("/me/type", authRequired, updateMyAgentType);
router.get("/types", getAgentTypes);
router.post("/verify-faceid", authRequired, roleRequired(["AGENT"]), verifyFaceId);
router.get("/me", authRequired, roleRequired(["AGENT"]), myAgentProfile);
router.get("/top-weekly", topVerifiedAgents);
router.get("/top", topVerifiedAgents);
router.get("/", listAgents);
router.get("/:id", getAgentDetail);
router.get("/:id/reviews", listAgentReviews);
router.post("/:id/reviews", authRequired, upsertAgentReview);

export default router;
