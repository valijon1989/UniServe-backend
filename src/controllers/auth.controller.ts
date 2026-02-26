import { CookieOptions, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User";
import { buildResetPasswordToken, hashRecoveryToken } from "../utils/recoveryToken";
import { durationToMs, signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { sendEmail } from "../utils/email";
import { resolveAvatarUrl } from "../utils/avatarImage";

const PASSWORD_MIN_LENGTH = 8;
const REFRESH_COOKIE_NAME = "refreshToken";
const DEFAULT_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8RNfWfQfP6x2fA6dA5M9X2x7X7fFdy"; // password
const INVALID_CREDENTIALS_RESPONSE = { message: "Invalid credentials" };
const GENERIC_RECOVERY_MESSAGE = "If an account exists, instructions were sent.";

const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional(),
    password: z.string().min(1),
    rememberMe: z.boolean().optional()
  })
  .refine((payload) => Boolean(payload.identifier || payload.email || payload.username), {
    message: "identifier or email or username is required"
  });

const forgotUsernameSchema = z.object({
  email: z.string().trim().email()
});

const forgotPasswordSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional()
  })
  .refine((payload) => Boolean(payload.identifier || payload.email || payload.username), {
    message: "identifier or email or username is required"
  });

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH)
});

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  name: z.string().trim().min(1).max(120),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/)
    .optional(),
  rememberMe: z.boolean().optional()
});

const cookieSecure = ["1", "true", "yes"].includes((process.env.COOKIE_SECURE || "false").toLowerCase());
const cookieSameSiteRaw = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
const cookieSameSite: "lax" | "strict" | "none" =
  cookieSameSiteRaw === "strict" || cookieSameSiteRaw === "none" ? cookieSameSiteRaw : "lax";
const refreshCookieMaxAge = durationToMs(process.env.REFRESH_TOKEN_TTL || "30d") ?? DEFAULT_REFRESH_TTL_MS;
const appBaseUrl =
  process.env.APP_BASE_URL || process.env.FRONTEND_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean)[0] || "http://localhost:3000";

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: "/api/auth",
  maxAge: refreshCookieMaxAge
};

const clearRefreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: "/api/auth"
};

const normalizeIdentifier = (value: string) => value.trim().toLowerCase();

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseRememberMe = (value: unknown) => {
  if (value === false || value === 0) return false;
  if (typeof value === "string" && (value.toLowerCase() === "false" || value === "0")) return false;
  return true;
};

const getNickname = (user: any) => user?.username || user?.nickname || user?.name || "user";

const toAuthUser = (user: any) => ({
  _id: String(user._id),
  email: user.email,
  username: getNickname(user),
  nickname: getNickname(user),
  role: user.role,
  isVerified: Boolean(user.isVerified),
  avatarUrl: resolveAvatarUrl(user.avatarUrl, user._id)
});

const toNavbarUser = (user: any) => ({
  _id: String(user._id),
  nickname: getNickname(user),
  avatarUrl: resolveAvatarUrl(user.avatarUrl, user._id)
});

const badRequest = (res: Response, issues: z.ZodIssue[]) =>
  res.status(400).json({
    message: "Validation failed",
    errors: issues.map((issue) => issue.message)
  });

const issueAuthTokens = (
  res: Response,
  user: { _id: unknown; role: "USER" | "AGENT" | "ADMIN"; tokenVersion?: number },
  rememberMe = true
) => {
  const userId = String(user._id);
  const accessToken = signAccessToken({ _id: userId, role: user.role });
  const refreshToken = signRefreshToken({ _id: userId, role: user.role, tokenVersion: user.tokenVersion ?? 0 });

  const cookieOptions: CookieOptions = rememberMe
    ? refreshCookieOptions
    : {
        ...refreshCookieOptions,
        maxAge: undefined
      };
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
  return accessToken;
};

export const register = async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.issues);

    const payload = parsed.data;
    const normalizedEmail = normalizeIdentifier(payload.email);
    const rememberMe = parseRememberMe(req.body?.rememberMe);

    const existingQuery = payload.username
      ? { $or: [{ email: normalizedEmail }, { username: payload.username }] }
      : { email: normalizedEmail };
    const existingUser = await User.findOne(existingQuery);
    if (existingUser) {
      return res.status(400).json({
        message: existingUser.email === normalizedEmail ? "Email already registered" : "Username already taken"
      });
    }

    const baseUsername = payload.username || normalizedEmail.split("@")[0] || `user${Date.now()}`;
    let username = baseUsername;
    while (await User.exists({ username })) {
      username = `${baseUsername}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const user = await User.create({
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(payload.password, 10),
      name: payload.name,
      username,
      role: "USER"
    });

    const accessToken = issueAuthTokens(res, user, rememberMe);
    return res.status(201).json({ user: toAuthUser(user), accessToken });
  } catch (err) {
    console.error("register error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);

    const identifierRaw = String(parsed.data.identifier || parsed.data.email || parsed.data.username || "").trim();
    const identifier = normalizeIdentifier(identifierRaw);
    const rememberMe = parseRememberMe(req.body?.rememberMe);

    let user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) {
      const regex = new RegExp(`^${escapeRegex(identifierRaw)}$`, "i");
      user = await User.findOne({ $or: [{ email: regex }, { username: regex }] });
    }

    const passwordHash = user?.passwordHash || DUMMY_PASSWORD_HASH;
    const passwordMatches = await bcrypt.compare(parsed.data.password, passwordHash);
    if (!user || !passwordMatches) return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);

    const accessToken = issueAuthTokens(res, user, rememberMe);
    return res.json({ user: toAuthUser(user), accessToken });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await User.findById(payload._id);
    if (!user || (user.tokenVersion ?? 0) !== payload.tokenVersion) {
      res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
      return res.status(401).json({ message: "Not authenticated" });
    }

    const accessToken = issueAuthTokens(res, user, true);
    return res.json({ user: toAuthUser(user), accessToken });
  } catch (err) {
    console.error("refresh error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await User.findByIdAndUpdate(payload._id, { $inc: { tokenVersion: 1 } });
      } catch {
        // ignore invalid token
      }
    }

    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
    return res.json({ ok: true });
  } catch (err) {
    console.error("logout error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user: toNavbarUser(user) });
  } catch (err) {
    console.error("me error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const forgotUsername = async (req: Request, res: Response) => {
  try {
    const parsed = forgotUsernameSchema.safeParse(req.body);
    if (!parsed.success) return res.status(200).json({ message: GENERIC_RECOVERY_MESSAGE });

    const email = normalizeIdentifier(parsed.data.email);
    const user = await User.findOne({ email });
    if (user) {
      await sendEmail(user.email, "Your UniServe username", `Your username is: ${user.username}`);
    }

    return res.status(200).json({ message: GENERIC_RECOVERY_MESSAGE });
  } catch (err) {
    console.error("forgotUsername error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(200).json({ message: GENERIC_RECOVERY_MESSAGE });

    const identifierRaw = String(parsed.data.identifier || parsed.data.email || parsed.data.username || "").trim();
    const identifier = normalizeIdentifier(identifierRaw);

    let user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!user) {
      const regex = new RegExp(`^${escapeRegex(identifierRaw)}$`, "i");
      user = await User.findOne({ $or: [{ email: regex }, { username: regex }] });
    }

    if (user) {
      const { plainToken, tokenHash, expiresAt } = buildResetPasswordToken();
      user.resetPasswordTokenHash = tokenHash;
      user.resetPasswordExpiresAt = expiresAt;
      await user.save();

      const resetLink = `${appBaseUrl.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(plainToken)}`;
      await sendEmail(user.email, "Reset your UniServe password", `Open this link to reset your password: ${resetLink}`);
    }

    return res.status(200).json({ message: GENERIC_RECOVERY_MESSAGE });
  } catch (err) {
    console.error("forgotPassword error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.issues);

    const tokenHash = hashRecoveryToken(parsed.data.token);
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() }
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
    return res.json({ ok: true });
  } catch (err) {
    console.error("resetPassword error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
