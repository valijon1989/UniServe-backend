import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, username } = req.body;
    if (!email || !password || !name || !username) {
      return res.status(400).json({ message: "email, password, name, username required" });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = username.toLowerCase();

    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: existing.email === normalizedEmail ? "Email already registered" : "Username already taken" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash: hash,
      name,
      username: normalizedUsername,
      role: "USER"
    });

    const token = signToken({ _id: user._id.toString(), role: user.role });
    return res.status(201).json({ token, user });
  } catch (err) {
    console.error("register error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginId = (identifier || email || username || "").trim().toLowerCase();
    if (!loginId || !password) {
      return res.status(400).json({ message: "email/username and password required" });
    }

    const user = await User.findOne({
      $or: [{ email: loginId }, { username: loginId }]
    });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = signToken({ _id: user._id.toString(), role: user.role });
    return res.json({ token, user });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user });
  } catch (err) {
    console.error("me error", err);
    return res.status(500).json({ message: "Server error" });
  }
};
