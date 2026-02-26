import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { verifyAccessToken } from "./jwt";

type WsPayload = Record<string, unknown>;

const userSockets = new Map<string, Set<WebSocket>>();

function addSocket(userId: string, socket: WebSocket) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(socket);
}

function removeSocket(userId: string, socket: WebSocket) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) {
    userSockets.delete(userId);
  }
}

export function sendToUser(userId: string, type: string, payload: WsPayload) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const message = JSON.stringify({ type, payload });
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  }
}

export function initWebsocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const token =
      url.searchParams.get("token") ||
      (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : undefined);

    if (!token) {
      socket.close(4001, "Unauthorized");
      return;
    }

    let userId: string | null = null;
    try {
      const payload = verifyAccessToken(token);
      userId = payload._id;
    } catch {
      socket.close(4002, "Invalid token");
      return;
    }

    addSocket(userId, socket);

    socket.on("close", () => {
      if (userId) removeSocket(userId, socket);
    });

    socket.on("error", () => {
      if (userId) removeSocket(userId, socket);
    });
  });

  return wss;
}
