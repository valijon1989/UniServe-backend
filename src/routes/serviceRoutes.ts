import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import { createService, getTrendingServices, listServices, myServices } from "../controllers/serviceController";

const router = Router();

router.post("/", authRequired, roleRequired(["AGENT"]), createService);
router.get("/", listServices);
router.get("/trending", getTrendingServices);
router.get("/me", authRequired, roleRequired(["AGENT", "ADMIN"]), myServices);

export default router;
