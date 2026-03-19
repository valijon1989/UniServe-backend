import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { User } from "../models/User";
import { AdminSession } from "../models/AdminSession";
import { invalidateAuthState, resolveAdminSessionId } from "../services/authSession";
import { t } from "../i18n";

const isAdminRoute = (req: Request) => req.originalUrl.startsWith("/api/admin");

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    let payload: ReturnType<typeof verifyAccessToken>;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ message: t(req, "auth.session.invalid.message") });
    }

    try {
      const user = await User.findById(payload._id)
        .select("_id role tokenVersion isAdmin adminLevel adminAccessStatus")
        .lean();
      if (!user) {
        return res.status(401).json({ message: t(req, "auth.session.required.message") });
      }

      if (typeof payload.tokenVersion === "number" && (user.tokenVersion ?? 0) !== payload.tokenVersion) {
        return res.status(401).json({ message: t(req, "auth.session.invalid.message") });
      }

      if (isAdminRoute(req)) {
        const adminSessionId = resolveAdminSessionId(req);
        if (!adminSessionId) {
          return res.status(401).json({ message: t(req, "auth.admin.session.required.message") });
        }

        const adminSession = await AdminSession.findOne({ sessionId: adminSessionId, userId: user._id, revokedAt: null }).lean();
        if (!adminSession) {
          return res.status(401).json({ message: t(req, "auth.admin.session.invalid.message") });
        }

        const isAdminIdentity = user.role === "ADMIN" || Boolean((user as { isAdmin?: boolean }).isAdmin);
        const hasAccess = (user as { adminLevel?: string }).adminLevel === "PRIMARY" || user.adminAccessStatus === "APPROVED";

        if (!isAdminIdentity || !hasAccess) {
          await invalidateAuthState({ userId: String(user._id), sessionId: adminSessionId });
          return res.status(403).json({ message: t(req, "auth.admin.access.required.message") });
        }
      }

      req.user = { _id: String(user._id), role: user.role };
      return next();
    } catch (error) {
      console.error("requireAuth error", error);
      return res.status(500).json({ message: t(req, "common.errors.server.message") });
    }
  }

  const adminSessionId = resolveAdminSessionId(req);
  if (!adminSessionId) {
    return res.status(401).json({ message: t(req, "auth.authorization.header.message") });
  }

  try {
    const adminSession = await AdminSession.findOne({ sessionId: adminSessionId, revokedAt: null }).lean();
    if (!adminSession) {
      return res.status(401).json({ message: t(req, "auth.session.required.message") });
    }

    const user = await User.findById(adminSession.userId).select("_id role isAdmin adminLevel adminAccessStatus").lean();
    if (!user) {
      await invalidateAuthState({ sessionId: adminSessionId, rotateTokens: false, revokeAllAdminSessions: false });
      return res.status(401).json({ message: t(req, "auth.session.required.message") });
    }

    const isAdminIdentity = user.role === "ADMIN" || Boolean((user as { isAdmin?: boolean }).isAdmin);
    const hasAccess = (user as { adminLevel?: string }).adminLevel === "PRIMARY" || user.adminAccessStatus === "APPROVED";
    if (!isAdminIdentity || !hasAccess) {
      await invalidateAuthState({ userId: String(user._id), sessionId: adminSessionId });
      return res.status(403).json({ message: t(req, "auth.admin.access.required.message") });
    }

    req.user = { _id: String(user._id), role: user.role };
    return next();
  } catch (error) {
    console.error("requireAuth error", error);
    return res.status(500).json({ message: t(req, "common.errors.server.message") });
  }
}
