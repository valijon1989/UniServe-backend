import mongoose from "mongoose";
import { Request, Response } from "express";
import { User } from "../models/User";
import { AgentProfile } from "../models/AgentProfile";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import { Dispute } from "../models/Dispute";
import { RefundRequest } from "../models/RefundRequest";
import { PayoutRequest } from "../models/PayoutRequest";
import { RiskFlag } from "../models/RiskFlag";
import { Post } from "../models/Post";
import { CommunityGroupModel } from "../models/CommunityGroup";
import { AuditLog } from "../models/AuditLog";
import { AdminSetting } from "../models/AdminSetting";
import { AdminContentBlock } from "../models/AdminContentBlock";
import { TaxonomyNode } from "../models/TaxonomyNode";
import { writeAuditLog } from "../services/auditLog";
import { hasAnyPermission } from "../services/adminBlueprint";
import { isAdminIdentityRecord } from "../services/adminPolicy";
import { respondAuthRequired } from "../utils/controllerResponses";

const canAccess = (req: Request, required: string[]) =>
  hasAnyPermission(req.adminContext?.permissions || [], required, req.adminContext?.adminLevel || null);

const requireAdminActionPermission = (req: Request, res: Response, required: string[], message = "Missing permission") => {
  if (canAccess(req, required)) return true;
  res.status(403).json({ message });
  return false;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizeLocalizedText = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const localizedName = {
    uz: normalizeText(source.uz),
    ru: normalizeText(source.ru),
    en: normalizeText(source.en),
    ko: normalizeText(source.ko)
  };
  return Object.values(localizedName).some(Boolean) ? localizedName : undefined;
};

const pickLocalizedLabel = (value: unknown) => {
  const localized = normalizeLocalizedText(value);
  return localized?.uz || localized?.en || localized?.ru || localized?.ko || "";
};

const toPositiveInt = (value: unknown, fallback: number, max = 200) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const parseObjectId = (value: unknown) => {
  const raw = normalizeText(value);
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};

const buildDateRange = (days: number) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
};

const statusPriority = (value: string) => {
  const normalized = normalizeText(value).toUpperCase();
  if (["BANNED", "SUSPENDED", "FLAGGED", "DISPUTED", "FAILED"].includes(normalized)) return "high";
  if (["WARNED", "RESTRICTED", "PENDING", "OPEN", "ESCALATED", "BLOCKED"].includes(normalized)) return "medium";
  return "low";
};

const parseBooleanFlag = (value: unknown) => {
  const normalized = normalizeText(value).toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const truncateText = (value: unknown, max = 160) => {
  const text = normalizeText(value);
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
};

const formatActorLabel = (value: { name?: unknown; username?: unknown; email?: unknown } | null | undefined): string | null => {
  if (!value) return null;
  const name = normalizeText(value.name);
  if (name) return name;
  const username = normalizeText(value.username);
  if (username) return username;
  const email = normalizeText(value.email);
  return email || null;
};

const scopeAllowsModule = (req: Request, moduleName: string) => {
  if (req.adminContext?.adminLevel === "PRIMARY") return true;
  const scopes = Array.isArray(req.adminContext?.scopes) ? req.adminContext?.scopes : [];
  if (!scopes.length) return true;
  const normalized = normalizeText(moduleName).toLowerCase();
  return scopes.some((scope) => {
    const scopeModule = normalizeText(scope.module).toLowerCase();
    return scopeModule === "*" || scopeModule === normalized;
  });
};

const canAccessModule = (req: Request, moduleName: string, permissions: string[]) =>
  canAccess(req, permissions) && scopeAllowsModule(req, moduleName);

const toEntityHistoryKey = (entityType: string | null | undefined, entityId: string | null | undefined) => {
  const normalizedType = normalizeText(entityType);
  const normalizedId = normalizeText(entityId);
  if (!normalizedType || !normalizedId) return null;
  return `${normalizedType}:${normalizedId}`;
};

const defaultSettings = {
  platform: {
    defaultCurrency: "USD",
    defaultLocale: "en",
    supportInboxEmail: "",
    allowNewRegistrations: true,
    maintenanceMode: false
  },
  security: {
    requireMfaForAdmins: true,
    adminModeTtlMinutes: 15,
    revokeSessionsOnAccessChange: true,
    sessionIdleTimeoutMinutes: 60
  },
  moderation: {
    autoEscalateRepeatedOffender: true,
    maxWarningsBeforeSuspend: 3,
    flagThreshold: 3,
    agentComplaintSuspendThreshold: 5
  },
  notifications: {
    urgentAlertsEmail: true,
    queueDigestEnabled: true,
    paymentFailureAlerts: true,
    suspensionAlertsEnabled: true
  },
  content: {
    homepageAutoRotate: false,
    defaultFeaturedDurationDays: 14,
    announcementsRequireApproval: true
  },
  features: {
    communityEnabled: true,
    escrowEnabled: true,
    bookingsEnabled: true,
    dynamicPricingEnabled: false
  }
};

const serializeAuditItem = (item: any) => ({
  id: String(item._id),
  actorId: item.actorId?._id ? String(item.actorId._id) : item.actorId ? String(item.actorId) : undefined,
  actorName: formatActorLabel(item.actorId) || null,
  actorRole: item.actorRole || undefined,
  action: item.action,
  entityType: item.entityType || item.targetType || undefined,
  entityId: item.entityId || item.targetId || undefined,
  reason: item.reason || item.meta?.reason || undefined,
  previousValue: item.previousValue || null,
  newValue: item.newValue || null,
  ip: item.ip || undefined,
  userAgent: item.userAgent || undefined,
  createdAt: item.createdAt
});

const buildUserWarnings = (user: any, activity: { orders: number; payments: number; posts: number }) => {
  const warnings: string[] = [];
  if (Number(user.warningCount || 0) > 0) warnings.push(`${Number(user.warningCount || 0)} warning(s) issued`);
  if (Number(user.reportCount || 0) > 0) warnings.push(`${Number(user.reportCount || 0)} report(s) pending`);
  if (String(user.accountStatus || "ACTIVE").toUpperCase() !== "ACTIVE") {
    warnings.push(`Account is ${String(user.accountStatus || "ACTIVE").toLowerCase()}`);
  }
  if (user.restrictionReason) warnings.push(String(user.restrictionReason));
  if (activity.orders + activity.payments + activity.posts === 0) warnings.push("No linked order, payment, or post activity");
  return warnings;
};

const buildAgentFlags = (profile: any) => {
  const flags: string[] = [];
  if (!profile.verifiedByAdmin) flags.push("Awaiting admin verification");
  if (!profile.faceIdVerified) flags.push("Face ID check incomplete");
  if (Number(profile.complaintCount || 0) > 0) flags.push(`${Number(profile.complaintCount || 0)} complaint(s) registered`);
  if (Number(profile.responseRate || 0) < 70) flags.push("Response rate below target");
  if (!profile.badge) flags.push("No trust badge assigned");
  return flags;
};

const buildOrderPaymentSummary = (payments: any[]) => ({
  totalTransactions: payments.length,
  successful: payments.filter((payment) => payment.status === "SUCCESS").length,
  failed: payments.filter((payment) => payment.status === "FAILED").length,
  refunded: payments.filter((payment) => payment.status === "REFUNDED").length,
  flagged: payments.filter((payment) => payment.status === "FLAGGED").length,
  escalated: payments.filter((payment) => payment.financeStatus === "ESCALATED").length,
  payouts: payments.filter((payment) => payment.kind === "PAYOUT").length,
  refunds: payments.filter((payment) => payment.kind === "REFUND").length,
  totalAmount: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
});

const buildPaymentIssueFlags = (payment: any) => {
  const flags: string[] = [];
  if (payment.status === "FAILED") flags.push("Failed payment");
  if (payment.status === "FLAGGED") flags.push("Flagged transaction");
  if (payment.financeStatus === "ESCALATED") flags.push("Escalated finance review");
  if (payment.kind === "REFUND") flags.push("Refund transaction");
  if (payment.kind === "PAYOUT") flags.push("Payout transaction");
  if (!payment.transactionId) flags.push("Missing gateway reference");
  return flags;
};

const serializeUserItem = (
  user: any,
  linkedActivity: Record<string, { orders: number; payments: number; posts: number }>,
  auditHistory: Record<string, any[]>
) => {
  const activity = linkedActivity[String(user._id)] || { orders: 0, payments: 0, posts: 0 };
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    username: user.username,
    status: user.accountStatus || "ACTIVE",
    warningCount: Number(user.warningCount || 0),
    reportCount: Number(user.reportCount || 0),
    restrictionReason: user.restrictionReason || null,
    internalNotes: user.internalNotes || null,
    joinedAt: user.createdAt,
    region: user.region || null,
    verificationStatus: Boolean(user.isVerified),
    linkedActivity: activity,
    activitySummary: {
      orders: activity.orders,
      payments: activity.payments,
      posts: activity.posts,
      followers: Array.isArray(user.followers) ? user.followers.length : 0,
      following: Array.isArray(user.following) ? user.following.length : 0,
      totalSignals: activity.orders + activity.payments + activity.posts
    },
    warnings: buildUserWarnings(user, activity),
    followers: Array.isArray(user.followers) ? user.followers.length : 0,
    following: Array.isArray(user.following) ? user.following.length : 0,
    lastAdminActionAt: user.lastAdminActionAt || null,
    recentActions: auditHistory[String(user._id)] || []
  };
};

const serializeAgentItem = (
  profile: any,
  productCounts: Record<string, number>,
  serviceCounts: Record<string, number>,
  orderCounts: Record<string, number>,
  productPreviews: Record<string, any[]>,
  servicePreviews: Record<string, any[]>,
  auditHistory: Record<string, any[]>
) => {
  const userId = profile.user?._id ? String(profile.user._id) : profile.user ? String(profile.user) : undefined;
  return {
    id: String(profile._id),
    userId,
    name: profile.user?.name || profile.user?.username || "Unknown agent",
    email: profile.user?.email || null,
    kind: profile.kind,
    adminStatus: profile.adminStatus || (profile.verifiedByAdmin ? "ACTIVE" : "PENDING"),
    verifiedByAdmin: Boolean(profile.verifiedByAdmin),
    faceIdVerified: Boolean(profile.faceIdVerified),
    badge: profile.badge || null,
    rating: Number(profile.rating || 0),
    ratingCount: Number(profile.ratingCount || 0),
    complaints: Number(profile.complaintCount || 0),
    responseRate: Number(profile.responseRate || 0),
    productsCount: productCounts[userId || ""] || 0,
    servicesCount: serviceCounts[userId || ""] || 0,
    orderCount: orderCounts[userId || ""] || 0,
    verificationSummary: {
      verifiedByAdmin: Boolean(profile.verifiedByAdmin),
      faceIdVerified: Boolean(profile.faceIdVerified),
      requiresReview: !profile.verifiedByAdmin || !profile.faceIdVerified
    },
    internalFlags: buildAgentFlags(profile),
    linkedProducts: productPreviews[userId || ""] || [],
    linkedServices: servicePreviews[userId || ""] || [],
    internalNotes: profile.internalNotes || null,
    lastModeratedAt: profile.lastModeratedAt || null,
    recentActions: auditHistory[String(profile._id)] || [],
    createdAt: profile.createdAt
  };
};

const serializeOrderItem = (
  order: any,
  paymentsByOrderId: Record<string, any[]>,
  auditHistory: Record<string, any[]>
) => {
  const payments = (paymentsByOrderId[String(order._id)] || []).map((payment) => ({
    id: String(payment._id),
    status: payment.status,
    financeStatus: payment.financeStatus || "OPEN",
    kind: payment.kind || "PAYMENT",
    amount: Number(payment.amount || 0),
    provider: payment.provider
  }));
  const paymentSummary = buildOrderPaymentSummary(payments);
  return {
    id: String(order._id),
    kind: order.kind || "PRODUCT",
    status: order.status,
    user: order.userId
      ? {
          id: String(order.userId._id || order.userId),
          name: order.userId.name || order.userId.username || "Unknown user",
          email: order.userId.email || null
        }
      : null,
    agent: order.agentId
      ? {
          id: String(order.agentId._id || order.agentId),
          name: order.agentId.name || order.agentId.username || "Unknown agent",
          email: order.agentId.email || null
        }
      : null,
    total: Number(order.total || 0),
    currency: order.currency || "USD",
    itemCount: Array.isArray(order.items) ? order.items.length : 0,
    itemsPreview: Array.isArray(order.items)
      ? order.items.slice(0, 3).map((item: any) => ({
          productId: item.productId ? String(item.productId) : null,
          title: item.titleSnapshot,
          qty: Number(item.qty || 0),
          unitPrice: Number(item.unitPrice || 0),
          image: item.imageSnapshot || null
        }))
      : [],
    source: order.source,
    bookingAt: order.bookingAt || null,
    disputeReason: order.disputeReason || null,
    disputeState: order.status === "DISPUTED" || order.disputeReason ? "OPEN" : "NONE",
    refundReason: order.refundReason || null,
    refundState: order.status === "REFUNDED" || paymentSummary.refunded > 0 ? "REFUNDED" : order.refundReason ? "REQUESTED" : "NONE",
    note: order.note || null,
    shipping: order.shippingAddress
      ? {
          name: order.shippingAddress.name,
          phone: order.shippingAddress.phone,
          address1: order.shippingAddress.address1,
          address2: order.shippingAddress.address2 || null,
          postalCode: order.shippingAddress.postalCode || null
        }
      : null,
    paymentMethod: order.payment
      ? {
          method: order.payment.method,
          provider: order.payment.provider || null,
          transactionId: order.payment.transactionId || null,
          paidAt: order.payment.paidAt || null
        }
      : null,
    paymentSummary,
    payments,
    recentActions: auditHistory[String(order._id)] || [],
    createdAt: order.createdAt
  };
};

const serializePaymentItem = (payment: any, auditHistory: Record<string, any[]>) => ({
  id: String(payment._id),
  status: payment.status,
  financeStatus: payment.financeStatus || "OPEN",
  riskLevel: payment.riskLevel || statusPriority(payment.status || ""),
  kind: payment.kind || "PAYMENT",
  provider: payment.provider,
  amount: Number(payment.amount || 0),
  currency: payment.currency || "USD",
  note: payment.note || null,
  transactionId: payment.transactionId || null,
  issueFlags: buildPaymentIssueFlags(payment),
  user: payment.userId
    ? {
        id: String(payment.userId._id || payment.userId),
        name: payment.userId.name || payment.userId.username || "Unknown user",
        email: payment.userId.email || null
      }
    : null,
  order: payment.orderId
    ? {
        id: String(payment.orderId._id || payment.orderId),
        status: payment.orderId.status || null,
        total: payment.orderId.total || null,
        kind: payment.orderId.kind || null,
        source: payment.orderId.source || null
      }
    : null,
  recentActions: auditHistory[String(payment._id)] || [],
  createdAt: payment.createdAt
});

const serializeContentBlock = (item: any) => ({
  id: String(item._id),
  key: item.key,
  title: item.title,
  kind: item.kind,
  status: item.status,
  audience: item.audience || null,
  priority: Number(item.priority || 0),
  payload: item.payload || {},
  payloadKeys: Object.keys(item.payload || {}),
  updatedBy: item.updatedBy
    ? {
        id: String(item.updatedBy._id || item.updatedBy),
        name: formatActorLabel(item.updatedBy) || null
      }
    : null,
  updatedAt: item.updatedAt,
  createdAt: item.createdAt
});

const serializeTaxonomyNode = (item: any, parentLabelMap: Record<string, string>, childCountMap: Record<string, number>) => ({
  id: String(item._id),
  module: item.module,
  kind: item.kind,
  key: item.key,
  label: item.label,
  localizedName: item.name || null,
  slug: item.slug || null,
  parentId: item.parentId ? String(item.parentId._id || item.parentId) : null,
  parentLabel: item.parentId
    ? parentLabelMap[String(item.parentId._id || item.parentId)] || normalizeText(item.parentId.label) || null
    : null,
  childCount: childCountMap[String(item._id)] || 0,
  status: item.status,
  sortOrder: Number(item.sortOrder || 0),
  metadata: item.metadata || {},
  metadataKeys: Object.keys(item.metadata || {}),
  updatedBy: item.updatedBy
    ? {
        id: String(item.updatedBy._id || item.updatedBy),
        name: formatActorLabel(item.updatedBy) || null
      }
    : null,
  updatedAt: item.updatedAt
});

const getLinkedActivityMap = async (userIds: string[]) => {
  if (!userIds.length) return {};
  const objectIds = userIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return {};

  const [orders, payments, posts] = await Promise.all([
    Order.aggregate([{ $match: { userId: { $in: objectIds } } }, { $group: { _id: "$userId", count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { userId: { $in: objectIds } } }, { $group: { _id: "$userId", count: { $sum: 1 } } }]),
    Post.aggregate([{ $match: { author: { $in: objectIds } } }, { $group: { _id: "$author", count: { $sum: 1 } } }])
  ]);

  const map: Record<string, { orders: number; payments: number; posts: number }> = {};
  for (const id of userIds) {
    map[id] = { orders: 0, payments: 0, posts: 0 };
  }
  for (const row of orders) map[String(row._id)] = { ...(map[String(row._id)] || { orders: 0, payments: 0, posts: 0 }), orders: row.count };
  for (const row of payments) map[String(row._id)] = { ...(map[String(row._id)] || { orders: 0, payments: 0, posts: 0 }), payments: row.count };
  for (const row of posts) map[String(row._id)] = { ...(map[String(row._id)] || { orders: 0, payments: 0, posts: 0 }), posts: row.count };
  return map;
};

const buildAuditHistoryMap = async (entityTypes: string[], entityIds: string[], limitPerEntity = 5) => {
  const ids = Array.from(new Set(entityIds.map((value) => normalizeText(value)).filter(Boolean)));
  const types = Array.from(new Set(entityTypes.map((value) => normalizeText(value)).filter(Boolean)));
  const map = ids.reduce<Record<string, any[]>>((acc, id) => {
    acc[id] = [];
    return acc;
  }, {});

  if (!ids.length || !types.length) return map;

  const maxDocs = Math.max(ids.length * limitPerEntity * 8, 80);
  const logs = await AuditLog.find({
    $or: [
      { entityType: { $in: types }, entityId: { $in: ids } },
      { targetType: { $in: types }, targetId: { $in: ids } }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(maxDocs)
    .populate("actorId", "name username email")
    .lean();

  for (const log of logs) {
    const entityId = normalizeText(log.entityId);
    const targetId = normalizeText(log.targetId);
    const key = ids.includes(entityId) ? entityId : ids.includes(targetId) ? targetId : "";
    if (!key || map[key].length >= limitPerEntity) continue;
    map[key].push(serializeAuditItem(log));
  }

  return map;
};

const buildCreatorPreviewMap = async (Model: any, userIds: string[]) => {
  const map = userIds.reduce<Record<string, any[]>>((acc, id) => {
    acc[id] = [];
    return acc;
  }, {});

  const objectIds = userIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return map;

  const rows = await Model.aggregate([
    { $match: { createdBy: { $in: objectIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$createdBy",
        count: { $sum: 1 },
        items: {
          $push: {
            id: "$_id",
            title: "$title",
            status: "$status",
            category: "$category",
            createdAt: "$createdAt"
          }
        }
      }
    },
    { $project: { count: 1, items: { $slice: ["$items", 3] } } }
  ]);

  for (const row of rows) {
    map[String(row._id)] = Array.isArray(row.items)
      ? row.items.map((item: any) => ({
          id: String(item.id),
          title: item.title,
          status: item.status,
          category: item.category || null,
          createdAt: item.createdAt
        }))
      : [];
  }

  return map;
};

const loadModerationHistoryMap = async (items: Array<{ entityType: string; id: string }>) => {
  const idsByType = new Map<string, Set<string>>();

  for (const item of items) {
    const type = normalizeText(item.entityType);
    const id = normalizeText(item.id);
    if (!type || !id) continue;
    if (!idsByType.has(type)) idsByType.set(type, new Set());
    idsByType.get(type)?.add(id);
  }

  const orFilters: Record<string, unknown>[] = [];
  for (const [type, ids] of idsByType.entries()) {
    const values = Array.from(ids);
    orFilters.push({ entityType: type, entityId: { $in: values } });
    orFilters.push({ targetType: type, targetId: { $in: values } });
  }

  if (!orFilters.length) return {};

  const logs = await AuditLog.find({ $or: orFilters })
    .populate("actorId", "name username email")
    .sort({ createdAt: -1 })
    .limit(Math.max(items.length * 6, 48))
    .lean();

  const map: Record<string, Array<{ id: string; action: string; actorName: string | null; createdAt: Date; reason?: string | null }>> = {};

  for (const log of logs) {
    const keys = [
      toEntityHistoryKey(log.entityType, log.entityId),
      toEntityHistoryKey(log.targetType, log.targetId)
    ].filter(Boolean) as string[];

    for (const key of keys) {
      if (!map[key]) map[key] = [];
      if (map[key].length >= 4) continue;
      map[key].push({
        id: String(log._id),
        action: log.action,
        actorName: formatActorLabel(log.actorId as any),
        createdAt: log.createdAt,
        reason: log.reason || null
      });
    }
  }

  return map;
};

export const getDashboardControlCenter = async (req: Request, res: Response) => {
  try {
    const todayStart = buildDateRange(1);
    const last7d = buildDateRange(7);
    const recentProductWindowStart = buildDateRange(30);

    const canUsers = canAccessModule(req, "users", ["users.view", "users.read"]);
    const canAgents = canAccessModule(req, "agents", ["agents.view", "agents.read"]);
    const canProducts = canAccessModule(req, "products", ["products.view", "listings.read_all"]);
    const canProductsModerate = canAccessModule(req, "products", ["products.approve", "products.reject", "listings.moderate"]);
    const canServices = canAccessModule(req, "services", ["services.view", "listings.read_all"]);
    const canServicesModerate = canAccessModule(req, "services", ["services.approve", "services.reject", "listings.moderate"]);
    const canAgentsVerify = canAccessModule(req, "agents", ["agents.verify"]);
    const canCommunity = canAccessModule(req, "community", ["reports.view", "moderation.view", "community.moderate"]);
    const canContent = canAccessModule(req, "content", ["content.moderate", "reports.view", "moderation.view"]);
    const canOrders = canAccessModule(req, "orders", ["orders.view", "orders.read"]);
    const canPayments = canAccessModule(req, "payments", ["payments.view", "payments.read"]);
    const canAudit = canAccessModule(req, "admins", ["audit.view", "audit.read", "logs.read"]);
    const canTechnical = canAccessModule(req, "technical", ["technical.view", "system.health.view"]);

    const [
      totalUsers,
      totalAgents,
      activeProducts,
      activeServices,
      pendingProductReviews,
      pendingServices,
      pendingAgentVerifications,
      communityPosts,
      mediaPosts,
      reportedGroups,
      reportedUsers,
      reportedAgents,
      todayProductOrders,
      todayBookings,
      paymentIssues,
      escalatedPayments,
      suspiciousPayments,
      suspiciousUsers,
      suspiciousAgents,
      recentAdminActions,
      recentPayments,
      recentOrders,
      systemHealth,
      highRiskPosts,
      highRiskUsers,
      highRiskAgents,
      openDisputes,
      refundQueue,
      payoutQueue,
      openRiskFlags,
      activeUsers,
      newAgents7d,
      dailyRevenue,
      topProductLeaders,
      topServiceLeaders,
      topAgentLeaders
    ] = await Promise.all([
      canUsers ? User.countDocuments({ isAdmin: { $ne: true } }) : Promise.resolve(0),
      canAgents ? AgentProfile.countDocuments() : Promise.resolve(0),
      canProducts ? Product.countDocuments({ status: "ACTIVE" }) : Promise.resolve(0),
      canServices ? Service.countDocuments({ status: "ACTIVE" }) : Promise.resolve(0),
      canProductsModerate ? Product.countDocuments({ createdAt: { $gte: recentProductWindowStart } }) : Promise.resolve(0),
      canServicesModerate ? Service.countDocuments({ status: "PENDING" }) : Promise.resolve(0),
      canAgentsVerify ? AgentProfile.countDocuments({ adminStatus: "PENDING" }) : Promise.resolve(0),
      canCommunity
        ? Post.countDocuments({
            reports: { $gt: 0 },
            "media.0": { $exists: false },
            "images.0": { $exists: false }
          })
        : Promise.resolve(0),
      canContent
        ? Post.countDocuments({
            reports: { $gt: 0 },
            $or: [{ "media.0": { $exists: true } }, { "images.0": { $exists: true } }]
          })
        : Promise.resolve(0),
      canCommunity ? CommunityGroupModel.countDocuments({ spamReports: { $gt: 0 } }) : Promise.resolve(0),
      canUsers
        ? User.countDocuments({
            isAdmin: { $ne: true },
            $or: [{ reportCount: { $gt: 0 } }, { accountStatus: { $in: ["WARNED", "RESTRICTED", "SUSPENDED", "BANNED"] } }]
          })
        : Promise.resolve(0),
      canAgents ? AgentProfile.countDocuments({ complaintCount: { $gt: 0 } }) : Promise.resolve(0),
      canOrders ? Order.countDocuments({ kind: "PRODUCT", createdAt: { $gte: todayStart } }) : Promise.resolve(0),
      canOrders ? Order.countDocuments({ kind: "SERVICE", createdAt: { $gte: todayStart } }) : Promise.resolve(0),
      canPayments
        ? Payment.countDocuments({
            $or: [{ status: "FAILED" }, { status: "FLAGGED" }, { financeStatus: "OPEN" }, { financeStatus: "ESCALATED" }]
          })
        : Promise.resolve(0),
      canPayments ? Payment.countDocuments({ financeStatus: "ESCALATED" }) : Promise.resolve(0),
      canPayments ? Payment.countDocuments({ $or: [{ status: "FLAGGED" }, { riskLevel: "HIGH" }] }) : Promise.resolve(0),
      canUsers
        ? User.countDocuments({
            isAdmin: { $ne: true },
            $or: [{ reportCount: { $gte: 3 } }, { accountStatus: { $in: ["RESTRICTED", "SUSPENDED", "BANNED"] } }]
          })
        : Promise.resolve(0),
      canAgents ? AgentProfile.countDocuments({ complaintCount: { $gte: 3 } }) : Promise.resolve(0),
      canAudit
        ? AuditLog.find({ createdAt: { $gte: last7d } }).populate("actorId", "name username email").sort({ createdAt: -1 }).limit(8).lean()
        : Promise.resolve([]),
      canPayments
        ? Payment.find().sort({ createdAt: -1 }).limit(6).populate("userId", "name username email").lean()
        : Promise.resolve([]),
      canOrders
        ? Order.find().sort({ createdAt: -1 }).limit(6).populate("userId", "name username email").lean()
        : Promise.resolve([]),
      canTechnical
        ? Promise.all([
          Payment.countDocuments({ status: "FAILED", createdAt: { $gte: last7d } }),
          Post.countDocuments({ reports: { $gt: 0 } }),
          CommunityGroupModel.countDocuments({ spamReports: { $gt: 0 } }),
          Payment.countDocuments({ financeStatus: "ESCALATED" })
        ]).then(([failed, posts, groups, escalated]) => ({
          api: failed > 25 ? "warning" : "healthy",
          moderation: posts + groups > 20 ? "busy" : "healthy",
          storage: escalated > 20 ? "warning" : "healthy"
        }))
        : Promise.resolve({ api: null, moderation: null, storage: null }),
      canCommunity
        ? Post.find({ reports: { $gte: 3 } }).sort({ reports: -1, createdAt: -1 }).limit(3).select("title text reports").lean()
        : Promise.resolve([]),
      canUsers
        ? User.find({
            isAdmin: { $ne: true },
            $or: [{ reportCount: { $gte: 3 } }, { accountStatus: { $in: ["RESTRICTED", "SUSPENDED", "BANNED"] } }]
          })
            .sort({ reportCount: -1, updatedAt: -1 })
            .limit(3)
            .select("name username reportCount accountStatus")
            .lean()
        : Promise.resolve([]),
      canAgents
        ? AgentProfile.find({ complaintCount: { $gte: 3 } })
            .sort({ complaintCount: -1, updatedAt: -1 })
            .limit(3)
            .populate("user", "name username email")
            .lean()
        : Promise.resolve([]),
      canOrders || canPayments
        ? Dispute.countDocuments({
            status: { $in: ["OPEN", "UNDER_REVIEW", "WAITING_SELLER_RESPONSE", "WAITING_BUYER_RESPONSE", "HOLD_EXTENDED"] }
          })
        : Promise.resolve(0),
      canPayments
        ? RefundRequest.countDocuments({ status: { $in: ["REQUESTED", "UNDER_REVIEW"] } })
        : Promise.resolve(0),
      canPayments
        ? PayoutRequest.countDocuments({ status: { $in: ["REQUESTED", "PENDING", "UNDER_REVIEW", "ON_HOLD", "HELD"] } })
        : Promise.resolve(0),
      canPayments ? RiskFlag.countDocuments({ status: "OPEN" }) : Promise.resolve(0),
      canUsers ? User.countDocuments({ isAdmin: { $ne: true }, accountStatus: "ACTIVE" }) : Promise.resolve(0),
      canAgents ? AgentProfile.countDocuments({ createdAt: { $gte: last7d } }) : Promise.resolve(0),
      canPayments
        ? Payment.aggregate([
            { $match: { status: "SUCCESS", createdAt: { $gte: todayStart } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ])
        : Promise.resolve([]),
      canProducts
        ? Product.find({ status: "ACTIVE" })
            .sort({ orders: -1, views: -1, createdAt: -1 })
            .limit(5)
            .select("title category orders views likes")
            .lean()
        : Promise.resolve([]),
      canServices
        ? Service.find({ status: { $ne: "REJECTED" } })
            .sort({ orders: -1, views: -1, createdAt: -1 })
            .limit(5)
            .select("title category orders views likes")
            .lean()
        : Promise.resolve([]),
      canAgents
        ? AgentProfile.find()
            .sort({ rating: -1, responseRate: -1, complaintCount: 1, updatedAt: -1 })
            .limit(5)
            .populate("user", "name username")
            .lean()
        : Promise.resolve([])
    ]);

    const unresolvedReports = communityPosts + mediaPosts + reportedGroups + reportedUsers + reportedAgents;
    const pendingApprovals = pendingProductReviews + pendingServices + pendingAgentVerifications;
    const suspiciousAccounts = suspiciousUsers + suspiciousAgents;
    const dailyRevenueAmount = Array.isArray(dailyRevenue) && dailyRevenue[0] ? Number(dailyRevenue[0].total || 0) : 0;
    const systemStatus =
      systemHealth.api === "warning" || systemHealth.moderation === "busy" || systemHealth.storage === "warning"
        ? "attention"
        : canTechnical
          ? "healthy"
          : "unknown";

    const queueSummary = [
      canProductsModerate
        ? {
            id: "product_approvals",
            label: "Product approvals",
            count: pendingProductReviews,
            tone: pendingProductReviews > 0 ? "warning" : "neutral",
            href: "/admin/moderation",
            module: "products",
            description: "Recently created product listings awaiting review.",
            permissionAny: ["products.approve", "products.reject", "listings.moderate"]
          }
        : null,
      canServicesModerate
        ? {
            id: "service_approvals",
            label: "Service approvals",
            count: pendingServices,
            tone: pendingServices > 0 ? "warning" : "neutral",
            href: "/admin/moderation",
            module: "services",
            description: "Pending service listings that need approval.",
            permissionAny: ["services.approve", "services.reject", "listings.moderate"]
          }
        : null,
      canAgentsVerify
        ? {
            id: "agent_verification",
            label: "Agent verification",
            count: pendingAgentVerifications,
            tone: pendingAgentVerifications > 0 ? "warning" : "neutral",
            href: "/admin/moderation",
            module: "agents",
            description: "Agent onboarding and verification requests.",
            permissionAny: ["agents.verify"]
          }
        : null,
      canCommunity
        ? {
            id: "community_reports",
            label: "Community reports",
            count: communityPosts + reportedGroups,
            tone: communityPosts + reportedGroups > 0 ? "danger" : "neutral",
            href: "/admin/moderation",
            module: "community",
            description: "Reported posts, groups, and spam complaints.",
            permissionAny: ["reports.view", "community.moderate", "posts.moderate"]
          }
        : null,
      canUsers
        ? {
            id: "reported_users",
            label: "Reported users",
            count: reportedUsers,
            tone: reportedUsers > 0 ? "danger" : "neutral",
            href: "/admin/moderation",
            module: "users",
            description: "Accounts with reports, warnings, or restrictions.",
            permissionAny: ["users.view", "users.warn", "users.suspend", "users.ban"]
          }
        : null,
      canAgents
        ? {
            id: "reported_agents",
            label: "Reported agents",
            count: reportedAgents,
            tone: reportedAgents > 0 ? "danger" : "neutral",
            href: "/admin/moderation",
            module: "agents",
            description: "Agents with complaints or suspension risk.",
            permissionAny: ["agents.view", "agents.verify", "agents.suspend"]
          }
        : null,
      canContent
        ? {
            id: "media_violations",
            label: "Media violations",
            count: mediaPosts,
            tone: mediaPosts > 0 ? "danger" : "neutral",
            href: "/admin/moderation",
            module: "content",
            description: "Reported posts with media or content abuse signals.",
            permissionAny: ["content.moderate", "reports.view", "moderation.view"]
          }
        : null,
      canPayments
        ? {
            id: "payment_issues",
            label: "Payment issues",
            count: paymentIssues,
            tone: paymentIssues > 0 ? "danger" : "neutral",
            href: "/admin/payments",
            module: "payments",
            description: "Failed, flagged, or escalated finance events.",
            permissionAny: ["payments.view", "payments.read", "payments.manage"]
          }
        : null,
      canPayments || canOrders
        ? {
            id: "open_disputes",
            label: "Open disputes",
            count: openDisputes,
            tone: openDisputes > 0 ? "warning" : "neutral",
            href: "/admin/disputes",
            module: "payments",
            description: "Buyer-seller disputes waiting for support or finance review.",
            permissionAny: ["disputes.view", "disputes.resolve", "disputes.decide"]
          }
        : null,
      canPayments
        ? {
            id: "refund_queue",
            label: "Refund queue",
            count: refundQueue,
            tone: refundQueue > 0 ? "warning" : "neutral",
            href: "/admin/payments",
            module: "payments",
            description: "Refund requests waiting for support or finance decisions.",
            permissionAny: ["refunds.manage", "refunds.approve"]
          }
        : null,
      canPayments
        ? {
            id: "payout_queue",
            label: "Payout queue",
            count: payoutQueue,
            tone: payoutQueue > 0 ? "warning" : "neutral",
            href: "/admin/payments",
            module: "payments",
            description: "Seller payout requests waiting for approval or transfer.",
            permissionAny: ["payouts.approve", "payouts.hold", "payments.manage"]
          }
        : null,
      canPayments
        ? {
            id: "escalated_cases",
            label: "Escalated cases",
            count: escalatedPayments,
            tone: escalatedPayments > 0 ? "danger" : "neutral",
            href: "/admin/moderation",
            module: "moderation",
            description: "Cases escalated for finance or high-risk review.",
            permissionAny: ["moderation.view", "reports.view", "escalations.manage"]
          }
        : null
    ].filter(Boolean);

    const alerts = [
      canPayments && paymentIssues > 0
        ? {
            id: "payment_issues",
            level: escalatedPayments > 0 ? "high" : "medium",
            title: "Payment issues need review",
            description: `${paymentIssues} finance events are open, failed, flagged, or escalated.`,
            count: paymentIssues,
            href: "/admin/payments",
            module: "payments",
            permissionAny: ["payments.view", "payments.read", "payments.manage"]
          }
        : null,
      canCommunity && communityPosts + reportedGroups > 0
        ? {
            id: "community_backlog",
            level: communityPosts + reportedGroups >= 10 ? "high" : "medium",
            title: "Community moderation backlog",
            description: `${communityPosts + reportedGroups} community posts or groups are waiting for moderation.`,
            count: communityPosts + reportedGroups,
            href: "/admin/moderation",
            module: "community",
            permissionAny: ["reports.view", "community.moderate", "posts.moderate"]
          }
        : null,
      canUsers && suspiciousAccounts > 0
        ? {
            id: "suspicious_accounts",
            level: suspiciousAccounts >= 5 ? "high" : "medium",
            title: "Suspicious accounts detected",
            description: `${suspiciousAccounts} users or agents have repeated-offender signals.`,
            count: suspiciousAccounts,
            href: "/admin/moderation",
            module: "users",
            permissionAny: ["users.view", "agents.view", "reports.view"]
          }
        : null,
      canProductsModerate && pendingApprovals > 0
        ? {
            id: "approval_backlog",
            level: pendingApprovals >= 10 ? "medium" : "low",
            title: "Approval queues are active",
            description: `${pendingApprovals} product, service, or agent approval cases need attention.`,
            count: pendingApprovals,
            href: "/admin/moderation",
            module: "moderation",
            permissionAny: ["products.approve", "services.approve", "agents.verify"]
          }
        : null
    ].filter(Boolean);

    const escalations = [
      canPayments && escalatedPayments > 0
        ? {
            id: "finance_escalations",
            level: "high",
            title: "Finance escalations",
            description: "Escalated payouts, refunds, or risky payment flows.",
            count: escalatedPayments,
            href: "/admin/moderation",
            module: "payments",
            permissionAny: ["payments.manage", "refunds.manage", "payouts.approve", "escalations.manage"]
          }
        : null,
      canUsers && highRiskUsers.length > 0
        ? {
            id: "user_offenders",
            level: "high",
            title: "Repeated-offender users",
            description: highRiskUsers
              .map((item: any) => `${item.name || item.username || "User"} (${Number(item.reportCount || 0)} reports)`)
              .join(", "),
            count: highRiskUsers.length,
            href: "/admin/moderation",
            module: "users",
            permissionAny: ["users.view", "users.warn", "users.suspend", "users.ban"]
          }
        : null,
      canAgents && highRiskAgents.length > 0
        ? {
            id: "agent_offenders",
            level: "high",
            title: "Repeated-offender agents",
            description: highRiskAgents
              .map((item: any) => `${item.user?.name || item.user?.username || "Agent"} (${Number(item.complaintCount || 0)} complaints)`)
              .join(", "),
            count: highRiskAgents.length,
            href: "/admin/moderation",
            module: "agents",
            permissionAny: ["agents.view", "agents.verify", "agents.suspend"]
          }
        : null,
      canCommunity && highRiskPosts.length > 0
        ? {
            id: "high_risk_content",
            level: "medium",
            title: "High-risk content reports",
            description: highRiskPosts
              .map((item: any) => `${truncateText(item.title || item.text || "Reported post", 48)} (${Number(item.reports || 0)} reports)`)
              .join(", "),
            count: highRiskPosts.length,
            href: "/admin/moderation",
            module: "community",
            permissionAny: ["reports.view", "community.moderate", "content.moderate"]
          }
        : null
    ].filter(Boolean);

    await writeAuditLog(req, {
      actorId: String(req.user?._id || ""),
      action: "admin.dashboard.control_center.read",
      targetType: "Dashboard",
      targetId: "control_center",
      meta: {
        cards: {
          pendingApprovals,
          unresolvedReports,
          paymentIssues,
          suspiciousAccounts,
          openDisputes,
          refundQueue,
          payoutQueue
        }
      }
    });

    return res.json({
      cards: {
        totalUsers,
        totalAgents,
        activeListings: activeProducts + activeServices,
        pendingApprovals,
        unresolvedReports,
        todayOrders: todayProductOrders,
        todayBookings,
        paymentIssues,
        openDisputes,
        refundQueue,
        payoutQueue,
        suspiciousAccounts,
        suspiciousActions: suspiciousAccounts || suspiciousPayments,
        systemStatus
      },
      queues: {
        pendingProductReviews,
        pendingServices,
        agentVerification: pendingAgentVerifications,
        communityReports: communityPosts + reportedGroups,
        reportedUsers,
        reportedAgents,
        mediaViolations: mediaPosts,
        escalatedCases: escalatedPayments,
        paymentIssues,
        openDisputes,
        refundQueue,
        payoutQueue
      },
      marketplaceStats: {
        dailyRevenue: dailyRevenueAmount,
        activeUsers,
        activeAgents: totalAgents,
        newAgents7d,
        openDisputes,
        refundQueue,
        payoutQueue
      },
      riskMonitoring: {
        suspiciousPayments,
        suspiciousUsers,
        suspiciousAgents,
        suspiciousAccounts,
        openRiskFlags,
        escalatedPayments
      },
      queueSummary,
      alerts: [
        ...alerts
      ],
      escalations,
      leaderboards: {
        products: topProductLeaders.map((item: any) => ({
          id: String(item._id),
          title: item.title,
          category: item.category || null,
          orders: Number(item.orders || 0),
          views: Number(item.views || 0),
          likes: Number(item.likes || 0)
        })),
        services: topServiceLeaders.map((item: any) => ({
          id: String(item._id),
          title: item.title,
          category: item.category || null,
          orders: Number(item.orders || 0),
          views: Number(item.views || 0),
          likes: Number(item.likes || 0)
        })),
        agents: topAgentLeaders.map((item: any) => ({
          id: String(item._id),
          name: item.user?.name || item.user?.username || "Agent",
          rating: Number(item.rating || 0),
          responseRate: Number(item.responseRate || 0),
          complaints: Number(item.complaintCount || 0)
        }))
      },
      recentAdminActions: recentAdminActions.map(serializeAuditItem),
      recentOrders: recentOrders.map((order: any) => ({
        id: String(order._id),
        kind: order.kind || "PRODUCT",
        status: order.status,
        total: order.total,
        currency: order.currency || "USD",
        userName: order.userId?.name || order.userId?.username || null,
        bookingAt: order.bookingAt || null,
        createdAt: order.createdAt
      })),
      recentPayments: recentPayments.map((payment: any) => ({
        id: String(payment._id),
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency || "USD",
        userName: payment.userId?.name || payment.userId?.username || null,
        createdAt: payment.createdAt
      })),
      systemHealth: {
        ...systemHealth,
        overall: systemStatus
      }
    });
  } catch (error) {
    console.error("getDashboardControlCenter error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getModerationCenter = async (req: Request, res: Response) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 1000000);
    const limit = toPositiveInt(req.query.limit, 50, 200);
    const moduleFilter = normalizeText(req.query.module || req.query.moduleType).toLowerCase();
    const sort = normalizeText(req.query.sort || "urgent").toLowerCase();
    const urgentOnly = parseBooleanFlag(req.query.urgent);
    const unresolvedOnly = parseBooleanFlag(req.query.unresolved);
    const escalatedOnly = parseBooleanFlag(req.query.escalated);
    const repeatedOnly = parseBooleanFlag(req.query.repeatedOffender);
    const recentProductWindowStart = buildDateRange(30);
    const sortDirection = sort === "oldest" ? 1 : -1;
    const queryLimit = Math.min(Math.max(limit * 3, 60), 180);

    const canProductsModerate = canAccessModule(req, "products", ["products.approve", "products.reject", "listings.moderate"]);
    const canServicesModerate = canAccessModule(req, "services", ["services.approve", "services.reject", "listings.moderate"]);
    const canAgentsRead = canAccessModule(req, "agents", ["agents.view", "agents.read", "agents.verify", "agents.suspend"]);
    const canUsersRead = canAccessModule(req, "users", ["users.view", "users.read", "users.warn", "users.suspend", "users.ban"]);
    const canCommunity = canAccessModule(req, "community", ["reports.view", "community.moderate", "posts.moderate"]);
    const canContent = canAccessModule(req, "content", ["content.moderate", "moderation.view", "reports.view"]);
    const canPayments = canAccessModule(req, "payments", ["payments.view", "payments.read", "payments.manage", "refunds.manage"]);

    const [products, services, posts, groups, agents, users, payments] = await Promise.all([
      canProductsModerate
        ? Product.find({ createdAt: { $gte: recentProductWindowStart } })
            .sort({ createdAt: sortDirection })
            .limit(queryLimit)
            .populate("createdBy", "name username email")
            .lean()
        : Promise.resolve([]),
      canServicesModerate
        ? Service.find({ status: "PENDING" })
            .sort({ createdAt: sortDirection })
            .limit(queryLimit)
            .populate("createdBy", "name username email")
            .lean()
        : Promise.resolve([]),
      canCommunity || canContent
        ? Post.find({ reports: { $gt: 0 } })
            .sort({ createdAt: sortDirection })
            .limit(queryLimit)
            .populate("author", "name username email")
            .lean()
        : Promise.resolve([]),
      canCommunity
        ? CommunityGroupModel.find({ spamReports: { $gt: 0 } })
            .sort({ updatedAt: sortDirection })
            .limit(queryLimit)
            .populate("createdBy", "name username email")
            .lean()
        : Promise.resolve([]),
      canAgentsRead
        ? AgentProfile.find({ $or: [{ adminStatus: "PENDING" }, { complaintCount: { $gt: 0 } }, { adminStatus: "SUSPENDED" }] })
            .sort({ updatedAt: sortDirection })
            .limit(queryLimit)
            .populate("user", "name username email")
            .lean()
        : Promise.resolve([]),
      canUsersRead
        ? User.find({
            isAdmin: { $ne: true },
            $or: [{ reportCount: { $gt: 0 } }, { accountStatus: { $in: ["WARNED", "RESTRICTED", "SUSPENDED", "BANNED"] } }]
          })
            .sort({ updatedAt: sortDirection })
            .limit(queryLimit)
            .lean()
        : Promise.resolve([]),
      canPayments
        ? Payment.find({ $or: [{ status: "FAILED" }, { status: "FLAGGED" }, { riskLevel: "HIGH" }, { financeStatus: "ESCALATED" }] })
            .sort({ updatedAt: sortDirection })
            .limit(queryLimit)
            .populate("userId", "name username email")
            .populate("orderId", "status total kind")
            .lean()
        : Promise.resolve([])
    ]);

    const reportedPostCountsByAuthor = new Map<string, number>();
    const listingReviewCountsByOwner = new Map<string, number>();
    const flaggedPaymentsByUser = new Map<string, number>();

    for (const item of posts as any[]) {
      const authorId = item.author?._id ? String(item.author._id) : item.author ? String(item.author) : "";
      if (!authorId) continue;
      reportedPostCountsByAuthor.set(authorId, (reportedPostCountsByAuthor.get(authorId) || 0) + 1);
    }
    for (const item of [...(products as any[]), ...(services as any[])]) {
      const ownerId = item.createdBy?._id ? String(item.createdBy._id) : item.createdBy ? String(item.createdBy) : "";
      if (!ownerId) continue;
      listingReviewCountsByOwner.set(ownerId, (listingReviewCountsByOwner.get(ownerId) || 0) + 1);
    }
    for (const payment of payments as any[]) {
      const userId = payment.userId?._id ? String(payment.userId._id) : payment.userId ? String(payment.userId) : "";
      if (!userId) continue;
      flaggedPaymentsByUser.set(userId, (flaggedPaymentsByUser.get(userId) || 0) + 1);
    }

    const queueCounts: Record<string, number> = {
      product_approvals: 0,
      service_approvals: 0,
      agent_verification: 0,
      community_reports: 0,
      reported_users: 0,
      reported_agents: 0,
      media_violations: 0,
      escalated_cases: 0
    };

    const baseItems = [
      ...(products as any[]).map((item) => {
        const ownerId = item.createdBy?._id ? String(item.createdBy._id) : item.createdBy ? String(item.createdBy) : "";
        const repeatedOffender = (listingReviewCountsByOwner.get(ownerId) || 0) >= 3;
        queueCounts.product_approvals += 1;
        return {
          module: "products",
          queueType: "product_approvals",
          queueLabel: "Product approvals",
          entityType: "Product",
          id: String(item._id),
          title: item.title,
          status: "PENDING",
          riskLevel: repeatedOffender ? "medium" : "low",
          reportCount: 0,
          ownerName: item.createdBy?.name || item.createdBy?.username || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt || item.createdAt,
          actions: ["approve", "reject", "request_changes"],
          reason: "New product listing is waiting for admin review.",
          preview: {
            summary: truncateText(item.description || `Category: ${item.category || "product"}`),
            imageUrl: item.coverImageUrl || item.coverImage || item.imageUrl || item.image || item.images?.[0] || null
          },
          detailRows: [
            { label: "Category", value: item.category || "Product" },
            { label: "Price", value: `${Number(item.price || 0)} ${item.currency || "USD"}` },
            { label: "Status", value: String(item.status || "ACTIVE").toUpperCase() }
          ],
          linkedEntity: {
            type: "User",
            id: ownerId || undefined,
            label: item.createdBy?.name || item.createdBy?.username || "Listing owner",
            subtitle: item.createdBy?.email || null
          },
          internalNotes: [],
          flags: {
            urgent: false,
            unresolved: true,
            escalated: false,
            repeatedOffender
          },
          history: []
        };
      }),
      ...(services as any[]).map((item) => {
        const ownerId = item.createdBy?._id ? String(item.createdBy._id) : item.createdBy ? String(item.createdBy) : "";
        const repeatedOffender = (listingReviewCountsByOwner.get(ownerId) || 0) >= 3;
        queueCounts.service_approvals += 1;
        return {
          module: "services",
          queueType: "service_approvals",
          queueLabel: "Service approvals",
          entityType: "Service",
          id: String(item._id),
          title: item.title,
          status: "PENDING",
          riskLevel: repeatedOffender ? "high" : "medium",
          reportCount: 0,
          ownerName: item.createdBy?.name || item.createdBy?.username || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt || item.createdAt,
          actions: ["approve", "reject", "request_changes"],
          reason: "Pending service listing requires manual approval.",
          preview: {
            summary: truncateText(item.description || `${item.kind || "SERVICE"} service`),
            imageUrl: item.coverImageUrl || item.coverImage || item.imageUrl || item.image || item.images?.[0] || null
          },
          detailRows: [
            { label: "Category", value: item.category || "Service" },
            { label: "Kind", value: item.kind || "SERVICE" },
            { label: "Price", value: `${Number(item.price || item.hourlyRate || 0)} ${item.currency || "USD"}` }
          ],
          linkedEntity: {
            type: "User",
            id: ownerId || undefined,
            label: item.createdBy?.name || item.createdBy?.username || "Service owner",
            subtitle: item.createdBy?.email || null
          },
          internalNotes: [],
          flags: {
            urgent: repeatedOffender,
            unresolved: true,
            escalated: false,
            repeatedOffender
          },
          history: []
        };
      }),
      ...(posts as any[])
        .filter((item) => item.reports > 0)
        .map((item) => {
          const hasMedia = Boolean(item.media?.length || item.images?.length || item.videoUrl);
          const authorId = item.author?._id ? String(item.author._id) : item.author ? String(item.author) : "";
          const repeatedOffender = (reportedPostCountsByAuthor.get(authorId) || 0) >= 2;
          const urgent = Number(item.reports || 0) >= 5;
          const queueType = hasMedia ? "media_violations" : "community_reports";
          const module = hasMedia ? "content" : "community";
          if (queueType === "media_violations") queueCounts.media_violations += 1;
          else queueCounts.community_reports += 1;
          return {
            module,
            queueType,
            queueLabel: hasMedia ? "Media / content violations" : "Community reports",
            entityType: "Post",
            id: String(item._id),
            title: item.title || truncateText(item.text || item.content, 64) || "Reported post",
            status: String(item.status || "active").toUpperCase(),
            riskLevel: urgent ? "high" : Number(item.reports || 0) >= 3 ? "medium" : "low",
            reportCount: Number(item.reports || 0),
            ownerName: item.author?.name || item.author?.username || null,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt || item.createdAt,
            actions: hasMedia ? ["hide", "escalate", "resolve"] : ["hide", "warn", "resolve"],
            reason: `${Number(item.reports || 0)} reports received for this post.`,
            preview: {
              summary: truncateText(item.text || item.content || item.excerpt || "Reported community post"),
              imageUrl: item.images?.[0] || item.media?.[0]?.url || null
            },
            detailRows: [
              { label: "Category", value: item.category || "community" },
              { label: "Reports", value: String(item.reports || 0) },
              { label: "Comments", value: String(item.commentCount || 0) },
              { label: "Media assets", value: String((item.images?.length || 0) + (item.media?.length || 0)) }
            ],
            linkedEntity: {
              type: "User",
              id: authorId || undefined,
              label: item.author?.name || item.author?.username || "Post author",
              subtitle: item.author?.email || null
            },
            internalNotes: [],
            flags: {
              urgent,
              unresolved: true,
              escalated: urgent || hasMedia,
              repeatedOffender
            },
            history: []
          };
        }),
      ...(groups as any[]).map((item) => {
        const urgent = Number(item.spamReports || 0) >= 5;
        queueCounts.community_reports += 1;
        return {
          module: "community",
          queueType: "community_reports",
          queueLabel: "Community reports",
          entityType: "CommunityGroup",
          id: String(item._id),
          title: item.title,
          status: item.isActive ? "ACTIVE" : "HIDDEN",
          riskLevel: urgent ? "high" : Number(item.spamReports || 0) >= 3 ? "medium" : "low",
          reportCount: Number(item.spamReports || 0),
          ownerName: item.createdBy?.name || item.createdBy?.username || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt || item.createdAt,
          actions: ["hide", "resolve", "escalate"],
          reason: `${Number(item.spamReports || 0)} spam reports received for this group.`,
          preview: {
            summary: truncateText(item.description || `${item.groupType || "group"} in ${item.category || "community"}`),
            imageUrl: null
          },
          detailRows: [
            { label: "Members", value: String(item.members || 0) },
            { label: "Privacy", value: item.privacy || "public" },
            { label: "Pending approvals", value: String(item.pendingApprovals || 0) }
          ],
          linkedEntity: {
            type: "CommunityGroup",
            id: String(item._id),
            label: item.title,
            subtitle: item.category || null
          },
          internalNotes: [],
          flags: {
            urgent,
            unresolved: true,
            escalated: urgent,
            repeatedOffender: Number(item.spamReports || 0) >= 3
          },
          history: []
        };
      }),
      ...(agents as any[]).map((item) => {
        const complaintCount = Number(item.complaintCount || 0);
        const pendingVerification = String(item.adminStatus || "").toUpperCase() === "PENDING";
        const queueType = pendingVerification ? "agent_verification" : "reported_agents";
        if (queueType === "agent_verification") queueCounts.agent_verification += 1;
        else queueCounts.reported_agents += 1;
        return {
          module: "agents",
          queueType,
          queueLabel: pendingVerification ? "Agent verification" : "Reported agents",
          entityType: "AgentProfile",
          id: String(item._id),
          title: item.user?.name || item.user?.username || "Agent",
          status: item.adminStatus || "ACTIVE",
          riskLevel: complaintCount >= 5 ? "high" : complaintCount >= 3 || pendingVerification ? "medium" : "low",
          reportCount: complaintCount,
          ownerName: item.user?.email || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt || item.createdAt,
          actions: pendingVerification ? ["verify", "request_changes", "suspend"] : ["note", "suspend", "resolve"],
          reason: pendingVerification
            ? "Agent onboarding is waiting for verification."
            : `${complaintCount} complaints recorded for this agent.`,
          preview: {
            summary: truncateText(item.internalNotes || `${item.kind || "AGENT"} · rating ${Number(item.rating || 0).toFixed(1)}`),
            imageUrl: null
          },
          detailRows: [
            { label: "Kind", value: item.kind || "AGENT" },
            { label: "Complaints", value: String(complaintCount) },
            { label: "Response rate", value: `${Number(item.responseRate || 0)}%` }
          ],
          linkedEntity: {
            type: "User",
            id: item.user?._id ? String(item.user._id) : undefined,
            label: item.user?.name || item.user?.username || "Agent user",
            subtitle: item.user?.email || null
          },
          internalNotes: item.internalNotes ? [item.internalNotes] : [],
          flags: {
            urgent: complaintCount >= 5,
            unresolved: true,
            escalated: complaintCount >= 5 || String(item.adminStatus || "").toUpperCase() === "SUSPENDED",
            repeatedOffender: complaintCount >= 3
          },
          history: []
        };
      }),
      ...(users as any[]).map((item) => {
        const reportCount = Number(item.reportCount || 0);
        const warningCount = Number(item.warningCount || 0);
        queueCounts.reported_users += 1;
        return {
          module: "users",
          queueType: "reported_users",
          queueLabel: "Reported users",
          entityType: "User",
          id: String(item._id),
          title: item.name || item.username || "User",
          status: item.accountStatus || "ACTIVE",
          riskLevel:
            reportCount >= 5 || ["SUSPENDED", "BANNED"].includes(String(item.accountStatus || "").toUpperCase())
              ? "high"
              : reportCount >= 3 || warningCount >= 3 || String(item.accountStatus || "").toUpperCase() === "RESTRICTED"
                ? "medium"
                : "low",
          reportCount,
          ownerName: item.email || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt || item.createdAt,
          actions: ["warn", "suspend", "ban", "resolve"],
          reason:
            reportCount > 0
              ? `${reportCount} reports recorded for this user account.`
              : `${String(item.accountStatus || "ACTIVE").toLowerCase()} account requires review.`,
          preview: {
            summary: truncateText(item.restrictionReason || item.internalNotes || `${item.region || "Unknown region"} · verified ${Boolean(item.isVerified) ? "yes" : "no"}`),
            imageUrl: item.avatarUrl || null
          },
          detailRows: [
            { label: "Warnings", value: String(warningCount) },
            { label: "Region", value: item.region || "—" },
            { label: "Verified", value: Boolean(item.isVerified) ? "Yes" : "No" }
          ],
          linkedEntity: {
            type: "User",
            id: String(item._id),
            label: item.name || item.username || "User account",
            subtitle: item.email || null
          },
          internalNotes: [item.internalNotes, item.restrictionReason].filter(Boolean),
          flags: {
            urgent: reportCount >= 5 || ["SUSPENDED", "BANNED"].includes(String(item.accountStatus || "").toUpperCase()),
            unresolved: true,
            escalated: ["RESTRICTED", "SUSPENDED", "BANNED"].includes(String(item.accountStatus || "").toUpperCase()),
            repeatedOffender: reportCount >= 3 || warningCount >= 3
          },
          history: []
        };
      }),
      ...(payments as any[]).map((item) => {
        const escalated = String(item.financeStatus || "").toUpperCase() === "ESCALATED";
        const repeatedOffender = (flaggedPaymentsByUser.get(String(item.userId?._id || item.userId || "")) || 0) >= 2;
        const queueType = escalated ? "escalated_cases" : "escalated_cases";
        queueCounts.escalated_cases += 1;
        return {
          module: "payments",
          queueType,
          queueLabel: "Escalated cases",
          entityType: "Payment",
          id: String(item._id),
          title: `${item.provider} ${Number(item.amount || 0)} ${item.currency || "USD"}`,
          status: item.financeStatus || item.status,
          riskLevel: escalated || String(item.riskLevel || "").toUpperCase() === "HIGH" ? "high" : String(item.status || "").toUpperCase() === "FAILED" ? "medium" : "low",
          reportCount: escalated ? 1 : 0,
          ownerName: item.userId?.name || item.userId?.username || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt || item.createdAt,
          actions: item.kind === "REFUND" ? ["approve_refund", "mark_reviewed", "escalate"] : ["mark_reviewed", "flag", "escalate"],
          reason: escalated
            ? "Finance escalation requires senior review."
            : `${String(item.status || "PAYMENT").toLowerCase()} payment event requires review.`,
          preview: {
            summary: truncateText(item.note || `${item.kind || "PAYMENT"} via ${item.provider}`),
            imageUrl: null
          },
          detailRows: [
            { label: "Provider", value: item.provider || "—" },
            { label: "Risk level", value: item.riskLevel || "LOW" },
            { label: "Order status", value: item.orderId?.status || "—" }
          ],
          linkedEntity: {
            type: "Order",
            id: item.orderId?._id ? String(item.orderId._id) : item.orderId ? String(item.orderId) : undefined,
            label: item.userId?.name || item.userId?.username || "Linked order",
            subtitle: item.transactionId || null
          },
          internalNotes: item.note ? [item.note] : [],
          flags: {
            urgent: escalated || String(item.riskLevel || "").toUpperCase() === "HIGH",
            unresolved: true,
            escalated,
            repeatedOffender
          },
          history: []
        };
      })
    ];

    const summary = [
      {
        id: "product_approvals",
        label: "Product approvals",
        count: queueCounts.product_approvals,
        permissionAny: ["products.approve", "products.reject", "listings.moderate"]
      },
      {
        id: "service_approvals",
        label: "Service approvals",
        count: queueCounts.service_approvals,
        permissionAny: ["services.approve", "services.reject", "listings.moderate"]
      },
      {
        id: "agent_verification",
        label: "Agent verification",
        count: queueCounts.agent_verification,
        permissionAny: ["agents.verify", "agents.view"]
      },
      {
        id: "community_reports",
        label: "Community reports",
        count: queueCounts.community_reports,
        permissionAny: ["reports.view", "community.moderate", "posts.moderate"]
      },
      {
        id: "reported_users",
        label: "Reported users",
        count: queueCounts.reported_users,
        permissionAny: ["users.view", "users.warn", "users.suspend", "users.ban"]
      },
      {
        id: "reported_agents",
        label: "Reported agents",
        count: queueCounts.reported_agents,
        permissionAny: ["agents.view", "agents.suspend", "agents.verify"]
      },
      {
        id: "media_violations",
        label: "Media violations",
        count: queueCounts.media_violations,
        permissionAny: ["content.moderate", "moderation.view", "reports.view"]
      },
      {
        id: "escalated_cases",
        label: "Escalated cases",
        count: queueCounts.escalated_cases,
        permissionAny: ["payments.view", "payments.manage", "reports.view", "escalations.manage"]
      }
    ].filter((item) => item.count > 0);

    const filtered = baseItems
      .filter((item) => {
        if (moduleFilter && item.module !== moduleFilter && item.queueType !== moduleFilter) return false;
        if (urgentOnly && !item.flags.urgent) return false;
        if (unresolvedOnly && !item.flags.unresolved) return false;
        if (escalatedOnly && !item.flags.escalated) return false;
        if (repeatedOnly && !item.flags.repeatedOffender) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        const score = (value: typeof a) =>
          (value.flags.urgent ? 100 : 0) +
          (value.flags.escalated ? 50 : 0) +
          (value.flags.repeatedOffender ? 25 : 0) +
          (value.riskLevel === "high" ? 10 : value.riskLevel === "medium" ? 5 : 0) +
          Math.min(value.reportCount || 0, 9);
        return score(b) - score(a) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const pagedItems = filtered.slice(offset, offset + limit);
    const historyMap = await loadModerationHistoryMap(pagedItems.map((item) => ({ entityType: item.entityType, id: item.id })));

    await writeAuditLog(req, {
      actorId: String(req.user?._id || ""),
      action: "admin.moderation.center.read",
      targetType: "ModerationCenter",
      targetId: "queue",
      meta: {
        moduleFilter: moduleFilter || null,
        sort,
        urgentOnly,
        unresolvedOnly,
        escalatedOnly,
        repeatedOnly
      }
    });

    return res.json({
      items: pagedItems.map((item) => ({
        ...item,
        history: historyMap[toEntityHistoryKey(item.entityType, item.id) || ""] || []
      })),
      summary,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error("getModerationCenter error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const applyModerationCenterAction = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

    const id = parseObjectId(req.body.id || req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid moderation item id" });

    const moduleName = normalizeText(req.body.module).toLowerCase();
    const entityType = normalizeText(req.body.entityType);
    const action = normalizeText(req.body.action).toLowerCase();
    const reason = normalizeText(req.body.reason) || undefined;
    const note = normalizeText(req.body.note) || undefined;

    const deny = (message: string) => res.status(403).json({ message });
    const hasPermission = (moduleKey: string, permissions: string[]) => canAccessModule(req, moduleKey, permissions);
    const requirePermission = (moduleKey: string, permissions: string[], message: string) => {
      if (!hasPermission(moduleKey, permissions)) {
        deny(message);
        return false;
      }
      return true;
    };

    if (!moduleName || !entityType || !action) {
      return res.status(400).json({ message: "module, entityType, and action are required" });
    }

    if (moduleName === "products" && entityType === "Product") {
      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ message: "Product not found" });

      const before = { status: product.status };
      if (action === "approve") {
        if (!requirePermission("products", ["products.approve", "listings.moderate"], "Missing product approve permission")) return;
        product.status = "ACTIVE";
      } else if (["reject", "request_changes", "hide"].includes(action)) {
        if (!requirePermission("products", ["products.reject", "listings.moderate"], "Missing product moderation permission")) return;
        product.status = "BLOCKED";
      } else {
        return res.status(400).json({ message: "Unsupported product moderation action" });
      }

      await product.save();
      await writeAuditLog(req, {
        actorId: String(req.user._id),
        action: `admin.moderation.products.${action}`,
        entityType: "Product",
        entityId: String(product._id),
        targetType: "Product",
        targetId: String(product._id),
        before,
        after: { status: product.status },
        reason,
        meta: note ? { note } : undefined
      });

      return res.json({ item: { id: String(product._id), module: moduleName, entityType, status: product.status } });
    }

    if (moduleName === "services" && entityType === "Service") {
      const service = await Service.findById(id);
      if (!service) return res.status(404).json({ message: "Service not found" });

      const before = { status: service.status };
      if (action === "approve") {
        if (!requirePermission("services", ["services.approve", "listings.moderate"], "Missing service approve permission")) return;
        service.status = "ACTIVE";
      } else if (["reject", "request_changes", "hide"].includes(action)) {
        if (!requirePermission("services", ["services.reject", "listings.moderate"], "Missing service moderation permission")) return;
        service.status = "BLOCKED";
      } else {
        return res.status(400).json({ message: "Unsupported service moderation action" });
      }

      await service.save();
      await writeAuditLog(req, {
        actorId: String(req.user._id),
        action: `admin.moderation.services.${action}`,
        entityType: "Service",
        entityId: String(service._id),
        targetType: "Service",
        targetId: String(service._id),
        before,
        after: { status: service.status },
        reason,
        meta: note ? { note } : undefined
      });

      return res.json({ item: { id: String(service._id), module: moduleName, entityType, status: service.status } });
    }

    if (moduleName === "agents" && entityType === "AgentProfile") {
      const profile = await AgentProfile.findById(id);
      if (!profile) return res.status(404).json({ message: "Agent profile not found" });

      const before = {
        adminStatus: profile.adminStatus,
        verifiedByAdmin: profile.verifiedByAdmin,
        internalNotes: profile.internalNotes || null
      };

      if (action === "verify" || action === "resolve") {
        if (!requirePermission("agents", ["agents.verify"], "Missing agent verify permission")) return;
        profile.adminStatus = "ACTIVE";
        profile.verifiedByAdmin = true;
      } else if (action === "suspend") {
        if (!requirePermission("agents", ["agents.suspend"], "Missing agent suspend permission")) return;
        profile.adminStatus = "SUSPENDED";
      } else if (action === "note" || action === "request_changes") {
        if (!requirePermission("agents", ["agents.note", "agents.verify"], "Missing agent note permission")) return;
        profile.internalNotes = note || reason || profile.internalNotes;
      } else {
        return res.status(400).json({ message: "Unsupported agent moderation action" });
      }

      if (note && action !== "note" && action !== "request_changes") {
        profile.internalNotes = note;
      }
      profile.lastModeratedAt = new Date();
      await profile.save();

      await writeAuditLog(req, {
        actorId: String(req.user._id),
        action: `admin.moderation.agents.${action}`,
        entityType: "AgentProfile",
        entityId: String(profile._id),
        targetType: "AgentProfile",
        targetId: String(profile._id),
        before,
        after: {
          adminStatus: profile.adminStatus,
          verifiedByAdmin: profile.verifiedByAdmin,
          internalNotes: profile.internalNotes || null
        },
        reason
      });

      return res.json({ item: { id: String(profile._id), module: moduleName, entityType, status: profile.adminStatus } });
    }

    if (moduleName === "users" && entityType === "User") {
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (isAdminIdentityRecord(user)) return res.status(403).json({ message: "Admin accounts must be managed from admin management" });

      const before = {
        accountStatus: user.accountStatus,
        warningCount: user.warningCount,
        restrictionReason: user.restrictionReason,
        internalNotes: user.internalNotes || null
      };

      if (action === "warn") {
        if (!requirePermission("users", ["users.warn"], "Missing user warn permission")) return;
        user.accountStatus = "WARNED";
        user.warningCount = Number(user.warningCount || 0) + 1;
      } else if (action === "suspend") {
        if (!requirePermission("users", ["users.suspend"], "Missing user suspend permission")) return;
        user.accountStatus = "SUSPENDED";
        user.restrictionReason = reason || "Suspended from moderation center";
      } else if (action === "ban") {
        if (!requirePermission("users", ["users.ban"], "Missing user ban permission")) return;
        user.accountStatus = "BANNED";
        user.restrictionReason = reason || "Banned from moderation center";
      } else if (action === "resolve") {
        if (!requirePermission("users", ["users.suspend", "users.ban"], "Missing user resolve permission")) return;
        user.accountStatus = "ACTIVE";
        user.restrictionReason = null;
        user.restrictedUntil = null;
      } else {
        return res.status(400).json({ message: "Unsupported user moderation action" });
      }

      if (note) user.internalNotes = note;
      user.lastAdminActionAt = new Date();
      await user.save();

      await writeAuditLog(req, {
        actorId: String(req.user._id),
        action: `admin.moderation.users.${action}`,
        entityType: "User",
        entityId: String(user._id),
        targetType: "User",
        targetId: String(user._id),
        before,
        after: {
          accountStatus: user.accountStatus,
          warningCount: user.warningCount,
          restrictionReason: user.restrictionReason,
          internalNotes: user.internalNotes || null
        },
        reason
      });

      return res.json({ item: { id: String(user._id), module: moduleName, entityType, status: user.accountStatus } });
    }

    if ((moduleName === "community" || moduleName === "content") && entityType === "Post") {
      const post = await Post.findById(id);
      if (!post) return res.status(404).json({ message: "Post not found" });
      const author = action === "warn" ? await User.findById(post.author) : null;

      const before = {
        status: post.status,
        isActive: post.isActive,
        reports: post.reports,
        authorStatus: author?.accountStatus,
        authorWarnings: author?.warningCount
      };

      if (action === "hide") {
        if (!requirePermission(moduleName, ["community.moderate", "posts.moderate", "content.moderate"], "Missing content moderation permission")) return;
        post.status = "blocked";
        post.isActive = false;
        post.reports = 0;
      } else if (action === "resolve") {
        if (!requirePermission(moduleName, ["community.moderate", "posts.moderate", "content.moderate", "reports.resolve"], "Missing report resolve permission")) return;
        post.status = "active";
        post.isActive = true;
        post.reports = 0;
      } else if (action === "warn") {
        if (!requirePermission("users", ["users.warn"], "Missing user warn permission")) return;
        if (!author || isAdminIdentityRecord(author)) return res.status(404).json({ message: "Post author not found" });
        author.accountStatus = "WARNED";
        author.warningCount = Number(author.warningCount || 0) + 1;
        if (note) author.internalNotes = note;
        author.lastAdminActionAt = new Date();
        await author.save();
        post.status = "active";
        post.isActive = true;
        post.reports = 0;
      } else if (action === "escalate") {
        if (!requirePermission(moduleName, ["reports.resolve", "escalations.manage", "community.moderate", "content.moderate"], "Missing escalation permission")) return;
        post.status = "pending";
        post.isActive = false;
      } else {
        return res.status(400).json({ message: "Unsupported post moderation action" });
      }

      await post.save();
      await writeAuditLog(req, {
        actorId: String(req.user._id),
        action: `admin.moderation.${moduleName}.${action}`,
        entityType: "Post",
        entityId: String(post._id),
        targetType: "Post",
        targetId: String(post._id),
        before,
        after: {
          status: post.status,
          isActive: post.isActive,
          reports: post.reports,
          authorStatus: author?.accountStatus,
          authorWarnings: author?.warningCount
        },
        reason
      });

      return res.json({ item: { id: String(post._id), module: moduleName, entityType, status: post.status } });
    }

    if (moduleName === "community" && entityType === "CommunityGroup") {
      const group = await CommunityGroupModel.findById(id);
      if (!group) return res.status(404).json({ message: "Community group not found" });

      const before = {
        isActive: group.isActive,
        isVerified: group.isVerified,
        spamReports: group.spamReports
      };

      if (action === "hide") {
        if (!requirePermission("community", ["community.moderate", "groups.moderate"], "Missing community moderation permission")) return;
        group.isActive = false;
      } else if (action === "resolve") {
        if (!requirePermission("community", ["community.moderate", "groups.moderate", "reports.resolve"], "Missing community resolve permission")) return;
        group.isActive = true;
        group.spamReports = 0;
      } else if (action === "escalate") {
        if (!requirePermission("community", ["community.moderate", "groups.moderate", "escalations.manage"], "Missing community escalation permission")) return;
        group.isVerified = false;
      } else {
        return res.status(400).json({ message: "Unsupported community group action" });
      }

      await group.save();
      await writeAuditLog(req, {
        actorId: String(req.user._id),
        action: `admin.moderation.community.${action}`,
        entityType: "CommunityGroup",
        entityId: String(group._id),
        targetType: "CommunityGroup",
        targetId: String(group._id),
        before,
        after: {
          isActive: group.isActive,
          isVerified: group.isVerified,
          spamReports: group.spamReports
        },
        reason
      });

      return res.json({ item: { id: String(group._id), module: moduleName, entityType, status: group.isActive ? "ACTIVE" : "HIDDEN" } });
    }

    if (moduleName === "payments" && entityType === "Payment") {
      const payment = await Payment.findById(id);
      if (!payment) return res.status(404).json({ message: "Payment not found" });

      const before = {
        status: payment.status,
        financeStatus: payment.financeStatus,
        riskLevel: payment.riskLevel,
        note: payment.note || null
      };

      if (action === "mark_reviewed" || action === "resolve") {
        if (!requirePermission("payments", ["payments.manage"], "Missing payment review permission")) return;
        payment.financeStatus = "REVIEWED";
        if (payment.status === "FLAGGED") payment.status = "SUCCESS";
      } else if (action === "flag" || action === "escalate") {
        if (!requirePermission("payments", ["payments.manage", "escalations.manage"], "Missing payment escalation permission")) return;
        payment.status = "FLAGGED";
        payment.financeStatus = "ESCALATED";
        payment.riskLevel = "HIGH";
      } else if (action === "approve_refund") {
        if (!requirePermission("payments", ["refunds.manage"], "Missing refund approve permission")) return;
        payment.status = "REFUNDED";
        payment.financeStatus = "REVIEWED";
      } else if (action === "clear_flag") {
        if (!requirePermission("payments", ["payments.manage"], "Missing payment clear permission")) return;
        payment.financeStatus = "REVIEWED";
        payment.riskLevel = "LOW";
        if (payment.status === "FLAGGED") payment.status = "SUCCESS";
      } else {
        return res.status(400).json({ message: "Unsupported payment moderation action" });
      }

      if (note) payment.note = note;
      await payment.save();

      await writeAuditLog(req, {
        actorId: String(req.user._id),
        action: `admin.moderation.payments.${action}`,
        entityType: "Payment",
        entityId: String(payment._id),
        targetType: "Payment",
        targetId: String(payment._id),
        before,
        after: {
          status: payment.status,
          financeStatus: payment.financeStatus,
          riskLevel: payment.riskLevel,
          note: payment.note || null
        },
        reason
      });

      return res.json({ item: { id: String(payment._id), module: moduleName, entityType, status: payment.financeStatus } });
    }

    return res.status(400).json({ message: "Unsupported moderation item" });
  } catch (error) {
    console.error("applyModerationCenterAction error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listOperationalUsers = async (req: Request, res: Response) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 1000000);
    const limit = toPositiveInt(req.query.limit, 25, 100);
    const skip = (page - 1) * limit;
    const status = normalizeText(req.query.status).toUpperCase();
    const region = normalizeText(req.query.region);
    const search = normalizeText(req.query.search);

    const filter: Record<string, unknown> = {};
    filter.isAdmin = { $ne: true };
    filter.role = { $ne: "ADMIN" };
    if (status && ["ACTIVE", "WARNED", "RESTRICTED", "SUSPENDED", "BANNED"].includes(status)) {
      filter.accountStatus = status;
    }
    if (region) filter.region = region;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: regex }, { email: regex }, { username: regex }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "name email username region isVerified accountStatus warningCount reportCount restrictionReason restrictedUntil internalNotes lastAdminActionAt followers following createdAt"
        )
        .lean(),
      User.countDocuments(filter)
    ]);

    const userIds = users.map((user) => String(user._id));
    const [linkedActivity, auditHistory] = await Promise.all([
      getLinkedActivityMap(userIds),
      buildAuditHistoryMap(["User"], userIds)
    ]);

    return res.json({
      items: users.map((user) => serializeUserItem(user, linkedActivity, auditHistory)),
      total,
      page,
      limit
    });
  } catch (error) {
    console.error("listOperationalUsers error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateOperationalUser = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid user id" });

    const action = normalizeText(req.body.action).toLowerCase();
    const reason = normalizeText(req.body.reason) || undefined;
    const note = normalizeText(req.body.note) || undefined;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (isAdminIdentityRecord(user)) {
      return res.status(403).json({ message: "Admin accounts must be governed from admin management" });
    }

    const before = {
      accountStatus: user.accountStatus,
      warningCount: user.warningCount,
      restrictionReason: user.restrictionReason,
      internalNotes: user.internalNotes
    };

    if (action === "warn") {
      if (!requireAdminActionPermission(req, res, ["users.warn"], "Missing permission: users.warn")) return;
      user.accountStatus = "WARNED";
      user.warningCount = Number(user.warningCount || 0) + 1;
    } else if (action === "restrict") {
      if (!requireAdminActionPermission(req, res, ["users.suspend"], "Missing permission: users.suspend")) return;
      user.accountStatus = "RESTRICTED";
      user.restrictionReason = reason || "Restricted by admin";
    } else if (action === "suspend") {
      if (!requireAdminActionPermission(req, res, ["users.suspend"], "Missing permission: users.suspend")) return;
      user.accountStatus = "SUSPENDED";
      user.restrictionReason = reason || "Suspended by admin";
    } else if (action === "ban") {
      if (!requireAdminActionPermission(req, res, ["users.ban"], "Missing permission: users.ban")) return;
      user.accountStatus = "BANNED";
      user.restrictionReason = reason || "Banned by admin";
    } else if (action === "restore") {
      if (!requireAdminActionPermission(req, res, ["users.suspend", "users.ban"], "Missing permission: users.suspend or users.ban")) return;
      user.accountStatus = "ACTIVE";
      user.restrictionReason = null;
      user.restrictedUntil = null;
    } else if (action === "note") {
      if (!requireAdminActionPermission(req, res, ["users.edit", "users.update"], "Missing permission: users.edit")) return;
      user.internalNotes = note || user.internalNotes;
    } else {
      return res.status(400).json({ message: "Unsupported user action" });
    }

    if (note && action !== "note") {
      user.internalNotes = note;
    }
    user.lastAdminActionAt = new Date();
    await user.save();

    await writeAuditLog(req, {
      actorId: String(req.user._id),
      action: `admin.users.${action}`,
      entityType: "User",
      entityId: String(user._id),
      targetType: "User",
      targetId: String(user._id),
      before,
      after: {
        accountStatus: user.accountStatus,
        warningCount: user.warningCount,
        restrictionReason: user.restrictionReason,
        internalNotes: user.internalNotes
      },
      reason
    });

    return res.json({ item: user });
  } catch (error) {
    console.error("updateOperationalUser error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listOperationalAgents = async (req: Request, res: Response) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 1000000);
    const limit = toPositiveInt(req.query.limit, 25, 100);
    const skip = (page - 1) * limit;
    const status = normalizeText(req.query.status).toUpperCase();
    const search = normalizeText(req.query.search);
    const badge = normalizeText(req.query.badge);

    const filter: Record<string, unknown> = {};
    if (status && ["ACTIVE", "PENDING", "SUSPENDED"].includes(status)) filter.adminStatus = status;
    if (badge) filter.badge = badge;

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchedUsers = await User.find({
        $or: [{ name: regex }, { email: regex }, { username: regex }]
      })
        .select("_id")
        .lean();
      const matchedIds = matchedUsers.map((user) => user._id);
      if (!matchedIds.length) {
        return res.json({ items: [], total: 0, page, limit });
      }
      filter.user = { $in: matchedIds };
    }

    const [profiles, total] = await Promise.all([
      AgentProfile.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "name username email")
        .lean(),
      AgentProfile.countDocuments(filter)
    ]);

    const userIds = profiles
      .map((profile: any) => String(profile.user?._id || profile.user || ""))
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);

    const objectIds = userIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
    const [productCountsRaw, serviceCountsRaw, orderCountsRaw, productPreviews, servicePreviews, auditHistory] = await Promise.all([
      Product.aggregate([{ $match: { createdBy: { $in: objectIds } } }, { $group: { _id: "$createdBy", count: { $sum: 1 } } }]),
      Service.aggregate([{ $match: { createdBy: { $in: objectIds } } }, { $group: { _id: "$createdBy", count: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { agentId: { $in: objectIds } } }, { $group: { _id: "$agentId", count: { $sum: 1 } } }]),
      buildCreatorPreviewMap(Product, userIds),
      buildCreatorPreviewMap(Service, userIds),
      buildAuditHistoryMap(["AgentProfile"], profiles.map((profile: any) => String(profile._id)))
    ]);

    const toCountMap = (rows: Array<{ _id: mongoose.Types.ObjectId; count: number }>) =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[String(row._id)] = row.count;
        return acc;
      }, {});

    return res.json({
      items: profiles.map((profile: any) =>
        serializeAgentItem(
          profile,
          toCountMap(productCountsRaw),
          toCountMap(serviceCountsRaw),
          toCountMap(orderCountsRaw),
          productPreviews,
          servicePreviews,
          auditHistory
        )
      ),
      total,
      page,
      limit
    });
  } catch (error) {
    console.error("listOperationalAgents error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateOperationalAgent = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid agent id" });

    const profile = await AgentProfile.findById(id).populate("user", "role isAdmin adminLevel");
    if (!profile) return res.status(404).json({ message: "Agent profile not found" });
    if (isAdminIdentityRecord(profile.user as any)) {
      return res.status(403).json({ message: "Admin-linked agent profiles must be governed from admin management" });
    }

    const action = normalizeText(req.body.action).toLowerCase();
    const note = normalizeText(req.body.note) || undefined;
    const badge = normalizeText(req.body.badge) || undefined;
    const reason = normalizeText(req.body.reason) || undefined;

    const before = {
      adminStatus: profile.adminStatus,
      verifiedByAdmin: profile.verifiedByAdmin,
      badge: profile.badge,
      internalNotes: profile.internalNotes
    };

    if (action === "verify") {
      if (!requireAdminActionPermission(req, res, ["agents.verify"], "Missing permission: agents.verify")) return;
      profile.adminStatus = "ACTIVE";
      profile.verifiedByAdmin = true;
    } else if (action === "suspend") {
      if (!requireAdminActionPermission(req, res, ["agents.suspend"], "Missing permission: agents.suspend")) return;
      profile.adminStatus = "SUSPENDED";
    } else if (action === "restore") {
      if (!requireAdminActionPermission(req, res, ["agents.suspend"], "Missing permission: agents.suspend")) return;
      profile.adminStatus = "ACTIVE";
    } else if (action === "badge") {
      if (!requireAdminActionPermission(req, res, ["agents.badge"], "Missing permission: agents.badge")) return;
      profile.badge = badge || profile.badge;
    } else if (action === "note") {
      if (!requireAdminActionPermission(req, res, ["agents.note"], "Missing permission: agents.note")) return;
      profile.internalNotes = note || profile.internalNotes;
    } else {
      return res.status(400).json({ message: "Unsupported agent action" });
    }

    if (note && action !== "note") {
      profile.internalNotes = note;
    }
    profile.lastModeratedAt = new Date();
    await profile.save();

    await writeAuditLog(req, {
      actorId: String(req.user._id),
      action: `admin.agents.${action}`,
      entityType: "AgentProfile",
      entityId: String(profile._id),
      targetType: "AgentProfile",
      targetId: String(profile._id),
      before,
      after: {
        adminStatus: profile.adminStatus,
        verifiedByAdmin: profile.verifiedByAdmin,
        badge: profile.badge,
        internalNotes: profile.internalNotes
      },
      reason
    });

    return res.json({ item: profile });
  } catch (error) {
    console.error("updateOperationalAgent error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listOperationalOrders = async (req: Request, res: Response) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 1000000);
    const limit = toPositiveInt(req.query.limit, 25, 100);
    const skip = (page - 1) * limit;
    const status = normalizeText(req.query.status).toUpperCase();
    const kind = normalizeText(req.query.kind).toUpperCase();

    const filter: Record<string, unknown> = {};
    if (
      status &&
      ["PENDING_PAYMENT", "PAID", "PROCESSING", "CONFIRMED", "COMPLETED", "CANCELLED", "DISPUTED", "REFUNDED"].includes(status)
    ) {
      filter.status = status;
    }
    if (kind && ["PRODUCT", "SERVICE"].includes(kind)) {
      filter.kind = kind;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name username email")
        .populate("agentId", "name username email")
        .lean(),
      Order.countDocuments(filter)
    ]);

    const orderIds = orders.map((order) => order._id);
    const [paymentRows, auditHistory] = await Promise.all([
      orderIds.length ? Payment.find({ orderId: { $in: orderIds } }).lean() : Promise.resolve([]),
      buildAuditHistoryMap(["Order"], orders.map((order) => String(order._id)))
    ]);
    const paymentsByOrderId = paymentRows.reduce<Record<string, any[]>>((acc, item) => {
      const key = String(item.orderId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    return res.json({
      items: orders.map((order) => serializeOrderItem(order, paymentsByOrderId, auditHistory)),
      total,
      page,
      limit
    });
  } catch (error) {
    console.error("listOperationalOrders error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateOperationalOrder = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid order id" });

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const nextStatus = normalizeText(req.body.status).toUpperCase();
    const validStatuses = ["PENDING_PAYMENT", "PAID", "PROCESSING", "CONFIRMED", "COMPLETED", "CANCELLED", "DISPUTED", "REFUNDED"];
    if (!validStatuses.includes(nextStatus)) return res.status(400).json({ message: "Invalid order status" });

    const before = {
      status: order.status,
      note: order.note,
      disputeReason: order.disputeReason,
      refundReason: order.refundReason
    };

    order.status = nextStatus as any;
    order.note = normalizeText(req.body.note) || order.note;
    if (normalizeText(req.body.disputeReason)) order.disputeReason = normalizeText(req.body.disputeReason);
    if (normalizeText(req.body.refundReason)) order.refundReason = normalizeText(req.body.refundReason);
    await order.save();

    await writeAuditLog(req, {
      actorId: String(req.user._id),
      action: "admin.orders.update",
      entityType: "Order",
      entityId: String(order._id),
      targetType: "Order",
      targetId: String(order._id),
      before,
      after: {
        status: order.status,
        note: order.note,
        disputeReason: order.disputeReason,
        refundReason: order.refundReason
      },
      reason: normalizeText(req.body.reason) || undefined
    });

    return res.json({ item: order });
  } catch (error) {
    console.error("updateOperationalOrder error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listOperationalPayments = async (req: Request, res: Response) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 1000000);
    const limit = toPositiveInt(req.query.limit, 25, 100);
    const skip = (page - 1) * limit;
    const status = normalizeText(req.query.status).toUpperCase();
    const financeStatus = normalizeText(req.query.financeStatus).toUpperCase();
    const riskLevel = normalizeText(req.query.riskLevel).toUpperCase();

    const filter: Record<string, unknown> = {};
    if (status && ["PENDING", "SUCCESS", "FAILED", "REFUNDED", "FLAGGED"].includes(status)) filter.status = status;
    if (financeStatus && ["OPEN", "REVIEWED", "ESCALATED"].includes(financeStatus)) filter.financeStatus = financeStatus;
    if (riskLevel && ["LOW", "MEDIUM", "HIGH"].includes(riskLevel)) filter.riskLevel = riskLevel;

    const [items, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name username email")
        .populate("orderId", "status total kind source")
        .lean(),
      Payment.countDocuments(filter)
    ]);

    const auditHistory = await buildAuditHistoryMap(["Payment"], items.map((payment) => String(payment._id)));

    return res.json({
      items: items.map((payment) => serializePaymentItem(payment, auditHistory)),
      total,
      page,
      limit
    });
  } catch (error) {
    console.error("listOperationalPayments error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const reviewOperationalPayment = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const id = parseObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid payment id" });

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const action = normalizeText(req.body.action).toLowerCase();
    const confirmed = Boolean(req.body.confirmed);
    if (!confirmed && ["approve_refund", "approve_payout", "escalate", "flag"].includes(action)) {
      return res.status(400).json({ message: "Confirmation is required for sensitive finance action" });
    }

    const before = {
      status: payment.status,
      financeStatus: payment.financeStatus,
      riskLevel: payment.riskLevel,
      note: payment.note
    };

    if (action === "mark_reviewed") {
      if (!requireAdminActionPermission(req, res, ["payments.manage"], "Missing permission: payments.manage")) return;
      payment.financeStatus = "REVIEWED";
      if (payment.status === "FLAGGED") payment.status = "SUCCESS";
    } else if (action === "escalate") {
      if (!requireAdminActionPermission(req, res, ["payments.manage"], "Missing permission: payments.manage")) return;
      payment.financeStatus = "ESCALATED";
      payment.riskLevel = "HIGH";
    } else if (action === "flag") {
      if (!requireAdminActionPermission(req, res, ["payments.manage"], "Missing permission: payments.manage")) return;
      payment.status = "FLAGGED";
      payment.riskLevel = "HIGH";
      payment.financeStatus = "ESCALATED";
    } else if (action === "approve_refund") {
      if (!requireAdminActionPermission(req, res, ["refunds.manage"], "Missing permission: refunds.manage")) return;
      payment.status = "REFUNDED";
      payment.financeStatus = "REVIEWED";
    } else if (action === "approve_payout") {
      if (!requireAdminActionPermission(req, res, ["payouts.approve"], "Missing permission: payouts.approve")) return;
      payment.status = "SUCCESS";
      payment.financeStatus = "REVIEWED";
      if (payment.riskLevel === "HIGH") payment.riskLevel = "MEDIUM";
    } else if (action === "clear_flag") {
      if (!requireAdminActionPermission(req, res, ["payments.manage"], "Missing permission: payments.manage")) return;
      payment.status = "SUCCESS";
      payment.financeStatus = "REVIEWED";
      payment.riskLevel = "LOW";
    } else {
      return res.status(400).json({ message: "Unsupported payment action" });
    }

    if (normalizeText(req.body.note)) payment.note = normalizeText(req.body.note);
    await payment.save();

    await writeAuditLog(req, {
      actorId: String(req.user._id),
      action: `admin.payments.${action}`,
      entityType: "Payment",
      entityId: String(payment._id),
      targetType: "Payment",
      targetId: String(payment._id),
      before,
      after: {
        status: payment.status,
        financeStatus: payment.financeStatus,
        riskLevel: payment.riskLevel,
        note: payment.note
      },
      reason: normalizeText(req.body.reason) || undefined
    });

    return res.json({ item: payment });
  } catch (error) {
    console.error("reviewOperationalPayment error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listContentBlocks = async (req: Request, res: Response) => {
  try {
    const kind = normalizeText(req.query.kind);
    const status = normalizeText(req.query.status).toUpperCase();
    const filter: Record<string, unknown> = {};
    if (kind) filter.kind = kind;
    if (status && ["ACTIVE", "DRAFT", "ARCHIVED"].includes(status)) filter.status = status;

    const items = await AdminContentBlock.find(filter)
      .sort({ priority: -1, updatedAt: -1 })
      .populate("updatedBy", "name username email")
      .lean();
    return res.json({ items: items.map(serializeContentBlock) });
  } catch (error) {
    console.error("listContentBlocks error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const upsertContentBlock = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const id = parseObjectId(req.params.id);
    const payload = {
      key: normalizeText(req.body.key),
      title: normalizeText(req.body.title),
      kind: normalizeText(req.body.kind),
      status: normalizeText(req.body.status || "DRAFT").toUpperCase(),
      audience: normalizeText(req.body.audience) || undefined,
      priority: Number(req.body.priority || 0),
      payload: req.body.payload && typeof req.body.payload === "object" ? req.body.payload : {}
    };

    if (!payload.key || !payload.title || !payload.kind) {
      return res.status(400).json({ message: "key, title, kind are required" });
    }

    const existing = id ? await AdminContentBlock.findById(id) : await AdminContentBlock.findOne({ key: payload.key });
    const before = existing ? serializeContentBlock(existing.toObject()) : null;

    const doc =
      existing ||
      new AdminContentBlock({
        key: payload.key
      });

    doc.key = payload.key;
    doc.title = payload.title;
    doc.kind = payload.kind as any;
    doc.status = payload.status as any;
    doc.audience = payload.audience;
    doc.priority = payload.priority;
    doc.payload = payload.payload;
    doc.updatedBy = new mongoose.Types.ObjectId(req.user._id);
    await doc.save();

    await writeAuditLog(req, {
      actorId: String(req.user._id),
      action: existing ? "admin.content.update" : "admin.content.create",
      entityType: "AdminContentBlock",
      entityId: String(doc._id),
      targetType: "AdminContentBlock",
      targetId: String(doc._id),
      before,
      after: serializeContentBlock(doc.toObject()),
      reason: normalizeText(req.body.reason) || undefined
    });

    return res.json({ item: serializeContentBlock(doc.toObject()) });
  } catch (error) {
    console.error("upsertContentBlock error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listTaxonomyNodes = async (req: Request, res: Response) => {
  try {
    const moduleName = normalizeText(req.query.module);
    const kind = normalizeText(req.query.kind);
    const filter: Record<string, unknown> = {};
    if (moduleName) filter.module = moduleName;
    if (kind) filter.kind = kind;

    const items = await TaxonomyNode.find(filter)
      .sort({ module: 1, kind: 1, sortOrder: 1, label: 1 })
      .populate("parentId", "label name")
      .populate("updatedBy", "name username email")
      .lean();

    const parentLabelMap = items.reduce<Record<string, string>>((acc, item: any) => {
      const parentLabel = normalizeText(item.parentId?.label) || pickLocalizedLabel(item.parentId?.name) || "";
      if (item.parentId?._id && parentLabel) {
        acc[String(item.parentId._id)] = parentLabel;
      }
      return acc;
    }, {});
    const childCountMap = items.reduce<Record<string, number>>((acc, item: any) => {
      if (item.parentId?._id || item.parentId) {
        const parentId = String(item.parentId._id || item.parentId);
        acc[parentId] = Number(acc[parentId] || 0) + 1;
      }
      return acc;
    }, {});

    return res.json({ items: items.map((item) => serializeTaxonomyNode(item, parentLabelMap, childCountMap)) });
  } catch (error) {
    console.error("listTaxonomyNodes error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const upsertTaxonomyNode = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const id = parseObjectId(req.params.id);
    const payload = {
      module: normalizeText(req.body.module),
      kind: normalizeText(req.body.kind),
      key: normalizeText(req.body.key),
      label: normalizeText(req.body.label),
      name: normalizeLocalizedText(req.body.name || req.body.localizedName),
      slug: normalizeText(req.body.slug) || undefined,
      parentId: parseObjectId(req.body.parentId),
      status: normalizeText(req.body.status || "ACTIVE").toUpperCase(),
      sortOrder: Number(req.body.sortOrder || 0),
      metadata: req.body.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {}
    };

    const derivedLabel = payload.label || pickLocalizedLabel(payload.name);
    if (!payload.module || !payload.kind || !payload.key || !derivedLabel) {
      return res.status(400).json({ message: "module, kind, key and label or localized name are required" });
    }

    const existing = id ? await TaxonomyNode.findById(id) : await TaxonomyNode.findOne({ key: payload.key });
    const before = existing ? serializeTaxonomyNode(existing.toObject(), {}, {}) : null;

    const doc =
      existing ||
      new TaxonomyNode({
        key: payload.key
      });

    doc.module = payload.module;
    doc.kind = payload.kind as any;
    doc.key = payload.key;
    doc.label = derivedLabel;
    doc.name = payload.name;
    doc.slug = payload.slug;
    doc.parentId = payload.parentId;
    doc.status = payload.status as any;
    doc.sortOrder = payload.sortOrder;
    doc.metadata = payload.metadata;
    doc.updatedBy = new mongoose.Types.ObjectId(req.user._id);
    await doc.save();

    await writeAuditLog(req, {
      actorId: String(req.user._id),
      action: existing ? "admin.taxonomy.update" : "admin.taxonomy.create",
      entityType: "TaxonomyNode",
      entityId: String(doc._id),
      targetType: "TaxonomyNode",
      targetId: String(doc._id),
      before,
      after: serializeTaxonomyNode(doc.toObject(), {}, {}),
      reason: normalizeText(req.body.reason) || undefined
    });

    return res.json({ item: serializeTaxonomyNode(doc.toObject(), {}, {}) });
  } catch (error) {
    console.error("upsertTaxonomyNode error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAnalyticsOverview = async (req: Request, res: Response) => {
  try {
    const last30d = buildDateRange(30);
    const previous30dStart = buildDateRange(60);
    const analyticsEnabled = canAccessModule(req, "analytics", ["analytics.view"]);
    const canInspectAgents = canAccessModule(req, "agents", ["agents.view", "agents.read"]);
    const canInspectListings =
      canAccessModule(req, "products", ["products.view", "listings.read_all"]) ||
      canAccessModule(req, "services", ["services.view", "listings.read_all"]);
    const canInspectModeration =
      canAccessModule(req, "moderation", ["moderation.view", "reports.view"]) ||
      canAccessModule(req, "content", ["content.moderate", "reports.view"]);

    const [
      userGrowth,
      agentGrowth,
      orderStatusBreakdown,
      recentOrderStatusBreakdown,
      paymentStatusBreakdown,
      complaintStats,
      totals,
      categoryDemand,
      topAgents,
      topProducts,
      topServices,
      moderationLoad,
      newUsers30d,
      previousUsers30d,
      newAgents30d,
      previousAgents30d
    ] = await Promise.all([
      analyticsEnabled
        ? User.aggregate([
            { $match: { createdAt: { $gte: last30d } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ])
        : Promise.resolve([]),
      analyticsEnabled
        ? AgentProfile.aggregate([
            { $match: { createdAt: { $gte: last30d } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ])
        : Promise.resolve([]),
      analyticsEnabled
        ? Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, volume: { $sum: "$total" } } }, { $sort: { count: -1 } }])
        : Promise.resolve([]),
      analyticsEnabled
        ? Order.aggregate([
            { $match: { createdAt: { $gte: last30d } } },
            { $group: { _id: "$status", count: { $sum: 1 }, volume: { $sum: "$total" } } },
            { $sort: { count: -1 } }
          ])
        : Promise.resolve([]),
      analyticsEnabled
        ? Payment.aggregate([
            { $match: { createdAt: { $gte: last30d } } },
            { $group: { _id: "$status", count: { $sum: 1 }, volume: { $sum: "$amount" } } },
            { $sort: { count: -1 } }
          ])
        : Promise.resolve([]),
      analyticsEnabled
        ? Promise.all([
            User.countDocuments({ reportCount: { $gt: 0 } }),
            AgentProfile.countDocuments({ complaintCount: { $gt: 0 } }),
            Post.countDocuments({ reports: { $gt: 0 } }),
            CommunityGroupModel.countDocuments({ spamReports: { $gt: 0 } })
          ]).then(([users, agents, posts, groups]) => ({ users, agents, posts, groups }))
        : Promise.resolve({ users: 0, agents: 0, posts: 0, groups: 0 }),
      analyticsEnabled
        ? Promise.all([
            User.countDocuments(),
            AgentProfile.countDocuments(),
            Post.countDocuments(),
            CommunityGroupModel.countDocuments()
          ]).then(([users, agents, posts, groups]) => ({ users, agents, posts, groups }))
        : Promise.resolve({ users: 0, agents: 0, posts: 0, groups: 0 }),
      analyticsEnabled && canInspectListings
        ? Promise.all([
            Product.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }]),
            Service.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }])
          ]).then(([products, services]) => ({ products, services }))
        : Promise.resolve({ products: [], services: [] }),
      analyticsEnabled && canInspectAgents
        ? AgentProfile.find()
            .sort({ rating: -1, responseRate: -1 })
            .limit(8)
            .populate("user", "name username")
            .lean()
        : Promise.resolve([]),
      analyticsEnabled && canInspectListings
        ? Product.find()
            .sort({ orders: -1, views: -1, createdAt: -1 })
            .limit(6)
            .select("title category status orders views likes createdAt")
            .lean()
        : Promise.resolve([]),
      analyticsEnabled && canInspectListings
        ? Service.find()
            .sort({ orders: -1, views: -1, createdAt: -1 })
            .limit(6)
            .select("title category status orders views likes createdAt")
            .lean()
        : Promise.resolve([]),
      analyticsEnabled && canInspectModeration
        ? Promise.all([
            Service.countDocuments({ status: "PENDING" }),
            AgentProfile.countDocuments({ adminStatus: "PENDING" }),
            Post.countDocuments({ reports: { $gt: 0 } }),
            CommunityGroupModel.countDocuments({ spamReports: { $gt: 0 } }),
            Payment.countDocuments({ financeStatus: "OPEN" }),
            Order.countDocuments({ status: "DISPUTED" })
          ]).then(([pendingServices, pendingAgentVerifications, reportedPosts, flaggedGroups, openFinanceIssues, disputedOrders]) => ({
            pendingServices,
            pendingAgentVerifications,
            reportedPosts,
            flaggedGroups,
            openFinanceIssues,
            disputedOrders
          }))
        : Promise.resolve({
            pendingServices: 0,
            pendingAgentVerifications: 0,
            reportedPosts: 0,
            flaggedGroups: 0,
            openFinanceIssues: 0,
            disputedOrders: 0
          }),
      analyticsEnabled ? User.countDocuments({ createdAt: { $gte: last30d } }) : Promise.resolve(0),
      analyticsEnabled ? User.countDocuments({ createdAt: { $gte: previous30dStart, $lt: last30d } }) : Promise.resolve(0),
      analyticsEnabled ? AgentProfile.countDocuments({ createdAt: { $gte: last30d } }) : Promise.resolve(0),
      analyticsEnabled ? AgentProfile.countDocuments({ createdAt: { $gte: previous30dStart, $lt: last30d } }) : Promise.resolve(0)
    ]);

    const recentOrdersTotal = recentOrderStatusBreakdown.reduce((sum: number, item: any) => sum + Number(item.count || 0), 0);
    const recentOrdersVolume = recentOrderStatusBreakdown.reduce((sum: number, item: any) => sum + Number(item.volume || 0), 0);
    const recentPaymentsTotal = paymentStatusBreakdown.reduce((sum: number, item: any) => sum + Number(item.count || 0), 0);
    const recentPaymentsVolume = paymentStatusBreakdown.reduce((sum: number, item: any) => sum + Number(item.volume || 0), 0);

    const findCount = (rows: any[], status: string) =>
      Number(rows.find((item) => String(item._id || "").toUpperCase() === status)?.count || 0);

    const completedOrders30d = findCount(recentOrderStatusBreakdown, "COMPLETED");
    const disputedOrders30d = findCount(recentOrderStatusBreakdown, "DISPUTED");
    const cancelledOrders30d = findCount(recentOrderStatusBreakdown, "CANCELLED");
    const successfulPayments30d = findCount(paymentStatusBreakdown, "SUCCESS");
    const failedPayments30d = findCount(paymentStatusBreakdown, "FAILED");
    const refundedPayments30d = findCount(paymentStatusBreakdown, "REFUNDED");
    const flaggedPayments30d = findCount(paymentStatusBreakdown, "FLAGGED");

    const toRate = (affected: number, total: number) => (total > 0 ? Number(((affected / total) * 100).toFixed(1)) : 0);

    return res.json({
      summary: {
        newUsers30d,
        newUsersDelta: newUsers30d - previousUsers30d,
        newAgents30d,
        newAgentsDelta: newAgents30d - previousAgents30d,
        orders30d: recentOrdersTotal,
        grossVolume30d: recentOrdersVolume,
        paymentVolume30d: recentPaymentsVolume,
        completionRate: toRate(completedOrders30d, recentOrdersTotal),
        paymentSuccessRate: toRate(successfulPayments30d, recentPaymentsTotal)
      },
      growth: {
        users: userGrowth,
        agents: agentGrowth
      },
      orders: orderStatusBreakdown,
      complaints: complaintStats,
      complaintRate: {
        users: { affected: complaintStats.users, total: totals.users, rate: toRate(complaintStats.users, totals.users) },
        agents: { affected: complaintStats.agents, total: totals.agents, rate: toRate(complaintStats.agents, totals.agents) },
        posts: { affected: complaintStats.posts, total: totals.posts, rate: toRate(complaintStats.posts, totals.posts) },
        groups: { affected: complaintStats.groups, total: totals.groups, rate: toRate(complaintStats.groups, totals.groups) }
      },
      categoryDemand,
      agentPerformance: topAgents.map((item: any) => ({
        id: String(item._id),
        name: item.user?.name || item.user?.username || "Agent",
        rating: item.rating || 0,
        responseRate: item.responseRate || 0,
        complaints: item.complaintCount || 0
      })),
      listingPerformance: {
        products: topProducts.map((item: any) => ({
          id: String(item._id),
          title: item.title,
          category: item.category || null,
          status: item.status,
          orders: Number(item.orders || 0),
          views: Number(item.views || item.viewCount || 0),
          likes: Number(item.likes || item.likeCount || 0),
          createdAt: item.createdAt
        })),
        services: topServices.map((item: any) => ({
          id: String(item._id),
          title: item.title,
          category: item.category || null,
          status: item.status,
          orders: Number(item.orders || 0),
          views: Number(item.views || 0),
          likes: Number(item.likes || 0),
          createdAt: item.createdAt
        }))
      },
      conversionTrends: {
        orders30d: {
          total: recentOrdersTotal,
          completed: completedOrders30d,
          disputed: disputedOrders30d,
          cancelled: cancelledOrders30d
        },
        payments30d: {
          total: recentPaymentsTotal,
          successful: successfulPayments30d,
          failed: failedPayments30d,
          refunded: refundedPayments30d,
          flagged: flaggedPayments30d
        },
        rates: {
          orderCompletionRate: toRate(completedOrders30d, recentOrdersTotal),
          disputeRate: toRate(disputedOrders30d, recentOrdersTotal),
          paymentSuccessRate: toRate(successfulPayments30d, recentPaymentsTotal),
          paymentFailureRate: toRate(failedPayments30d, recentPaymentsTotal)
        }
      },
      moderationLoad
    });
  } catch (error) {
    console.error("getAnalyticsOverview error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAdminSystemSettings = async (_req: Request, res: Response) => {
  try {
    const docs = await AdminSetting.find({}).lean();
    const settings = docs.reduce<Record<string, Record<string, unknown>>>((acc, doc: any) => {
      acc[doc.section] = (doc.value as Record<string, unknown>) || {};
      return acc;
    }, {});

    return res.json({
      settings: {
        ...defaultSettings,
        ...settings
      }
    });
  } catch (error) {
    console.error("getAdminSystemSettings error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateAdminSystemSettings = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    if (!req.adminContext) return res.status(500).json({ message: "Admin context missing" });
    const payload = req.body && typeof req.body === "object" ? req.body : {};

    const nextSections = Object.entries(payload).filter(([, value]) => value && typeof value === "object");
    if (!nextSections.length) {
      return res.status(400).json({ message: "At least one settings section is required" });
    }

    const primaryOnlySections = new Set(["platform", "security", "moderation"]);
    const delegatedSections = new Set(["notifications", "features", "content"]);
    const isPrimary = req.adminContext.adminLevel === "PRIMARY";
    const hasSettingsManage = canAccess(req, ["settings.manage"]);
    const hasTechnicalManage = canAccess(req, ["technical.manage"]);

    for (const [section] of nextSections) {
      if (primaryOnlySections.has(section) && !isPrimary) {
        return res.status(403).json({ message: `Only primary admin can update ${section} settings` });
      }
      if (!primaryOnlySections.has(section) && !delegatedSections.has(section)) {
        return res.status(403).json({ message: `Unsupported settings section: ${section}` });
      }
      if (delegatedSections.has(section) && !isPrimary && !hasTechnicalManage && !hasSettingsManage) {
        return res.status(403).json({ message: `Missing permission to update ${section} settings` });
      }
    }

    const existingDocs = await AdminSetting.find({ section: { $in: nextSections.map(([section]) => section) } }).lean();
    const before = existingDocs.reduce<Record<string, Record<string, unknown>>>((acc, doc: any) => {
      acc[doc.section] = (doc.value as Record<string, unknown>) || {};
      return acc;
    }, {});

    for (const [section, value] of nextSections) {
      await AdminSetting.findOneAndUpdate(
        { key: section },
        {
          $set: {
            section,
            value,
            updatedBy: new mongoose.Types.ObjectId(req.user._id)
          }
        },
        { upsert: true, new: true }
      );
    }

    await writeAuditLog(req, {
      actorId: String(req.user._id),
      action: "admin.settings.update",
      entityType: "AdminSetting",
      entityId: "system",
      targetType: "AdminSetting",
      targetId: "system",
      before,
      after: payload,
      reason: normalizeText(req.body.reason) || undefined
    });

    const docs = await AdminSetting.find({}).lean();
    const settings = docs.reduce<Record<string, Record<string, unknown>>>((acc, doc: any) => {
      acc[doc.section] = (doc.value as Record<string, unknown>) || {};
      return acc;
    }, {});

    return res.json({
      settings: {
        ...defaultSettings,
        ...settings
      }
    });
  } catch (error) {
    console.error("updateAdminSystemSettings error", error);
    return res.status(500).json({ message: "Server error" });
  }
};
