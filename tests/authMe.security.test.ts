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
      lean: async () => ({
        _id: "65f000000000000000000111",
        email: "tester@example.com",
        username: "tester",
        name: "Tester",
        role: "USER",
        isVerified: true,
        isPrivate: false,
        passwordHash: "super-secret-hash",
        resetToken: "reset-token-value"
      })
    });

    const req: any = { user: { _id: "65f000000000000000000111" } };
    const { res, state } = createResponse();

    await me(req, res);

    assert.equal(state.statusCode, 200);
    assert.ok(state.payload?.user);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload.user, "passwordHash"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload.user, "resetToken"), false);
    assert.equal(state.payload.user.email, "tester@example.com");
  } finally {
    (User as any).findById = originalFindById;
  }
});
