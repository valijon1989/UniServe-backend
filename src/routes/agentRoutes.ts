import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  becomeAgent,
  listAgents,
  myAgentProfile,
  topVerifiedAgents,
  verifyFaceId
} from "../controllers/agentController";

const router = Router();

router.post("/become", authRequired, roleRequired(["USER"]), becomeAgent);
router.post("/verify-faceid", authRequired, roleRequired(["AGENT"]), verifyFaceId);
router.get("/me", authRequired, roleRequired(["AGENT"]), myAgentProfile);
router.get("/top", topVerifiedAgents);
router.get("/", listAgents);

export default router;
