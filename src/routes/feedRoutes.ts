import { Router } from "express";
import { feed } from "../controllers/feed.controller";

const router = Router();

router.get("/", feed);

export default router;
