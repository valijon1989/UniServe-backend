import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { getHomeDeals, getHomeFeatured, getLatestListings, getTopListings } from "../controllers/listingController";
import { listPublicAgentListings } from "../controllers/agentListingsController";

const router = Router();

router.get("/public", listPublicAgentListings);
router.get("/top", authRequired, getTopListings);
router.get("/latest", authRequired, getLatestListings);
router.get("/home", authRequired, getHomeFeatured);
router.get("/deals", authRequired, getHomeDeals);

export default router;
