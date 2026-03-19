import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  createAgentListing,
  deleteAgentListing,
  getMyAgentListingById,
  listMyAgentListings,
  updateAgentListing,
  updateAgentListingStatus
} from "../controllers/agentListingsController";

const router = Router();

router.use(authRequired, roleRequired(["AGENT"]));

router.get("/", listMyAgentListings);
router.post("/", createAgentListing);
router.get("/:id", getMyAgentListingById);
router.patch("/:id", updateAgentListing);
router.patch("/:id/status", updateAgentListingStatus);
router.delete("/:id", deleteAgentListing);

export default router;
