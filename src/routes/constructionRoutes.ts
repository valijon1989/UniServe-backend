import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  createConstructionListing,
  getConstructionCategories,
  getConstructionListingDetail,
  listConstructionListings,
  myConstructionListings,
  updateConstructionListing
} from "../controllers/constructionController";

const router = Router();

router.get("/categories", authRequired, getConstructionCategories);
router.get("/listings", authRequired, listConstructionListings);
router.get("/listings/me", authRequired, roleRequired(["AGENT", "ADMIN"]), myConstructionListings);
router.post("/listings", authRequired, roleRequired(["AGENT", "ADMIN"]), createConstructionListing);
router.get("/listings/:id", authRequired, getConstructionListingDetail);
router.patch("/listings/:id", authRequired, roleRequired(["AGENT", "ADMIN"]), updateConstructionListing);

export default router;
