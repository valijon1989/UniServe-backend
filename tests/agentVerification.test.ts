import * as assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAgentVerificationStatus } from "../src/services/agentVerification";

test("agent verification status approved bo'ladi", () => {
  assert.equal(resolveAgentVerificationStatus({ verifiedByAdmin: true, adminStatus: "ACTIVE" }), "approved");
});

test("agent verification status rejected bo'ladi", () => {
  assert.equal(
    resolveAgentVerificationStatus({ verifiedByAdmin: false, adminStatus: "SUSPENDED", verificationRejectionReason: "docs mismatch" }),
    "rejected"
  );
});

test("agent verification status default pending bo'ladi", () => {
  assert.equal(resolveAgentVerificationStatus({ verifiedByAdmin: false, adminStatus: "PENDING" }), "pending");
});
