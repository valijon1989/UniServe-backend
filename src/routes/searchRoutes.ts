import { Router } from "express";
import { authOptional, authRequired } from "../middlewares/auth";
import {
  clearSearchHistoryHandler,
  getSearchHistory,
  globalSearch,
  searchSuggestions
} from "../controllers/searchController";

const router = Router();

router.get("/suggestions", authOptional, searchSuggestions);
router.get("/history", authRequired, getSearchHistory);
router.delete("/history", authRequired, clearSearchHistoryHandler);
router.get("/", authOptional, globalSearch);

export default router;
