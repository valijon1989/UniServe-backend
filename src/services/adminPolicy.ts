import type { AdminLevel } from "./adminBlueprint";

const ADMIN_LEVEL_RANK: Record<AdminLevel, number> = {
  STAFF: 1,
  MANAGER: 2,
  PRIMARY: 3
};

export const getAdminHierarchyRank = (level?: AdminLevel | null): number => {
  if (!level) return 0;
  return ADMIN_LEVEL_RANK[level] || 0;
};

export const isAdminIdentityRecord = (value: { role?: unknown; isAdmin?: unknown } | null | undefined): boolean => {
  if (!value) return false;
  return String(value.role || "").toUpperCase() === "ADMIN" || Boolean(value.isAdmin);
};

export const canMutateAdminGovernanceTarget = (
  actorLevel?: AdminLevel | null,
  target?: { role?: unknown; isAdmin?: unknown; adminLevel?: AdminLevel | null } | null
): boolean => {
  if (!isAdminIdentityRecord(target)) return true;
  return actorLevel === "PRIMARY" && target?.adminLevel !== "PRIMARY";
};
