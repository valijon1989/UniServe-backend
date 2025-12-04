import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

const isValidRole = (role: any) => ["USER", "AGENT", "ADMIN"].includes(role);

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, username, role } = req.body;
    const errors: string[] = [];
    if (!email) errors.push("email is required");
    if (!password) errors.push("password is required");
    if (!name) errors.push("name is required");
    if (password && String(password).length < 6) errors.push("password must be at least 6 characters");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) errors.push("email format is invalid");
    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = username ? username.toLowerCase() : "";
    const chosenRole = isValidRole(role) ? role : "USER";

    // Derive username if missing
    let baseUsername =
      normalizedUsername ||
      (name ? slugify(name) : "") ||
      (normalizedEmail.includes("@") ? normalizedEmail.split("@")[0] : "");
    if (!baseUsername) baseUsername = `user${Date.now()}`;

    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });
    if (existing) {
      return res
        .status(400)
        .json({
          success: false,
          message: existing.email === normalizedEmail ? "Email already registered" : "Username already taken"
        });
    }

    // Ensure username uniqueness (append random suffix if needed)
    let finalUsername = baseUsername;
    while (await User.exists({ username: finalUsername })) {
      finalUsername = `${baseUsername}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash: hash,
      name,
      username: finalUsername,
      role: chosenRole
    });

    const token = signToken({ _id: user._id.toString(), role: user.role });
    return res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error("register error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginId = (identifier || email || username || "").trim().toLowerCase();
    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: "email/username and password required"
      });
    }

    const user = await User.findOne({
      $or: [{ email: loginId }, { username: loginId }]
    });
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = signToken({ _id: user._id.toString(), role: user.role });
    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ success: false, message: "Server error" });
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
