import { Request, Response } from "express";
import { User } from "../models/User";
import { AgentProfile } from "../models/AgentProfile";
import { Product } from "../models/Product";
import { Service } from "../models/Service";
import { Post } from "../models/Post";
import { NewsPost } from "../models/NewsPost";
import { CommunityGroupModel } from "../models/CommunityGroup";
import { writeAuditLog } from "../services/auditLog";
import { respondAuthRequired } from "../utils/controllerResponses";
import { Order } from "../models/Order";
import { Payment } from "../models/Payment";
import {
  ADMIN_ROLE_TEMPLATES,
  ADMIN_SUITE_DEFINITIONS,
  buildAdminWorkspace,
  canonicalizeAdminDepartment,
  hasAnyPermission
} from "../services/adminBlueprint";
import { resolveAdminRoleNames } from "../services/adminRbac";

const canAccess = (req: Request, required: string[]) =>
  hasAnyPermission(req.adminContext?.permissions || [], required, req.adminContext?.adminLevel || null);

const requireAdminActionPermission = (req: Request, res: Response, required: string[], message = "Missing permission") => {
  if (canAccess(req, required)) return true;
  res.status(403).json({ message });
  return false;
};

const toPositiveInt = (value: unknown, fallback: number, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const normalizeListingQueueStatus = (value: unknown) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "PAUSED" || normalized === "ALL") return normalized;
  return "PENDING";
};

const mapProductModerationStatus = (status: string | undefined, requested: string) => {
  const normalized = String(status || "ACTIVE").toUpperCase();
  if (normalized === "BLOCKED" || normalized === "REJECTED") {
    return requested === "REJECTED" ? "REJECTED" : "PAUSED";
  }
  return normalized === "ACTIVE" ? "ACTIVE" : normalized;
};

const mapServiceModerationStatus = (status: string | undefined) => {
  const normalized = String(status || "PENDING").toUpperCase();
  if (normalized === "BLOCKED") return "PAUSED";
  if (normalized === "PENDING") return "PENDING";
  return "ACTIVE";
};

export const adminOverview = async (req: Request, res: Response) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      currentAdmin,
      roleNames,
      users,
      agents,
      products,
      services,
      activeProducts,
      activeServices,
      pendingAdminRequests,
      pendingAgentVerifications,
      flaggedPosts,
      flaggedGroups,
      pendingPayments,
      todayOrders,
      revenueSnapshot
    ] = await Promise.all([
      req.user ? User.findById(req.user._id).select("adminLevel department position adminScopes").lean() : null,
      req.user ? resolveAdminRoleNames(String(req.user._id)) : Promise.resolve([]),
      canAccess(req, ["users.view", "users.read", "admin.manage"]) ? User.countDocuments() : Promise.resolve(null),
      canAccess(req, ["agents.view", "agents.read", "admin.manage"]) ? AgentProfile.countDocuments() : Promise.resolve(null),
      canAccess(req, ["products.view", "listings.read_all"]) ? Product.countDocuments() : Promise.resolve(null),
      canAccess(req, ["services.view", "listings.read_all"]) ? Service.countDocuments() : Promise.resolve(null),
      canAccess(req, ["products.view", "listings.read_all"])
        ? Product.countDocuments({ status: "ACTIVE" })
        : Promise.resolve(null),
      canAccess(req, ["services.view", "listings.read_all"]) ? Service.countDocuments() : Promise.resolve(null),
      canAccess(req, ["admins.view", "admins.manage"]) ? User.countDocuments({ isAdmin: true, adminAccessStatus: "PENDING" }) : Promise.resolve(null),
      canAccess(req, ["agents.verify"]) ? AgentProfile.countDocuments({ verifiedByAdmin: false }) : Promise.resolve(null),
      canAccess(req, ["reports.view", "community.moderate", "content.moderate"])
        ? Post.countDocuments({ reports: { $gt: 0 } })
        : Promise.resolve(null),
      canAccess(req, ["reports.view", "community.moderate", "content.moderate"])
        ? CommunityGroupModel.countDocuments({ spamReports: { $gt: 0 } })
        : Promise.resolve(null),
      canAccess(req, ["payments.view", "payments.read"]) ? Payment.countDocuments({ status: "PENDING" }) : Promise.resolve(null),
      canAccess(req, ["orders.view", "orders.read"]) ? Order.countDocuments({ createdAt: { $gte: todayStart } }) : Promise.resolve(null),
      canAccess(req, ["payments.view", "payments.read"])
        ? Payment.aggregate([
            { $match: { status: "SUCCESS", createdAt: { $gte: todayStart } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
          ])
        : Promise.resolve([])
    ]);

    const workspace = buildAdminWorkspace({
      adminLevel: currentAdmin?.adminLevel || req.adminContext?.adminLevel || null,
      department: currentAdmin?.department || null,
      permissions: req.adminContext?.permissions || [],
      roleNames,
      scopes: (currentAdmin?.adminScopes as any) || req.adminContext?.scopes || []
    });

    if (req.user) {
      await writeAuditLog(req, {
        actorId: req.user._id,
        action: "admin.overview.read",
        targetType: "Dashboard",
        targetId: "overview"
      });
    }
    return res.json({
      users,
      agents,
      products,
      services,
      workspace,
      cards: {
        totalUsers: users,
        totalAgents: agents,
        activeListings: activeProducts === null && activeServices === null ? null : (activeProducts || 0) + (activeServices || 0),
        pendingApprovals:
          pendingAdminRequests === null && pendingAgentVerifications === null
            ? null
            : (pendingAdminRequests || 0) + (pendingAgentVerifications || 0),
        unresolvedReports: flaggedPosts === null && flaggedGroups === null ? null : (flaggedPosts || 0) + (flaggedGroups || 0),
        todayOrders,
        revenueSnapshot: Array.isArray(revenueSnapshot) && revenueSnapshot[0] ? revenueSnapshot[0].total : null,
        systemStatus: canAccess(req, ["technical.view", "system.health.view"]) ? "healthy" : null
      },
      queues: {
        pendingAdminRequests,
        pendingAgentVerifications,
        flaggedPosts,
        flaggedGroups,
        pendingPayments,
        todayOrders
      },
      identity: {
        adminLevel: currentAdmin?.adminLevel || req.adminContext?.adminLevel || null,
        department: canonicalizeAdminDepartment(currentAdmin?.department),
        position: currentAdmin?.position || null,
        roleNames
      }
    });
  } catch (err) {
    console.error("adminOverview error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAdminWorkspace = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.adminContext) return respondAuthRequired(req, res);

    const user = await User.findById(req.user._id).select("adminLevel department position adminScopes").lean();
    const roleNames = await resolveAdminRoleNames(String(req.user._id));
    const workspace = buildAdminWorkspace({
      adminLevel: user?.adminLevel || req.adminContext.adminLevel || null,
      department: user?.department || null,
      permissions: req.adminContext.permissions || [],
      roleNames,
      scopes: (user?.adminScopes as any) || req.adminContext?.scopes || []
    });

    await writeAuditLog(req, {
      actorId: req.user._id,
      action: "admin.workspace.read",
      targetType: "Dashboard",
      targetId: "workspace"
    });

    return res.json({
      adminLevel: user?.adminLevel || req.adminContext.adminLevel || null,
      department: canonicalizeAdminDepartment(user?.department),
      position: user?.position || null,
      roleNames,
      permissions: req.adminContext.permissions || [],
      workspace
    });
  } catch (err) {
    console.error("getAdminWorkspace error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAdminArchitecture = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.adminContext) return respondAuthRequired(req, res);

    const user = await User.findById(req.user._id).select("adminLevel department position adminScopes").lean();
    const roleNames = await resolveAdminRoleNames(String(req.user._id));
    const workspace = buildAdminWorkspace({
      adminLevel: user?.adminLevel || req.adminContext.adminLevel || null,
      department: user?.department || null,
      permissions: req.adminContext.permissions || [],
      roleNames,
      scopes: (user?.adminScopes as any) || req.adminContext?.scopes || []
    });

    await writeAuditLog(req, {
      actorId: req.user._id,
      action: "admin.architecture.read",
      targetType: "Dashboard",
      targetId: "architecture"
    });

    return res.json({
      identity: {
        adminLevel: user?.adminLevel || req.adminContext.adminLevel || null,
        department: canonicalizeAdminDepartment(user?.department),
        position: user?.position || null,
        roleNames
      },
      suites: ADMIN_SUITE_DEFINITIONS,
      roleTemplates: ADMIN_ROLE_TEMPLATES.map((role) => ({
        name: role.name,
        label: role.label,
        description: role.description,
        adminLevel: role.adminLevel,
        departments: role.departments || [],
        permissionCount: role.permissionKeys.length,
        legacyAlias: Boolean(role.legacyAlias)
      })),
      workspace
    });
  } catch (err) {
    console.error("getAdminArchitecture error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find().select("-passwordHash");
    if (req.user) {
      await writeAuditLog(req, {
        actorId: req.user._id,
        action: "admin.users.read",
        targetType: "User",
        targetId: "list"
      });
    }
    return res.json({ users });
  } catch (err) {
    console.error("listUsers error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const verifyAgent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await AgentProfile.findById(id).populate("user");
    if (!profile) return res.status(404).json({ message: "Agent profile not found" });

    const before = {
      verifiedByAdmin: profile.verifiedByAdmin
    };
    profile.verifiedByAdmin = true;
    await profile.save();

    const user = await User.findById(profile.user._id);
    if (user) {
      const userBefore = { isVerified: user.isVerified };
      user.isVerified = true;
      await user.save();
      if (req.user) {
        await writeAuditLog(req, {
          actorId: req.user._id,
          action: "admin.agent.verify",
          targetType: "User",
          targetId: String(user._id),
          before: userBefore,
          after: { isVerified: user.isVerified }
        });
      }
    }

    if (req.user) {
      await writeAuditLog(req, {
        actorId: req.user._id,
        action: "admin.agent_profile.verify",
        targetType: "AgentProfile",
        targetId: String(profile._id),
        before,
        after: { verifiedByAdmin: profile.verifiedByAdmin }
      });
    }

    return res.json({ profile });
  } catch (err) {
    console.error("verifyAgent error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listFlaggedContent = async (req: Request, res: Response) => {
  try {
    const [posts, news, groups] = await Promise.all([
      Post.find({ reports: { $gt: 0 } }).sort({ reports: -1, createdAt: -1 }).limit(40),
      NewsPost.find({ reports: { $gt: 0 } }).sort({ reports: -1, createdAt: -1 }).limit(40),
      CommunityGroupModel.find({ spamReports: { $gt: 0 } }).sort({ spamReports: -1 }).limit(20)
    ]);
    if (req.user) {
      await writeAuditLog(req, {
        actorId: req.user._id,
        action: "admin.content.reports.read",
        targetType: "Content",
        targetId: "reports"
      });
    }
    return res.json({ posts, news, groups });
  } catch (err) {
    console.error("listFlaggedContent error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listModerationListings = async (req: Request, res: Response) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 1000000);
    const limit = toPositiveInt(req.query.limit, 50, 200);
    const skip = (page - 1) * limit;
    const requestedStatus = normalizeListingQueueStatus(req.query.status);

    const productFilters: Record<string, unknown> = {};
    if (requestedStatus === "ACTIVE") productFilters.status = "ACTIVE";
    if (requestedStatus === "PAUSED") productFilters.status = "BLOCKED";
    if (requestedStatus === "PENDING") productFilters.status = { $in: ["ACTIVE", "BLOCKED"] };

    const serviceFilters: Record<string, unknown> = {};
    if (requestedStatus === "ACTIVE") serviceFilters.status = "ACTIVE";
    if (requestedStatus === "PAUSED") serviceFilters.status = "BLOCKED";
    if (requestedStatus === "PENDING") serviceFilters.status = "PENDING";

    const [products, services, productTotal, serviceTotal] = await Promise.all([
      Product.find(productFilters)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("createdBy", "name username")
        .lean(),
      Service.find(serviceFilters)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("createdBy", "name username")
        .lean(),
      Product.countDocuments(productFilters),
      Service.countDocuments(serviceFilters)
    ]);

    const items = [
      ...products.map((product: any) => ({
        id: String(product._id),
        listingId: String(product._id),
        title: product.title,
        category: product.category || "products",
        subcategory: "product",
        status: mapProductModerationStatus(product.status, requestedStatus),
        ownerName: product.createdBy?.name || product.createdBy?.username || undefined,
        module: "products",
        createdAt: product.createdAt
      })),
      ...services.map((service: any) => ({
        id: String(service._id),
        listingId: String(service._id),
        title: service.title,
        category: service.category || "services",
        subcategory: "service",
        status: mapServiceModerationStatus(service.status),
        ownerName: service.createdBy?.name || service.createdBy?.username || undefined,
        module: "services",
        createdAt: service.createdAt
      }))
    ]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(skip, skip + limit);

    if (req.user) {
      await writeAuditLog(req, {
        actorId: req.user._id,
        action: "admin.listings.moderation.read",
        targetType: "Listing",
        targetId: requestedStatus.toLowerCase()
      });
    }

    return res.json({
      items,
      total: productTotal + serviceTotal,
      page,
      limit
    });
  } catch (err) {
    console.error("listModerationListings error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const moderateListing = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const action = String(req.body.action || req.body.decision || "").trim().toLowerCase();
    const reason = String(req.body.reason || "").trim() || undefined;
    if (!["approve", "reject", "pause"].includes(action)) {
      return res.status(400).json({ message: "Invalid moderation action" });
    }

    const product = await Product.findById(id);
    if (product) {
      if (action === "approve") {
        if (
          !requireAdminActionPermission(
            req,
            res,
            ["products.approve", "listings.approve_reject", "listings.moderate"],
            "Missing permission: products.approve"
          )
        ) {
          return;
        }
      } else if (action === "reject") {
        if (
          !requireAdminActionPermission(
            req,
            res,
            ["products.reject", "listings.approve_reject", "listings.moderate"],
            "Missing permission: products.reject"
          )
        ) {
          return;
        }
      } else if (
        !requireAdminActionPermission(
          req,
          res,
          ["listings.pause_force", "listings.moderate"],
          "Missing permission: listings.pause_force"
        )
      ) {
        return;
      }

      const before = { status: product.status };
      product.status = action === "approve" ? "ACTIVE" : "BLOCKED";
      await product.save();

      if (req.user) {
        await writeAuditLog(req, {
          actorId: req.user._id,
          action: `admin.listings.${action}`,
          targetType: "Product",
          targetId: String(product._id),
          before,
          after: { status: product.status },
          reason
        });
      }

      return res.json({
        item: {
          id: String(product._id),
          module: "products",
          status: mapProductModerationStatus(product.status, action === "reject" ? "REJECTED" : "ACTIVE")
        }
      });
    }

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ message: "Listing not found" });

    if (action === "approve") {
      if (
        !requireAdminActionPermission(
          req,
          res,
          ["services.approve", "listings.approve_reject", "listings.moderate"],
          "Missing permission: services.approve"
        )
      ) {
        return;
      }
    } else if (action === "reject") {
      if (
        !requireAdminActionPermission(
          req,
          res,
          ["services.reject", "listings.approve_reject", "listings.moderate"],
          "Missing permission: services.reject"
        )
      ) {
        return;
      }
    } else if (
      !requireAdminActionPermission(
        req,
        res,
        ["listings.pause_force", "listings.moderate"],
        "Missing permission: listings.pause_force"
      )
    ) {
      return;
    }

    const before = { status: service.status };
    service.status = action === "approve" ? "ACTIVE" : "BLOCKED";
    await service.save();

    if (req.user) {
      await writeAuditLog(req, {
        actorId: req.user._id,
        action: `admin.services.${action}`,
        targetType: "Service",
        targetId: String(service._id),
        before,
        after: { status: service.status },
        reason
      });
    }

    return res.json({
      item: {
        id: String(service._id),
        module: "services",
        status: mapServiceModerationStatus(service.status)
      }
    });
  } catch (err) {
    console.error("moderateListing error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listCommunityReports = async (req: Request, res: Response) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 1000000);
    const limit = toPositiveInt(req.query.limit, 50, 200);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ reports: { $gt: 0 } })
        .sort({ reports: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name username")
        .lean(),
      Post.countDocuments({ reports: { $gt: 0 } })
    ]);

    const items = posts.map((post: any) => ({
      id: String(post._id),
      reportId: String(post._id),
      reason: post.reports > 1 ? `${post.reports} reports` : "1 report",
      content: post.text || post.content || post.title || "",
      authorName: post.author?.name || post.author?.username || undefined,
      targetId: String(post._id),
      postId: String(post._id),
      createdAt: post.createdAt
    }));

    if (req.user) {
      await writeAuditLog(req, {
        actorId: req.user._id,
        action: "admin.community.reports.read",
        targetType: "Post",
        targetId: "reports"
      });
    }

    return res.json({
      items,
      total,
      page,
      limit
    });
  } catch (err) {
    console.error("listCommunityReports error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const resolveCommunityReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const action = String(req.body.action || req.body.resolution || "").trim().toLowerCase();
    const reason = String(req.body.reason || "").trim() || undefined;
    if (!["dismiss", "delete"].includes(action)) {
      return res.status(400).json({ message: "Invalid report action" });
    }

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Reported post not found" });

    if (action === "dismiss") {
      if (
        !requireAdminActionPermission(
          req,
          res,
          ["reports.resolve", "posts.moderate", "community.moderate", "content.moderate"],
          "Missing permission: reports.resolve"
        )
      ) {
        return;
      }
    } else if (
      !requireAdminActionPermission(
        req,
        res,
        ["posts.moderate", "community.moderate", "content.moderate"],
        "Missing permission: posts.moderate"
      )
    ) {
      return;
    }

    const before = {
      reports: post.reports,
      status: post.status,
      isActive: post.isActive
    };

    post.reports = 0;
    if (action === "delete") {
      post.status = "blocked";
      post.isActive = false;
    } else {
      post.status = "active";
      post.isActive = true;
    }
    await post.save();

    if (req.user) {
      await writeAuditLog(req, {
        actorId: req.user._id,
        action: `admin.community.reports.${action}`,
        targetType: "Post",
        targetId: String(post._id),
        before,
        after: {
          reports: post.reports,
          status: post.status,
          isActive: post.isActive
        },
        reason
      });
    }

    return res.json({
      item: {
        id: String(post._id),
        status: post.status,
        isActive: post.isActive
      }
    });
  } catch (err) {
    console.error("resolveCommunityReport error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updatePostStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, isActive } = req.body;
    if (!["active", "blocked", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    const before = {
      status: post.status,
      isActive: post.isActive
    };
    post.status = status as any;
    if (typeof isActive === "boolean") {
      post.isActive = isActive;
    }
    await post.save();
    if (req.user) {
      await writeAuditLog(req, {
        actorId: req.user._id,
        action: "admin.post.status.update",
        targetType: "Post",
        targetId: String(post._id),
        before,
        after: {
          status: post.status,
          isActive: post.isActive
        }
      });
    }
    return res.json({ post });
  } catch (err) {
    console.error("updatePostStatus error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const moderateGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const group = await CommunityGroupModel.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    const before = { isActive: group.isActive };
    if (typeof isActive === "boolean") {
      group.isActive = isActive;
    } else {
      group.isActive = false;
    }
    await group.save();
    if (req.user) {
      await writeAuditLog(req, {
        actorId: req.user._id,
        action: "admin.group.moderate",
        targetType: "CommunityGroup",
        targetId: String(group._id),
        before,
        after: { isActive: group.isActive }
      });
    }
    return res.json({ group });
  } catch (err) {
    console.error("moderateGroup error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
