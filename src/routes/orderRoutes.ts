import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import {
  appendOrderFulfillmentEvent,
  confirmOrderReceipt,
  createOrder,
  getOrderById,
  getOrderConfirmation,
  getOrderEscrowStatus,
  getOrderPaymentInstructions,
  listOrderFulfillmentHistory,
  listOrders,
  rejectOrderReceipt,
  startOrderFulfillment,
  updateOrderStatus
} from "../controllers/orderController";

const router = Router();

router.use(authRequired);

router.post("/", createOrder);
router.get("/", listOrders);
router.get("/:id/confirmation", getOrderConfirmation);
router.get("/:id/payment-instructions", getOrderPaymentInstructions);
router.get("/:id/invoice", getOrderPaymentInstructions);
router.get("/:id/escrow-status", getOrderEscrowStatus);
router.get("/:id/fulfillment", listOrderFulfillmentHistory);
router.post("/:id/confirm", confirmOrderReceipt);
router.post("/:id/reject", rejectOrderReceipt);
router.post("/:id/fulfillment/start", startOrderFulfillment);
router.post("/:id/fulfillment/events", appendOrderFulfillmentEvent);
router.patch("/:id/status", updateOrderStatus);
router.get("/:id", getOrderById);

export default router;
