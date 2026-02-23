import "dotenv/config";
import { connectDb } from "../src/config/db";
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

  const [education, construction, taxi, products, services] = await Promise.all([
    EducationListing.countDocuments({}),
    ConstructionListing.countDocuments({}),
    TaxiListing.countDocuments({}),
    Product.countDocuments({}),
    Service.countDocuments({})
  ]);

  console.log(JSON.stringify({ education, construction, taxi, products, services }));
}

run().catch((err) => {
  console.error("Failed to inspect listings:", err);
  process.exit(1);
});
