import { Router } from "express";
import { getHomeFeatured, getHomeListings } from "../controllers/listingController";

const router = Router();

router.get("/listings", getHomeListings);
router.get("/featured", getHomeFeatured);

export default router;
