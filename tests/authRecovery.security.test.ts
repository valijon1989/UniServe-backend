import * as assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import { forgotPassword, forgotUsername, resetPassword } from "../src/controllers/authController";
import { User } from "../src/models/User";
import { hashRecoveryToken } from "../src/utils/recoveryToken";

type ResponseState = {
  statusCode: number;
  payload: any;
  clearedCookie?: string;
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
    },
    clearCookie(name: string) {
      state.clearedCookie = name;
      return res;
    }
  };
  return { res, state };
};

test("forgotPassword does not disclose account existence", async () => {
  const originalFindOne = (User as any).findOne;

  try {
    (User as any).findOne = async () => null;

    const req: any = { body: { identifier: "missing@example.com" } };
    const { res, state } = createResponse();
    await forgotPassword(req, res);

    assert.equal(state.statusCode, 200);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload || {}, "ok"), false);
    assert.equal(state.payload?.message, "If an account exists, instructions were sent.");
  } finally {
    (User as any).findOne = originalFindOne;
  }
});

test("forgotUsername returns generic success for unknown email", async () => {
  const originalFindOne = (User as any).findOne;

  try {
    (User as any).findOne = async () => null;

    const req: any = { body: { email: "nouser@example.com" } };
    const { res, state } = createResponse();
    await forgotUsername(req, res);

    assert.equal(state.statusCode, 200);
    assert.equal(Object.prototype.hasOwnProperty.call(state.payload || {}, "success"), false);
    assert.equal(state.payload?.message, "If an account exists, instructions were sent.");
  } finally {
    (User as any).findOne = originalFindOne;
  }
});

test("resetPassword accepts only hashed token lookup and rotates password", async () => {
  const originalFindOne = (User as any).findOne;
  const token = "plain-reset-token";
  const hashedToken = hashRecoveryToken(token);
  const previousPasswordHash = await bcrypt.hash("old-password", 4);
  const fakeUser: any = {
    passwordHash: previousPasswordHash,
    resetPasswordTokenHash: hashedToken,
    resetPasswordExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    tokenVersion: 2,
    save: async () => undefined
  };

  try {
    (User as any).findOne = async (query: any) => {
      assert.equal(query.resetPasswordTokenHash, hashedToken);
      assert.ok(query.resetPasswordExpiresAt?.$gt instanceof Date);
      return fakeUser;
    };

    const req: any = { body: { token, newPassword: "new-password-123" } };
    const { res, state } = createResponse();
    await resetPassword(req, res);

    assert.equal(state.statusCode, 200);
    assert.equal(state.payload?.ok, true);
    assert.equal(state.clearedCookie, "refreshToken");
    assert.equal(fakeUser.resetPasswordTokenHash, undefined);
    assert.equal(fakeUser.resetPasswordExpiresAt, undefined);
    assert.equal(fakeUser.tokenVersion, 3);
    assert.equal(await bcrypt.compare("new-password-123", fakeUser.passwordHash), true);
  } finally {
    (User as any).findOne = originalFindOne;
  }
});
