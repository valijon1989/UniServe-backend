import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { User } from "../models/User";
import { sanitizeUser } from "../utils/userSanitizer";

const router = Router();

router.get("/me", authRequired, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!._id).lean();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.patch("/update", authRequired, async (req, res, next) => {
  try {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "avatarUrl")) {
      return res.status(400).json({ message: "avatarUrl can only be updated via POST /api/users/me/avatar" });
    }

    const { name, bio } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { name, bio },
      { new: true, runValidators: true }
    ).lean();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
