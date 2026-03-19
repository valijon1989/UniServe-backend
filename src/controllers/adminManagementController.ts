import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import { Request, Response } from "express";
import { User, AdminAccessStatus, AdminDepartment, AdminLevel, AdminScope } from "../models/User";
import { AdminInvite } from "../models/AdminInvite";
import { AdminRole } from "../models/AdminRole";
import { AdminPermission } from "../models/AdminPermission";
import { AdminRolePermission } from "../models/AdminRolePermission";
import { AdminUserRole } from "../models/AdminUserRole";
import { AdminSession } from "../models/AdminSession";
import { AuditLog } from "../models/AuditLog";
import { writeAuditLog } from "../services/auditLog";
import { invalidateAuthState } from "../services/authSession";
import {
  ADMIN_PERMISSION_KEYS,
  ADMIN_LEVELS,
  ADMIN_SCOPE_MODULES,
  canonicalizeAdminDepartment,
  getAdminDepartmentStorageValues,
  getPermissionDefinition,
  getRoleTemplate,
  normalizeAdminDepartment,
  resolveDefaultAdminRoleNames
} from "../services/adminBlueprint";
import {
  assignDefaultAdminRoles,
  ensureDefaultAdminRbac,
  ensurePermissions,
  replaceUserRoles,
  resolveAdminRoleNames
} from "../services/adminRbac";
import { canMutateAdminGovernanceTarget } from "../services/adminPolicy";
import { sendEmail } from "../utils/email";
import {
  respondAdminContextMissing,
  respondAuthRequired,
  respondPrimaryAdminRequired,
  respondProtectedAdminTarget,
  respondServerError
} from "../utils/controllerResponses";
import { t } from "../i18n";

const VALID_ADMIN_LEVELS: AdminLevel[] = [...ADMIN_LEVELS];
const VALID_ADMIN_ACCESS_STATUSES: AdminAccessStatus[] = ["PENDING", "APPROVED", "SUSPENDED", "REVOKED"];
const VALID_SCOPE_MODULES = new Set<string>([...ADMIN_SCOPE_MODULES]);
const VALID_ADMIN_PERMISSION_KEYS = new Set<string>([...ADMIN_PERMISSION_KEYS]);

const normalizeText = (value: unknown): string => String(value || "").trim();

const normalizeEmail = (value: unknown): string => String(value || "").trim().toLowerCase();

const hashToken = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");

const formatActorLabel = (value: { name?: unknown; username?: unknown; email?: unknown } | null | undefined): string | null => {
  if (!value) return null;
  const name = normalizeText(value.name);
  if (name) return name;
  const username = normalizeText(value.username);
  if (username) return username;
  const email = normalizeText(value.email);
  return email || null;
};

const normalizeScopes = (value: unknown): AdminScope[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const moduleRaw = normalizeText((item as { module?: unknown }).module).toLowerCase();
      if (!moduleRaw) return null;
      const moduleMap: Record<string, string> = {
        listings: "products",
        products: "products",
        product: "products",
        services: "services",
        service: "services",
        community: "community",
        users: "users",
        user: "users",
        agents: "agents",
        agent: "agents",
        orders: "orders",
        order: "orders",
        payments: "payments",
        payment: "payments",
        "*": "*"
      };
      const moduleName = moduleMap[moduleRaw] || moduleRaw;
      if (!VALID_SCOPE_MODULES.has(moduleName)) return null;
      const region = normalizeText((item as { region?: unknown }).region) || undefined;
      const countryCode = normalizeText((item as { countryCode?: unknown }).countryCode).toUpperCase() || undefined;
      const categoryId = normalizeText((item as { categoryId?: unknown }).categoryId) || undefined;
      const subcategoryId = normalizeText((item as { subcategoryId?: unknown }).subcategoryId) || undefined;
      return {
        module: moduleName as AdminScope["module"],
        region,
        countryCode,
        categoryId,
        subcategoryId
      };
    })
    .filter(Boolean) as AdminScope[];
};

const normalizePermissionKeys = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)));
};

const requirePrimaryGovernanceActor = (req: Request, res: Response): boolean => {
  if (!req.user) {
    respondAuthRequired(req, res);
    return false;
  }
  if (!req.adminContext) {
    respondAdminContextMissing(req, res);
    return false;
  }
  if (req.adminContext.adminLevel !== "PRIMARY") {
    respondPrimaryAdminRequired(req, res);
    return false;
  }
  return true;
};

const ensureManageableAdminTarget = (req: Request, res: Response, target: { role?: unknown; isAdmin?: unknown; adminLevel?: AdminLevel | null }): boolean => {
  if (!canMutateAdminGovernanceTarget(req.adminContext?.adminLevel || null, target)) {
    respondProtectedAdminTarget(req, res);
    return false;
  }
  return true;
};

const normalizeAdminLevel = (value: unknown, fallback: AdminLevel = "STAFF"): AdminLevel => {
  const level = normalizeText(value).toUpperCase() as AdminLevel;
  return VALID_ADMIN_LEVELS.includes(level) ? level : fallback;
};

const normalizeAdminAccessStatus = (
  value: unknown,
  fallback: AdminAccessStatus = "PENDING"
): AdminAccessStatus => {
  const status = normalizeText(value).toUpperCase() as AdminAccessStatus;
  return VALID_ADMIN_ACCESS_STATUSES.includes(status) ? status : fallback;
};

const parseObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
  const id = normalizeText(value);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

const ensurePrimaryExists = async (): Promise<boolean> =>
  Boolean(await User.findOne({ adminLevel: "PRIMARY", adminAccessStatus: "APPROVED" }).select("_id").lean());

const ensureUniqueUsername = async (preferred: string): Promise<string> => {
  const base = preferred.replace(/[^a-z0-9._-]/gi, "").toLowerCase() || `admin${Date.now()}`;
  let username = base;
  let index = 1;
  while (await User.exists({ username })) {
    index += 1;
    username = `${base}${index}`;
  }
  return username;
};

const sanitizeAdminUser = (user: any) => ({
  _id: String(user._id),
  email: user.email,
  username: user.username,
  name: user.name,
  role: user.role,
  isAdmin: Boolean(user.isAdmin),
  adminLevel: user.adminLevel || null,
  adminAccessStatus: user.adminAccessStatus || null,
  adminApprovedBy: user.adminApprovedBy ? String(user.adminApprovedBy) : null,
  adminApprovedAt: user.adminApprovedAt || null,
  approvedBy: user.adminApprovedBy ? String(user.adminApprovedBy) : null,
  approvedByName: user.approvedByName || null,
  approvedAt: user.adminApprovedAt || null,
  department: canonicalizeAdminDepartment(user.department),
  position: user.position || null,
  departmentId: user.departmentId ? String(user.departmentId) : null,
  positionId: user.positionId ? String(user.positionId) : null,
  adminScopes: Array.isArray(user.adminScopes) ? user.adminScopes : [],
  assignedPermissionKeys: Array.isArray(user.assignedPermissionKeys)
    ? user.assignedPermissionKeys
    : Array.isArray(user.adminAssignedPermissions)
      ? user.adminAssignedPermissions
      : [],
  roleNames: Array.isArray(user.roleNames) ? user.roleNames : [],
  permissionKeys: Array.isArray(user.permissionKeys) ? user.permissionKeys : [],
  recommendedRoleNames: resolveDefaultAdminRoleNames(user.adminLevel, user.department),
  mfaEnabled: Boolean(user.mfaEnabled),
  mfaMethods: Array.isArray(user.mfaMethods) ? user.mfaMethods : [],
  invitedAt: user.invitedAt || null,
  invitedBy: user.invitedBy ? String(user.invitedBy) : null,
  invitedByName: user.invitedByName || null,
  createdBy: user.createdBy ? String(user.createdBy) : user.invitedBy ? String(user.invitedBy) : null,
  createdByName: user.createdByName || user.invitedByName || null,
  lastActivityAt: user.lastActivityAt || null,
  adminModeUntil: user.adminModeUntil || null,
  adminModeActive: Boolean(user.adminModeActive),
  activeSessionCount: Number(user.activeSessionCount || 0),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const listAdmins = async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {
      $or: [{ role: "ADMIN" }, { isAdmin: true }]
    };

    const departmentId = parseObjectId(req.query.departmentId);
    if (departmentId) filter.departmentId = departmentId;
    const departmentValues = getAdminDepartmentStorageValues(req.query.department);
    if (departmentValues.length) filter.department = { $in: departmentValues };

    const status = normalizeText(req.query.status).toUpperCase();
    if (["PENDING", "APPROVED", "SUSPENDED", "REVOKED"].includes(status)) {
      filter.adminAccessStatus = status;
    }

    const users = await User.find(filter)
      .select(
        "email username name role isAdmin adminLevel adminAccessStatus adminApprovedBy adminApprovedAt department position departmentId positionId adminScopes adminAssignedPermissions mfaEnabled mfaMethods createdAt updatedAt"
      )
      .sort({ updatedAt: -1 })
      .lean();

    const userIds = users.map((user) => user._id);
    const roleBindings = userIds.length
      ? await AdminUserRole.find({ userId: { $in: userIds } }).select("userId roleId").lean()
      : [];
    const roleIds = Array.from(new Set(roleBindings.map((item) => String(item.roleId))));
    const roles = roleIds.length ? await AdminRole.find({ _id: { $in: roleIds } }).select("name").lean() : [];
    const rolePermissionLinks = roleIds.length
      ? await AdminRolePermission.find({ roleId: { $in: roleIds } }).select("roleId permissionId").lean()
      : [];
    const permissionIds = Array.from(new Set(rolePermissionLinks.map((item) => String(item.permissionId))));
    const permissionDocs = permissionIds.length
      ? await AdminPermission.find({ _id: { $in: permissionIds } }).select("key").lean()
      : [];
    const activeSessions = userIds.length
      ? await AdminSession.find({ userId: { $in: userIds }, revokedAt: null })
          .select("userId lastSeenAt adminModeUntil")
          .sort({ lastSeenAt: -1 })
          .lean()
      : [];
    const emails = users.map((user) => normalizeEmail(user.email));
    const invites = emails.length || userIds.length
      ? await AdminInvite.find({
          $or: [
            { userId: { $in: userIds } },
            { email: { $in: emails } }
          ]
        })
          .select("userId email invitedBy createdAt")
          .sort({ createdAt: -1 })
          .lean()
      : [];
    const roleNameById = new Map(roles.map((role) => [String(role._id), role.name]));
    const permissionKeyById = new Map(permissionDocs.map((permission) => [String(permission._id), permission.key]));
    const permissionKeysByRoleId = new Map<string, string[]>();
    const roleNamesByUserId = new Map<string, string[]>();
    const permissionKeysByUserId = new Map<string, string[]>();
    const latestSessionByUserId = new Map<string, { lastSeenAt?: Date | null; adminModeUntil?: Date | null }>();
    const activeSessionCountByUserId = new Map<string, number>();
    const inviteByUserId = new Map<string, (typeof invites)[number]>();
    const inviteByEmail = new Map<string, (typeof invites)[number]>();

    for (const link of rolePermissionLinks) {
      const roleId = String(link.roleId);
      const permissionKey = permissionKeyById.get(String(link.permissionId));
      if (!permissionKey) continue;
      const current = permissionKeysByRoleId.get(roleId) || [];
      current.push(permissionKey);
      permissionKeysByRoleId.set(roleId, current);
    }

    for (const binding of roleBindings) {
      const userId = String(binding.userId);
      const roleId = String(binding.roleId);
      const roleName = roleNameById.get(String(binding.roleId));
      if (!roleName) continue;
      const current = roleNamesByUserId.get(userId) || [];
      current.push(roleName);
      roleNamesByUserId.set(userId, current);

      const permissionKeys = permissionKeysByRoleId.get(roleId) || [];
      if (permissionKeys.length) {
        const currentPermissionKeys = permissionKeysByUserId.get(userId) || [];
        currentPermissionKeys.push(...permissionKeys);
        permissionKeysByUserId.set(userId, currentPermissionKeys);
      }
    }

    for (const session of activeSessions) {
      const userId = String(session.userId);
      activeSessionCountByUserId.set(userId, (activeSessionCountByUserId.get(userId) || 0) + 1);
      if (!latestSessionByUserId.has(userId)) {
        latestSessionByUserId.set(userId, {
          lastSeenAt: session.lastSeenAt || null,
          adminModeUntil: session.adminModeUntil || null
        });
      }
    }

    for (const invite of invites) {
      const userId = invite.userId ? String(invite.userId) : "";
      const email = normalizeEmail(invite.email);
      if (userId && !inviteByUserId.has(userId)) {
        inviteByUserId.set(userId, invite);
      }
      if (email && !inviteByEmail.has(email)) {
        inviteByEmail.set(email, invite);
      }
    }

    const auditActorIds = Array.from(
      new Set(
        [
          ...users.map((user) => (user.adminApprovedBy ? String(user.adminApprovedBy) : "")),
          ...invites.map((invite) => (invite.invitedBy ? String(invite.invitedBy) : ""))
        ].filter(Boolean)
      )
    ).map((id) => new mongoose.Types.ObjectId(id));
    const auditActors = auditActorIds.length
      ? await User.find({ _id: { $in: auditActorIds } }).select("name username email").lean()
      : [];
    const auditActorLabelById = new Map(auditActors.map((actor) => [String(actor._id), formatActorLabel(actor)]));

    return res.json({
      items: users.map((user) =>
        sanitizeAdminUser({
          ...user,
          roleNames: Array.from(new Set(roleNamesByUserId.get(String(user._id)) || [])).sort(),
          assignedPermissionKeys: Array.from(new Set((user.adminAssignedPermissions || []).map((item) => String(item)))).sort(),
          permissionKeys:
            user.adminLevel === "PRIMARY"
              ? [...ADMIN_PERMISSION_KEYS]
              : Array.from(
                  new Set([
                    ...(permissionKeysByUserId.get(String(user._id)) || []),
                    ...((user.adminAssignedPermissions || []).map((item) => String(item)))
                  ])
                ).sort(),
          approvedByName: user.adminApprovedBy ? auditActorLabelById.get(String(user.adminApprovedBy)) || null : null,
          ...(inviteByUserId.get(String(user._id)) || inviteByEmail.get(normalizeEmail(user.email))
            ? (() => {
                const invite = inviteByUserId.get(String(user._id)) || inviteByEmail.get(normalizeEmail(user.email));
                const invitedBy = invite?.invitedBy ? String(invite.invitedBy) : null;
                return {
                  invitedAt: invite?.createdAt || null,
                  invitedBy,
                  invitedByName: invitedBy ? auditActorLabelById.get(invitedBy) || null : null,
                  createdBy: invitedBy,
                  createdByName: invitedBy ? auditActorLabelById.get(invitedBy) || null : null
                };
              })()
            : {}),
          ...(latestSessionByUserId.get(String(user._id))
            ? {
                lastActivityAt: latestSessionByUserId.get(String(user._id))?.lastSeenAt || null,
                adminModeUntil: latestSessionByUserId.get(String(user._id))?.adminModeUntil || null,
                adminModeActive:
                  Boolean(latestSessionByUserId.get(String(user._id))?.adminModeUntil) &&
                  new Date(String(latestSessionByUserId.get(String(user._id))?.adminModeUntil)).getTime() > Date.now(),
                activeSessionCount: activeSessionCountByUserId.get(String(user._id)) || 0
              }
            : {
                lastActivityAt: null,
                adminModeUntil: null,
                adminModeActive: false,
                activeSessionCount: 0
              })
        })
      )
    });
  } catch (err) {
    console.error("listAdmins error", err);
    return respondServerError(req, res);
  }
};

export const inviteAdmin = async (req: Request, res: Response) => {
  try {
    if (!requirePrimaryGovernanceActor(req, res)) return;

    const hasPrimary = await ensurePrimaryExists();
    if (!hasPrimary) return res.status(400).json({ message: "Primary admin is required before inviting admins" });

    const email = normalizeEmail(req.body.email);
    const userId = parseObjectId(req.body.userId);
    const adminLevel = normalizeAdminLevel(req.body.adminLevel, "STAFF");
    const departmentId = parseObjectId(req.body.departmentId);
    const positionId = parseObjectId(req.body.positionId);
    const department = normalizeAdminDepartment(req.body.department) as AdminDepartment | undefined;
    const position = normalizeText(req.body.position) || undefined;
    const scopes = normalizeScopes(req.body.scopes);

    if (!email && !userId) {
      return res.status(400).json({ message: "email or userId is required" });
    }
    if (adminLevel === "PRIMARY") {
      return res.status(400).json({ message: "PRIMARY level cannot be invited" });
    }

    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const invite = await AdminInvite.create({
      email: email || undefined,
      userId: userId || undefined,
      invitedBy: req.user!._id,
      status: "PENDING",
      tokenHash,
      expiresAt,
      requestedAdminLevel: adminLevel,
      requestedDepartment: department || undefined,
      requestedPosition: position || undefined,
      requestedDepartmentId: departmentId || null,
      requestedPositionId: positionId || null,
      requestedScopes: scopes
    });

    if (email) {
      await sendEmail(
        email,
        "UniServe admin invitation",
        `Use this invite token to accept admin invite: ${token}\nExpires at: ${expiresAt.toISOString()}`
      );
    }

    await writeAuditLog(req, {
      actorId: req.user!._id,
      action: "admin.invite.create",
      targetType: "AdminInvite",
      targetId: String(invite._id),
      after: {
        email: invite.email || null,
        userId: invite.userId ? String(invite.userId) : null,
        requestedAdminLevel: invite.requestedAdminLevel,
        requestedDepartment: invite.requestedDepartment || null,
        requestedPosition: invite.requestedPosition || null,
        requestedDepartmentId: invite.requestedDepartmentId ? String(invite.requestedDepartmentId) : null,
        requestedPositionId: invite.requestedPositionId ? String(invite.requestedPositionId) : null
      }
    });

    return res.status(201).json({
      inviteId: String(invite._id),
      expiresAt,
      ...(process.env.NODE_ENV !== "production" ? { inviteToken: token } : {})
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Invite token collision, retry request" });
    }
    console.error("inviteAdmin error", err);
    return respondServerError(req, res);
  }
};

export const acceptAdminInvite = async (req: Request, res: Response) => {
  try {
    const token = normalizeText(req.body.token);
    if (!token) return res.status(400).json({ message: "token is required" });
    const tokenHash = hashToken(token);

    const invite = await AdminInvite.findOne({
      tokenHash,
      status: "PENDING",
      expiresAt: { $gt: new Date() }
    });
    if (!invite) return res.status(404).json({ message: "Invite not found or expired" });

    let user = invite.userId ? await User.findById(invite.userId) : null;
    if (!user && invite.email) {
      user = await User.findOne({ email: invite.email });
    }

    if (!user) {
      const email = normalizeEmail(req.body.email || invite.email);
      const password = String(req.body.password || "");
      const name = normalizeText(req.body.name);
      const preferredUsername = normalizeText(req.body.username || email.split("@")[0] || "admin");
      if (!email || !password || !name) {
        return res.status(400).json({ message: "email, password and name are required for new admin user" });
      }
      const username = await ensureUniqueUsername(preferredUsername);
      user = await User.create({
        email,
        passwordHash: await bcrypt.hash(password, 10),
        name,
        username,
        role: "USER",
        isAdmin: true,
        adminAccessStatus: "PENDING",
        adminLevel: invite.requestedAdminLevel,
        department: invite.requestedDepartment || undefined,
        position: invite.requestedPosition || undefined,
        departmentId: invite.requestedDepartmentId || null,
        positionId: invite.requestedPositionId || null,
        adminScopes: invite.requestedScopes || [],
        mfaEnabled: false,
        mfaMethods: []
      });
    } else {
      user.isAdmin = true;
      user.adminAccessStatus = "PENDING";
      user.adminLevel = invite.requestedAdminLevel;
      user.department = invite.requestedDepartment || null;
      user.position = invite.requestedPosition || null;
      user.departmentId = invite.requestedDepartmentId || null;
      user.positionId = invite.requestedPositionId || null;
      user.adminScopes = invite.requestedScopes || [];
      await user.save();
    }

    invite.userId = user._id;
    invite.status = "ACCEPTED";
    invite.acceptedAt = new Date();
    await invite.save();

    await writeAuditLog(req, {
      actorId: String(user._id),
      action: "admin.invite.accept",
      targetType: "AdminInvite",
      targetId: String(invite._id),
      after: {
        userId: String(user._id),
        status: invite.status
      }
    });

    return res.json({
      userId: String(user._id),
      adminAccessStatus: user.adminAccessStatus
    });
  } catch (err) {
    console.error("acceptAdminInvite error", err);
    return respondServerError(req, res);
  }
};

export const approveAdmin = async (req: Request, res: Response) => {
  try {
    if (!requirePrimaryGovernanceActor(req, res)) return;

    const userId = parseObjectId(req.body.userId);
    if (!userId) return res.status(400).json({ message: "Valid userId is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: t(req, "users.profile.lookup.not_found.message") });
    if (!user.isAdmin) {
      return res.status(400).json({ message: "User is not an admin candidate" });
    }

    const before = sanitizeAdminUser(user);
    const requestedLevelProvided = req.body.level !== undefined || req.body.adminLevel !== undefined;
    const requestedRoleNames: string[] = Array.isArray(req.body.roleNames)
      ? req.body.roleNames.map((value: unknown) => normalizeText(value)).filter(Boolean)
      : [];
    let requestedLevel = normalizeAdminLevel(req.body.level || req.body.adminLevel, user.adminLevel || "STAFF");
    if (!requestedLevelProvided && requestedRoleNames.length) {
      if (requestedRoleNames.some((name: string) => getRoleTemplate(name)?.adminLevel === "PRIMARY")) {
        requestedLevel = "PRIMARY";
      } else if (requestedRoleNames.some((name: string) => getRoleTemplate(name)?.adminLevel === "MANAGER")) {
        requestedLevel = "MANAGER";
      } else {
        requestedLevel = "STAFF";
      }
    }
    if (requestedLevel === "PRIMARY" && user.adminLevel !== "PRIMARY") {
      return res.status(400).json({ message: "PRIMARY level cannot be assigned via approval flow" });
    }
    if (requestedRoleNames.includes("PRIMARY_ROLE") && user.adminLevel !== "PRIMARY") {
      return res.status(400).json({ message: "PRIMARY_ROLE cannot be assigned to helper admins" });
    }

    user.isAdmin = true;
    user.adminAccessStatus = "APPROVED";
    user.adminApprovedBy = new mongoose.Types.ObjectId(req.user!._id);
    user.adminApprovedAt = new Date();
    user.adminLevel = requestedLevel || user.adminLevel || "STAFF";
    await user.save();

    await ensureDefaultAdminRbac();
    const roleIdsInput = Array.isArray(req.body.roleIds) ? req.body.roleIds.map((value: unknown) => String(value)) : [];
    let assignedRoleNames: string[] = [];
    if (roleIdsInput.length) {
      await replaceUserRoles(String(user._id), roleIdsInput);
      assignedRoleNames = await resolveAdminRoleNames(String(user._id));
    } else if (Array.isArray(req.body.roleNames) && req.body.roleNames.length) {
      const roleNames = req.body.roleNames.map((value: unknown) => normalizeText(value)).filter(Boolean);
      const roles = await AdminRole.find({ name: { $in: roleNames } }).select("_id").lean();
      await replaceUserRoles(
        String(user._id),
        roles.map((role) => String(role._id))
      );
      assignedRoleNames = await resolveAdminRoleNames(String(user._id));
    } else {
      assignedRoleNames = await assignDefaultAdminRoles(String(user._id), user.adminLevel, user.department || null);
    }

    const invite = await AdminInvite.findOne({ userId: user._id, status: "ACCEPTED" }).sort({ updatedAt: -1 });
    if (invite) {
      invite.approvedBy = new mongoose.Types.ObjectId(req.user!._id);
      invite.approvedAt = new Date();
      await invite.save();
    }

    await writeAuditLog(req, {
      actorId: req.user!._id,
      action: "admin.approve",
      targetType: "User",
      targetId: String(user._id),
      before,
      after: sanitizeAdminUser({ ...user.toObject(), roleNames: assignedRoleNames })
    });

    return res.json({ user: sanitizeAdminUser({ ...user.toObject(), roleNames: assignedRoleNames }) });
  } catch (err) {
    console.error("approveAdmin error", err);
    return respondServerError(req, res);
  }
};

export const revokeAdmin = async (req: Request, res: Response) => {
  try {
    if (!requirePrimaryGovernanceActor(req, res)) return;

    const userId = parseObjectId(req.body.userId);
    if (!userId) return res.status(400).json({ message: "Valid userId is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: t(req, "users.profile.lookup.not_found.message") });
    if (!ensureManageableAdminTarget(req, res, user)) return;

    const nextStatus = normalizeAdminAccessStatus(req.body.status, "REVOKED");
    if (nextStatus !== "SUSPENDED" && nextStatus !== "REVOKED") {
      return res.status(400).json({ message: "status must be SUSPENDED or REVOKED" });
    }

    const before = sanitizeAdminUser(user);
    user.adminAccessStatus = nextStatus;
    await user.save();

    await invalidateAuthState({ userId: String(user._id) });

    const action = nextStatus === "SUSPENDED" ? "admin.suspend" : "admin.revoke";

    await writeAuditLog(req, {
      actorId: req.user!._id,
      action,
      targetType: "User",
      targetId: String(user._id),
      before,
      after: sanitizeAdminUser(user),
      reason: normalizeText(req.body.reason) || undefined,
      meta: {
        reason: normalizeText(req.body.reason) || undefined,
        status: nextStatus
      }
    });

    return res.json({ user: sanitizeAdminUser(user) });
  } catch (err) {
    console.error("revokeAdmin error", err);
    return respondServerError(req, res);
  }
};

export const updateAdminRoles = async (req: Request, res: Response) => {
  try {
    if (!requirePrimaryGovernanceActor(req, res)) return;
    const targetId = parseObjectId(req.params.id);
    if (!targetId) return res.status(400).json({ message: "Invalid admin id" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Admin user not found" });
    if (!ensureManageableAdminTarget(req, res, target)) return;

    const requestedLevelProvided = req.body.level !== undefined || req.body.adminLevel !== undefined;
    let requestedLevel = normalizeAdminLevel(
      req.body.level || req.body.adminLevel,
      target.adminLevel || "STAFF"
    );

    const roleIdsInput = Array.isArray(req.body.roleIds) ? req.body.roleIds.map((value: unknown) => String(value)) : [];
    let roleIds = roleIdsInput;
    let resolvedRoleNames: string[] = [];

    if (roleIdsInput.length) {
      const roles = await AdminRole.find({ _id: { $in: roleIdsInput } }).select("name").lean();
      resolvedRoleNames = roles.map((role) => role.name).filter(Boolean);
    }

    if (!roleIds.length && Array.isArray(req.body.roleNames)) {
      const names = req.body.roleNames.map((value: unknown) => normalizeText(value)).filter(Boolean);
      resolvedRoleNames = names;
      if (names.length) {
        const roles = await AdminRole.find({ name: { $in: names } }).select("_id").lean();
        roleIds = roles.map((item) => String(item._id));
      }
    }

    if (resolvedRoleNames.includes("PRIMARY_ROLE") && target.adminLevel !== "PRIMARY") {
      return res.status(400).json({ message: "PRIMARY_ROLE cannot be assigned to helper admins" });
    }

    if (!requestedLevelProvided && resolvedRoleNames.length) {
      if (resolvedRoleNames.some((name) => getRoleTemplate(name)?.adminLevel === "PRIMARY")) {
        requestedLevel = "PRIMARY";
      } else if (resolvedRoleNames.some((name) => getRoleTemplate(name)?.adminLevel === "MANAGER")) {
        requestedLevel = "MANAGER";
      } else {
        requestedLevel = "STAFF";
      }
    }

    if (requestedLevel === "PRIMARY" && target.adminLevel !== "PRIMARY") {
      return res.status(400).json({ message: "PRIMARY level cannot be assigned via role update" });
    }

    const beforeRoleNames = await resolveAdminRoleNames(String(target._id));
    const beforeLevel = target.adminLevel || null;

    if (!roleIds.length) {
      if (!requestedLevelProvided) {
        return res.status(400).json({ message: "roleIds, roleNames, or level are required" });
      }
      await assignDefaultAdminRoles(String(target._id), requestedLevel, target.department || null);
    }

    if (roleIds.length) {
      await replaceUserRoles(String(target._id), roleIds);
    }

    target.adminLevel = requestedLevel;
    await target.save();

    const afterRoleNames = await resolveAdminRoleNames(String(target._id));

    await writeAuditLog(req, {
      actorId: req.user!._id,
      action: "admin.roles.update",
      targetType: "User",
      targetId: String(target._id),
      before: { roles: beforeRoleNames, adminLevel: beforeLevel },
      after: { roles: afterRoleNames, adminLevel: target.adminLevel }
    });

    return res.json({ userId: String(target._id), roles: afterRoleNames, adminLevel: target.adminLevel });
  } catch (err) {
    console.error("updateAdminRoles error", err);
    return respondServerError(req, res);
  }
};

export const updateAdminScopes = async (req: Request, res: Response) => {
  try {
    if (!requirePrimaryGovernanceActor(req, res)) return;
    const targetId = parseObjectId(req.params.id);
    if (!targetId) return res.status(400).json({ message: "Invalid admin id" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Admin user not found" });
    if (!ensureManageableAdminTarget(req, res, target)) return;

    const scopes = normalizeScopes(req.body.scopes);
    const before = { adminScopes: target.adminScopes || [] };
    target.adminScopes = scopes;
    await target.save();

    await writeAuditLog(req, {
      actorId: req.user!._id,
      action: "admin.scopes.update",
      targetType: "User",
      targetId: String(target._id),
      before,
      after: { adminScopes: target.adminScopes }
    });

    return res.json({ userId: String(target._id), adminScopes: target.adminScopes });
  } catch (err) {
    console.error("updateAdminScopes error", err);
    return respondServerError(req, res);
  }
};

export const updateAdminDepartmentPosition = async (req: Request, res: Response) => {
  try {
    if (!requirePrimaryGovernanceActor(req, res)) return;
    const targetId = parseObjectId(req.params.id);
    if (!targetId) return res.status(400).json({ message: "Invalid admin id" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Admin user not found" });
    if (!ensureManageableAdminTarget(req, res, target)) return;

    const before = {
      department: target.department || null,
      position: target.position || null,
      departmentId: target.departmentId ? String(target.departmentId) : null,
      positionId: target.positionId ? String(target.positionId) : null
    };

    const department = normalizeAdminDepartment(req.body.department) as AdminDepartment | undefined;
    const position = normalizeText(req.body.position) || undefined;
    const departmentId = parseObjectId(req.body.departmentId);
    const positionId = parseObjectId(req.body.positionId);
    if (req.body.department !== undefined) target.department = department || null;
    if (req.body.position !== undefined) target.position = position || null;
    target.departmentId = departmentId;
    target.positionId = positionId;
    await target.save();

    await writeAuditLog(req, {
      actorId: req.user!._id,
      action: "admin.department_position.update",
      targetType: "User",
      targetId: String(target._id),
      before,
      after: {
        department: canonicalizeAdminDepartment(target.department),
        position: target.position || null,
        departmentId: target.departmentId ? String(target.departmentId) : null,
        positionId: target.positionId ? String(target.positionId) : null
      }
    });

    return res.json({ user: sanitizeAdminUser(target) });
  } catch (err) {
    console.error("updateAdminDepartmentPosition error", err);
    return respondServerError(req, res);
  }
};

const expandRoleWithPermissions = async (roles: any[]) => {
  const roleIds = roles.map((role) => role._id);
  const links = await AdminRolePermission.find({ roleId: { $in: roleIds } }).lean();
  const permissionIds = Array.from(new Set(links.map((item) => String(item.permissionId))));
  const permissions = await AdminPermission.find({ _id: { $in: permissionIds } }).lean();
  const permMap = new Map(permissions.map((permission) => [String(permission._id), permission.key]));

  const grouped = new Map<string, string[]>();
  for (const link of links) {
    const key = String(link.roleId);
    const permissionKey = permMap.get(String(link.permissionId));
    if (!permissionKey) continue;
    const existing = grouped.get(key) || [];
    existing.push(permissionKey);
    grouped.set(key, existing);
  }

  return roles.map((role) => ({
    _id: String(role._id),
    name: role.name,
    label: getRoleTemplate(role.name)?.label || role.name,
    description: role.description || "",
    isSystem: Boolean(role.isSystem),
    adminLevel: getRoleTemplate(role.name)?.adminLevel || null,
    departments: getRoleTemplate(role.name)?.departments || [],
    permissions: Array.from(new Set(grouped.get(String(role._id)) || [])).sort(),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt
  }));
};

export const getRoles = async (req: Request, res: Response) => {
  try {
    await ensureDefaultAdminRbac();
    const roles = await AdminRole.find({}).sort({ name: 1 }).lean();
    return res.json({ items: await expandRoleWithPermissions(roles) });
  } catch (err) {
    console.error("getRoles error", err);
    return respondServerError(req, res);
  }
};

export const createRole = async (req: Request, res: Response) => {
  try {
    if (!requirePrimaryGovernanceActor(req, res)) return;
    const name = normalizeText(req.body.name);
    if (!name) return res.status(400).json({ message: "name is required" });

    const description = normalizeText(req.body.description);
    const permissionKeys = normalizePermissionKeys(req.body.permissionKeys);
    const invalidPermissionKeys = permissionKeys.filter((key) => !VALID_ADMIN_PERMISSION_KEYS.has(key));
    if (invalidPermissionKeys.length) {
      return res.status(400).json({ message: "Unknown permission keys supplied", invalidPermissionKeys });
    }

    const role = await AdminRole.create({
      name,
      description: description || undefined,
      isSystem: false
    });

    const permissions = await ensurePermissions(permissionKeys);
    if (permissions.length) {
      await AdminRolePermission.insertMany(
        permissions.map((permission) => ({
          roleId: role._id,
          permissionId: permission._id
        })),
        { ordered: false }
      );
    }

    await writeAuditLog(req, {
      actorId: req.user!._id,
      action: "admin.role.create",
      targetType: "AdminRole",
      targetId: String(role._id),
      after: { name: role.name, permissionKeys }
    });

    return res.status(201).json({ role: { _id: String(role._id), name: role.name, description: role.description || "" } });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Role name already exists" });
    }
    console.error("createRole error", err);
    return respondServerError(req, res);
  }
};

export const updateRole = async (req: Request, res: Response) => {
  try {
    if (!requirePrimaryGovernanceActor(req, res)) return;
    const roleId = parseObjectId(req.params.id);
    if (!roleId) return res.status(400).json({ message: "Invalid role id" });

    const role = await AdminRole.findById(roleId);
    if (!role) return res.status(404).json({ message: "Role not found" });

    const before = {
      name: role.name,
      description: role.description || ""
    };

    if (req.body.name !== undefined) {
      const nextName = normalizeText(req.body.name);
      if (!nextName) return res.status(400).json({ message: "name cannot be empty" });
      role.name = nextName;
    }
    if (req.body.description !== undefined) {
      role.description = normalizeText(req.body.description) || undefined;
    }
    await role.save();

    if (Array.isArray(req.body.permissionKeys)) {
      const permissionKeys = normalizePermissionKeys(req.body.permissionKeys);
      const invalidPermissionKeys = permissionKeys.filter((key) => !VALID_ADMIN_PERMISSION_KEYS.has(key));
      if (invalidPermissionKeys.length) {
        return res.status(400).json({ message: "Unknown permission keys supplied", invalidPermissionKeys });
      }
      const permissions = await ensurePermissions(permissionKeys);
      await AdminRolePermission.deleteMany({ roleId: role._id });
      if (permissions.length) {
        await AdminRolePermission.insertMany(
          permissions.map((permission) => ({
            roleId: role._id,
            permissionId: permission._id
          })),
          { ordered: false }
        );
      }
    }

    await writeAuditLog(req, {
      actorId: req.user!._id,
      action: "admin.role.update",
      targetType: "AdminRole",
      targetId: String(role._id),
      before,
      after: {
        name: role.name,
        description: role.description || ""
      }
    });

    return res.json({ role: { _id: String(role._id), name: role.name, description: role.description || "" } });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Role name already exists" });
    }
    console.error("updateRole error", err);
    return respondServerError(req, res);
  }
};

export const updateAdminAssignedPermissions = async (req: Request, res: Response) => {
  try {
    if (!requirePrimaryGovernanceActor(req, res)) return;
    const targetId = parseObjectId(req.params.id);
    if (!targetId) return res.status(400).json({ message: "Invalid admin id" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "Admin user not found" });
    if (!ensureManageableAdminTarget(req, res, target)) return;

    const permissionKeys = normalizePermissionKeys(req.body.permissionKeys);
    const invalidPermissionKeys = permissionKeys.filter((key) => !VALID_ADMIN_PERMISSION_KEYS.has(key));
    if (invalidPermissionKeys.length) {
      return res.status(400).json({
        message: "Unknown permission keys supplied",
        invalidPermissionKeys
      });
    }

    const before = Array.isArray(target.adminAssignedPermissions)
      ? target.adminAssignedPermissions.map((item) => String(item)).sort()
      : [];
    target.adminAssignedPermissions = permissionKeys as any;
    await target.save();

    await writeAuditLog(req, {
      actorId: req.user!._id,
      action: "admin.permissions.update",
      entityType: "User",
      entityId: String(target._id),
      targetType: "User",
      targetId: String(target._id),
      before: { assignedPermissionKeys: before },
      after: { assignedPermissionKeys: permissionKeys },
      reason: normalizeText(req.body.reason) || undefined
    });

    return res.json({
      userId: String(target._id),
      assignedPermissionKeys: permissionKeys
    });
  } catch (err) {
    console.error("updateAdminAssignedPermissions error", err);
    return respondServerError(req, res);
  }
};

export const getPermissions = async (req: Request, res: Response) => {
  try {
    await ensureDefaultAdminRbac();
    const permissions = await AdminPermission.find({}).sort({ key: 1 }).lean();
    return res.json({
      items: permissions.map((permission) => ({
        _id: String(permission._id),
        key: permission.key,
        label: getPermissionDefinition(permission.key)?.label || permission.key,
        group: getPermissionDefinition(permission.key)?.group || "core",
        groupLabel: getPermissionDefinition(permission.key)?.groupLabel || "Core",
        critical: Boolean(getPermissionDefinition(permission.key)?.critical),
        legacy: Boolean(getPermissionDefinition(permission.key)?.legacy),
        description: permission.description || getPermissionDefinition(permission.key)?.description || ""
      }))
    });
  } catch (err) {
    console.error("getPermissions error", err);
    return respondServerError(req, res);
  }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    const actorId = parseObjectId(req.query.actor || req.query.actorId || req.query.adminId);
    if (actorId) filter.actorId = actorId;

    const action = normalizeText(req.query.action);
    if (action) filter.action = action;

    const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
    const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom && !Number.isNaN(dateFrom.getTime())) (filter.createdAt as any).$gte = dateFrom;
      if (dateTo && !Number.isNaN(dateTo.getTime())) (filter.createdAt as any).$lte = dateTo;
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter)
    ]);

    const actorIds = Array.from(
      new Set(items.map((item) => String(item.actorId || "")).filter(Boolean))
    ).map((id) => new mongoose.Types.ObjectId(id));
    const actors = actorIds.length ? await User.find({ _id: { $in: actorIds } }).select("name username email").lean() : [];
    const actorLabelById = new Map(actors.map((actor) => [String(actor._id), formatActorLabel(actor)]));

    return res.json({
      items: items.map((item) => ({
        _id: String(item._id),
        actorId: String(item.actorId),
        actorName: actorLabelById.get(String(item.actorId)) || null,
        actorRole: item.actorRole || null,
        action: item.action,
        entityType: item.entityType || item.targetType || null,
        entityId: item.entityId || item.targetId || null,
        reason: item.reason || null,
        previousValue: item.previousValue || item.diff?.before || null,
        newValue: item.newValue || item.diff?.after || null,
        targetType: item.targetType || null,
        targetId: item.targetId || null,
        diff: item.diff || null,
        ip: item.ip || null,
        userAgent: item.userAgent || null,
        meta: item.meta || null,
        createdAt: item.createdAt
      })),
      page,
      limit,
      total
    });
  } catch (err) {
    console.error("getAuditLogs error", err);
    return respondServerError(req, res);
  }
};
