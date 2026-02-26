import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { requireAuth } from "./requireAuth";

export const authRequired = requireAuth;

export function authOptional(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.substring(7);
    try {
      const payload = verifyAccessToken(token);
      req.user = { _id: payload._id, role: payload.role };
    } catch {
      // ignore invalid token for optional auth
    }
  }
  return next();
}

export function roleRequired(roles: ("USER" | "AGENT" | "ADMIN")[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}
