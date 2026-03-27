import type { IncomingMessage } from "http";
import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import type { JwtUserPayload } from "./jwt";
import { verifyAccessToken } from "./jwt";

type WsPayload = Record<string, unknown>;
type SocketAuthSource = "auth" | "query" | "header" | "none";
type SocketHandshakeLike = {
  auth?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
};
type SocketTokenCarrier = {
  id: string;
  handshake: SocketHandshakeLike;
};
type RealtimeSocketData = {
  userId?: string;
  user?: JwtUserPayload;
  authSource?: Exclude<SocketAuthSource, "none">;
};
type RealtimeSocket = Socket<any, any, any, RealtimeSocketData>;
type RoomJoinCapableSocket = {
  data: RealtimeSocketData;
  join: (room: string) => void;
};

const USER_ROOM_PREFIX = "user:";
export const SOCKET_PATH = "/ws";
export const SOCKET_IO_CLIENT_VERSION = "v4";
const SOCKET_ALLOWED_HEADERS = ["Authorization"];
const SOCKET_PATH_HINT = `${SOCKET_PATH} (client version ${SOCKET_IO_CLIENT_VERSION})`;

let websocketServer: SocketIOServer<any, any, any, RealtimeSocketData> | null = null;
const activeSocketIds = new Set<string>();

const getUserRoom = (userId: string) => `${USER_ROOM_PREFIX}${userId}`;

const logTokenSource = (socketId: string, source: Exclude<SocketAuthSource, "none">) => {
  console.info(`[ws-auth] token source=${source} socket=${socketId}`);
};

const logAuthenticatedUser = (socketId: string, userId: string, source: Exclude<SocketAuthSource, "none">) => {
  console.info(`[ws-auth] authenticated userId=${userId} source=${source} socket=${socketId}`);
};

const logAuthFailed = (socketId: string, reason: string, source?: SocketAuthSource) => {
  const suffix = source && source !== "none" ? ` source=${source}` : "";
  console.warn(`[ws-auth] auth failed reason=${reason}${suffix} socket=${socketId}`);
};

const logSocketConnection = (params: {
  stage: "connected" | "disconnected";
  socketId: string;
  userId: string;
  total: number;
  source?: Exclude<SocketAuthSource, "none">;
  reason?: string;
}) => {
  const source = params.source ? ` source=${params.source}` : "";
  const reason = params.reason ? ` reason=${params.reason}` : "";
  console.info(`[ws-conn] ${params.stage} userId=${params.userId}${source} socket=${params.socketId} total=${params.total}${reason}`);
};

const normalizeSocketPath = (pathname: string) => {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) || "/" : pathname;
};

const looksLikeSocketIoRequest = (request: IncomingMessage) => {
  const url = new URL(request.url || "/", "http://localhost");
  const pathname = normalizeSocketPath(url.pathname);
  const upgrade = typeof request.headers.upgrade === "string" ? request.headers.upgrade.toLowerCase() : "";
  const transport = url.searchParams.get("transport");
  const hasEngineIoQuery = url.searchParams.has("EIO");
  const isDefaultSocketPath = pathname === "/socket.io";
  const isSocketLikeTransport = transport === "websocket" || transport === "polling" || upgrade === "websocket";

  return {
    pathname,
    hasEngineIoQuery,
    isDefaultSocketPath,
    isSocketLikeTransport
  };
};

const registerUnexpectedSocketPathLogging = (server: HttpServer) => {
  const expectedPath = normalizeSocketPath(SOCKET_PATH);
  const logUnexpectedSocketPath = (request: IncomingMessage, channel: "request" | "upgrade") => {
    const details = looksLikeSocketIoRequest(request);
    if (!details.isSocketLikeTransport && !details.hasEngineIoQuery && !details.isDefaultSocketPath) {
      return;
    }
    if (details.pathname === expectedPath) {
      return;
    }

    console.warn(
      `[ws-auth] unexpected socket path=${details.pathname} expected=${SOCKET_PATH} channel=${channel} hint="Use ${SOCKET_PATH_HINT}"`
    );
  };

  server.on("request", (request) => logUnexpectedSocketPath(request, "request"));
  server.on("upgrade", (request) => logUnexpectedSocketPath(request, "upgrade"));
};

const isAllowedSocketOrigin = (origin: string | undefined, allowedOrigins: string[]) => {
  if (!origin) return true;
  if (allowedOrigins.includes("*")) return true;
  return allowedOrigins.includes(origin);
};

const extractSocketTokenCandidate = (
  socket: Pick<SocketTokenCarrier, "handshake">
): { token: string | null; source: SocketAuthSource } => {
  const auth = socket.handshake.auth as Record<string, unknown> | undefined;
  const authToken = typeof auth?.token === "string" ? auth.token.trim() : "";
  if (authToken) return { token: authToken, source: "auth" };

  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === "string" && queryToken.trim()) {
    return { token: queryToken.trim(), source: "query" };
  }

  if (Array.isArray(queryToken)) {
    const firstToken = queryToken.find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (firstToken) {
      return { token: firstToken.trim(), source: "query" };
    }
  }

  const authorization = socket.handshake.headers?.authorization;
  const authorizationHeader = Array.isArray(authorization) ? authorization[0] : authorization;
  if (typeof authorizationHeader === "string") {
    const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch?.[1]?.trim()) {
      return { token: bearerMatch[1].trim(), source: "header" };
    }
  }

  return { token: null, source: "none" };
};

export function extractSocketToken(socket: Pick<SocketTokenCarrier, "handshake">): string | null {
  return extractSocketTokenCandidate(socket).token;
}

export function authenticateSocket(
  socket: Pick<SocketTokenCarrier, "id" | "handshake">
): { userId: string; user: JwtUserPayload; source: Exclude<SocketAuthSource, "none"> } {
  const token = extractSocketToken(socket);
  const { source } = extractSocketTokenCandidate(socket);

  if (source !== "none") {
    logTokenSource(socket.id, source);
  }

  if (!token) {
    const error = new Error("Unauthorized: token missing") as Error & { source?: SocketAuthSource };
    error.source = source;
    throw error;
  }

  try {
    const user = verifyAccessToken(token);
    const userId = String((user as JwtUserPayload & { sub?: string }).sub || user._id || "").trim();
    if (!userId) {
      throw new Error("Unauthorized: invalid access token");
    }
    return {
      userId,
      user,
      source: source === "none" ? "auth" : source
    };
  } catch {
    const error = new Error("Unauthorized: invalid access token") as Error & { source?: SocketAuthSource };
    error.source = source;
    throw error;
  }
}

export function sendToUser(userId: string, type: string, payload: WsPayload) {
  const normalizedUserId = String(userId || "").trim();
  if (!websocketServer || !normalizedUserId) return;
  websocketServer.to(getUserRoom(normalizedUserId)).emit(type, payload);
}

export function joinSocketUserRoom(socket: RoomJoinCapableSocket): string | null {
  const userId = String(socket.data.userId || "").trim();
  if (!userId) return null;
  const userRoom = getUserRoom(userId);
  socket.join(userRoom);
  return userRoom;
}

export function initWebsocket(server: HttpServer, allowedOrigins: string[]) {
  registerUnexpectedSocketPathLogging(server);
  websocketServer = new SocketIOServer(server, {
    path: SOCKET_PATH,
    cors: {
      origin: (origin, callback) => {
        if (isAllowedSocketOrigin(origin, allowedOrigins)) {
          callback(null, true);
          return;
        }

        console.warn(`[socket.io] Rejected origin: origin=${origin || "none"}`);
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: SOCKET_ALLOWED_HEADERS
    }
  });

  websocketServer.use((socket: RealtimeSocket, next) => {
    try {
      const authResult = authenticateSocket(socket);
      socket.data.userId = authResult.userId;
      socket.data.user = authResult.user;
      socket.data.authSource = authResult.source;
      logAuthenticatedUser(socket.id, authResult.userId, authResult.source);
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unauthorized: invalid access token";
      const source =
        error && typeof error === "object" && "source" in error && typeof (error as { source?: unknown }).source === "string"
          ? ((error as { source: SocketAuthSource }).source ?? "none")
          : "none";
      logAuthFailed(socket.id, message, source);
      next(new Error(message));
    }
  });

  websocketServer.on("connection", (socket: RealtimeSocket) => {
    const userId = String(socket.data.userId || "").trim();
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    joinSocketUserRoom(socket);
    activeSocketIds.add(socket.id);
    logSocketConnection({
      stage: "connected",
      socketId: socket.id,
      userId,
      total: activeSocketIds.size,
      source: socket.data.authSource
    });

    socket.on("disconnect", (reason) => {
      activeSocketIds.delete(socket.id);
      logSocketConnection({
        stage: "disconnected",
        socketId: socket.id,
        userId,
        total: activeSocketIds.size,
        source: socket.data.authSource,
        reason
      });
    });
  });

  return websocketServer;
}
