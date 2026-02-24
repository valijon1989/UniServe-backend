type GenericRecord = Record<string, unknown>;

const SECRET_USER_FIELDS = new Set([
  "passwordHash",
  "password",
  "resetToken",
  "resetPasswordToken",
  "resetPasswordExpires",
  "emailVerificationToken",
  "emailVerificationCode",
  "twoFactorSecret",
  "twoFactorRecoveryCodes",
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

  if (sanitized._id !== undefined) {
    sanitized._id = normalizeId(sanitized._id);
  }
  if (sanitized.id === undefined && sanitized._id !== undefined) {
    sanitized.id = sanitized._id;
  } else if (sanitized.id !== undefined) {
    sanitized.id = normalizeId(sanitized.id);
  }

  return sanitized;
};
