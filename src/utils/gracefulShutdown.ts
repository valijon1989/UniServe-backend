import type { Server } from "http";
import type { Server as SocketIOServer } from "socket.io";

type ClosableServer = Server & {
  closeAllConnections?: () => void;
  closeIdleConnections?: () => void;
};

interface GracefulShutdownOptions {
  server: Server;
  websocketServer?: SocketIOServer;
  shutdownTimeoutMs?: number;
  closeResources?: () => Promise<void>;
}

interface ShutdownOptions {
  exitCode?: number;
  error?: unknown;
}

const closeServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });

    const closable = server as ClosableServer;
    closable.closeIdleConnections?.();
    closable.closeAllConnections?.();
  });

const closeWebsocketServer = (websocketServer?: SocketIOServer) =>
  new Promise<void>((resolve) => {
    if (!websocketServer) {
      resolve();
      return;
    }

    websocketServer.disconnectSockets(true);
    websocketServer.close(() => resolve());
  });

export const createGracefulShutdown = (options: GracefulShutdownOptions) => {
  let shuttingDown = false;
  let activeShutdown: Promise<void> | null = null;

  const shutdown = async (reason: string, shutdownOptions: ShutdownOptions = {}) => {
    if (activeShutdown) return activeShutdown;

    shuttingDown = true;
    const exitCode = shutdownOptions.exitCode ?? 0;
    const timeoutMs = options.shutdownTimeoutMs ?? 10_000;

    activeShutdown = (async () => {
      const forceExitTimer = setTimeout(() => {
        console.error(`[shutdown] Timed out while closing resources after ${reason}. Forcing exit.`);
        process.exit(1);
      }, timeoutMs);
      forceExitTimer.unref();

      try {
        console.info(`[shutdown] ${reason} received. Closing HTTP server and resources...`);
        await closeWebsocketServer(options.websocketServer);
        await closeServer(options.server);
        if (options.closeResources) {
          await options.closeResources();
        }
        if (shutdownOptions.error) {
          console.error(`[shutdown] ${reason} triggered by error:`, shutdownOptions.error);
        }
        console.info("[shutdown] UniServe backend stopped cleanly.");
      } catch (error) {
        console.error("[shutdown] Failed to close resources cleanly:", error);
        process.exitCode = 1;
      } finally {
        clearTimeout(forceExitTimer);
        if (process.exitCode === undefined) {
          process.exitCode = exitCode;
        }
      }
    })();

    await activeShutdown;
  };

  const registerSignalHandlers = () => {
    process.once("SIGINT", () => {
      void shutdown("SIGINT", { exitCode: 0 }).finally(() => process.exit(process.exitCode ?? 0));
    });
    process.once("SIGTERM", () => {
      void shutdown("SIGTERM", { exitCode: 0 }).finally(() => process.exit(process.exitCode ?? 0));
    });
  };

  const registerProcessErrorHandlers = () => {
    process.once("uncaughtException", (error) => {
      console.error("[runtime] Uncaught exception:", error);
      void shutdown("uncaughtException", { exitCode: 1, error }).finally(() => process.exit(1));
    });

    process.once("unhandledRejection", (reason) => {
      console.error("[runtime] Unhandled promise rejection:", reason);
      void shutdown("unhandledRejection", { exitCode: 1, error: reason }).finally(() => process.exit(1));
    });
  };

  return {
    shutdown,
    registerSignalHandlers,
    registerProcessErrorHandlers,
    isShuttingDown: () => shuttingDown
  };
};
