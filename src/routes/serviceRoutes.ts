import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  createService,
  getServiceDetail,
  getTrendingServices,
  listServices,
  myServices
} from "../controllers/serviceController";
import {
  createServiceOrder,
  getServiceReactionSummary,
  listIncomingServiceOrders,
  listMyServiceOrders,
  toggleServiceReaction,
  updateServiceOrderStatus
} from "../controllers/serviceInteractionController";
import { reportServiceInteraction } from "../controllers/interactionReportController";

const router = Router();

router.post("/", authRequired, roleRequired(["AGENT"]), createService);
router.get("/", listServices);
router.get("/trending", getTrendingServices);
router.get("/me", authRequired, roleRequired(["AGENT", "ADMIN"]), myServices);
router.get("/orders/my", authRequired, listMyServiceOrders);
router.get("/orders/incoming", authRequired, roleRequired(["AGENT", "ADMIN"]), listIncomingServiceOrders);
router.patch("/orders/:id/status", authRequired, updateServiceOrderStatus);
router.get("/:identifier/reactions", getServiceReactionSummary);
router.post("/:identifier/reactions", authRequired, toggleServiceReaction);
router.post("/:identifier/report", authRequired, reportServiceInteraction);
router.post("/:identifier/orders", authRequired, createServiceOrder);
router.get("/:identifier", getServiceDetail);

export default router;
