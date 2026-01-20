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

  const agentUsers = await User.countDocuments({ role: "AGENT" });
  const verifiedAgentUsers = await User.countDocuments({ role: "AGENT", isVerified: true });
  const profiles = await AgentProfile.countDocuments({});
  const activeProfiles = await AgentProfile.countDocuments({ verifiedByAdmin: true });

  console.log(JSON.stringify({ agentUsers, verifiedAgentUsers, profiles, activeProfiles }));
}

run().catch((err) => {
  console.error("Failed to inspect agents:", err);
  process.exit(1);
});
