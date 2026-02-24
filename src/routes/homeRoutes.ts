import { Router } from "express";
import { getHomeDeals, getHomeFeatured, getHomeListings } from "../controllers/listingController";
import { authRequired } from "../middlewares/auth";

const router = Router();

router.get("/listings", authRequired, getHomeListings);
router.get("/featured", authRequired, getHomeFeatured);
router.get("/deals", authRequired, getHomeDeals);

export default router;
