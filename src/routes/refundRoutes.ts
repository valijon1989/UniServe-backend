import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { createRefundRequestResource, getRefundRequestResource } from "../controllers/refundController";

const router = Router();

router.use(authRequired);
router.post("/", createRefundRequestResource);
router.get("/:id", getRefundRequestResource);

export default router;
