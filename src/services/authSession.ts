import { CookieOptions, Request, Response } from "express";
import { AdminSession } from "../models/AdminSession";
import { User, UserRole } from "../models/User";
import { durationToMs, signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../utils/jwt";

const DEFAULT_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const REFRESH_COOKIE_NAME = "refreshToken";
export const ADMIN_SESSION_COOKIE_NAME = "admin_session";

const cookieSecure = ["1", "true", "yes"].includes((process.env.COOKIE_SECURE || "false").toLowerCase());
const cookieSameSiteRaw = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
const cookieSameSite: "lax" | "strict" | "none" =
  cookieSameSiteRaw === "strict" || cookieSameSiteRaw === "none" ? cookieSameSiteRaw : "lax";
const refreshCookieMaxAge = durationToMs(process.env.REFRESH_TOKEN_TTL || "30d") ?? DEFAULT_REFRESH_TTL_MS;

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: "/api/auth",
  maxAge: refreshCookieMaxAge
};

export const adminSessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: "/api/admin",
  maxAge: refreshCookieMaxAge
};

export const clearRefreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: "/api/auth"
};

export const clearAdminSessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: "/api/admin"
};

const normalizeText = (value: unknown): string => String(value || "").trim();

const parseHeaderValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
};

export const resolveAccessToken = (req: Request): string => {
  const authHeader = parseHeaderValue(req.headers.authorization);
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return "";
};

export const resolveRefreshToken = (req: Request): string => normalizeText(req.cookies?.[REFRESH_COOKIE_NAME]);

export const resolveAdminSessionId = (req: Request): string => {
  const fromCookie = normalizeText(req.cookies?.[ADMIN_SESSION_COOKIE_NAME]);
  if (fromCookie) return fromCookie;
  return normalizeText(parseHeaderValue(req.headers["x-admin-session-id"]));
};

export const issueAuthTokens = (
  res: Response,
  user: { _id: unknown; role: UserRole; tokenVersion?: number },
  rememberMe = true
) => {
  const userId = String(user._id);
  const accessToken = signAccessToken({ _id: userId, role: user.role, tokenVersion: user.tokenVersion ?? 0 });
  const refreshToken = signRefreshToken({ _id: userId, role: user.role, tokenVersion: user.tokenVersion ?? 0 });

  const cookieOptions = rememberMe
    ? refreshCookieOptions
    : {
        ...refreshCookieOptions,
        maxAge: undefined
      };

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
  return accessToken;
};

export const setAdminSessionCookie = (res: Response, sessionId: string, rememberMe = true) => {
  const cookieOptions = rememberMe
    ? adminSessionCookieOptions
    : {
        ...adminSessionCookieOptions,
        maxAge: undefined
      };
  res.cookie(ADMIN_SESSION_COOKIE_NAME, sessionId, cookieOptions);
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
  res.clearCookie(ADMIN_SESSION_COOKIE_NAME, clearAdminSessionCookieOptions);
};

export const resolveLogoutContext = async (req: Request) => {
  const sessionId = resolveAdminSessionId(req);
  const refreshToken = resolveRefreshToken(req);
  const accessToken = resolveAccessToken(req);

  let userId = req.user?._id ? String(req.user._id) : "";
  let refreshTokenValid = false;
  let accessTokenValid = false;

  if (!userId && accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      userId = String(payload._id);
      accessTokenValid = true;
    } catch {
      // Graceful logout still continues with refresh/session fallbacks.
    }
  } else if (userId) {
    accessTokenValid = true;
  }

  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      refreshTokenValid = true;
      if (!userId) userId = String(payload._id);
    } catch {
      // Ignore broken refresh token during logout.
    }
  }

  const session = sessionId
    ? await AdminSession.findOne({ sessionId }).select("userId sessionId revokedAt adminModeUntil").lean()
    : null;

  if (!userId && session?.userId) {
    userId = String(session.userId);
  }

  return {
    userId: userId || null,
    sessionId: sessionId || null,
    session,
    refreshTokenValid,
    accessTokenValid
  };
};

export const invalidateAuthState = async (options: {
  userId?: string | null;
  sessionId?: string | null;
  revokeAllAdminSessions?: boolean;
  rotateTokens?: boolean;
}) => {
  const userId = normalizeText(options.userId);
  const sessionId = normalizeText(options.sessionId);
  const revokeAllAdminSessions = options.revokeAllAdminSessions !== false;
  const rotateTokens = options.rotateTokens !== false;
  const revokedAt = new Date();

  let revokedCount = 0;

  if (userId && rotateTokens) {
    await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
  }

  if (userId && revokeAllAdminSessions) {
    const result = await AdminSession.updateMany({ userId, revokedAt: null }, { $set: { revokedAt } });
    revokedCount = result.modifiedCount;
  } else if (sessionId) {
    const result = await AdminSession.updateOne({ sessionId, revokedAt: null }, { $set: { revokedAt } });
    revokedCount = result.modifiedCount;
  }

  return {
    revokedAt,
    revokedCount,
    rotatedTokens: Boolean(userId && rotateTokens)
  };
};
