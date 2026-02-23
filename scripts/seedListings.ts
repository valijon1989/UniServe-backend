import "dotenv/config";
import { connectDb } from "../src/config/db";
import { AgentProfile } from "../src/models/AgentProfile";
import { EducationListing } from "../src/models/EducationListing";
import { ConstructionListing } from "../src/models/ConstructionListing";
import { TaxiListing } from "../src/models/TaxiListing";
import { stubImage } from "../src/data/stubProducts";

type SeedAgent = {
  userId: string;
  serviceCategory?: string;
};

const educationSeeds = [
  {
    title: "English for Beginners",
    category: "language",
    subcategory: "english",
    description: "A1-A2 level grammar and speaking basics.",
    format: "online",
    languageOfInstruction: "English",
    weeklyHours: 4,
    weeklyDays: 3,
    totalDurationValue: 2,
    totalDurationUnit: "months",
    onlineSchedule: { days: ["Mon", "Wed", "Fri"], time: "19:00", durationMinutes: 90 },
    images: [stubImage("edu-english-1", "english class"), stubImage("edu-english-2", "language learning"), stubImage("edu-english-3", "teacher")]
  },
  {
    title: "Frontend Skills Bootcamp",
    category: "skill",
    subcategory: "frontend",
    description: "HTML, CSS, JS fundamentals with small projects.",
    format: "online",
    languageOfInstruction: "Uzbek",
    weeklyHours: 6,
    weeklyDays: 3,
    totalDurationValue: 6,
    totalDurationUnit: "weeks",
    onlineSchedule: { days: ["Tue", "Thu", "Sat"], time: "20:00", durationMinutes: 120 },
    images: [stubImage("edu-frontend-1", "coding class"), stubImage("edu-frontend-2", "javascript")]
  },
  {
    title: "Mathematics Exam Prep",
    category: "special",
    subcategory: "math-exam",
    description: "Focused exam prep with practice tests.",
    format: "offline",
    offlineLocation: { address: "Tashkent, Chilonzor", building: "Study Center", room: "204", schedule: "Weekend 10:00-13:00" },
    languageOfInstruction: "Uzbek",
    weeklyHours: 3,
    weeklyDays: 1,
    totalDurationValue: 8,
    totalDurationUnit: "weeks",
    images: [stubImage("edu-math-1", "math class"), stubImage("edu-math-2", "exam prep")]
  }
];

const constructionSeeds = [
  {
    title: "Interior ремонт - квартира",
    category: "interior",
    subcategory: "apartment",
    description: "Pol, devor, shift ishlari, sifatli materiallar bilan.",
    location: "Tashkent",
    priceFrom: 1500000,
    priceTo: 9000000,
    currency: "UZS",
    images: [stubImage("const-interior-1", "interior renovation"), stubImage("const-interior-2", "apartment interior")]
  },
  {
    title: "Exterior фасад ishlari",
    category: "exterior",
    subcategory: "facade",
    description: "Fasad bo'yash va izolyatsiya ishlari.",
    location: "Tashkent",
    priceFrom: 2000000,
    priceTo: 12000000,
    currency: "UZS",
    images: [stubImage("const-facade-1", "building facade"), stubImage("const-facade-2", "construction exterior")]
  }
];

const taxiSeeds = [
  {
    title: "Shahar ichida taxi xizmat",
    city: "Tashkent",
    serviceArea: "Chilonzor, Yunusobod, Mirzo-Ulugbek",
    carType: "Sedan",
    vehicleModel: "Chevrolet Cobalt",
    options: ["AC", "Wi-Fi"],
    capacity: 4,
    pricePerHour: 90000,
    currency: "UZS",
    languages: ["Uzbek", "Russian"],
    description: "24/7 xavfsiz va tezkor taxi.",
    images: [stubImage("taxi-1", "taxi car"), stubImage("taxi-2", "city taxi")]
  },
  {
    title: "Business class taxi",
    city: "Tashkent",
    serviceArea: "Markaz",
    carType: "Business",
    vehicleModel: "Toyota Camry",
    options: ["Leather seats", "AC"],
    capacity: 4,
    pricePerHour: 180000,
    currency: "UZS",
    languages: ["Uzbek", "English"],
    description: "Business uchrashuvlar uchun qulay.",
    images: [stubImage("taxi-3", "business car"), stubImage("taxi-4", "luxury taxi")]
  }
];

const ensureServiceCategory = async (userId: string, category: string) => {
  const profile = await AgentProfile.findOne({ user: userId });
  if (!profile) return;
  if (!profile.serviceCategory) {
    profile.serviceCategory = category as any;
    await profile.save();
  }
};

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL not set");
  }

  await connectDb(mongoUrl);

  const agents = await AgentProfile.find({}).select("user serviceCategory").lean();
  if (!agents.length) {
    throw new Error("No agent profiles found.");
  }

  const seedAgents: SeedAgent[] = agents.map((a) => ({ userId: String(a.user), serviceCategory: a.serviceCategory }));
  let agentIndex = 0;
  const nextAgent = () => {
    const agent = seedAgents[agentIndex % seedAgents.length];
    agentIndex += 1;
    return agent;
  };

  const existingEducation = await EducationListing.find({}).select("title category subcategory agentId").lean();
  const eduKey = new Set(existingEducation.map((e) => `${e.title}||${e.category}||${e.subcategory}||${e.agentId}`));

  const eduToInsert = educationSeeds.map((item) => {
    const agent = nextAgent();
    return { ...item, agentId: agent.userId };
  }).filter((item) => !eduKey.has(`${item.title}||${item.category}||${item.subcategory}||${item.agentId}`));

  const existingConstruction = await ConstructionListing.find({}).select("title category subcategory agentId").lean();
  const consKey = new Set(existingConstruction.map((e) => `${e.title}||${e.category}||${e.subcategory}||${e.agentId}`));

  const consToInsert = constructionSeeds.map((item) => {
    const agent = nextAgent();
    return { ...item, agentId: agent.userId };
  }).filter((item) => !consKey.has(`${item.title}||${item.category}||${item.subcategory}||${item.agentId}`));

  const existingTaxi = await TaxiListing.find({}).select("title city vehicleModel agentId").lean();
  const taxiKey = new Set(existingTaxi.map((e) => `${e.title}||${e.city}||${e.vehicleModel}||${e.agentId}`));

  const taxiToInsert = taxiSeeds.map((item) => {
    const agent = nextAgent();
    return { ...item, agentId: agent.userId, status: "active" };
  }).filter((item) => !taxiKey.has(`${item.title}||${item.city}||${item.vehicleModel}||${item.agentId}`));

  if (eduToInsert.length) {
    await EducationListing.insertMany(eduToInsert);
  }
  if (consToInsert.length) {
    await ConstructionListing.insertMany(consToInsert);
  }
  if (taxiToInsert.length) {
    await TaxiListing.insertMany(taxiToInsert);
  }

  for (const item of eduToInsert) {
    await ensureServiceCategory(item.agentId.toString(), "education");
  }
  for (const item of consToInsert) {
    await ensureServiceCategory(item.agentId.toString(), "construction");
  }
  for (const item of taxiToInsert) {
    await ensureServiceCategory(item.agentId.toString(), "taxi");
  }

  console.log(
    JSON.stringify({
      educationInserted: eduToInsert.length,
      constructionInserted: consToInsert.length,
      taxiInserted: taxiToInsert.length
    })
  );
}

run().catch((err) => {
  console.error("Failed to seed listings:", err);
  process.exit(1);
});
