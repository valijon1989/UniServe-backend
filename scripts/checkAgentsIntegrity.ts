import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { AgentProfile } from "../src/models/AgentProfile";
import { User } from "../src/models/User";
import { resolveAvatarUrl } from "../src/utils/avatarImage";

const hasFixFlag = process.argv.includes("--fix");

const objectIdStr = (value: unknown) => String(value || "");

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");

  await connectDb(mongoUrl);

  const [agentUsers, allProfiles, allUsers] = await Promise.all([
    User.find({ role: "AGENT" }).select("_id role avatarUrl").lean(),
    AgentProfile.find({}).select("_id user kind verifiedByAdmin faceIdVerified").lean(),
    User.find({}).select("_id role").lean()
  ]);

  const userById = new Map(allUsers.map((u) => [objectIdStr(u._id), u]));
  const profileByUserId = new Map(allProfiles.map((p) => [objectIdStr(p.user), p]));

  const usersWithoutProfile = agentUsers.filter((u) => !profileByUserId.has(objectIdStr(u._id)));
  const profilesWithoutUser = allProfiles.filter((p) => !userById.has(objectIdStr(p.user)));
  const profilesWithNonAgentUser = allProfiles.filter((p) => {
    const linked = userById.get(objectIdStr(p.user));
    return linked && linked.role !== "AGENT";
  });

  let createdProfiles = 0;
  let fixedUserRoles = 0;
  let normalizedAgentAvatars = 0;

  if (hasFixFlag) {
    for (const u of usersWithoutProfile) {
      await AgentProfile.create({
        user: u._id,
        kind: "SERVICE",
        verifiedByAdmin: false,
        faceIdVerified: false
      });
      createdProfiles += 1;
    }

    for (const p of profilesWithNonAgentUser) {
      const result = await User.updateOne({ _id: p.user, role: { $ne: "AGENT" } }, { $set: { role: "AGENT" } });
      if (result.modifiedCount > 0) fixedUserRoles += 1;
    }

    const refreshedAgents = await User.find({ role: "AGENT" }).select("_id avatarUrl").lean();
    for (const u of refreshedAgents) {
      const nextAvatar = resolveAvatarUrl(u.avatarUrl, objectIdStr(u._id));
      if ((u.avatarUrl || "") !== nextAvatar) {
        const result = await User.updateOne({ _id: u._id }, { $set: { avatarUrl: nextAvatar } });
        if (result.modifiedCount > 0) normalizedAgentAvatars += 1;
      }
    }
  }

  const finalAgentUsers = await User.countDocuments({ role: "AGENT" });
  const finalProfiles = await AgentProfile.countDocuments({});

  console.log(
    JSON.stringify(
      {
        mode: hasFixFlag ? "fix" : "check",
        totals: {
          agentUsers: agentUsers.length,
          profiles: allProfiles.length,
          allUsers: allUsers.length
        },
        issues: {
          usersWithoutProfile: usersWithoutProfile.length,
          profilesWithoutUser: profilesWithoutUser.length,
          profilesWithNonAgentUser: profilesWithNonAgentUser.length
        },
        fixesApplied: {
          createdProfiles,
          fixedUserRoles,
          normalizedAgentAvatars
        },
        after: {
          agentUsers: finalAgentUsers,
          profiles: finalProfiles
        },
        samples: {
          usersWithoutProfile: usersWithoutProfile.slice(0, 5).map((u) => objectIdStr(u._id)),
          profilesWithoutUser: profilesWithoutUser.slice(0, 5).map((p) => objectIdStr(p._id)),
          profilesWithNonAgentUser: profilesWithNonAgentUser.slice(0, 5).map((p) => objectIdStr(p._id))
        }
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("checkAgentsIntegrity failed:", err);
  process.exit(1);
});
