import { Router } from "express";
import { serviceCategoryTree } from "../data/serviceCategories";

const router = Router();

router.get("/", (_req, res) => {
  res.json(serviceCategoryTree);
});

export default router;
