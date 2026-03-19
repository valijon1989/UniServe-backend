import * as assert from "node:assert/strict";
import { test } from "node:test";
import { severityFromScore } from "../src/services/fraudMonitoring";

test("fraud severity thresholds escalate predictably", () => {
  assert.equal(severityFromScore(10), "LOW");
  assert.equal(severityFromScore(35), "MEDIUM");
  assert.equal(severityFromScore(60), "HIGH");
  assert.equal(severityFromScore(90), "CRITICAL");
});
