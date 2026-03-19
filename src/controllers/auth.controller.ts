import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User";
import { AdminSession } from "../models/AdminSession";
import { buildResetPasswordToken, hashRecoveryToken } from "../utils/recoveryToken";
import { verifyRefreshToken } from "../utils/jwt";
import { sendEmail } from "../utils/email";
import { resolveAvatarUrl } from "../utils/avatarImage";
import {
  ADMIN_SESSION_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearAdminSessionCookieOptions,
  clearRefreshCookieOptions,
  issueAuthTokens
} from "../services/authSession";
import { respondAuthRequired } from "../utils/controllerResponses";

const PASSWORD_MIN_LENGTH = 8;
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
  role: z.enum(["USER", "AGENT"]).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/)
    .optional(),
  rememberMe: z.boolean().optional()
});

const appBaseUrl =
  process.env.APP_BASE_URL || process.env.FRONTEND_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean)[0] || "http://localhost:3000";

const normalizeIdentifier = (value: string) => value.trim().toLowerCase();
const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$/.test(String(value || ""));

const buildLoginLookupQuery = (identifier: string) => ({
  $or: [{ email: identifier }, { username: identifier }]
});

const buildCaseInsensitiveLoginLookupQuery = (identifierRaw: string) => {
  const regex = new RegExp(`^${escapeRegex(identifierRaw)}$`, "i");
  return { $or: [{ email: regex }, { username: regex }] };
};

const findLegacyLoginUser = async (identifier: string, identifierRaw: string) => {
  const exact = await User.collection.findOne(buildLoginLookupQuery(identifier));
  if (exact) return exact;
  return User.collection.findOne(buildCaseInsensitiveLoginLookupQuery(identifierRaw));
};

const verifySubmittedPassword = async (submittedPassword: string, storedSecret?: string | null) => {
  const secret = String(storedSecret || "").trim();
  if (!secret) return false;
  if (isBcryptHash(secret)) {
    return bcrypt.compare(submittedPassword, secret);
  }
  return submittedPassword === secret;
};

const normalizeRequestedRole = (value: unknown): "USER" | "AGENT" => {
  return String(value || "").trim().toUpperCase() === "AGENT" ? "AGENT" : "USER";
};

const sanitizeUsernameSeed = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[-._]{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 30);

const buildUsernameFromEmail = (email: string) => {
  const localPart = email.split("@")[0] || `user${Date.now()}`;
  const sanitized = sanitizeUsernameSeed(localPart);
  if (sanitized.length >= 3) return sanitized;
  return `user${Date.now()}`.slice(0, 30);
};

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

const buildDevErrorPayload = (err: any) => {
  if (process.env.NODE_ENV === "production") {
    return { message: "Server error" };
  }

  const validationMessages = Array.isArray(err?.errors)
    ? err.errors.map((issue: any) => String(issue?.message || "").trim()).filter(Boolean)
    : undefined;

  return {
    message: String(err?.message || "Server error"),
    code: typeof err?.code === "string" || typeof err?.code === "number" ? err.code : undefined,
    name: typeof err?.name === "string" ? err.name : undefined,
    errors: validationMessages?.length ? validationMessages : undefined
  };
};

export const register = async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.issues);

    const payload = parsed.data;
    const normalizedEmail = normalizeIdentifier(payload.email);
    const rememberMe = parseRememberMe(req.body?.rememberMe);
    const requestedRole = normalizeRequestedRole(payload.role);

    const existingQuery = payload.username
      ? { $or: [{ email: normalizedEmail }, { username: payload.username }] }
      : { email: normalizedEmail };
    const existingUser = await User.findOne(existingQuery);
    if (existingUser) {
      return res.status(400).json({
        message: existingUser.email === normalizedEmail ? "Email already registered" : "Username already taken"
      });
    }

    const baseUsername = payload.username || buildUsernameFromEmail(normalizedEmail);
    let username = baseUsername;
    while (await User.exists({ username })) {
      const suffix = String(Math.floor(1000 + Math.random() * 9000));
      const prefix = baseUsername.slice(0, Math.max(3, 30 - suffix.length - 1));
      username = `${prefix}-${suffix}`;
    }

    const user = await User.create({
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(payload.password, 10),
      name: payload.name,
      username,
      role: requestedRole
    });

    const accessToken = issueAuthTokens(res, user, rememberMe);
    return res.status(201).json({ user: toAuthUser(user), token: accessToken, accessToken });
  } catch (err: any) {
    if (err?.code === 11000) {
      const duplicateFields = Object.keys(err?.keyPattern || err?.keyValue || {});
      const duplicateField = duplicateFields[0];
      if (duplicateField === "email") {
        return res.status(400).json({ message: "Email already registered" });
      }
      if (duplicateField === "username") {
        return res.status(400).json({ message: "Username already taken" });
      }
      return res.status(400).json({ message: "Account already exists" });
    }

    if (Array.isArray(err?.errors) || err?.name === "ValidationError") {
      const messages = Object.values(err?.errors || {})
        .map((issue: any) => String(issue?.message || "").trim())
        .filter(Boolean);
      return res.status(400).json({
        message: "Validation failed",
        errors: messages.length ? messages : ["Invalid registration payload"]
      });
    }

    console.error("register error", err);
    return res.status(500).json(buildDevErrorPayload(err));
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);

    const identifierRaw = String(parsed.data.identifier || parsed.data.email || parsed.data.username || "").trim();
    const identifier = normalizeIdentifier(identifierRaw);
    const rememberMe = parseRememberMe(req.body?.rememberMe);

    let user = await User.findOne(buildLoginLookupQuery(identifier));
    if (!user) {
      user = await User.findOne(buildCaseInsensitiveLoginLookupQuery(identifierRaw));
    }
    const legacyUser = !user || !(user as any)?.passwordHash ? await findLegacyLoginUser(identifier, identifierRaw) : null;

    const storedPasswordHash =
      (typeof (user as any)?.passwordHash === "string" && (user as any).passwordHash) ||
      (typeof legacyUser?.passwordHash === "string" && legacyUser.passwordHash) ||
      undefined;
    const legacyPassword =
      (typeof (legacyUser as any)?.password === "string" && (legacyUser as any).password) ||
      (typeof (user as any)?.password === "string" && (user as any).password) ||
      undefined;
    const passwordMatches =
      (await verifySubmittedPassword(parsed.data.password, storedPasswordHash)) ||
      (await verifySubmittedPassword(parsed.data.password, legacyPassword)) ||
      (await bcrypt.compare(parsed.data.password, DUMMY_PASSWORD_HASH) && false);
    const authUser = user || legacyUser;
    if (!authUser || !passwordMatches) return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);

    if ((!user || !(user as any)?.passwordHash) && (storedPasswordHash || legacyPassword) && legacyUser?._id) {
      const nextPasswordHash =
        storedPasswordHash || (legacyPassword && isBcryptHash(legacyPassword) ? legacyPassword : await bcrypt.hash(parsed.data.password, 10));
      await User.collection.updateOne(
        { _id: legacyUser._id },
        {
          $set: { passwordHash: nextPasswordHash },
          $unset: { password: "" }
        }
      );
      if (user) {
        (user as any).passwordHash = nextPasswordHash;
      }
    }

    const accessToken = issueAuthTokens(res, authUser as any, rememberMe);
    return res.json({ user: toAuthUser(authUser), token: accessToken, accessToken });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json(buildDevErrorPayload(err));
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) return respondAuthRequired(req, res);

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
      return respondAuthRequired(req, res);
    }

    const user = await User.findById(payload._id);
    if (!user || (user.tokenVersion ?? 0) !== payload.tokenVersion) {
      res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
      return respondAuthRequired(req, res);
    }

    const accessToken = issueAuthTokens(res, user, true);
    return res.json({ user: toAuthUser(user), token: accessToken, accessToken });
  } catch (err) {
    console.error("refresh error", err);
    return res.status(500).json(buildDevErrorPayload(err));
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    let userId: string | null = null;
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        userId = String(payload._id);
        await User.findByIdAndUpdate(payload._id, { $inc: { tokenVersion: 1 } });
        await AdminSession.updateMany({ userId: payload._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
      } catch {
        // ignore invalid token
      }
    }

    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions);
    res.clearCookie(ADMIN_SESSION_COOKIE_NAME, clearAdminSessionCookieOptions);
    return res.json({ ok: true, userId });
  } catch (err) {
    console.error("logout error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);

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
