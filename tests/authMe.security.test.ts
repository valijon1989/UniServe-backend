import * as assert from "node:assert/strict";
import { test } from "node:test";
import { me } from "../src/controllers/authController";
import { User } from "../src/models/User";

type ResponseState = {
  statusCode: number;
  payload: any;
};

const createResponse = () => {
  const state: ResponseState = { statusCode: 200, payload: null };
  const res: any = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: any) {
      state.payload = payload;
      return res;
    }
  };
  return { res, state };
};

test("/me response does not expose passwordHash and secret fields", async () => {
  const originalFindById = (User as any).findById;

  try {
    (User as any).findById = () => ({
      _id: "65f000000000000000000111",
      email: "tester@example.com",
      username: "tester",
      name: "Tester",
      role: "USER",
      tokenVersion: 9,
      isVerified: true,
      isPrivate: false,
      passwordHash: "super-secret-hash",
      resetToken: "reset-token-value",
      avatarUrl: "https://cdn.example.com/u/tester.png"
    });

    const req: any = { user: { _id: "65f000000000000000000111" } };
    const { res, state } = createResponse();

    await me(req, res);

    assert.equal(state.statusCode, 200);
    assert.ok(state.payload?.user);
    assert.equal(state.payload.user._id, "65f000000000000000000111");
    assert.equal(state.payload.user.nickname, "tester");
    assert.equal(typeof state.payload.user.avatarUrl, "string");
    assert.equal(state.payload.user.avatarUrl.includes("/api/media/avatar/"), true);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload.user, "email"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload.user, "username"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload.user, "role"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload.user, "isVerified"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload.user, "passwordHash"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload.user, "resetToken"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload.user, "tokenVersion"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload.user, "id"), false);
  } finally {
    (User as any).findById = originalFindById;
  }
});
