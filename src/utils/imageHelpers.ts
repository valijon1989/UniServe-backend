const localPort = Number(process.env.PORT || 5001);
const envOrigin =
  process.env.API_BASE_URL || process.env.BACKEND_ORIGIN || process.env.SERVER_URL || process.env.SERVER_ORIGIN;

export const apiBaseUrl = (envOrigin || `http://localhost:${localPort}`).replace(/\/+$/, "");

type MediaAssetType = "services" | "products";

const placeholderPaths: Record<MediaAssetType, string> = {
  services: `${apiBaseUrl}/static/placeholders/services/default.jpg`,
  products: `${apiBaseUrl}/static/placeholders/products/default.jpg`
};

export const ensureAbsoluteUrl = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  const cleanPath = trimmed.replace(/^\/+/, "");
  return `${apiBaseUrl}/${cleanPath}`;
};

export const getCardPlaceholderUrl = (type: MediaAssetType) => placeholderPaths[type];

export const buildCardImageUrl = (value: string | undefined, type: MediaAssetType) => {
  const normalized = ensureAbsoluteUrl(value);
  return normalized || getCardPlaceholderUrl(type);
};

export type { MediaAssetType };
