import mongoose from "mongoose";
import { AdminPermission } from "../models/AdminPermission";
import { AdminRole } from "../models/AdminRole";
import { AdminRolePermission } from "../models/AdminRolePermission";
import { AdminUserRole } from "../models/AdminUserRole";
import { User } from "../models/User";
import {
  ADMIN_PERMISSION_KEYS,
  ADMIN_ROLE_TEMPLATES,
  getPermissionDefinition,
  resolveDefaultAdminRoleNames,
  type AdminDepartment,
  type AdminLevel,
  type AdminPermissionKey
} from "./adminBlueprint";

export const DEFAULT_PERMISSION_KEYS = [...ADMIN_PERMISSION_KEYS] as const;

type SeedRole = {
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
};

const DEFAULT_ROLES: SeedRole[] = ADMIN_ROLE_TEMPLATES.map((template) => ({
  name: template.name,
  description: template.description,
  permissions: template.permissionKeys,
  isSystem: true
}));

export const ensurePermissions = async (keys: string[]) => {
  const uniqueKeys = Array.from(new Set(keys.map((key) => String(key).trim()).filter(Boolean)));
  if (!uniqueKeys.length) return [];

  const existing = await AdminPermission.find({ key: { $in: uniqueKeys } }).lean();
  const existingMap = new Map(existing.map((item) => [item.key, item]));

  const toCreate = uniqueKeys
    .filter((key) => !existingMap.has(key))
    .map((key) => ({
      key,
      description: getPermissionDefinition(key)?.description
    }));

  if (toCreate.length) {
    await AdminPermission.insertMany(toCreate, { ordered: false });
  }

  const updates = uniqueKeys
    .map((key) => {
      const existingPermission = existingMap.get(key);
      const definition = getPermissionDefinition(key);
      if (!existingPermission?._id || !definition?.description) return null;
      if (existingPermission.description === definition.description) return null;
      return {
        updateOne: {
          filter: { _id: existingPermission._id },
          update: { $set: { description: definition.description } }
        }
      };
    })
    .filter(Boolean) as Array<{
    updateOne: {
      filter: { _id: mongoose.Types.ObjectId };
      update: { $set: { description: string } };
    };
  }>;

  if (updates.length) {
    await AdminPermission.bulkWrite(updates, { ordered: false });
  }

  return await AdminPermission.find({ key: { $in: uniqueKeys } });
};

const ensureRoleByName = async (payload: SeedRole) => {
  let role = await AdminRole.findOne({ name: payload.name });
  if (!role) {
    role = await AdminRole.create({
      name: payload.name,
      description: payload.description,
      isSystem: payload.isSystem
    });
    return role;
  }

  const needsUpdate = role.description !== payload.description || role.isSystem !== payload.isSystem;
  if (needsUpdate) {
    role.description = payload.description;
    role.isSystem = payload.isSystem;
    await role.save();
  }

  return role;
};

const syncRolePermissions = async (roleId: mongoose.Types.ObjectId, permissionIds: mongoose.Types.ObjectId[]) => {
  await AdminRolePermission.deleteMany({ roleId });
  if (!permissionIds.length) return;
  await AdminRolePermission.insertMany(
    permissionIds.map((permissionId) => ({
      roleId,
      permissionId
    })),
    { ordered: false }
  );
};

export const ensureDefaultAdminRbac = async () => {
  await ensurePermissions([...DEFAULT_PERMISSION_KEYS]);

  for (const roleConfig of DEFAULT_ROLES) {
    const role = await ensureRoleByName(roleConfig);
    const permissions = await AdminPermission.find({ key: { $in: roleConfig.permissions } }).select("_id").lean();
    await syncRolePermissions(
      role._id,
      permissions.map((item) => item._id)
    );
  }
};

export const assignRoleToUserByName = async (userId: string, roleName: string) => {
  const role = await AdminRole.findOne({ name: roleName }).select("_id");
  if (!role) return null;
  await AdminUserRole.updateOne({ userId, roleId: role._id }, { $setOnInsert: { userId, roleId: role._id } }, { upsert: true });
  return role;
};

export const replaceUserRoles = async (userId: string, roleIds: string[]) => {
  const validRoleIds = roleIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  await AdminUserRole.deleteMany({ userId });
  if (!validRoleIds.length) return;
  await AdminUserRole.insertMany(
    validRoleIds.map((roleId) => ({
      userId: new mongoose.Types.ObjectId(userId),
      roleId
    })),
    { ordered: false }
  );
};

export const assignDefaultAdminRoles = async (
  userId: string,
  adminLevel?: AdminLevel | null,
  department?: AdminDepartment | null
): Promise<string[]> => {
  await ensureDefaultAdminRbac();
  const roleNames = resolveDefaultAdminRoleNames(adminLevel, department);
  const roles = await AdminRole.find({ name: { $in: roleNames } }).select("_id name").lean();
  const roleIds = roles.map((role) => String(role._id));
  await replaceUserRoles(userId, roleIds);
  return roles.map((role) => role.name);
};

export const resolveAdminRoleNames = async (userId: string): Promise<string[]> => {
  const roleBindings = await AdminUserRole.find({ userId }).select("roleId").lean();
  const roleIds = roleBindings.map((item) => item.roleId);
  if (!roleIds.length) return [];

  const roles = await AdminRole.find({ _id: { $in: roleIds } }).select("name").lean();
  return Array.from(
    new Set(
      roles
        .map((role) => String(role.name || "").trim())
        .filter(Boolean)
    )
  ).sort();
};

export const resolveAdminPermissionKeys = async (
  userId: string,
  adminLevel?: AdminLevel | null
): Promise<AdminPermissionKey[]> => {
  if (adminLevel === "PRIMARY") {
    const all = await AdminPermission.find({}).select("key").lean();
    return Array.from(
      new Set(
        all
          .map((item) => String(item.key || "").trim())
          .filter(Boolean)
      )
    ) as AdminPermissionKey[];
  }

  const user = await User.findById(userId).select("adminAssignedPermissions").lean();
  const assignedPermissionKeys = Array.isArray(user?.adminAssignedPermissions)
    ? user.adminAssignedPermissions.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const roleBindings = await AdminUserRole.find({ userId }).select("roleId").lean();
  const roleIds = roleBindings.map((item) => item.roleId);
  if (!roleIds.length) return Array.from(new Set(assignedPermissionKeys)) as AdminPermissionKey[];

  const permissionLinks = await AdminRolePermission.find({ roleId: { $in: roleIds } }).select("permissionId").lean();
  const permissionIds = permissionLinks.map((item) => item.permissionId);
  if (!permissionIds.length) return Array.from(new Set(assignedPermissionKeys)) as AdminPermissionKey[];

  const permissionDocs = await AdminPermission.find({ _id: { $in: permissionIds } }).select("key").lean();
  return Array.from(
    new Set(
      [
        ...permissionDocs
          .map((item) => String(item.key || "").trim())
          .filter(Boolean),
        ...assignedPermissionKeys
      ].filter(Boolean)
    )
  ) as AdminPermissionKey[];
};
