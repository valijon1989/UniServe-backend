import "dotenv/config";
import { connectDb } from "../src/config/db";
import { User } from "../src/models/User";
import { AgentProfile } from "../src/models/AgentProfile";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { EducationListing } from "../src/models/EducationListing";
import { ConstructionListing } from "../src/models/ConstructionListing";
import { TaxiListing } from "../src/models/TaxiListing";
import { stubImage } from "../src/data/stubProducts";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");

  await connectDb(mongoUrl);

  const agents = await User.find({ role: "AGENT" }).select("_id name username avatarUrl").lean();
  if (!agents.length) throw new Error("No agent users found.");

  const existingUsernames = new Set<string>(
    (await User.find({}).select("username").lean()).map((u) => String(u.username))
  );
  const existingAvatars = new Set<string>(
    (await User.find({ avatarUrl: { $exists: true, $ne: null } }).select("avatarUrl").lean()).map((u) =>
      String(u.avatarUrl)
    )
  );

  let updatedUsers = 0;

  for (let i = 0; i < agents.length; i += 1) {
    const agent = agents[i];
    const base = slugify(agent.name || `agent_${i + 1}`);
    let username = `agent_${base}_${i + 1}`;
    let suffix = 1;
    while (existingUsernames.has(username)) {
      username = `agent_${base}_${i + 1}_${suffix}`;
      suffix += 1;
    }

    const avatarSeed = `agent-${i + 1}-${agent._id}`;
    let avatarUrl = stubImage(avatarSeed, "person portrait");
    let avatarSuffix = 1;
    while (existingAvatars.has(avatarUrl)) {
      avatarUrl = stubImage(`${avatarSeed}-${avatarSuffix}`, "person portrait");
      avatarSuffix += 1;
    }

    existingUsernames.add(username);
    existingAvatars.add(avatarUrl);

    await User.updateOne(
      { _id: agent._id },
      {
        $set: {
          username,
          avatarUrl
        }
      }
    );
    updatedUsers += 1;
  }

  const agentIds = agents.map((a) => a._id);

  const roundRobin = <T>(items: T[], size: number) => {
    const buckets: T[][] = Array.from({ length: size }, () => []);
    items.forEach((item, idx) => buckets[idx % size].push(item));
    return buckets;
  };

  const products = await Product.find({}).select("_id").lean();
  const services = await Service.find({}).select("_id").lean();
  const education = await EducationListing.find({}).select("_id").lean();
  const construction = await ConstructionListing.find({}).select("_id").lean();
  const taxi = await TaxiListing.find({}).select("_id").lean();

  const allListings = [
    ...products.map((p) => ({ model: "product", id: p._id })),
    ...services.map((s) => ({ model: "service", id: s._id })),
    ...education.map((e) => ({ model: "education", id: e._id })),
    ...construction.map((c) => ({ model: "construction", id: c._id })),
    ...taxi.map((t) => ({ model: "taxi", id: t._id }))
  ];

  const buckets = roundRobin(allListings, agentIds.length);

  let reassigned = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    const agentId = agentIds[i];
    const bucket = buckets[i];
    for (const item of bucket) {
      if (item.model === "product") {
        await Product.updateOne({ _id: item.id }, { $set: { createdBy: agentId } });
      } else if (item.model === "service") {
        await Service.updateOne({ _id: item.id }, { $set: { createdBy: agentId } });
      } else if (item.model === "education") {
        await EducationListing.updateOne({ _id: item.id }, { $set: { agentId } });
      } else if (item.model === "construction") {
        await ConstructionListing.updateOne({ _id: item.id }, { $set: { agentId } });
      } else if (item.model === "taxi") {
        await TaxiListing.updateOne({ _id: item.id }, { $set: { agentId } });
      }
      reassigned += 1;
    }
  }

  // Ensure every agent has a profile tied to their user id.
  const profiles = await AgentProfile.find({ user: { $in: agentIds } }).select("user").lean();
  const profileUsers = new Set(profiles.map((p) => String(p.user)));
  let createdProfiles = 0;
  for (const agentId of agentIds) {
    if (!profileUsers.has(String(agentId))) {
      await AgentProfile.create({
        user: agentId,
        kind: "SELLER",
        socialServices: [],
        materialServices: [],
        verifiedByAdmin: true
      });
      createdProfiles += 1;
    }
  }

  console.log(
    JSON.stringify({
      updatedUsers,
      reassignedListings: reassigned,
      createdProfiles
    })
  );
}

run().catch((err) => {
  console.error("Failed to reassign agents and listings:", err);
  process.exit(1);
});
