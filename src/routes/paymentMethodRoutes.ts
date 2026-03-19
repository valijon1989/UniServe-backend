import { Router } from "express";
import { listPaymentMethodsResource } from "../controllers/paymentController";

const router = Router();

router.get("/", listPaymentMethodsResource);

export default router;
