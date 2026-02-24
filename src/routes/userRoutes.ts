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
    const { name, bio, avatarUrl } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { name, bio, avatarUrl },
      { new: true, runValidators: true }
    ).lean();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
