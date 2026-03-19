import { resolveAvatarUrl } from "./avatarImage";

type GenericRecord = Record<string, unknown>;

const SECRET_USER_FIELDS = new Set([
  "passwordHash",
  "password",
  "tokenVersion",
  "resetToken",
  "resetPasswordToken",
  "resetPasswordExpires",
  "resetPasswordTokenHash",
  "resetPasswordExpiresAt",
  "emailVerificationToken",
  "emailVerificationCode",
  "twoFactorSecret",
  "twoFactorRecoveryCodes",
  "mfaTotpSecret",
  "mfaPendingSecret",
  "mfaRecoveryCodeHashes",
  "mfaEmailOtpHash",
  "mfaEmailOtpExpiresAt",
  "__v"
]);

const toPlainObject = (value: unknown): GenericRecord | null => {
  if (!value || typeof value !== "object") return null;
  if (typeof (value as { toObject?: () => GenericRecord }).toObject === "function") {
    return (value as { toObject: () => GenericRecord }).toObject();
  }
  return { ...(value as GenericRecord) };
};

const normalizeId = (value: unknown): string | unknown => {
  if (!value) return value;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof (value as { toString?: () => string }).toString === "function") {
    return (value as { toString: () => string }).toString();
  }
  return value;
};

export const sanitizeUser = (value: unknown): GenericRecord | null => {
  const user = toPlainObject(value);
  if (!user) return null;

  const sanitized: GenericRecord = { ...user };
  for (const key of SECRET_USER_FIELDS) {
    delete sanitized[key];
  }

  const normalizedInternalId = sanitized._id !== undefined ? normalizeId(sanitized._id) : undefined;

  if (sanitized.id === undefined && normalizedInternalId !== undefined) {
    sanitized.id = normalizedInternalId;
  } else if (sanitized.id !== undefined) {
    sanitized.id = normalizeId(sanitized.id);
  }

  if (sanitized.avatarUrl !== undefined || sanitized.id !== undefined || normalizedInternalId !== undefined) {
    sanitized.avatarUrl = resolveAvatarUrl(
      typeof sanitized.avatarUrl === "string" ? sanitized.avatarUrl : "",
      String(sanitized.id || normalizedInternalId || "user")
    );
  }

  delete sanitized._id;

  return sanitized;
};
