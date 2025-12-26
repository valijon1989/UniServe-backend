import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  acceptTaxiRide,
  agentTaxiRides,
  completeTaxiRide,
  confirmTaxiRide,
  createTaxiRideRequest,
  estimateTaxiFare,
  listNearbyRideRequests,
  listNearbyTaxis,
  myTaxiRideRequests,
  taxiDailyEarnings,
  taxiLiveBalance,
  updateTaxiLocation,
  upsertTaxiProfile
} from "../controllers/taxiController";

const router = Router();

router.post("/agents/profile", authRequired, roleRequired(["AGENT"]), upsertTaxiProfile);
router.patch("/agents/location", authRequired, roleRequired(["AGENT"]), updateTaxiLocation);
router.get("/agents/nearby", listNearbyTaxis);
router.get("/agents/earnings/daily", authRequired, roleRequired(["AGENT"]), taxiDailyEarnings);
router.get("/agents/balance", authRequired, roleRequired(["AGENT"]), taxiLiveBalance);

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
