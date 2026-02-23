import "dotenv/config";
import { connectDb } from "../src/config/db";
import { User } from "../src/models/User";
import { AgentProfile } from "../src/models/AgentProfile";
import { EducationListing } from "../src/models/EducationListing";
import { ConstructionListing } from "../src/models/ConstructionListing";
import { TaxiListing } from "../src/models/TaxiListing";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL not set");
  }

  await connectDb(mongoUrl);

  const [
    agentUsers,
    educationAgentIds,
    constructionAgentIds,
    taxiAgentIds,
    productAgentIds,
    serviceAgentIds
  ] = await Promise.all([
    User.find({ role: "AGENT" }).select("_id").lean(),
    EducationListing.distinct("agentId"),
    ConstructionListing.distinct("agentId"),
    TaxiListing.distinct("agentId"),
    Product.distinct("createdBy"),
    Service.distinct("createdBy")
  ]);

  const allUserIds = new Set<string>();
  for (const agent of agentUsers) allUserIds.add(String(agent._id));
  for (const id of educationAgentIds) allUserIds.add(String(id));
  for (const id of constructionAgentIds) allUserIds.add(String(id));
  for (const id of taxiAgentIds) allUserIds.add(String(id));
  for (const id of productAgentIds) allUserIds.add(String(id));
  for (const id of serviceAgentIds) allUserIds.add(String(id));

  if (allUserIds.size === 0) {
    console.log("No agents or listings found.");
    return;
  }

  const users = await User.find({ _id: { $in: Array.from(allUserIds) } })
    .select("_id role isVerified")
    .lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const missingUsers = Array.from(allUserIds).filter((id) => !userById.has(id));
  if (missingUsers.length) {
    console.log(`Listings reference ${missingUsers.length} users that do not exist.`);
  }

  const profiles = await AgentProfile.find({ user: { $in: Array.from(allUserIds) } })
    .select("user")
    .lean();
  const profileUserIds = new Set(profiles.map((p) => String(p.user)));
  const missing = Array.from(allUserIds)
    .filter((id) => !profileUserIds.has(id))
    .map((id) => userById.get(id))
    .filter((u): u is NonNullable<typeof users[number]> => Boolean(u));

  if (missing.length === 0) {
    console.log("All listing/agent users already have profiles.");
    return;
  }

  const flagsByUser = new Map<string, { education: boolean; construction: boolean; taxi: boolean; product: boolean; service: boolean }>();
  const mark = (ids: any[], key: "education" | "construction" | "taxi" | "product" | "service") => {
    for (const id of ids) {
      const stringId = String(id);
      const current = flagsByUser.get(stringId) || {
        education: false,
        construction: false,
        taxi: false,
        product: false,
        service: false
      };
      current[key] = true;
      flagsByUser.set(stringId, current);
    }
  };

  mark(educationAgentIds, "education");
  mark(constructionAgentIds, "construction");
  mark(taxiAgentIds, "taxi");
  mark(productAgentIds, "product");
  mark(serviceAgentIds, "service");

  const profilesToCreate = missing.map((agent) => {
    const flags = flagsByUser.get(String(agent._id)) || {
      education: false,
      construction: false,
      taxi: false,
      product: false,
      service: false
    };
    const serviceLike = flags.education || flags.construction || flags.taxi || flags.service;
    const kind = serviceLike ? "SERVICE" : "SELLER";
    const serviceCategory = flags.taxi ? "taxi" : flags.education ? "education" : flags.construction ? "construction" : undefined;

    return {
      user: agent._id,
      kind,
      socialServices: [],
      materialServices: [],
      verifiedByAdmin: Boolean(agent.isVerified),
      faceIdVerified: false,
      ...(serviceCategory ? { serviceCategory } : {})
    };
  });

  await AgentProfile.insertMany(profilesToCreate);
  await User.updateMany(
    { _id: { $in: missing.map((m) => m._id) } },
    { $set: { role: "AGENT", isVerified: true } }
  );

  console.log(`Created ${profilesToCreate.length} agent profiles.`);
}

run().catch((err) => {
  console.error("Failed to create agent profiles:", err);
  process.exit(1);
});
