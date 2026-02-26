import jwt, { SignOptions } from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "dev-access-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-refresh-secret";
const LEGACY_SECRET = process.env.JWT_SECRET || "";

export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
export const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "30d";

type UserRole = "USER" | "AGENT" | "ADMIN";

const isUserRole = (value: unknown): value is UserRole => value === "USER" || value === "AGENT" || value === "ADMIN";

export interface JwtUserPayload {
  _id: string;
  role: UserRole;
}

interface AccessTokenPayload extends JwtUserPayload {
  tokenType: "access";
}

export interface RefreshTokenPayload extends JwtUserPayload {
  tokenType: "refresh";
  tokenVersion: number;
}

const asExpiresIn = (value: string): SignOptions["expiresIn"] => value as SignOptions["expiresIn"];

const normalizeUserPayload = (raw: unknown): JwtUserPayload => {
  const payload = raw as Record<string, unknown>;
  if (!payload || typeof payload !== "object") throw new Error("Invalid token payload");
  const id = payload._id;
  const role = payload.role;
  if (typeof id !== "string" || !isUserRole(role)) throw new Error("Invalid token payload");
  return { _id: id, role };
};

export function durationToMs(value: string): number | undefined {
  const match = value.trim().match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount)) return undefined;

  if (unit === "ms") return amount;
  if (unit === "s") return amount * 1000;
  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
}

export function signAccessToken(payload: JwtUserPayload) {
  const body: AccessTokenPayload = { ...payload, tokenType: "access" };
  return jwt.sign(body, ACCESS_SECRET, { expiresIn: asExpiresIn(ACCESS_TOKEN_TTL) });
}

export function signRefreshToken(payload: JwtUserPayload & { tokenVersion: number }) {
  const body: RefreshTokenPayload = { ...payload, tokenType: "refresh" };
  return jwt.sign(body, REFRESH_SECRET, { expiresIn: asExpiresIn(REFRESH_TOKEN_TTL) });
}

export function verifyAccessToken(token: string): JwtUserPayload {
  const secrets = [ACCESS_SECRET];
  if (LEGACY_SECRET && LEGACY_SECRET !== ACCESS_SECRET) {
    secrets.push(LEGACY_SECRET);
  }

  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret) as Record<string, unknown>;
      if (decoded.tokenType && decoded.tokenType !== "access") {
        throw new Error("Invalid token type");
      }
      return normalizeUserPayload(decoded);
    } catch {
      // try next secret
    }
  }

  throw new Error("Invalid or expired token");
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, REFRESH_SECRET) as Record<string, unknown>;
  const base = normalizeUserPayload(decoded);
  if (decoded.tokenType !== "refresh") throw new Error("Invalid token type");
  if (typeof decoded.tokenVersion !== "number") throw new Error("Invalid token payload");
  return { ...base, tokenType: "refresh", tokenVersion: decoded.tokenVersion };
}
