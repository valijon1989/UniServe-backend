import * as assert from "node:assert/strict";
import { test } from "node:test";
import { AdminSession } from "../src/models/AdminSession";
import { User } from "../src/models/User";
import { invalidateAuthState, resolveLogoutContext } from "../src/services/authSession";

test("resolveLogoutContext falls back to admin session when token state is broken", async () => {
  const originalFindOne = (AdminSession as any).findOne;

  try {
    (AdminSession as any).findOne = (query: any) => ({
      select() {
        return {
          lean: async () => ({
            userId: "65f000000000000000000123",
            sessionId: query.sessionId,
            revokedAt: null,
            adminModeUntil: new Date()
          })
        };
      }
    });

    const context = await resolveLogoutContext({
      cookies: {
        admin_session: "admin-session-1",
        refreshToken: "broken-refresh-token"
      },
      headers: {
        authorization: "Bearer broken-access-token"
      }
    } as any);

    assert.equal(context.userId, "65f000000000000000000123");
    assert.equal(context.sessionId, "admin-session-1");
    assert.equal(Boolean(context.session), true);
    assert.equal(context.accessTokenValid, false);
    assert.equal(context.refreshTokenValid, false);
  } finally {
    (AdminSession as any).findOne = originalFindOne;
  }
});

test("invalidateAuthState rotates tokenVersion and revokes all active admin sessions", async () => {
  const originalFindByIdAndUpdate = (User as any).findByIdAndUpdate;
  const originalUpdateMany = (AdminSession as any).updateMany;

  let rotatedUserId = "";
  let rotatedPayload: any = null;
  let revokedQuery: any = null;
  let revokedPayload: any = null;

  try {
    (User as any).findByIdAndUpdate = async (userId: string, payload: any) => {
      rotatedUserId = userId;
      rotatedPayload = payload;
      return null;
    };
    (AdminSession as any).updateMany = async (query: any, payload: any) => {
      revokedQuery = query;
      revokedPayload = payload;
      return { modifiedCount: 4 };
    };

    const result = await invalidateAuthState({
      userId: "65f000000000000000000456",
      sessionId: "admin-session-2"
    });

    assert.equal(rotatedUserId, "65f000000000000000000456");
    assert.deepEqual(rotatedPayload, { $inc: { tokenVersion: 1 } });
    assert.deepEqual(revokedQuery, { userId: "65f000000000000000000456", revokedAt: null });
    assert.equal(typeof revokedPayload?.$set?.revokedAt?.toISOString, "function");
    assert.equal(result.revokedCount, 4);
    assert.equal(result.rotatedTokens, true);
  } finally {
    (User as any).findByIdAndUpdate = originalFindByIdAndUpdate;
    (AdminSession as any).updateMany = originalUpdateMany;
  }
});
