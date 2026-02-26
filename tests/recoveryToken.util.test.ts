import * as assert from "node:assert/strict";
import { test } from "node:test";
import { buildResetPasswordToken, hashRecoveryToken } from "../src/utils/recoveryToken";

test("buildResetPasswordToken returns plain token + hash and future expiry", () => {
  const start = Date.now();
  const token = buildResetPasswordToken();

  assert.equal(typeof token.plainToken, "string");
  assert.equal(typeof token.tokenHash, "string");
  assert.equal(token.plainToken.length > 20, true);
  assert.equal(token.tokenHash, hashRecoveryToken(token.plainToken));
  assert.equal(token.tokenHash === token.plainToken, false);
  assert.equal(token.expiresAt.getTime() > start, true);
});
