import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { getHomeFeatured, getLatestListings, getTopListings } from "../controllers/listingController";

const router = Router();

router.get("/top", authRequired, getTopListings);
router.get("/latest", authRequired, getLatestListings);
router.get("/home", authRequired, getHomeFeatured);

export default router;
