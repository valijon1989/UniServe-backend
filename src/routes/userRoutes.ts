import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { User } from "../models/User";

const router = Router();

router.get("/me", authRequired, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!._id).select("-passwordHash");
    res.json({ user });
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
    ).select("-passwordHash");
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
