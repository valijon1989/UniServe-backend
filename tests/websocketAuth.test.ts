import * as assert from "node:assert/strict";
import { test } from "node:test";
import { signAccessToken, signRefreshToken } from "../src/utils/jwt";
import { authenticateSocket, extractSocketToken, joinSocketUserRoom } from "../src/utils/websocket";

const createMockSocket = (overrides?: Partial<any>) => ({
  id: "socket-test-1",
  data: {},
  handshake: {
    auth: {},
    query: {},
    headers: {}
  },
  ...(overrides || {})
});

test("extractSocketToken prefers auth token over query and header", () => {
  const accessToken = signAccessToken({ _id: "user-auth", role: "USER" });
  const socket = createMockSocket({
    handshake: {
      auth: { token: accessToken },
      query: { token: "query-token" },
      headers: { authorization: "Bearer header-token" }
    }
  });

  const extracted = extractSocketToken(socket);
  assert.equal(extracted, accessToken);
});

test("authenticateSocket accepts auth payload token and returns user context", () => {
  const accessToken = signAccessToken({ _id: "user-auth", role: "AGENT" });
  const socket = createMockSocket({
    handshake: {
      auth: { token: accessToken },
      query: {},
      headers: {}
    }
  });

  const result = authenticateSocket(socket);
  assert.equal(result.source, "auth");
  assert.equal(result.userId, "user-auth");
  assert.equal(result.user._id, "user-auth");
  assert.equal(result.user.role, "AGENT");
});

test("authenticateSocket accepts query and header bearer tokens", () => {
  const queryToken = signAccessToken({ _id: "user-query", role: "USER" });
  const headerToken = signAccessToken({ _id: "user-header", role: "ADMIN" });

  const querySocket = createMockSocket({
    handshake: {
      auth: {},
      query: { token: queryToken },
      headers: {}
    }
  });
  const headerSocket = createMockSocket({
    handshake: {
      auth: {},
      query: {},
      headers: { authorization: `Bearer ${headerToken}` }
    }
  });

  const queryResult = authenticateSocket(querySocket);
  const headerResult = authenticateSocket(headerSocket);

  assert.equal(queryResult.source, "query");
  assert.equal(queryResult.userId, "user-query");
  assert.equal(headerResult.source, "header");
  assert.equal(headerResult.userId, "user-header");
  assert.equal(headerResult.user.role, "ADMIN");
});

test("authenticateSocket rejects missing token with a stable error", () => {
  const missingTokenSocket = createMockSocket();

  assert.throws(() => authenticateSocket(missingTokenSocket), {
    message: "Unauthorized: token missing"
  });
});

test("authenticateSocket rejects invalid access token with a stable error", () => {
  const refreshTokenSocket = createMockSocket({
    handshake: {
      auth: { token: signRefreshToken({ _id: "user-refresh", role: "USER", tokenVersion: 1 }) },
      query: {},
      headers: {}
    }
  });

  assert.throws(() => authenticateSocket(refreshTokenSocket), {
    message: "Unauthorized: invalid access token"
  });
});

test("joinSocketUserRoom joins authenticated user into the user room", () => {
  const joinedRooms: string[] = [];
  const socket = {
    data: {
      userId: "user-room-1"
    },
    join: (room: string) => {
      joinedRooms.push(room);
    }
  };

  const room = joinSocketUserRoom(socket);

  assert.equal(room, "user:user-room-1");
  assert.deepEqual(joinedRooms, ["user:user-room-1"]);
});
