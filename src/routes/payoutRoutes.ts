import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth";
import {
  createPayoutAccount,
  getPayoutBalance,
  getPayoutRequestDetail,
  listMyPayoutRequests,
  listPayoutAccounts,
  listSettlementHistory,
  requestPayout,
  updatePayoutAccount
} from "../controllers/payoutController";

const router = Router();

router.use(authRequired);

router.get("/accounts", roleRequired(["AGENT", "ADMIN"]), listPayoutAccounts);
router.post("/accounts", roleRequired(["AGENT", "ADMIN"]), createPayoutAccount);
router.patch("/accounts/:accountId", roleRequired(["AGENT", "ADMIN"]), updatePayoutAccount);
router.get("/balance", roleRequired(["AGENT", "ADMIN"]), getPayoutBalance);
router.get("/settlements", roleRequired(["AGENT", "ADMIN"]), listSettlementHistory);
router.get("/requests", roleRequired(["AGENT", "ADMIN"]), listMyPayoutRequests);
router.get("/requests/:requestId", roleRequired(["AGENT", "ADMIN"]), getPayoutRequestDetail);
router.post("/requests", roleRequired(["AGENT", "ADMIN"]), requestPayout);
router.get("/my", roleRequired(["AGENT", "ADMIN"]), listMyPayoutRequests);
router.post("/request", roleRequired(["AGENT", "ADMIN"]), requestPayout);

export default router;
