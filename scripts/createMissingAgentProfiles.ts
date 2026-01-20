import "dotenv/config";
import { connectDb } from "../src/config/db";
import { User } from "../src/models/User";
import { AgentProfile } from "../src/models/AgentProfile";

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL not set");
  }

  await connectDb(mongoUrl);

  const agents = await User.find({ role: "AGENT" }).select("_id").lean();
  if (agents.length === 0) {
    console.log("No agent users found.");
    return;
  }

  const profiles = await AgentProfile.find({ user: { $in: agents.map((a) => a._id) } })
    .select("user")
    .lean();
  const profileUserIds = new Set(profiles.map((p) => String(p.user)));
  const missing = agents.filter((agent) => !profileUserIds.has(String(agent._id)));

  if (missing.length === 0) {
    console.log("All agent users already have profiles.");
    return;
  }

  const profilesToCreate = missing.map((agent, index) => ({
    user: agent._id,
    kind: "SERVICE",
    socialServices: [],
    materialServices: ["General"],
    rating: 4.2 + (index % 3) * 0.2,
    ratingCount: 1,
    verifiedByAdmin: true,
    serviceCategory: "repair"
  }));

  await AgentProfile.insertMany(profilesToCreate);
  await User.updateMany({ _id: { $in: missing.map((m) => m._id) } }, { $set: { isVerified: true } });

  console.log(`Created ${profilesToCreate.length} agent profiles.`);
}

run().catch((err) => {
  console.error("Failed to create agent profiles:", err);
  process.exit(1);
});
