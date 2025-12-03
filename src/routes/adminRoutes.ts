import { Router } from "express";
import { adminOverview, listUsers, verifyAgent } from "../controllers/adminController";
import { authRequired, roleRequired } from "../middlewares/auth";

const router = Router();

router.use(authRequired, roleRequired(["ADMIN"]));

router.get("/overview", adminOverview);
router.get("/users", listUsers);
router.post("/agents/:id/verify", verifyAgent);

export default router;
