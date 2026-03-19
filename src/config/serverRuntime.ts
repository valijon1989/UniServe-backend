export interface ServerRuntimeConfig {
  port: number;
  fallbackPort: number | null;
  autoFallbackPort: boolean;
  shutdownTimeoutMs: number;
  mongoUrl: string;
  frontendOrigins: string[];
}

export const DEFAULT_SERVER_PORT = 5001;
export const DEFAULT_FALLBACK_PORT = 5002;
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const parseBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const parseOrigins = (value: unknown) => {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : ["http://localhost:3000"];
};

export const getServerRuntimeConfig = (): ServerRuntimeConfig => {
  const port = parsePositiveInt(process.env.PORT, DEFAULT_SERVER_PORT);
  const fallbackPort = parsePositiveInt(
    process.env.PORT_FALLBACK,
    port === DEFAULT_SERVER_PORT ? DEFAULT_FALLBACK_PORT : port + 1
  );

  return {
    port,
    fallbackPort: fallbackPort === port ? null : fallbackPort,
    autoFallbackPort: parseBoolean(process.env.PORT_AUTO_FALLBACK, false),
    shutdownTimeoutMs: parsePositiveInt(process.env.SHUTDOWN_TIMEOUT_MS, DEFAULT_SHUTDOWN_TIMEOUT_MS),
    mongoUrl: String(process.env.MONGO_URL || process.env.MONGO_URI || "").trim(),
    frontendOrigins: parseOrigins(process.env.FRONTEND_ORIGINS)
  };
};
