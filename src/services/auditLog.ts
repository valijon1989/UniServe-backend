import { Request } from "express";
import { AuditLog } from "../models/AuditLog";

type DiffShape = Record<string, { before: unknown; after: unknown }>;

type WriteAuditPayload = {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  entityType?: string;
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
  meta?: Record<string, unknown>;
};

const toJson = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const normalizeRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
};

const computeDiff = (beforeRaw: unknown, afterRaw: unknown): DiffShape | undefined => {
  const before = normalizeRecord(beforeRaw);
  const after = normalizeRecord(afterRaw);
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const diff: DiffShape = {};

  for (const key of keys) {
    const oldValue = before[key];
    const newValue = after[key];
    if (toJson(oldValue) === toJson(newValue)) continue;
    diff[key] = { before: oldValue, after: newValue };
  }

  return Object.keys(diff).length ? diff : undefined;
};

const resolveIp = (req: Request): string => {
  const xff = req.headers["x-forwarded-for"];
  if (Array.isArray(xff) && xff.length) return String(xff[0]);
  if (typeof xff === "string" && xff.trim()) return xff.split(",")[0].trim();
  return req.ip || "";
};

export const writeAuditLog = async (req: Request, payload: WriteAuditPayload): Promise<void> => {
  if (!payload.actorId || !payload.action) return;

  const diff = computeDiff(payload.before, payload.after);
  await AuditLog.create({
    actorId: payload.actorId,
    actorRole: req.adminContext?.adminLevel || req.user?.role || undefined,
    action: payload.action,
    entityType: payload.entityType || payload.targetType,
    entityId: payload.entityId || payload.targetId,
    targetType: payload.targetType,
    targetId: payload.targetId,
    previousValue: payload.before || null,
    newValue: payload.after || null,
    reason: payload.reason || null,
    diff,
    meta: payload.meta,
    ip: resolveIp(req),
    userAgent: String(req.headers["user-agent"] || ""),
    deviceFingerprint: String(req.headers["x-device-fingerprint"] || "").trim() || undefined
  });
};
