import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import {
  acceptEscrowDelivery,
  cancelPaymentIntentController,
  confirmOrderPayment,
  confirmPaymentIntent,
  confirmSourcePayment,
  createPaymentIntentResource,
  expirePaymentIntentController,
  getPaymentById,
  getPaymentIntentById,
  handlePaymentProviderWebhook,
  listPaymentMethodCatalog,
  listPaymentMethodsResource,
  listPayments,
  resendPaymentIntentSms,
  triggerAutoRelease,
  uploadPaymentIntentReceipt
} from "../controllers/paymentController";

const router = Router();

router.get("/methods", listPaymentMethodCatalog);
router.get("/catalog", listPaymentMethodsResource);
router.post("/webhooks/:providerKey", handlePaymentProviderWebhook);
router.post("/provider-events/webhook", handlePaymentProviderWebhook);

router.use(authRequired);

router.get("/", listPayments);
router.get("/history", listPayments);
router.post("/intents", createPaymentIntentResource);
router.post("/source/confirm", confirmSourcePayment);
router.post("/:orderId/confirm", confirmOrderPayment);
router.get("/intents/:id", getPaymentIntentById);
router.post("/intents/:id/confirm", confirmPaymentIntent);
router.post("/intents/:id/resend-sms", resendPaymentIntentSms);
router.post("/intents/:id/receipt", uploadPaymentIntentReceipt);
router.post("/intents/:id/expire", expirePaymentIntentController);
router.post("/intents/:id/cancel", cancelPaymentIntentController);
router.get("/:id", getPaymentById);
router.post("/:id/accept", acceptEscrowDelivery);
router.post("/:id/auto-release", triggerAutoRelease);

export default router;
