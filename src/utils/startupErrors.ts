import type { Server } from "http";
import type { ServerRuntimeConfig } from "../config/serverRuntime";

const listenOnce = (server: Server, port: number) =>
  new Promise<void>((resolve, reject) => {
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    const onError = (error: NodeJS.ErrnoException) => {
      server.off("listening", onListening);
      reject(error);
    };

    server.once("listening", onListening);
    server.once("error", onError);
    server.listen(port);
  });

export const logStartupError = (error: unknown, config: ServerRuntimeConfig, attemptedPort = config.port) => {
  const err = error as NodeJS.ErrnoException & { attemptedPort?: number };
  const activePort = err.attemptedPort || attemptedPort;

  if (err?.code === "EADDRINUSE") {
    console.error(`[startup] Port ${activePort} is already in use.`);
    console.error(`[startup] Free it with: npm run port:5001:kill`);
    console.error(`[startup] Restart cleanly with: npm run start:clean`);
    console.error(`[startup] Or choose another port: PORT=${config.fallbackPort || activePort + 1} npm run start`);
    if (config.fallbackPort) {
      console.error(
        `[startup] Optional fallback: set PORT_AUTO_FALLBACK=true to switch to ${config.fallbackPort} automatically.`
      );
    }
    return;
  }

  if (err?.code === "EACCES") {
    console.error(`[startup] Permission denied while binding port ${activePort}.`);
    console.error(`[startup] Use a non-privileged port like 5001 or run with the required privileges.`);
    return;
  }

  console.error("[startup] HTTP server failed to start:", error);
};

export const listenWithPortRecovery = async (server: Server, config: ServerRuntimeConfig) => {
  try {
    await listenOnce(server, config.port);
    return config.port;
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { attemptedPort?: number };
    err.attemptedPort = config.port;
    const canFallback =
      err?.code === "EADDRINUSE" &&
      config.autoFallbackPort &&
      config.fallbackPort &&
      config.fallbackPort !== config.port;

    if (!canFallback) {
      throw error;
    }

    const fallbackPort = config.fallbackPort as number;
    console.warn(
      `[startup] Port ${config.port} is busy. PORT_AUTO_FALLBACK=true, retrying on ${fallbackPort}.`
    );
    try {
      await listenOnce(server, fallbackPort);
    } catch (fallbackError) {
      (fallbackError as NodeJS.ErrnoException & { attemptedPort?: number }).attemptedPort = fallbackPort;
      throw fallbackError;
    }
    return fallbackPort;
  }
};
