import "dotenv/config";
import { connectDb } from "../src/config/db";
import { User } from "../src/models/User";
import { Product } from "../src/models/Product";
import { Service } from "../src/models/Service";
import { EducationListing } from "../src/models/EducationListing";
import { ConstructionListing } from "../src/models/ConstructionListing";
import { TaxiListing } from "../src/models/TaxiListing";
import { stubImage } from "../src/data/stubProducts";

const uniqueUrl = (seed: string, keyword: string, used: Set<string>) => {
  let url = stubImage(seed, keyword);
  let suffix = 1;
  while (used.has(url)) {
    url = stubImage(`${seed}-${suffix}`, keyword);
    suffix += 1;
  }
  used.add(url);
  return url;
};

const uniqueImages = (seed: string, keyword: string, used: Set<string>) => [
  uniqueUrl(`${seed}-1`, keyword, used),
  uniqueUrl(`${seed}-2`, keyword, used),
  uniqueUrl(`${seed}-3`, keyword, used)
];

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL not set");

  await connectDb(mongoUrl);

  const used = new Set<string>();

  const users = await User.find({ role: "AGENT" }).select("_id").lean();
  let updatedAvatars = 0;
  for (const user of users) {
    const avatarUrl = uniqueUrl(`avatar-${user._id}`, "person portrait", used);
    await User.updateOne({ _id: user._id }, { $set: { avatarUrl } });
    updatedAvatars += 1;
  }

  const products = await Product.find({}).select("_id").lean();
  for (const item of products) {
    const images = uniqueImages(`product-${item._id}`, "product", used);
    await Product.updateOne({ _id: item._id }, { $set: { images } });
  }

  const education = await EducationListing.find({}).select("_id").lean();
  for (const item of education) {
    const images = uniqueImages(`education-${item._id}`, "education", used);
    await EducationListing.updateOne({ _id: item._id }, { $set: { images } });
  }

  const construction = await ConstructionListing.find({}).select("_id").lean();
  for (const item of construction) {
    const images = uniqueImages(`construction-${item._id}`, "construction", used);
    await ConstructionListing.updateOne({ _id: item._id }, { $set: { images } });
  }

  const taxi = await TaxiListing.find({}).select("_id").lean();
  for (const item of taxi) {
    const images = uniqueImages(`taxi-${item._id}`, "taxi", used);
    await TaxiListing.updateOne({ _id: item._id }, { $set: { images } });
  }

  // Services do not store images, only ensure they stay distinct by ownership already set.
  const serviceCount = await Service.countDocuments({});

  console.log(
    JSON.stringify({
      updatedAvatars,
      updatedProductImages: products.length,
      updatedEducationImages: education.length,
      updatedConstructionImages: construction.length,
      updatedTaxiImages: taxi.length,
      services: serviceCount
    })
  );
}

run().catch((err) => {
  console.error("Failed to fix unique images:", err);
  process.exit(1);
});
