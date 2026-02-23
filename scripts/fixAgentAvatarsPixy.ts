import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../src/config/db";
import { User } from "../src/models/User";


const DEFAULT_TAGS = ["people", "portrait", "face", "person"];
const TAGS = (process.env.PIXY_TAGS || "")
  .split(",")
  .map((tag) => tag.trim().toLowerCase())
  .filter(Boolean);
const ACTIVE_TAGS = TAGS.length ? TAGS : DEFAULT_TAGS;

const PIXY_BASE = "https://pixy.org";
const MAX_IDS_PER_TAG = Number(process.env.PIXY_MAX_IDS || 60);
const REQUEST_TIMEOUT_MS = Number(process.env.PIXY_TIMEOUT_MS || 8000);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchText = async (url: string) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      "user-agent": "uniserve-backend/1.0 (+https://pixy.org)",
      accept: "text/html,application/xhtml+xml",
    },
  }).finally(() => clearTimeout(timer));
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  return res.text();
};

const tryHead = async (url: string) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    );
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    return contentType.startsWith("image/");
  } catch {
    return false;
  }
};

const tryRangeGet = async (url: string) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { range: "bytes=0-0" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    return contentType.startsWith("image/");
  } catch {
    return false;
  }
};

const extractIds = (html: string) => {
  const ids = new Set<string>();
  const patterns = [
    /href="\/(\d{4,})\/"/g,
    /href='\/(\d{4,})\/'/g,
    /https?:\/\/pixy\.org\/(\d{4,})\//g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
      ids.add(match[1]);
    }
  }
  return Array.from(ids);
};

const extractImageUrl = (html: string) => {
  const metaPatterns = [
    /property=["']og:image["']\s+content=["']([^"']+)["']/i,
    /name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
  ];
  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }

  const patterns = [
    /https?:\/\/pixy\.org\/src\/\d+\/\d+\.(?:jpg|jpeg|png)/i,
    /https?:\/\/pixy\.org\/src\/\d+\/\d+_[^"' ]+\.(?:jpg|jpeg|png)/i,
    /https?:\/\/cdn\.pixy\.org\/[^"' ]+\.(?:jpg|jpeg|png)/i,
    /https?:\/\/[^"' ]+\.pixy\.org\/[^"' ]+\.(?:jpg|jpeg|png)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[0];
  }

  const attrPatterns = [
    /data-src=["']([^"']+\.(?:jpg|jpeg|png))["']/i,
    /data-original=["']([^"']+\.(?:jpg|jpeg|png))["']/i,
    /src=["']([^"']+\.(?:jpg|jpeg|png))["']/i,
  ];
  for (const pattern of attrPatterns) {
    const match = html.match(pattern);
    if (match?.[1] && match[1].includes("pixy")) return match[1];
  }

  return null;
};

const resolvePixyImage = async (id: string) => {
  const pageUrl = `${PIXY_BASE}/${id}/`;
  try {
    const html = await fetchText(pageUrl);
    const fromPage = extractImageUrl(html);
    if (fromPage) return fromPage;
  } catch {
    // ignore
  }

  const folder = Math.floor(Number(id) / 10000);
  const base = `${PIXY_BASE}/src/${folder}/${id}`;
  const candidates = [`${base}.jpg`, `${base}.jpeg`, `${base}.png`];
  for (const url of candidates) {
    if (await tryHead(url)) return url;
    if (await tryRangeGet(url)) return url;
  }
  return null;
};

const collectPixyImages = async (required: number) => {
  const urls = new Set<string>();
  const seenIds = new Set<string>();

  for (const tag of ACTIVE_TAGS) {
    const tagUrl = `${PIXY_BASE}/tag/${encodeURIComponent(tag)}/`;
    let html = "";
    try {
      html = await fetchText(tagUrl);
    } catch (error) {
      console.warn(`Tag page failed: ${tagUrl}`, error);
      continue;
    }

    const ids = extractIds(html)
      .filter((id) => !seenIds.has(id))
      .slice(0, MAX_IDS_PER_TAG);
    ids.forEach((id) => seenIds.add(id));

    console.log(`Pixy tag "${tag}": ${ids.length} ta ID topildi.`);

    for (const id of ids) {
      if (urls.size >= required) return Array.from(urls);
      const imageUrl = await resolvePixyImage(id);
      if (imageUrl) urls.add(imageUrl);
      await sleep(50);
    }
    console.log(`Pixy tag "${tag}": jami ${urls.size} ta rasm yig'ildi.`);
  }

  return Array.from(urls);
};

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL is not set");
  }
  await connectDb(mongoUrl);

  const agents = await User.find({ role: "AGENT" }).select("_id").lean();
  if (!agents.length) {
    console.log("No agents found.");
    await mongoose.disconnect();
    return;
  }

  const pixyUrls = await collectPixyImages(agents.length);
  if (pixyUrls.length < agents.length) {
    await mongoose.disconnect();
    throw new Error(
      `Pixy images yetarli emas. Kerak: ${agents.length}, topildi: ${pixyUrls.length}. ` +
        `PIXY_TAGS ni kengaytiring yoki keyinroq qayta urinib ko'ring.`
    );
  }

  let updated = 0;
  for (let i = 0; i < agents.length; i += 1) {
    const avatarUrl = pixyUrls[i];
    await User.updateOne({ _id: agents[i]._id }, { $set: { avatarUrl } });
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        updated,
        totalAgents: agents.length,
        pixyTags: ACTIVE_TAGS,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("fixAgentAvatarsPixy failed:", err);
  process.exit(1);
});
