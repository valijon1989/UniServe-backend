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

router.use(authRequired);

router.post("/", roleRequired(["AGENT"]), createService);
router.get("/", listServices);
router.get("/trending", getTrendingServices);
router.get("/me", roleRequired(["AGENT", "ADMIN"]), myServices);
router.get("/orders/my", listMyServiceOrders);
router.get("/orders/incoming", roleRequired(["AGENT", "ADMIN"]), listIncomingServiceOrders);
router.patch("/orders/:id/status", updateServiceOrderStatus);
router.get("/:identifier/reactions", getServiceReactionSummary);
router.post("/:identifier/reactions", toggleServiceReaction);
router.post("/:identifier/report", reportServiceInteraction);
router.post("/:identifier/orders", createServiceOrder);
router.get("/:identifier", getServiceDetail);

export default router;
