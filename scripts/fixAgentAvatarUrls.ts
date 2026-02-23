import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { User } from "../src/models/User";
import { resolveAvatarUrl } from "../src/utils/avatarImage";

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL is not set");

  const role = (process.env.AVATAR_FIX_ROLE || "AGENT").toUpperCase();
  const roleFilter =
    role === "ALL" ? {} : role === "USER" || role === "ADMIN" || role === "AGENT" ? { role } : { role: "AGENT" };

  await connectDb(mongoUrl);

  const users = await User.find(roleFilter).select("_id role avatarUrl").lean();
  let changed = 0;
  let unchanged = 0;

  for (const user of users) {
    const next = resolveAvatarUrl(user.avatarUrl, user._id.toString());
    if ((user.avatarUrl || "") === next) {
      unchanged += 1;
      continue;
    }
    await User.updateOne({ _id: user._id }, { $set: { avatarUrl: next } });
    changed += 1;
  }

  console.log(
    JSON.stringify(
      {
        scope: role === "ALL" ? "ALL" : roleFilter,
        total: users.length,
        changed,
        unchanged
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("fixAgentAvatarUrls failed:", err);
  process.exit(1);
});
