import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import {
  addDisputeEvidence,
  addDisputeMessage,
  createDispute,
  getDisputeById,
  listDisputes,
  respondToDispute
} from "../controllers/disputeController";

const router = Router();

router.use(authRequired);

router.get("/", listDisputes);
router.post("/", createDispute);
router.get("/:id", getDisputeById);
router.post("/:id/messages", addDisputeMessage);
router.post("/:id/evidence", addDisputeEvidence);
router.post("/:id/respond", respondToDispute);

export default router;
