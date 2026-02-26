import { NextFunction, Request, Response } from "express";

type AttemptState = {
  count: number;
  resetAt: number;
};

const attemptsByKey = new Map<string, AttemptState>();
const WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX || 10);

const getClientKey = (req: Request) => {
  const loginId = String(req.body?.identifier || req.body?.email || req.body?.username || "").toLowerCase().trim();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}:${loginId}`;
};

export const loginRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const now = Date.now();
  const key = getClientKey(req);
  const state = attemptsByKey.get(key);

  if (!state || state.resetAt <= now) {
    attemptsByKey.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (state.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((state.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
    return res.status(429).json({
      success: false,
      message: "Too many login attempts. Please try again later."
    });
  }

  state.count += 1;
  attemptsByKey.set(key, state);
  return next();
};

export const clearLoginRateLimit = (req: Request) => {
  attemptsByKey.delete(getClientKey(req));
};
