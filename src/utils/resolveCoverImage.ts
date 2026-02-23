import { ensureAbsoluteUrl } from "./imageHelpers";
import * as fs from "fs";
import * as path from "path";
import { apiBaseUrl } from "./imageHelpers";

const RANDOM_UNSPLASH_PATTERNS: RegExp[] = [
  /source\.unsplash\.com/i,
  /images\.unsplash\.com\/random/i,
  /unsplash\.com\/random/i,
  /unsplash\.com\/featured/i,
  /[?&](random|sig)=/i,
  /picsum\.photos/i
];

export const isRandomUnsplashUrl = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const input = value.trim();
  if (!input) return false;
  return RANDOM_UNSPLASH_PATTERNS.some((pattern) => pattern.test(input));
};

const normalizePath = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (/^\/(uploads|media|files|static|images|api\/media)\//i.test(trimmed)) {
    return ensureAbsoluteUrl(trimmed) || null;
  }

  return null;
};

export const normalizeCoverImageUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = normalizePath(value);
  if (!normalized) return null;
  if (isRandomUnsplashUrl(normalized)) return null;
  return normalized;
};

const toUrlPath = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    return parsed.pathname || null;
  } catch {
    return value.startsWith("/") ? value : null;
  }
};

export const localPathFromImageUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = normalizeCoverImageUrl(value);
  if (!normalized) return null;
  const pathname = toUrlPath(normalized);
  if (!pathname) return null;
  if (/^\/api\/media\//i.test(pathname)) return null;
  if (!/^\/(static|uploads|media|files|images)\//i.test(pathname)) return null;
  const relativePath = pathname.replace(/^\/+/, "");
  return path.join(process.cwd(), relativePath);
};

export const isLocalImageUrl = (value: unknown): boolean => {
  const localPath = localPathFromImageUrl(value);
  return Boolean(localPath);
};

export const localImageExists = (value: unknown): boolean => {
  const localPath = localPathFromImageUrl(value);
  if (!localPath) return true;
  return fs.existsSync(localPath);
};

export const isAbsoluteApiUrl = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const normalized = normalizeCoverImageUrl(value);
  if (!normalized) return false;
  return normalized.startsWith(apiBaseUrl);
};

const getFromArray = (value: unknown): string | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0] as unknown;
  if (first && typeof first === "object" && typeof (first as { url?: unknown }).url === "string") {
    return normalizeCoverImageUrl((first as { url: string }).url);
  }
  return normalizeCoverImageUrl(first);
};

export const resolveCoverImage = (entity: any): string | null => {
  return (
    normalizeCoverImageUrl(entity?.coverImageUrl) ||
    normalizeCoverImageUrl(entity?.coverImage) ||
    normalizeCoverImageUrl(entity?.imageUrl) ||
    normalizeCoverImageUrl(entity?.image) ||
    normalizeCoverImageUrl(entity?.thumbnail) ||
    getFromArray(entity?.images) ||
    (Array.isArray(entity?.media) && entity.media[0] && typeof entity.media[0] === "object"
      ? normalizeCoverImageUrl((entity.media[0] as { url?: unknown }).url)
      : normalizeCoverImageUrl(Array.isArray(entity?.media) ? entity.media[0] : null)) ||
    null
  );
};

export const sanitizeImageArray = (images: unknown): string[] => {
  if (!Array.isArray(images)) return [];
  return images
    .map((img: unknown) => {
      if (img && typeof img === "object" && typeof (img as { url?: unknown }).url === "string") {
        return normalizeCoverImageUrl((img as { url: string }).url);
      }
      return normalizeCoverImageUrl(img);
    })
    .filter(Boolean) as string[];
};
