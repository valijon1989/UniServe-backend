import { apiBaseUrl, ensureAbsoluteUrl } from "./imageHelpers";
import * as fs from "fs";
import * as path from "path";

const allowedHosts = new Set<string>();
try {
  allowedHosts.add(new URL(apiBaseUrl).hostname.toLowerCase());
} catch {
  // ignore invalid API base URL in non-standard environments
}
allowedHosts.add("localhost");
allowedHosts.add("127.0.0.1");

const isAllowedAbsoluteUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return allowedHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const isLegacyDefaultAvatar = (value: string): boolean => {
  return value.includes("/static/placeholders/services/default.jpg");
};

const localAvatarPathFromUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    if (!/^\/static\/avatars\//i.test(parsed.pathname)) return null;
    return path.join(process.cwd(), parsed.pathname.replace(/^\/+/, ""));
  } catch {
    if (!/^\/static\/avatars\//i.test(value)) return null;
    return path.join(process.cwd(), value.replace(/^\/+/, ""));
  }
};

export const resolveAvatarUrl = (value: unknown, seed?: string): string => {
  const normalized = typeof value === "string" ? ensureAbsoluteUrl(value) : undefined;
  if (normalized && isAllowedAbsoluteUrl(normalized) && !isLegacyDefaultAvatar(normalized)) {
    const localAvatarPath = localAvatarPathFromUrl(normalized);
    if (localAvatarPath && !fs.existsSync(localAvatarPath)) {
      const safeSeed = String(seed || "user").replace(/[^a-zA-Z0-9_-]+/g, "-");
      return `${apiBaseUrl}/api/media/avatar/${encodeURIComponent(safeSeed)}.svg`;
    }
    return normalized;
  }
  const safeSeed = String(seed || "user").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${apiBaseUrl}/api/media/avatar/${encodeURIComponent(safeSeed)}.svg`;
};
