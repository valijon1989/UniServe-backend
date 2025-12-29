import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  acceptTaxiRide,
  agentTaxiRides,
  agentTaxiOrders,
  completeTaxiRide,
  confirmTaxiRide,
  createTaxiFeedback,
  createTaxiListing,
  createTaxiOrder,
  createTaxiRideRequest,
  estimateTaxiFare,
  listTaxiFeedbackByListing,
  listTaxiListings,
  listNearbyRideRequests,
  listNearbyTaxis,
  myTaxiOrders,
  myTaxiRideRequests,
  taxiListingDetail,
  taxiDailyEarnings,
  taxiLiveBalance,
  updateTaxiListing,
  updateTaxiListingStatus,
  updateTaxiOrderStatus,
  updateTaxiLocation,
  upsertTaxiProfile
} from "../controllers/taxiController";

const router = Router();

router.post("/agents/profile", authRequired, roleRequired(["AGENT"]), upsertTaxiProfile);
router.patch("/agents/location", authRequired, roleRequired(["AGENT"]), updateTaxiLocation);
router.get("/agents/nearby", listNearbyTaxis);
router.get("/agents/earnings/daily", authRequired, roleRequired(["AGENT"]), taxiDailyEarnings);
router.get("/agents/balance", authRequired, roleRequired(["AGENT"]), taxiLiveBalance);

router.get("/listings", listTaxiListings);
router.get("/listings/:id", taxiListingDetail);
router.post("/listings", authRequired, roleRequired(["AGENT", "ADMIN"]), createTaxiListing);
router.patch("/listings/:id", authRequired, roleRequired(["AGENT", "ADMIN"]), updateTaxiListing);
router.patch("/listings/:id/status", authRequired, roleRequired(["AGENT", "ADMIN"]), updateTaxiListingStatus);

router.post("/orders", authRequired, createTaxiOrder);
router.get("/orders/my", authRequired, myTaxiOrders);
router.get("/orders/agent", authRequired, roleRequired(["AGENT", "ADMIN"]), agentTaxiOrders);
router.patch("/orders/:id/status", authRequired, updateTaxiOrderStatus);

router.post("/feedback", authRequired, createTaxiFeedback);
router.get("/feedback/listing/:id", listTaxiFeedbackByListing);

router.get("/fare/estimate", estimateTaxiFare);
router.post("/fare/estimate", estimateTaxiFare);

router.post("/rides/request", authRequired, roleRequired(["USER"]), createTaxiRideRequest);
router.get("/rides/nearby", authRequired, roleRequired(["AGENT"]), listNearbyRideRequests);
router.post("/rides/:id/accept", authRequired, roleRequired(["AGENT"]), acceptTaxiRide);
router.post("/rides/:id/confirm", authRequired, roleRequired(["USER"]), confirmTaxiRide);
router.post("/rides/:id/complete", authRequired, roleRequired(["AGENT"]), completeTaxiRide);
router.get("/rides/me", authRequired, roleRequired(["USER"]), myTaxiRideRequests);
router.get("/rides/agent", authRequired, roleRequired(["AGENT"]), agentTaxiRides);

export default router;
