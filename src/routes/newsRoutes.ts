import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  createNews,
  getNewsDetail,
  listNews,
  reportNews,
  updateNewsStatus
} from "../controllers/newsController";

const router = Router();

router.get("/", listNews);
router.get("/:slug", getNewsDetail);
router.post("/", authRequired, createNews);
router.post("/:slug/report", authRequired, reportNews);
router.post("/:slug/status", authRequired, roleRequired(["ADMIN"]), updateNewsStatus);

export default router;
