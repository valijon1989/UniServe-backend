import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { User } from "../models/User";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.slice(7);
  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const user = await User.findById(payload._id).select("_id role").lean();
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    req.user = { _id: String(user._id), role: user.role };
    return next();
  } catch (error) {
    console.error("requireAuth error", error);
    return res.status(500).json({ message: "Server error" });
  }
}
