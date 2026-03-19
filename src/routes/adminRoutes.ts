import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getAdminArchitecture,
  adminOverview,
  getAdminWorkspace,
  listCommunityReports,
  listModerationListings,
  listUsers,
  verifyAgent,
  listFlaggedContent,
  moderateListing,
  resolveCommunityReport,
  updatePostStatus,
  moderateGroup
} from "../controllers/adminController";
import {
  acceptAdminInvite,
  approveAdmin,
  createRole,
  getAuditLogs,
  getPermissions,
  getRoles,
  inviteAdmin,
  listAdmins,
  revokeAdmin,
  updateAdminAssignedPermissions,
  updateAdminDepartmentPosition,
  updateAdminRoles,
  updateAdminScopes,
  updateRole
} from "../controllers/adminManagementController";
import {
  bootstrapPrimaryAdmin,
  enterAdminMode,
  getAdminAuthMe,
  loginAdminAccount,
  logoutAdminAccount,
  listAdminSessions,
  registerAdminAccount,
  revokeAdminSession,
  revokeAllAdminSessions,
  setupAdminMfa,
  verifyAdminMfa
} from "../controllers/adminAuthController";
import {
  applyModerationCenterAction,
  getAdminSystemSettings,
  getAnalyticsOverview,
  getDashboardControlCenter,
  getModerationCenter,
  listContentBlocks,
  listOperationalAgents,
  listOperationalOrders,
  listOperationalPayments,
  listOperationalUsers,
  listTaxonomyNodes,
  reviewOperationalPayment,
  updateAdminSystemSettings,
  updateOperationalAgent,
  updateOperationalOrder,
  updateOperationalUser,
  upsertContentBlock,
  upsertTaxonomyNode
} from "../controllers/adminEnterpriseController";
import {
  createRiskFlagAdmin,
  decideDisputeAdmin,
  getFraudOverviewAdmin,
  getDisputeDetailAdmin,
  getPaymentReviewDetailAdmin,
  getPayoutRequestDetailAdmin,
  listPaymentReviewsAdmin,
  listCategoryPaymentPoliciesAdmin,
  listDisputesAdmin,
  listEscrowBucketsAdmin,
  listPayoutRequestsAdmin,
  listRiskFlagsAdmin,
  rejectPaymentReviewAdmin,
  reviewPayoutRequestAdmin,
  updateCategoryPaymentPolicyAdmin,
  verifyPaymentReviewAdmin
} from "../controllers/adminFinanceController";
import { authRequired } from "../middlewares/auth";
import {
  requireAdminAccess,
  requireAdminIdentity,
  requireAdminMode,
  requirePermission,
  requirePrimaryAdmin,
  requireScope
} from "../middlewares/adminAccess";
import { respondRateLimited } from "../utils/controllerResponses";

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const adminAuthLimiter = rateLimit({
  windowMs: toNumber(process.env.ADMIN_AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: toNumber(process.env.ADMIN_AUTH_RATE_LIMIT_MAX, 10),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => respondRateLimited(req, res)
});

const router = Router();

router.post("/primary/bootstrap", bootstrapPrimaryAdmin);
router.post("/admins/accept", acceptAdminInvite);
router.post("/admins/accept-invite", acceptAdminInvite);
router.post("/auth/register", adminAuthLimiter, registerAdminAccount);
router.post("/auth/login", adminAuthLimiter, loginAdminAccount);
router.post("/auth/logout", logoutAdminAccount);
router.get("/auth/me", getAdminAuthMe);

router.use(authRequired);

router.post("/auth/mfa/setup", requireAdminIdentity, setupAdminMfa);
router.post("/auth/mfa/verify", adminAuthLimiter, requireAdminIdentity, verifyAdminMfa);
router.post("/auth/enter", adminAuthLimiter, requireAdminIdentity, enterAdminMode);

router.use(requireAdminAccess);

router.get("/sessions", requirePermission(["sessions.view", "sessions.read"]), listAdminSessions);
router.post("/sessions/revoke", requirePermission("sessions.revoke"), requireAdminMode, revokeAdminSession);
router.post("/sessions/revoke-all", requirePermission("sessions.revoke"), requireAdminMode, revokeAllAdminSessions);

router.get("/admins", requirePermission(["admins.view", "admins.read"]), listAdmins);
router.post(
  "/admins/invite",
  requirePermission(["admins.create", "admins.invite", "admins.manage", "admin.manage"]),
  requirePrimaryAdmin,
  requireAdminMode,
  inviteAdmin
);
router.post(
  "/admins/approve",
  requirePermission(["admins.approve", "admins.manage", "admin.manage"]),
  requirePrimaryAdmin,
  requireAdminMode,
  approveAdmin
);
router.post(
  "/admins/revoke",
  requirePermission(["admins.revoke", "admins.manage", "admin.manage"]),
  requirePrimaryAdmin,
  requireAdminMode,
  revokeAdmin
);
router.patch(
  "/admins/:id/roles",
  requirePermission(["admins.roles.manage", "admins.roles.write"]),
  requirePrimaryAdmin,
  requireAdminMode,
  updateAdminRoles
);
router.patch(
  "/admins/:id/scopes",
  requirePermission(["admins.scopes.manage", "admins.scopes.write"]),
  requirePrimaryAdmin,
  requireAdminMode,
  updateAdminScopes
);
router.patch(
  "/admins/:id/department-position",
  requirePermission(["admins.department.manage", "admins.department.write"]),
  requirePrimaryAdmin,
  requireAdminMode,
  updateAdminDepartmentPosition
);
router.patch(
  "/admins/:id/permissions",
  requirePermission(["admins.assign_permissions", "admins.manage", "admin.manage"]),
  requirePrimaryAdmin,
  requireAdminMode,
  updateAdminAssignedPermissions
);

router.get("/roles", requirePermission(["rbac.view", "rbac.read"]), getRoles);
router.post("/roles", requirePermission(["rbac.manage", "rbac.write"]), requirePrimaryAdmin, requireAdminMode, createRole);
router.patch("/roles/:id", requirePermission(["rbac.manage", "rbac.write"]), requirePrimaryAdmin, requireAdminMode, updateRole);
router.get("/permissions", requirePermission(["rbac.view", "rbac.read"]), getPermissions);

router.get("/audit-logs", requirePermission(["audit.view", "audit.read", "logs.read"]), getAuditLogs);

router.get("/overview", requirePermission(["dashboard.view", "dashboard.read"]), adminOverview);
router.get("/architecture", requirePermission(["dashboard.view", "dashboard.read"]), getAdminArchitecture);
router.get("/dashboard/control-center", requirePermission(["dashboard.view", "dashboard.read"]), getDashboardControlCenter);
router.get("/workspace", requirePermission(["dashboard.view", "dashboard.read"]), getAdminWorkspace);
router.get(
  "/moderation/center",
  requirePermission(["moderation.view", "reports.view", "community.moderate", "content.moderate", "listings.moderate"]),
  getModerationCenter
);
router.post(
  "/moderation/center/action",
  requirePermission([
    "products.approve",
    "products.reject",
    "services.approve",
    "services.reject",
    "agents.verify",
    "agents.suspend",
    "users.warn",
    "users.suspend",
    "users.ban",
    "community.moderate",
    "posts.moderate",
    "content.moderate",
    "reports.resolve",
    "payments.manage",
    "refunds.manage",
    "escalations.manage"
  ]),
  requireAdminMode,
  applyModerationCenterAction
);
router.get(
  "/listings/moderation",
  requirePermission(["products.view", "services.view", "listings.read_all"]),
  listModerationListings
);
router.post(
  "/listings/:id/moderate",
  requirePermission([
    "products.approve",
    "products.reject",
    "services.approve",
    "services.reject",
    "listings.approve_reject",
    "listings.pause_force"
  ]),
  requireAdminMode,
  moderateListing
);
router.get(
  "/community/reports",
  requirePermission(["reports.view", "posts.moderate", "content.moderate", "community.moderate"]),
  listCommunityReports
);
router.post(
  "/community/reports/:id/resolve",
  requirePermission(["reports.resolve", "posts.moderate", "community.delete_post", "content.moderate", "community.moderate"]),
  requireAdminMode,
  resolveCommunityReport
);
router.get("/users", requirePermission(["users.view", "users.read"]), listUsers);
router.get("/users/operations", requirePermission(["users.view", "users.read"]), listOperationalUsers);
router.post(
  "/users/:id/action",
  requirePermission(["users.warn", "users.suspend", "users.ban", "users.edit", "users.update"]),
  requireAdminMode,
  updateOperationalUser
);
router.get("/agents/operations", requirePermission(["agents.view", "agents.read"]), listOperationalAgents);
router.post("/agents/:id/verify", requirePermission(["agents.verify", "admin.manage"]), requireAdminMode, verifyAgent);
router.post(
  "/agents/:id/action",
  requirePermission(["agents.verify", "agents.suspend", "agents.badge", "agents.note", "admin.manage"]),
  requireAdminMode,
  updateOperationalAgent
);
router.get("/orders/operations", requirePermission(["orders.view", "orders.read"]), listOperationalOrders);
router.post("/orders/:id/status", requirePermission(["orders.manage"]), requireAdminMode, updateOperationalOrder);
router.get("/payments/operations", requirePermission(["payments.view", "payments.read"]), listOperationalPayments);
router.post(
  "/payments/:id/review",
  requirePermission(["payments.manage", "refunds.manage", "payouts.approve"]),
  requireAdminMode,
  reviewOperationalPayment
);
router.get(
  "/finance/policies",
  requirePermission(["payments.view", "payments.manage", "finance.audit.view"]),
  listCategoryPaymentPoliciesAdmin
);
router.get(
  "/payment-policies",
  requirePermission(["payments.view", "payments.manage", "finance.audit.view"]),
  listCategoryPaymentPoliciesAdmin
);
router.patch(
  "/payment-policies/:policyId",
  requirePermission(["payments.manage", "finance.audit.view"]),
  requireAdminMode,
  updateCategoryPaymentPolicyAdmin
);
router.get(
  "/finance/escrow/buckets",
  requirePermission(["payments.view", "payments.manage", "finance.audit.view"]),
  listEscrowBucketsAdmin
);
router.get(
  "/payments/reviews",
  requirePermission(["payments.view", "payments.manage", "finance.audit.view"]),
  listPaymentReviewsAdmin
);
router.get(
  "/payments/reviews/:reviewId",
  requirePermission(["payments.view", "payments.manage", "finance.audit.view"]),
  getPaymentReviewDetailAdmin
);
router.post(
  "/payments/:intentId/verify",
  requirePermission(["payments.manage", "refunds.manage", "payouts.approve"]),
  requireAdminMode,
  verifyPaymentReviewAdmin
);
router.post(
  "/payments/:intentId/reject",
  requirePermission(["payments.manage", "refunds.manage", "payouts.approve"]),
  requireAdminMode,
  rejectPaymentReviewAdmin
);
router.get(
  "/finance/disputes",
  requirePermission(["disputes.view", "disputes.resolve", "disputes.decide"]),
  listDisputesAdmin
);
router.get(
  "/disputes",
  requirePermission(["disputes.view", "disputes.resolve", "disputes.decide"]),
  listDisputesAdmin
);
router.get(
  "/disputes/:disputeId",
  requirePermission(["disputes.view", "disputes.resolve", "disputes.decide"]),
  getDisputeDetailAdmin
);
router.post(
  "/finance/disputes/:id/decide",
  requirePermission([
    "disputes.decide",
    "refunds.approve",
    "release.approve",
    "disputes.shopping.resolve",
    "disputes.services.resolve",
    "disputes.translation.resolve",
    "disputes.legal.resolve",
    "disputes.psychology.resolve",
    "disputes.education.resolve",
    "disputes.consulting.resolve",
    "disputes.sport.resolve"
  ]),
  requireAdminMode,
  decideDisputeAdmin
);
router.post(
  "/disputes/:disputeId/decision",
  requirePermission([
    "disputes.decide",
    "refunds.approve",
    "release.approve",
    "disputes.shopping.resolve",
    "disputes.services.resolve",
    "disputes.translation.resolve",
    "disputes.legal.resolve",
    "disputes.psychology.resolve",
    "disputes.education.resolve",
    "disputes.consulting.resolve",
    "disputes.sport.resolve"
  ]),
  requireAdminMode,
  decideDisputeAdmin
);
router.get(
  "/finance/payouts",
  requirePermission(["payouts.approve", "payouts.hold", "payments.manage"]),
  listPayoutRequestsAdmin
);
router.get(
  "/payouts",
  requirePermission(["payouts.approve", "payouts.hold", "payments.manage"]),
  listPayoutRequestsAdmin
);
router.get(
  "/payouts/:requestId",
  requirePermission(["payouts.approve", "payouts.hold", "payments.manage"]),
  getPayoutRequestDetailAdmin
);
router.post(
  "/finance/payouts/:id/review",
  requirePermission(["payouts.approve", "payouts.hold", "payments.manage"]),
  requireAdminMode,
  reviewPayoutRequestAdmin
);
router.post(
  "/payouts/:requestId/decision",
  requirePermission(["payouts.approve", "payouts.hold", "payments.manage"]),
  requireAdminMode,
  reviewPayoutRequestAdmin
);
router.get(
  "/finance/risk-flags",
  requirePermission(["fraud.flag", "payments.manage", "finance.audit.view"]),
  listRiskFlagsAdmin
);
router.get(
  "/risk/overview",
  requirePermission(["fraud.flag", "payments.manage", "finance.audit.view"]),
  getFraudOverviewAdmin
);
router.get(
  "/risk-flags",
  requirePermission(["fraud.flag", "payments.manage", "finance.audit.view"]),
  listRiskFlagsAdmin
);
router.post(
  "/risk-flags",
  requirePermission(["fraud.flag", "payments.manage", "finance.audit.view"]),
  requireAdminMode,
  createRiskFlagAdmin
);
router.get("/content/reports", requirePermission(["reports.view", "content.moderate", "community.moderate"]), listFlaggedContent);
router.get("/content/items", requirePermission(["content.view", "content.manage", "content.moderate"]), listContentBlocks);
router.post("/content/items", requirePermission(["content.manage"]), requireAdminMode, upsertContentBlock);
router.patch("/content/items/:id", requirePermission(["content.manage"]), requireAdminMode, upsertContentBlock);
router.get("/taxonomy/nodes", requirePermission(["taxonomy.view", "taxonomy.manage"]), listTaxonomyNodes);
router.post("/taxonomy/nodes", requirePermission(["taxonomy.manage"]), requireAdminMode, upsertTaxonomyNode);
router.patch("/taxonomy/nodes/:id", requirePermission(["taxonomy.manage"]), requireAdminMode, upsertTaxonomyNode);
router.get("/analytics/overview", requirePermission(["analytics.view"]), getAnalyticsOverview);
router.get("/settings/system", requirePermission(["settings.manage", "technical.manage"]), getAdminSystemSettings);
router.put(
  "/settings/system",
  requirePermission(["settings.manage", "technical.manage"]),
  requireAdminMode,
  updateAdminSystemSettings
);
router.post(
  "/posts/:id/status",
  requirePermission(["posts.moderate", "content.moderate", "community.moderate"]),
  requireScope("community", (req) => String(req.body.categoryId || "")),
  requireAdminMode,
  updatePostStatus
);
router.post(
  "/community/groups/:id/status",
  requirePermission(["groups.moderate", "content.moderate", "community.moderate"]),
  requireScope("community", (req) => String(req.body.categoryId || "")),
  requireAdminMode,
  moderateGroup
);

export default router;
