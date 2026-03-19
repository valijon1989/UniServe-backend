import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import {
  createGroup,
  getCommunityGroupPosts,
  getCommunityPosts,
  getGroupDetail,
  listGroups,
  modifyMembership,
  rateGroup,
  reportGroup
} from "../controllers/communityController";
import { getTopListings, getLatestListings } from "../controllers/listingController";

const router = Router();

router.get("/groups", listGroups);
router.get("/groups/:id", getGroupDetail);
router.get("/groups/:id/posts", getCommunityGroupPosts);
router.get("/posts", getCommunityPosts);
router.get("/listings/top", authRequired, getTopListings);
router.get("/listings/latest", authRequired, getLatestListings);
router.post("/groups", authRequired, createGroup);
router.post("/groups/:id/report", authRequired, reportGroup);
router.post("/groups/:id/rate", authRequired, rateGroup);
router.post("/groups/:id/:action(join|leave)", authRequired, modifyMembership);

export default router;
