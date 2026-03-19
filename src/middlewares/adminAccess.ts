import { NextFunction, Request, Response } from "express";
import { t } from "../i18n";
import { AdminScope, User } from "../models/User";
import { AdminSession } from "../models/AdminSession";
import { resolveAdminPermissionKeys } from "../services/adminRbac";
import type { AdminPermissionKey } from "../services/adminBlueprint";

type ScopeResolver = string | ((req: Request) => string | undefined | null) | undefined;

const buildScope = (scope: AdminScope): AdminScope => ({
  module: String(scope.module || "").trim().toLowerCase() as AdminScope["module"],
  region: scope.region ? String(scope.region).trim() : undefined,
  countryCode: scope.countryCode ? String(scope.countryCode).trim().toUpperCase() : undefined,
  categoryId: scope.categoryId ? String(scope.categoryId).trim() : undefined,
  subcategoryId: scope.subcategoryId ? String(scope.subcategoryId).trim() : undefined
});

const resolveValue = (req: Request, input: ScopeResolver): string | undefined => {
  if (!input) return undefined;
  if (typeof input === "function") {
    const value = input(req);
    if (value === undefined || value === null) return undefined;
    const trimmed = String(value).trim();
    return trimmed || undefined;
  }
  const trimmed = String(input).trim();
  return trimmed || undefined;
};

const attachAdminContext = async (
  req: Request,
  res: Response,
  next: NextFunction,
  options: { requireMfa: boolean }
) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const user = await User.findById(req.user._id)
      .select("role isAdmin adminAccessStatus adminLevel adminScopes mfaEnabled")
      .lean();
    if (!user) return res.status(401).json({ message: t(req, "auth.session.required.message") });

    const isAdminIdentity = user.role === "ADMIN" || Boolean((user as { isAdmin?: boolean }).isAdmin);
    if (!isAdminIdentity) return res.status(403).json({ message: t(req, "auth.admin.access.required.message") });
    const hasAdminAccess = user.adminLevel === "PRIMARY" || user.adminAccessStatus === "APPROVED";
    if (!hasAdminAccess) {
      return res.status(403).json({
        message: t(req, "auth.admin.access_state.message", {
          status: String(user.adminAccessStatus || "PENDING")
        })
      });
    }
    if (options.requireMfa && !user.mfaEnabled) {
      return res.status(403).json({ message: t(req, "auth.admin.mfa.required.message") });
    }

    const scopes = Array.isArray(user.adminScopes)
      ? user.adminScopes
          .map((item) => buildScope(item as AdminScope))
          .filter((item) => item.module)
      : [];

    const permissions = await resolveAdminPermissionKeys(String(user._id), user.adminLevel);

    req.adminContext = {
      userId: String(user._id),
      adminLevel: user.adminLevel,
      permissions,
      scopes,
      mfaEnabled: Boolean(user.mfaEnabled)
    };

    return next();
  } catch (error) {
    console.error("attachAdminContext error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};

export const requireAdminIdentity = (req: Request, res: Response, next: NextFunction) =>
  attachAdminContext(req, res, next, { requireMfa: false });

export const requireAdminAccess = (req: Request, res: Response, next: NextFunction) =>
  // Read access is allowed for approved admins even before MFA setup.
  // Elevated mutations stay protected behind requireAdminMode.
  attachAdminContext(req, res, next, { requireMfa: false });

export const requirePermission = (required: AdminPermissionKey | AdminPermissionKey[] | string | string[]) => {
  const requiredKeys = Array.isArray(required) ? required : [required];
  return (req: Request, res: Response, next: NextFunction) => {
    const ctx = req.adminContext;
    if (!ctx) return res.status(500).json({ message: t(req, "admin.context.required.message") });
    if (ctx.adminLevel === "PRIMARY") return next();
    const allowed = new Set<string>(ctx.permissions || []);
    const has = requiredKeys.some((key) => allowed.has(key));
    if (!has) return res.status(403).json({ message: t(req, "admin.permissions.required.message") });
    return next();
  };
};

export const requirePrimaryAdmin = (req: Request, res: Response, next: NextFunction) => {
  const ctx = req.adminContext;
  if (!ctx) return res.status(500).json({ message: t(req, "admin.context.required.message") });
  if (ctx.adminLevel !== "PRIMARY") {
    return res.status(403).json({ message: t(req, "admin.primary.required.message") });
  }
  return next();
};

export const requireScope = (
  moduleName: string,
  categoryIdInput?: ScopeResolver,
  subcategoryIdInput?: ScopeResolver
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ctx = req.adminContext;
    if (!ctx) return res.status(500).json({ message: t(req, "admin.context.required.message") });
    if (ctx.adminLevel === "PRIMARY") return next();

    const categoryId = resolveValue(req, categoryIdInput);
    const subcategoryId = resolveValue(req, subcategoryIdInput);
    const scopes = Array.isArray(ctx.scopes) ? ctx.scopes : [];

    const matched = scopes.some((scope) => {
      if (scope.module !== "*" && scope.module !== moduleName) return false;
      if (categoryId && scope.categoryId && scope.categoryId !== categoryId) return false;
      if (subcategoryId && scope.subcategoryId && scope.subcategoryId !== subcategoryId) return false;
      return true;
    });

    if (!matched) return res.status(403).json({ message: t(req, "admin.scope.forbidden.message") });
    return next();
  };
};

export const requireAdminMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: t(req, "auth.session.required.message") });
    const rawSessionId = req.headers["x-admin-session-id"];
    const headerSessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
    const cookieSessionId = String(req.cookies?.admin_session || "").trim();
    const sessionId =
      (typeof headerSessionId === "string" && headerSessionId.trim()) || cookieSessionId || undefined;
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(401).json({ message: t(req, "auth.admin.mode.required.message") });
    }

    const session = await AdminSession.findOne({
      sessionId,
      userId: req.user._id,
      revokedAt: null
    });
    if (!session) return res.status(401).json({ message: t(req, "auth.admin.mode.not_found.message") });
    if (session.adminModeUntil.getTime() < Date.now()) {
      return res.status(401).json({ message: t(req, "auth.admin.mode.expired.message") });
    }

    session.lastSeenAt = new Date();
    await session.save();

    req.adminSession = {
      sessionId: session.sessionId,
      adminModeUntil: session.adminModeUntil
    };
    return next();
  } catch (error) {
    console.error("requireAdminMode error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
};
