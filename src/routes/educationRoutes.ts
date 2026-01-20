import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  createEducationListing,
  getEducationCategories,
  getEducationListingDetail,
  listEducationListings,
  myEducationListings,
  updateEducationListing
} from "../controllers/educationController";

const router = Router();

router.get("/categories", authRequired, getEducationCategories);
router.get("/listings", authRequired, listEducationListings);
router.get("/listings/me", authRequired, roleRequired(["AGENT", "ADMIN"]), myEducationListings);
router.post("/listings", authRequired, roleRequired(["AGENT", "ADMIN"]), createEducationListing);
router.get("/listings/:id", authRequired, getEducationListingDetail);
router.patch("/listings/:id", authRequired, roleRequired(["AGENT", "ADMIN"]), updateEducationListing);

export default router;
