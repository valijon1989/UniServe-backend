import "dotenv/config";
import { connectDb } from "../src/config/db";
import { User } from "../src/models/User";
import { AgentProfile } from "../src/models/AgentProfile";

const fraction = 0.8;

function shuffle<T>(items: T[]) {
  return items
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL not set");
  }

  await connectDb(mongoUrl);

  const agentUsers = await User.find({ role: "AGENT" }).select("_id isVerified").lean();
  if (agentUsers.length === 0) {
    console.log("No agents found.");
    process.exit(0);
  }

  const shuffled = shuffle(agentUsers);
  const targetCount = Math.max(1, Math.round(shuffled.length * fraction));
  const activeIds = new Set(shuffled.slice(0, targetCount).map((u) => String(u._id)));
  const inactiveIds = shuffled.slice(targetCount).map((u) => u._id);

  await User.updateMany({ _id: { $in: Array.from(activeIds) } }, { $set: { isVerified: true } });
  if (inactiveIds.length) {
    await User.updateMany({ _id: { $in: inactiveIds } }, { $set: { isVerified: false } });
  }

  await AgentProfile.updateMany({ user: { $in: Array.from(activeIds) } }, { $set: { verifiedByAdmin: true } });
  if (inactiveIds.length) {
    await AgentProfile.updateMany({ user: { $in: inactiveIds } }, { $set: { verifiedByAdmin: false } });
  }

  console.log(`Active agents: ${activeIds.size} / ${agentUsers.length}`);
}

run().catch((err) => {
  console.error("Failed to activate agents:", err);
  process.exit(1);
});
