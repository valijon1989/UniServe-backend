import { createHash, randomBytes } from "crypto";

const RESET_PASSWORD_TTL_MINUTES = Number(process.env.RESET_PASSWORD_TOKEN_TTL_MINUTES || 30);

export const hashRecoveryToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const getResetPasswordTtlMs = () => {
  if (!Number.isFinite(RESET_PASSWORD_TTL_MINUTES) || RESET_PASSWORD_TTL_MINUTES <= 0) {
    return 30 * 60 * 1000;
  }
  return RESET_PASSWORD_TTL_MINUTES * 60 * 1000;
};

export const buildResetPasswordToken = () => {
  const plainToken = randomBytes(32).toString("hex");
  const tokenHash = hashRecoveryToken(plainToken);
  const expiresAt = new Date(Date.now() + getResetPasswordTtlMs());
  return { plainToken, tokenHash, expiresAt };
};
