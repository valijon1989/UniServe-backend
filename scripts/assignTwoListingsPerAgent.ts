import "dotenv/config";
import { connectDb } from "../src/config/db";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";
import { AgentProfile } from "../src/models/AgentProfile";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { EducationListing } from "../src/models/EducationListing";
import { ConstructionListing } from "../src/models/ConstructionListing";
import { TaxiListing } from "../src/models/TaxiListing";
import { stubImage } from "../src/data/stubProducts";

type ListingRef =
  | { model: "product"; id: any }
  | { model: "service"; id: any }
  | { model: "education"; id: any }
  | { model: "construction"; id: any }
  | { model: "taxi"; id: any };

const ensureThreeImages = (seed: string, keyword: string) => [
  stubImage(`${seed}-1`, keyword),
  stubImage(`${seed}-2`, keyword),
  stubImage(`${seed}-3`, keyword)
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

async function createExtraAgents(count: number) {
  if (count <= 0) return [];
  const hash = await bcrypt.hash("Agent123!", 10);
  const existingUsernames = new Set<string>(
    (await User.find({}).select("username").lean()).map((u) => String(u.username))
  );

  const newAgents: any[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = slugify(`extra_agent_${Date.now()}_${i + 1}`);
    let username = `agent_${base}`;
    let suffix = 1;
    while (existingUsernames.has(username)) {
      username = `agent_${base}_${suffix}`;
      suffix += 1;
    }
    existingUsernames.add(username);

    const email = `${username}@agents.local`;
    const name = `Extra Agent ${i + 1}`;
    const user = await User.create({
      email,
      passwordHash: hash,
      name,
      username,
      role: "AGENT",
      isVerified: true,
      isPrivate: false
    });

    await AgentProfile.create({
      user: user._id,
      kind: "SELLER",
      socialServices: [],
      materialServices: [],
      verifiedByAdmin: true
    });

    newAgents.push(user);
  }

  return newAgents;
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");

  await connectDb(mongoUrl);

  const agents = await User.find({ role: "AGENT" })
    .select("_id avatarUrl")
    .sort({ _id: 1 })
    .lean();
  if (!agents.length) throw new Error("No agent users found.");

  const products = await Product.find({}).select("_id").sort({ _id: 1 }).lean();
  const services = await Service.find({}).select("_id").sort({ _id: 1 }).lean();
  const education = await EducationListing.find({}).select("_id").sort({ _id: 1 }).lean();
  const construction = await ConstructionListing.find({}).select("_id").sort({ _id: 1 }).lean();
  const taxi = await TaxiListing.find({}).select("_id").sort({ _id: 1 }).lean();

  const listings: ListingRef[] = [
    ...products.map((p) => ({ model: "product" as const, id: p._id })),
    ...services.map((s) => ({ model: "service" as const, id: s._id })),
    ...education.map((e) => ({ model: "education" as const, id: e._id })),
    ...construction.map((c) => ({ model: "construction" as const, id: c._id })),
    ...taxi.map((t) => ({ model: "taxi" as const, id: t._id }))
  ];

  if (listings.length % 2 !== 0) {
    throw new Error(`Listings count (${listings.length}) must be even to assign 2 per agent.`);
  }

  const desiredAgents = listings.length / 2;
  const missingAgents = Math.max(desiredAgents - agents.length, 0);
  if (missingAgents > 0) {
    await createExtraAgents(missingAgents);
  }

  const allAgents = await User.find({ role: "AGENT" })
    .select("_id avatarUrl")
    .sort({ _id: 1 })
    .lean();

  const usedAvatars = new Set<string>();
  for (let i = 0; i < allAgents.length; i += 1) {
    const agent = allAgents[i];
    const seed = `agent-${agent._id}`;
    let avatarUrl = stubImage(seed, "person portrait");
    let suffix = 1;
    while (usedAvatars.has(avatarUrl)) {
      avatarUrl = stubImage(`${seed}-${suffix}`, "person portrait");
      suffix += 1;
    }
    usedAvatars.add(avatarUrl);
    await User.updateOne({ _id: agent._id }, { $set: { avatarUrl } });
  }

  let updatedListings = 0;
  for (let i = 0; i < allAgents.length; i += 1) {
    const agent = allAgents[i];
    const first = listings[i * 2];
    const second = listings[i * 2 + 1];
    const pair = [first, second];

    for (const item of pair) {
      const seed = `${item.model}-${item.id}-${agent._id}`;
      if (item.model === "product") {
        await Product.updateOne(
          { _id: item.id },
          { $set: { createdBy: agent._id, images: ensureThreeImages(seed, "product") } }
        );
      } else if (item.model === "service") {
        await Service.updateOne({ _id: item.id }, { $set: { createdBy: agent._id } });
      } else if (item.model === "education") {
        await EducationListing.updateOne(
          { _id: item.id },
          { $set: { agentId: agent._id, images: ensureThreeImages(seed, "education") } }
        );
      } else if (item.model === "construction") {
        await ConstructionListing.updateOne(
          { _id: item.id },
          { $set: { agentId: agent._id, images: ensureThreeImages(seed, "construction") } }
        );
      } else if (item.model === "taxi") {
        await TaxiListing.updateOne(
          { _id: item.id },
          { $set: { agentId: agent._id, images: ensureThreeImages(seed, "taxi") } }
        );
      }
      updatedListings += 1;
    }
  }

  console.log(
    JSON.stringify({
      agents: allAgents.length,
      listings: listings.length,
      updatedListings
    })
  );
}

run().catch((err) => {
  console.error("Failed to assign listings:", err);
  process.exit(1);
});
