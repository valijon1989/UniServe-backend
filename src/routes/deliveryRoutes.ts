import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { createDeliveryOrder, getDeliveryOrderById } from "../controllers/deliveryController";

const router = Router();

router.use(authRequired);
router.post("/orders", createDeliveryOrder);
router.get("/orders/:id", getDeliveryOrderById);

export default router;
