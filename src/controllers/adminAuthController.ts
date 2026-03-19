import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Request, Response } from "express";
import { AdminDepartment, type AdminScope, type AdminScopeModule, User } from "../models/User";
import { AdminInvite } from "../models/AdminInvite";
import { AdminSession } from "../models/AdminSession";
import { Department } from "../models/Department";
import { Position } from "../models/Position";
import {
  buildTotpOtpAuthUrl,
  consumeRecoveryCode,
  generateEmailOtp,
  generateRecoveryCodes,
  generateTotpSecretHex,
  hashRecoveryCodes,
  verifyEmailOtp,
  verifyTotpCode
} from "../utils/adminMfa";
import { sendEmail } from "../utils/email";
import { respondAuthRequired } from "../utils/controllerResponses";
import { writeAuditLog } from "../services/auditLog";
import {
  clearAuthCookies,
  issueAuthTokens,
  invalidateAuthState,
  resolveAdminSessionId,
  resolveLogoutContext,
  setAdminSessionCookie
} from "../services/authSession";
import {
  ADMIN_SCOPE_MODULES,
  buildAdminWorkspace,
  canonicalizeAdminDepartment,
  getRoleTemplate,
  normalizeAdminDepartment,
  resolveDefaultAdminRoleNames
} from "../services/adminBlueprint";
import {
  assignDefaultAdminRoles,
  ensureDefaultAdminRbac,
  resolveAdminPermissionKeys,
  resolveAdminRoleNames
} from "../services/adminRbac";

const ADMIN_MODE_TTL_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8RNfWfQfP6x2fA6dA5M9X2x7X7fFdy"; // password

const normalizeMethod = (value: unknown): "TOTP" | "PASSKEY" | "EMAIL_OTP" => {
  const method = String(value || "TOTP")
    .trim()
    .toUpperCase();
  if (method === "EMAIL_OTP") return "EMAIL_OTP";
  if (method === "PASSKEY") return "PASSKEY";
  return "TOTP";
};

const normalizeEmail = (value: unknown): string => String(value || "").trim().toLowerCase();
const normalizeIdentifier = (value: unknown): string => String(value || "").trim().toLowerCase();
const normalizeText = (value: unknown): string => String(value || "").trim();
const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }
  return false;
};
const parseRememberMe = (value: unknown) => {
  if (value === false || value === 0) return false;
  if (typeof value === "string" && (value.toLowerCase() === "false" || value === "0")) return false;
  return true;
};
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseHeaderValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
};

const resolveIp = (req: Request): string => {
  const xff = req.headers["x-forwarded-for"];
  if (Array.isArray(xff) && xff.length) return String(xff[0]);
  if (typeof xff === "string" && xff.trim()) return xff.split(",")[0].trim();
  return req.ip || "";
};

const isAdminIdentity = (user: any): boolean => user?.role === "ADMIN" || Boolean(user?.isAdmin);

const hasApprovedAdminAccess = (user: any): boolean => user?.adminLevel === "PRIMARY" || user?.adminAccessStatus === "APPROVED";

const resolveDepartmentAndPosition = (req: Request) => {
  const department = normalizeAdminDepartment(req.body.department || req.body.adminDepartment || req.body.departmentName) as
    | AdminDepartment
    | undefined;
  const position = normalizeText(req.body.position || req.body.adminPosition || req.body.lavozim) || undefined;
  return { department, position };
};

const normalizeScopesForResponse = (value: unknown): AdminScope[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const moduleName = normalizeText((item as { module?: unknown }).module);
      if (!moduleName || !ADMIN_SCOPE_MODULES.includes(moduleName as AdminScopeModule)) return null;
      const categoryId = normalizeText((item as { categoryId?: unknown }).categoryId) || undefined;
      const subcategoryId = normalizeText((item as { subcategoryId?: unknown }).subcategoryId) || undefined;
      const region = normalizeText((item as { region?: unknown }).region) || undefined;
      const countryCode = normalizeText((item as { countryCode?: unknown }).countryCode).toUpperCase() || undefined;
      return {
        module: moduleName as AdminScopeModule,
        region,
        countryCode,
        categoryId,
        subcategoryId
      };
    })
    .filter(Boolean) as AdminScope[];
};

const resolveRoleBadge = (roleNames: string[], adminLevel?: string | null, department?: unknown) => {
  for (const roleName of roleNames) {
    const template = getRoleTemplate(roleName);
    if (template) return template.label;
  }

  const [fallbackRoleName] = resolveDefaultAdminRoleNames((adminLevel as any) || null, department);
  return getRoleTemplate(fallbackRoleName)?.label || (adminLevel === "PRIMARY" ? "Primary Admin" : "Admin Staff");
};

const buildAdminClaims = async (user: any) => {
  const permissions = await resolveAdminPermissionKeys(String(user._id), user.adminLevel || null);
  const roleNames = await resolveAdminRoleNames(String(user._id));
  const workspace = buildAdminWorkspace({
    adminLevel: user.adminLevel || null,
    department: user.department || null,
    permissions,
    roleNames,
    scopes: normalizeScopesForResponse(user.adminScopes)
  });
  return {
    adminLevel: user.adminLevel || null,
    department: canonicalizeAdminDepartment(user.department),
    position: user.position || null,
    permissions,
    roleNames,
    roleBadge: resolveRoleBadge(roleNames, user.adminLevel || null, user.department || null),
    workspace,
    scopes: normalizeScopesForResponse(user.adminScopes)
  };
};

const resolveDepartmentPosition = async (req: Request) => {
  const departmentIdRaw =
    req.body.departmentId || req.body.adminDepartmentId || req.body.department || req.body.adminDepartment;
  const positionIdRaw =
    req.body.positionId || req.body.adminPositionId || req.body.position || req.body.adminPosition || req.body.lavozim;

  const departmentIdText = normalizeText(departmentIdRaw);
  const positionIdText = normalizeText(positionIdRaw);

  let departmentId: any = null;
  let positionId: any = null;

  if (departmentIdText) {
    if (/^[a-f0-9]{24}$/i.test(departmentIdText)) {
      departmentId = departmentIdText;
    } else {
      const department = await Department.findOneAndUpdate(
        { name: departmentIdText },
        { $setOnInsert: { name: departmentIdText } },
        { upsert: true, new: true }
      );
      departmentId = department?._id || null;
    }
  }

  if (positionIdText) {
    if (/^[a-f0-9]{24}$/i.test(positionIdText)) {
      positionId = positionIdText;
    } else {
      let effectiveDepartmentId = departmentId;
      if (!effectiveDepartmentId) {
        const fallbackDepartmentName = "General";
        const fallbackDepartment = await Department.findOneAndUpdate(
          { name: fallbackDepartmentName },
          { $setOnInsert: { name: fallbackDepartmentName } },
          { upsert: true, new: true }
        );
        effectiveDepartmentId = fallbackDepartment?._id || null;
        departmentId = effectiveDepartmentId;
      }

      if (effectiveDepartmentId) {
        const position = await Position.findOneAndUpdate(
          { name: positionIdText, departmentId: effectiveDepartmentId },
          { $setOnInsert: { name: positionIdText, departmentId: effectiveDepartmentId, rank: 1 } },
          { upsert: true, new: true }
        );
        positionId = position?._id || null;
      }
    }
  }

  return { departmentId, positionId };
};

const resolveRequestedAdminLevel = (req: Request, defaultLevel: "STAFF" | "MANAGER" = "STAFF") => {
  const raw = normalizeText(req.body.adminLevel || req.body.level || req.body.position || req.body.lavozim).toUpperCase();
  if (raw === "PRIMARY") return "PRIMARY";
  if (raw === "MANAGER" || raw === "MODERATOR") return "MANAGER";
  return defaultLevel;
};

const verifyAdminMfaChallenge = async (user: any, mfaCode: string, recoveryCode: string): Promise<boolean> => {
  const methods = new Set((user.mfaMethods || []).map((method: string) => String(method).toUpperCase()));
  let mfaOk = false;

  if (methods.has("TOTP") && user.mfaTotpSecret) {
    if (mfaCode && verifyTotpCode(user.mfaTotpSecret, mfaCode)) {
      mfaOk = true;
    } else if (recoveryCode) {
      const consumed = consumeRecoveryCode(recoveryCode, user.mfaRecoveryCodeHashes);
      if (consumed.ok) {
        user.mfaRecoveryCodeHashes = consumed.remaining;
        await user.save();
        mfaOk = true;
      }
    }
  } else if (methods.has("EMAIL_OTP")) {
    mfaOk = verifyEmailOtp(mfaCode, user.mfaEmailOtpHash, user.mfaEmailOtpExpiresAt);
    if (mfaOk) {
      user.mfaEmailOtpHash = undefined;
      user.mfaEmailOtpExpiresAt = undefined;
      await user.save();
    }
  }

  return mfaOk;
};

export const registerAdminAccount = async (req: Request, res: Response) => {
  try {
    const inviteToken = normalizeText(req.body.inviteToken || req.body.adminInviteToken);
    const accessCode = normalizeText(req.body.adminAccessCode || req.body.accessCode || req.body.inviteCode);
    const adminEmail = normalizeEmail(req.body.adminEmail || req.body.email || req.body.workEmail);
    const adminPassword = String(req.body.adminPassword || req.body.password || "");
    const adminName = normalizeText(req.body.adminName || req.body.name || req.body.fullName || req.body.full_name);
    const adminUsernameRaw = normalizeText(req.body.adminUsername || req.body.username || adminEmail.split("@")[0] || "");
    const adminUsername = adminUsernameRaw.toLowerCase();
    const enableMfaRequested = parseBoolean(req.body.enableMfa || req.body.mfaEnabled || req.body.adminMfaEnabled);

    if (!adminEmail || !adminPassword || !adminName || !adminUsername) {
      return res.status(400).json({
        message: "adminEmail, adminPassword, adminName, adminUsername are required"
      });
    }
    const { departmentId, positionId } = await resolveDepartmentPosition(req);
    const { department, position } = resolveDepartmentAndPosition(req);

    const primaryExists = Boolean(
      await User.findOne({ isAdmin: true, adminLevel: "PRIMARY", adminAccessStatus: "APPROVED" })
        .select("_id")
        .lean()
    );

    const requestedLevel = resolveRequestedAdminLevel(req, "STAFF");
    const isPrimaryRequest = requestedLevel === "PRIMARY" || String(req.body.registrationMode || "").toUpperCase() === "PRIMARY";

    if (!primaryExists) {
      const expectedCode = process.env.ADMIN_PRIMARY_SIGNUP_CODE || "Sabriya";
      if (!accessCode || accessCode !== expectedCode) {
        return res.status(403).json({ message: "Primary admin access code is required" });
      }

      await ensureDefaultAdminRbac();
      let user = await User.findOne({ $or: [{ email: adminEmail }, { username: adminUsername }] });
      if (!user) {
        user = await User.create({
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 10),
          name: adminName,
          username: adminUsername,
          role: "USER",
          isAdmin: true,
          adminAccessStatus: "APPROVED",
          adminLevel: "PRIMARY",
          adminApprovedAt: new Date(),
          adminApprovedBy: undefined,
          department: department || null,
          position: position || null,
          departmentId: departmentId || null,
          positionId: positionId || null,
          mfaEnabled: false,
          mfaMethods: []
        });
      } else {
        if (user.username !== adminUsername && (await User.exists({ username: adminUsername }))) {
          return res.status(400).json({ message: "adminUsername already taken" });
        }
        user.email = adminEmail;
        user.passwordHash = await bcrypt.hash(adminPassword, 10);
        user.name = adminName;
        user.username = adminUsername;
        user.isAdmin = true;
        user.adminAccessStatus = "APPROVED";
        user.adminLevel = "PRIMARY";
        user.adminApprovedAt = new Date();
        user.adminApprovedBy = user._id;
        user.department = department || null;
        user.position = position || null;
        user.departmentId = departmentId || null;
        user.positionId = positionId || null;
        if (!Array.isArray(user.adminScopes)) user.adminScopes = [];
        if (!Array.isArray(user.mfaMethods)) user.mfaMethods = [];
        await user.save();
      }

      await assignDefaultAdminRoles(String(user._id), "PRIMARY", user.department || null);

      await writeAuditLog(req, {
        actorId: String(user._id),
        action: "admin.auth.register.primary",
        targetType: "User",
        targetId: String(user._id),
        after: {
          isAdmin: user.isAdmin,
          adminAccessStatus: user.adminAccessStatus,
          adminLevel: user.adminLevel
        }
      });

      return res.status(201).json({
        user: {
          _id: String(user._id),
          email: user.email,
          username: user.username,
          adminAccessStatus: user.adminAccessStatus,
          adminLevel: user.adminLevel
        },
        requiresMfaSetup: enableMfaRequested || true
      });
    }

    if (isPrimaryRequest) {
      return res.status(409).json({
        message: "Primary admin already exists. Use invited admin flow for additional admins."
      });
    }

    // Primary exists. Allow signup only with invite token or moderator-issued access code.
    const expectedStaffCode =
      process.env.ADMIN_STAFF_SIGNUP_CODE || process.env.ADMIN_PRIMARY_SIGNUP_CODE || "Sabriya";
    const hasValidStaffCode = Boolean(accessCode && accessCode === expectedStaffCode);

    if (!inviteToken) {
      if (!hasValidStaffCode) {
        return res.status(403).json({
          message: "Admin invite token or valid admin access code is required"
        });
      }

      const effectiveLevel: "MANAGER" | "STAFF" = requestedLevel === "MANAGER" ? "MANAGER" : "STAFF";
      let user = await User.findOne({ $or: [{ email: adminEmail }, { username: adminUsername }] });
      if (!user) {
        user = await User.create({
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 10),
          name: adminName,
          username: adminUsername,
          role: "USER",
          isAdmin: true,
          adminAccessStatus: "PENDING",
          adminLevel: effectiveLevel,
          department: department || null,
          position: position || null,
          departmentId: departmentId || null,
          positionId: positionId || null,
          adminScopes: [],
          mfaEnabled: false,
          mfaMethods: []
        });
      } else {
        if (user.username !== adminUsername && (await User.exists({ username: adminUsername }))) {
          return res.status(400).json({ message: "adminUsername already taken" });
        }
        user.email = adminEmail;
        user.passwordHash = await bcrypt.hash(adminPassword, 10);
        user.name = adminName;
        user.username = adminUsername;
        user.isAdmin = true;
        user.adminAccessStatus = "PENDING";
        if (!user.adminLevel || user.adminLevel === "PRIMARY") {
          user.adminLevel = effectiveLevel;
        }
        user.department = department || null;
        user.position = position || null;
        user.departmentId = departmentId || null;
        user.positionId = positionId || null;
        await user.save();
      }

      await writeAuditLog(req, {
        actorId: String(user._id),
        action: "admin.auth.register.pending",
        targetType: "User",
        targetId: String(user._id),
        after: {
          isAdmin: user.isAdmin,
          adminAccessStatus: user.adminAccessStatus,
          adminLevel: user.adminLevel
        }
      });

      return res.status(202).json({
        user: {
          _id: String(user._id),
          email: user.email,
          username: user.username,
          adminAccessStatus: user.adminAccessStatus,
          adminLevel: user.adminLevel
        },
        message: "Admin request sent. Primary moderator approval required."
      });
    }

    // Invite-based admin register.
    const tokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex");
    const invite = await AdminInvite.findOne({
      tokenHash,
      status: "PENDING",
      expiresAt: { $gt: new Date() }
    });
    if (!invite) {
      return res.status(404).json({ message: "Invite not found or expired" });
    }
    if (invite.email && invite.email !== adminEmail) {
      return res.status(400).json({ message: "Invite email does not match adminEmail" });
    }

    let user = invite.userId ? await User.findById(invite.userId) : null;
    if (!user) user = await User.findOne({ email: adminEmail });

    if (!user) {
      user = await User.create({
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        name: adminName,
        username: adminUsername,
        role: "USER",
        isAdmin: true,
        adminAccessStatus: "PENDING",
        adminLevel: invite.requestedAdminLevel,
        department: invite.requestedDepartment || department || null,
        position: invite.requestedPosition || position || null,
        departmentId: invite.requestedDepartmentId || departmentId || null,
        positionId: invite.requestedPositionId || positionId || null,
        adminScopes: invite.requestedScopes || [],
        mfaEnabled: false,
        mfaMethods: []
      });
    } else {
      if (user.username !== adminUsername && (await User.exists({ username: adminUsername }))) {
        return res.status(400).json({ message: "adminUsername already taken" });
      }
      user.email = adminEmail;
      user.passwordHash = await bcrypt.hash(adminPassword, 10);
      user.name = adminName;
      user.username = adminUsername;
      user.isAdmin = true;
      user.adminAccessStatus = "PENDING";
      user.adminLevel = invite.requestedAdminLevel;
      user.department = invite.requestedDepartment || department || null;
      user.position = invite.requestedPosition || position || null;
      user.departmentId = invite.requestedDepartmentId || departmentId || null;
      user.positionId = invite.requestedPositionId || positionId || null;
      user.adminScopes = invite.requestedScopes || [];
      await user.save();
    }

    invite.userId = user._id;
    invite.status = "ACCEPTED";
    invite.acceptedAt = new Date();
    await invite.save();

    await writeAuditLog(req, {
      actorId: String(user._id),
      action: "admin.auth.register.invite",
      targetType: "User",
      targetId: String(user._id),
      after: {
        isAdmin: user.isAdmin,
        adminAccessStatus: user.adminAccessStatus,
        adminLevel: user.adminLevel
      }
    });

    return res.status(201).json({
      user: {
        _id: String(user._id),
        email: user.email,
        username: user.username,
        adminAccessStatus: user.adminAccessStatus,
        adminLevel: user.adminLevel
      },
      message: "Invite accepted. Moderator approval required before admin login."
    });
  } catch (err) {
    if ((err as any)?.code === 11000) {
      return res.status(409).json({ message: "Admin account data already exists (email/username/primary)." });
    }
    console.error("registerAdminAccount error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const loginAdminAccount = async (req: Request, res: Response) => {
  try {
    const adminIdentifier = normalizeIdentifier(
      req.body.adminIdentifier || req.body.identifier || req.body.email || req.body.username
    );
    const adminPassword = String(req.body.adminPassword || req.body.password || "");
    const mfaCode = String(req.body.mfaCode || req.body.otpCode || req.body.otp || "");
    const recoveryCode = String(req.body.recoveryCode || req.body.adminRecoveryCode || "");
    const rememberMe = parseRememberMe(req.body.rememberMe);
    const deviceFingerprint =
      normalizeText(req.body.deviceFingerprint || parseHeaderValue(req.headers["x-device-fingerprint"])) || undefined;

    if (!adminIdentifier || !adminPassword) {
      return res.status(400).json({ message: "adminIdentifier and adminPassword are required" });
    }

    let user = await User.findOne({ $or: [{ email: adminIdentifier }, { username: adminIdentifier }] });
    if (!user) {
      const regex = new RegExp(`^${escapeRegex(String(req.body.adminIdentifier || ""))}$`, "i");
      user = await User.findOne({ $or: [{ email: regex }, { username: regex }] });
    }

    const passwordHash = user?.passwordHash || DUMMY_PASSWORD_HASH;
    const passwordMatches = await bcrypt.compare(adminPassword, passwordHash);
    if (!user || !passwordMatches) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    if (!isAdminIdentity(user)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    if (!hasApprovedAdminAccess(user)) {
      return res.status(403).json({ message: `Admin access is ${String(user.adminAccessStatus || "PENDING")}` });
    }

    if (user.mfaEnabled) {
      if (!mfaCode && !recoveryCode) {
        return res.status(428).json({ message: "MFA code required", mfaRequired: true });
      }
      const mfaOk = await verifyAdminMfaChallenge(user, mfaCode, recoveryCode);
      if (!mfaOk) {
        return res.status(401).json({ message: "Invalid MFA credentials" });
      }
    }

    await ensureDefaultAdminRbac();
    const accessToken = issueAuthTokens(res, user, rememberMe);
    const sessionId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
    const adminModeUntil = new Date(Date.now() + ADMIN_MODE_TTL_MS);

    await AdminSession.create({
      userId: user._id,
      sessionId,
      deviceFingerprint,
      ip: resolveIp(req),
      userAgent: String(req.headers["user-agent"] || ""),
      lastSeenAt: new Date(),
      adminModeUntil
    });

    setAdminSessionCookie(res, sessionId, rememberMe);

    const claims = await buildAdminClaims(user);

    await writeAuditLog(req, {
      actorId: String(user._id),
      action: "admin.auth.login",
      targetType: "AdminSession",
      targetId: sessionId,
      after: { sessionId, adminModeUntil, deviceFingerprint }
    });

    return res.json({
      user: {
        _id: String(user._id),
        email: user.email,
        username: user.username,
        role: user.role,
        isAdmin: user.isAdmin,
        adminLevel: user.adminLevel,
        adminAccessStatus: user.adminAccessStatus,
        department: canonicalizeAdminDepartment(user.department),
        position: user.position || null
      },
      accessToken,
      ...claims,
      adminSession: {
        sessionId,
        adminModeUntil
      },
      requiresMfaSetup: !user.mfaEnabled
    });
  } catch (err) {
    console.error("loginAdminAccount error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAdminAuthMe = async (req: Request, res: Response) => {
  try {
    const sessionId = resolveAdminSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ message: "Admin session not found" });
    }

    const adminSession = await AdminSession.findOne({
      sessionId,
      revokedAt: null
    });
    if (!adminSession) {
      return res.status(401).json({ message: "Admin session is invalid or revoked" });
    }

    const user = await User.findById(adminSession.userId);
    if (!user) {
      await invalidateAuthState({ sessionId: adminSession.sessionId, rotateTokens: false, revokeAllAdminSessions: false });
      return respondAuthRequired(req, res);
    }

    if (!isAdminIdentity(user)) {
      await invalidateAuthState({ userId: String(user._id), sessionId: adminSession.sessionId });
      return res.status(403).json({ message: "Admin access required" });
    }
    if (!hasApprovedAdminAccess(user)) {
      await invalidateAuthState({ userId: String(user._id), sessionId: adminSession.sessionId });
      return res.status(403).json({
        message: `Admin access is ${String(user.adminAccessStatus || "PENDING")}`,
        shouldLogout: true
      });
    }

    await ensureDefaultAdminRbac();
    adminSession.lastSeenAt = new Date();
    await adminSession.save();

    const claims = await buildAdminClaims(user);

    return res.json({
      user: {
        _id: String(user._id),
        email: user.email,
        username: user.username,
        role: user.role,
        isAdmin: user.isAdmin,
        adminLevel: user.adminLevel,
        adminAccessStatus: user.adminAccessStatus,
        department: canonicalizeAdminDepartment(user.department),
        position: user.position || null
      },
      ...claims,
      adminSession: {
        sessionId: adminSession.sessionId,
        adminModeUntil: adminSession.adminModeUntil,
        lastSeenAt: adminSession.lastSeenAt
      },
      requiresMfaSetup: !user.mfaEnabled
    });
  } catch (err) {
    console.error("getAdminAuthMe error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const logoutAdminAccount = async (req: Request, res: Response) => {
  try {
    const logoutContext = await resolveLogoutContext(req);
    const invalidation = await invalidateAuthState({
      userId: logoutContext.userId,
      sessionId: logoutContext.sessionId,
      revokeAllAdminSessions: true,
      rotateTokens: true
    });

    if (logoutContext.userId) {
      await writeAuditLog(req, {
        actorId: logoutContext.userId,
        action: "admin.auth.logout",
        entityType: "AdminSession",
        entityId: logoutContext.sessionId || logoutContext.userId,
        targetType: "AdminSession",
        targetId: logoutContext.sessionId || logoutContext.userId,
        after: {
          revokedCount: invalidation.revokedCount,
          rotatedTokens: invalidation.rotatedTokens,
          sessionDetected: Boolean(logoutContext.session)
        }
      });
    }

    clearAuthCookies(res);
    return res.json({
      ok: true,
      revokedCount: invalidation.revokedCount,
      rotatedTokens: invalidation.rotatedTokens,
      sessionDetected: Boolean(logoutContext.session)
    });
  } catch (err) {
    console.error("logoutAdminAccount error", err);
    clearAuthCookies(res);
    return res.json({ ok: true, revokedCount: 0, rotatedTokens: false, sessionDetected: false });
  }
};

export const bootstrapPrimaryAdmin = async (req: Request, res: Response) => {
  try {
    const bootstrapKey = parseHeaderValue(req.headers["x-admin-bootstrap-key"]);
    const expectedKey = process.env.ADMIN_BOOTSTRAP_KEY || "dev-admin-bootstrap";
    if (!bootstrapKey || bootstrapKey !== expectedKey) {
      return res.status(403).json({ message: "Invalid bootstrap key" });
    }

    const existingPrimary = await User.findOne({ adminLevel: "PRIMARY" }).select("_id");
    if (existingPrimary) {
      return res.status(409).json({ message: "Primary admin already exists" });
    }

    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const name = String(req.body.name || "").trim();
    const username = String(req.body.username || "").trim().toLowerCase();
    const department = normalizeAdminDepartment(req.body.department || req.body.adminDepartment) as
      | AdminDepartment
      | undefined;
    const position = normalizeText(req.body.position || req.body.adminPosition) || undefined;

    if (!email || !password || !name || !username) {
      return res.status(400).json({ message: "email, password, name, username are required" });
    }

    await ensureDefaultAdminRbac();

    const hash = await bcrypt.hash(password, 10);
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (!user) {
      user = await User.create({
        email,
        passwordHash: hash,
        name,
        username,
        role: "USER",
        isAdmin: true,
        adminAccessStatus: "APPROVED",
        adminLevel: "PRIMARY",
        adminApprovedAt: new Date(),
        department: department || null,
        position: position || null,
        isVerified: true,
        mfaEnabled: false,
        mfaMethods: []
      });
    } else {
      user.email = email;
      user.passwordHash = hash;
      user.name = name;
      user.username = username;
      user.isAdmin = true;
      user.adminAccessStatus = "APPROVED";
      user.adminLevel = "PRIMARY";
      user.adminApprovedAt = new Date();
      user.adminApprovedBy = user._id;
      user.department = department || null;
      user.position = position || null;
      await user.save();
    }

    await assignDefaultAdminRoles(String(user._id), "PRIMARY", user.department || null);

    await writeAuditLog(req, {
      actorId: String(user._id),
      action: "admin.primary.bootstrap",
      targetType: "User",
      targetId: String(user._id),
      after: {
        role: user.role,
        adminLevel: user.adminLevel,
        adminAccessStatus: user.adminAccessStatus
      }
    });

    return res.status(201).json({
      user: {
        _id: String(user._id),
        email: user.email,
        username: user.username,
        role: user.role,
        adminLevel: user.adminLevel,
        adminAccessStatus: user.adminAccessStatus
      }
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Primary admin already exists" });
    }
    console.error("bootstrapPrimaryAdmin error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const setupAdminMfa = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const user = await User.findById(req.user._id);
    if (!user) return respondAuthRequired(req, res);
    if (!isAdminIdentity(user)) return res.status(403).json({ message: "Admin access required" });
    if (!hasApprovedAdminAccess(user)) return res.status(403).json({ message: "Admin access is not approved" });

    const method = normalizeMethod(req.body.method);
    if (method === "PASSKEY") {
      return res.status(501).json({ message: "Passkey setup is not implemented yet" });
    }

    if (method === "TOTP") {
      const secret = generateTotpSecretHex();
      user.mfaPendingSecret = secret;
      await user.save();

      const label = user.email || user.username || `admin-${user._id}`;
      const issuer = process.env.MFA_ISSUER || "UniServe";
      return res.json({
        method: "TOTP",
        otpAuthUrl: buildTotpOtpAuthUrl(secret, label, issuer),
        ...(process.env.NODE_ENV !== "production" ? { secretForDev: secret } : {})
      });
    }

    const emailOtp = generateEmailOtp();
    user.mfaEmailOtpHash = emailOtp.codeHash;
    user.mfaEmailOtpExpiresAt = emailOtp.expiresAt;
    await user.save();

    if (user.email) {
      await sendEmail(user.email, "UniServe admin MFA code", `Your verification code: ${emailOtp.code}`);
    }

    return res.json({
      method: "EMAIL_OTP",
      sent: true,
      expiresAt: emailOtp.expiresAt
    });
  } catch (err) {
    console.error("setupAdminMfa error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const verifyAdminMfa = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const user = await User.findById(req.user._id);
    if (!user) return respondAuthRequired(req, res);
    if (!isAdminIdentity(user)) return res.status(403).json({ message: "Admin access required" });
    if (!hasApprovedAdminAccess(user)) return res.status(403).json({ message: "Admin access is not approved" });

    const method = normalizeMethod(req.body.method);
    if (method === "PASSKEY") {
      return res.status(501).json({ message: "Passkey verify is not implemented yet" });
    }

    if (method === "TOTP") {
      const code = String(req.body.code || "");
      const secret = user.mfaPendingSecret || user.mfaTotpSecret;
      if (!secret) return res.status(400).json({ message: "No TOTP setup in progress" });
      if (!verifyTotpCode(secret, code)) return res.status(400).json({ message: "Invalid TOTP code" });

      if (user.mfaPendingSecret) {
        user.mfaTotpSecret = user.mfaPendingSecret;
        user.mfaPendingSecret = undefined;
      }
      user.mfaEnabled = true;
      user.mfaMethods = Array.from(new Set([...(user.mfaMethods || []), "TOTP"]));

      const recoveryCodes = generateRecoveryCodes();
      user.mfaRecoveryCodeHashes = hashRecoveryCodes(recoveryCodes);
      await user.save();

      await writeAuditLog(req, {
        actorId: String(user._id),
        action: "admin.mfa.verified",
        targetType: "User",
        targetId: String(user._id),
        after: { mfaEnabled: true, method: "TOTP" }
      });

      return res.json({ ok: true, method: "TOTP", recoveryCodes });
    }

    const code = String(req.body.code || "");
    const isValid = verifyEmailOtp(code, user.mfaEmailOtpHash, user.mfaEmailOtpExpiresAt);
    if (!isValid) return res.status(400).json({ message: "Invalid or expired email OTP" });

    user.mfaEnabled = true;
    user.mfaMethods = Array.from(new Set([...(user.mfaMethods || []), "EMAIL_OTP"]));
    user.mfaEmailOtpHash = undefined;
    user.mfaEmailOtpExpiresAt = undefined;
    const recoveryCodes = generateRecoveryCodes();
    user.mfaRecoveryCodeHashes = hashRecoveryCodes(recoveryCodes);
    await user.save();

    await writeAuditLog(req, {
      actorId: String(user._id),
      action: "admin.mfa.verified",
      targetType: "User",
      targetId: String(user._id),
      after: { mfaEnabled: true, method: "EMAIL_OTP" }
    });

    return res.json({ ok: true, method: "EMAIL_OTP", recoveryCodes });
  } catch (err) {
    console.error("verifyAdminMfa error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const enterAdminMode = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    const password = String(req.body.password || "");
    const mfaCode = String(req.body.mfaCode || "");
    const recoveryCode = String(req.body.recoveryCode || "");
    const deviceFingerprint =
      String(req.body.deviceFingerprint || parseHeaderValue(req.headers["x-device-fingerprint"])).trim() || undefined;

    if (!password) return res.status(400).json({ message: "password is required" });

    const user = await User.findById(req.user._id);
    if (!user) return respondAuthRequired(req, res);
    if (!isAdminIdentity(user)) return res.status(403).json({ message: "Admin access required" });
    if (!hasApprovedAdminAccess(user)) return res.status(403).json({ message: "Admin access is not approved" });
    if (!user.mfaEnabled) return res.status(403).json({ message: "MFA must be enabled" });

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) return res.status(401).json({ message: "Invalid credentials" });

    const methods = new Set((user.mfaMethods || []).map((method) => String(method).toUpperCase()));
    let mfaOk = false;

    if (methods.has("TOTP") && user.mfaTotpSecret) {
      if (mfaCode && verifyTotpCode(user.mfaTotpSecret, mfaCode)) {
        mfaOk = true;
      } else if (recoveryCode) {
        const consumed = consumeRecoveryCode(recoveryCode, user.mfaRecoveryCodeHashes);
        if (consumed.ok) {
          user.mfaRecoveryCodeHashes = consumed.remaining;
          await user.save();
          mfaOk = true;
        }
      }
    } else if (methods.has("EMAIL_OTP")) {
      mfaOk = verifyEmailOtp(mfaCode, user.mfaEmailOtpHash, user.mfaEmailOtpExpiresAt);
      if (mfaOk) {
        user.mfaEmailOtpHash = undefined;
        user.mfaEmailOtpExpiresAt = undefined;
        await user.save();
      }
    }

    if (!mfaOk) return res.status(401).json({ message: "Invalid MFA credentials" });

    const adminModeUntil = new Date(Date.now() + ADMIN_MODE_TTL_MS);
    const currentSessionId = resolveAdminSessionId(req);
    let session = currentSessionId
      ? await AdminSession.findOne({
          sessionId: currentSessionId,
          userId: user._id,
          revokedAt: null
        })
      : null;

    if (!session) {
      const nextSessionId =
        typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");

      session = await AdminSession.create({
        userId: user._id,
        sessionId: nextSessionId,
        deviceFingerprint,
        ip: resolveIp(req),
        userAgent: String(req.headers["user-agent"] || ""),
        lastSeenAt: new Date(),
        adminModeUntil
      });

      setAdminSessionCookie(res, nextSessionId, true);
    } else {
      session.adminModeUntil = adminModeUntil;
      session.lastSeenAt = new Date();
      if (deviceFingerprint) session.deviceFingerprint = deviceFingerprint;
      session.ip = resolveIp(req);
      session.userAgent = String(req.headers["user-agent"] || "");
      await session.save();
    }

    await writeAuditLog(req, {
      actorId: String(user._id),
      action: "admin.auth.enter",
      targetType: "AdminSession",
      targetId: session.sessionId,
      after: { sessionId: session.sessionId, adminModeUntil, deviceFingerprint }
    });

    return res.json({
      sessionId: session.sessionId,
      adminModeUntil
    });
  } catch (err) {
    console.error("enterAdminMode error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const listAdminSessions = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    if (!req.adminContext) return res.status(500).json({ message: "Admin context missing" });

    const targetUserId = String(req.query.userId || req.user._id);
    if (targetUserId !== req.user._id && req.adminContext.adminLevel !== "PRIMARY") {
      return res.status(403).json({ message: "Only primary can view other admin sessions" });
    }

    const sessions = await AdminSession.find({ userId: targetUserId }).sort({ createdAt: -1 }).lean();
    return res.json({
      items: sessions.map((session) => ({
        sessionId: session.sessionId,
        userId: String(session.userId),
        deviceFingerprint: session.deviceFingerprint || null,
        ip: session.ip || null,
        userAgent: session.userAgent || null,
        lastSeenAt: session.lastSeenAt,
        adminModeUntil: session.adminModeUntil,
        revokedAt: session.revokedAt || null,
        createdAt: session.createdAt
      }))
    });
  } catch (err) {
    console.error("listAdminSessions error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const revokeAdminSession = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    if (!req.adminContext) return res.status(500).json({ message: "Admin context missing" });

    const sessionId = String(req.body.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ message: "sessionId is required" });

    const session = await AdminSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const isPrimary = req.adminContext.adminLevel === "PRIMARY";
    if (!isPrimary && String(session.userId) !== req.user._id) {
      return res.status(403).json({ message: "Cannot revoke another admin session" });
    }

    session.revokedAt = new Date();
    await session.save();

    await writeAuditLog(req, {
      actorId: req.user._id,
      action: "admin.session.revoke",
      targetType: "AdminSession",
      targetId: session.sessionId,
      after: { revokedAt: session.revokedAt }
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("revokeAdminSession error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const revokeAllAdminSessions = async (req: Request, res: Response) => {
  try {
    if (!req.user) return respondAuthRequired(req, res);
    if (!req.adminContext) return res.status(500).json({ message: "Admin context missing" });

    const requestedUserId = String(req.body.userId || "").trim();
    const isPrimary = req.adminContext.adminLevel === "PRIMARY";
    const userId = requestedUserId || req.user._id;
    if (requestedUserId && requestedUserId !== req.user._id && !isPrimary) {
      return res.status(403).json({ message: "Only primary can revoke all sessions for another admin" });
    }

    const result = await AdminSession.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });

    await writeAuditLog(req, {
      actorId: req.user._id,
      action: "admin.session.revoke_all",
      targetType: "User",
      targetId: userId,
      after: { revokedCount: result.modifiedCount }
    });

    return res.json({ ok: true, revokedCount: result.modifiedCount });
  } catch (err) {
    console.error("revokeAllAdminSessions error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
