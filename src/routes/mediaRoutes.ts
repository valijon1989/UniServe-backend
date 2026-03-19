import { Router } from "express";
import { authRequired } from "../middlewares/auth";
import { createMediaRoom, createMediaToken, getGeneratedAvatar } from "../controllers/mediaController";
import { t } from "../i18n";
import { respondServerError } from "../utils/controllerResponses";

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

type RateEntry = {
  count: number;
  resetAt: number;
};

const router = Router();

const queries: Record<string, string> = {
  consulting: "business consulting office",
  translation: "documents translation office",
  psychology: "therapy counseling room",
  legal: "lawyer office meeting",
  sport: "personal trainer gym"
};

const cache = new Map<string, CacheEntry>();
const rateBucket = new Map<string, RateEntry>();

const cacheTtlMs = Number(process.env.PEXELS_CACHE_TTL_MS || 60 * 60 * 1000);
const rateWindowMs = Number(process.env.PEXELS_RATE_WINDOW_MS || 15 * 60 * 1000);
const rateMax = Number(process.env.PEXELS_RATE_MAX || 60);

router.get("/avatar/:seed.svg", getGeneratedAvatar);

router.get("/:category", authRequired, async (req, res) => {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: t(req, "media.config.api_key_missing.error") });
    }

    const category = String(req.params.category || "").toLowerCase();
    const query = queries[category];
    if (!query) {
      return res.status(404).json({ error: t(req, "media.lookup.category_not_found.error") });
    }

    const ip = req.ip || "unknown";
    const now = Date.now();
    const bucket = rateBucket.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      rateBucket.set(ip, { count: 1, resetAt: now + rateWindowMs });
    } else if (bucket.count >= rateMax) {
      return res.status(429).json({ error: t(req, "media.rate_limit.exceeded.error") });
    } else {
      bucket.count += 1;
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const perPage = Math.min(30, Math.max(1, Number(req.query.per_page || 12)));
    const cacheKey = `${category}:${page}:${perPage}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return res.json(cached.data);
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: apiKey
        }
      }
    );

    if (!response.ok) {
      return res.status(502).json({ error: t(req, "media.upstream.pexels.error") });
    }

    const data = await response.json();
    cache.set(cacheKey, { expiresAt: now + cacheTtlMs, data });
    return res.json(data);
  } catch (err) {
    return respondServerError(req, res, "error");
  }
});

router.post("/rooms", authRequired, createMediaRoom);
router.post("/token", authRequired, createMediaToken);

export default router;
