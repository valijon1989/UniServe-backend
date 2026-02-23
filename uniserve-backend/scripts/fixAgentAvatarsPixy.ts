import 'dotenv/config';
import mongoose, { Schema } from 'mongoose';

type UserDoc = {
  _id: mongoose.Types.ObjectId;
  role?: string;
  avatarUrl?: string;
};

type AgentDoc = {
  _id: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  avatarUrl?: string;
};

const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  throw new Error('MONGO_URL is not set');
}

const UserSchema = new Schema(
  {
    role: String,
    avatarUrl: String,
  },
  { collection: 'users' }
);

const AgentSchema = new Schema(
  {
    user: Schema.Types.ObjectId,
    avatarUrl: String,
  },
  { collection: 'agents' }
);

const User = mongoose.model<UserDoc>('User', UserSchema);
const Agent = mongoose.model<AgentDoc>('Agent', AgentSchema);

const DEFAULT_TAGS = ['people', 'portrait', 'face', 'person'];
const TAGS = (process.env.PIXY_TAGS || '')
  .split(',')
  .map((tag) => tag.trim().toLowerCase())
  .filter(Boolean);
const ACTIVE_TAGS = TAGS.length ? TAGS : DEFAULT_TAGS;

const PIXY_BASE = 'https://pixy.org';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchText = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'uniserve-backend/1.0 (+https://pixy.org)',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status})`);
  }
  return res.text();
};

const tryHead = async (url: string) => {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') || '';
    return contentType.startsWith('image/');
  } catch {
    return false;
  }
};

const tryRangeGet = async (url: string) => {
  try {
    const res = await fetch(url, { headers: { range: 'bytes=0-0' } });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') || '';
    return contentType.startsWith('image/');
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
  const patterns = [
    /https?:\/\/pixy\.org\/src\/\d+\/\d+\.(?:jpg|jpeg|png)/i,
    /https?:\/\/cdn\.pixy\.org\/[^"' ]+\.(?:jpg|jpeg|png)/i,
    /https?:\/\/pixy\.org\/src\/\d+\/\d+_[^"' ]+\.(?:jpg|jpeg|png)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[0];
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
    // Ignore and fallback to direct guess.
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
    let html = '';
    try {
      html = await fetchText(tagUrl);
    } catch (error) {
      console.warn(`Tag page failed: ${tagUrl}`, error);
      continue;
    }

    const ids = extractIds(html).filter((id) => !seenIds.has(id));
    ids.forEach((id) => seenIds.add(id));

    for (const id of ids) {
      if (urls.size >= required) return Array.from(urls);
      const imageUrl = await resolvePixyImage(id);
      if (imageUrl) {
        urls.add(imageUrl);
      }
      await sleep(50);
    }
  }

  return Array.from(urls);
};

const run = async () => {
  await mongoose.connect(MONGO_URL);

  const users = await User.find({ role: 'AGENT' }).select('_id').lean();
  const agents = await Agent.find({}).select('_id user').lean();
  const targetCount = Math.max(users.length, agents.length);

  if (!targetCount) {
    console.log('No agents found.');
    await mongoose.disconnect();
    return;
  }

  const pixyUrls = await collectPixyImages(targetCount);
  if (pixyUrls.length < targetCount) {
    throw new Error(
      `Pixy images yetarli emas. Kerak: ${targetCount}, topildi: ${pixyUrls.length}. ` +
        `PIXy_TAGS ni kengaytiring yoki keyinroq qayta urinib ko'ring.`
    );
  }

  const userIdSet = new Set(users.map((u) => String(u._id)));
  const used = new Set<string>();

  let updatedUsers = 0;
  for (let i = 0; i < users.length; i += 1) {
    const url = pixyUrls[i];
    used.add(url);
    const userId = users[i]._id;
    await User.updateOne({ _id: userId }, { $set: { avatarUrl: url } });
    await Agent.updateOne({ user: userId }, { $set: { avatarUrl: url } });
    updatedUsers += 1;
  }

  let updatedAgents = 0;
  let urlIndex = users.length;
  for (const agent of agents) {
    if (agent.user && userIdSet.has(String(agent.user))) continue;
    while (urlIndex < pixyUrls.length && used.has(pixyUrls[urlIndex])) {
      urlIndex += 1;
    }
    if (urlIndex >= pixyUrls.length) break;
    const url = pixyUrls[urlIndex];
    used.add(url);
    await Agent.updateOne({ _id: agent._id }, { $set: { avatarUrl: url } });
    updatedAgents += 1;
    urlIndex += 1;
  }

  console.log(
    JSON.stringify(
      {
        updatedUsers,
        updatedAgents,
        totalAgents: agents.length,
        totalUsers: users.length,
        pixyTags: ACTIVE_TAGS,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('fixAgentAvatarsPixy failed:', error);
  process.exit(1);
});
