import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID;
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
const TWILIO_VIDEO_REGION = process.env.TWILIO_VIDEO_REGION || "us1";

const createTwilioToken = (identity: string, roomName: string) => {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET) {
    throw new Error("Twilio API credentials are missing");
  }

  const ttl = Number(process.env.MEDIA_TOKEN_TTL_SEC || 3600);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    jti: `${TWILIO_API_KEY_SID}-${crypto.randomBytes(8).toString("hex")}`,
    iss: TWILIO_API_KEY_SID,
    sub: TWILIO_ACCOUNT_SID,
    exp: now + ttl,
    nbf: now - 10,
    grants: {
      identity,
      video: {
        room: roomName
      }
    }
  };

  return jwt.sign(payload, TWILIO_API_KEY_SECRET);
};

const createTwilioRoom = async (roomName: string, roomType: string) => {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio REST credentials are missing");
  }
  const payload = new URLSearchParams({
    UniqueName: roomName,
    Type: roomType,
    StatusCallback: `https://example.com/twilio/video/callback`,
    MaxParticipants: "25",
    RecordParticipantsOnConnect: "false"
  });

  const response = await fetch("https://video.twilio.com/v1/Rooms", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString(
        "base64"
      )}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload
  });
  const data = await response.json();
  if (!response.ok) {
    const message = (data && data.message) || "Failed to create Twilio room";
    throw new Error(message);
  }
  return data;
};

export const createMediaToken = async (req: Request, res: Response) => {
  try {
    const provider = (req.body.provider || "twilio").toString().toLowerCase();
    const identity =
      req.body.identity ||
      (req.user ? `user-${String(req.user._id).slice(-6)}` : `guest-${Date.now()}`);
    const roomName = req.body.roomName || `room-${Date.now()}`;

    if (provider === "twilio") {
      const token = createTwilioToken(identity, roomName);
      return res.json({
        provider: "twilio",
        token,
        identity,
        roomName,
        expiresIn: Number(process.env.MEDIA_TOKEN_TTL_SEC || 3600),
        region: TWILIO_VIDEO_REGION
      });
    }

    return res.status(400).json({ message: "Unsupported media provider" });
  } catch (err: any) {
    console.error("createMediaToken error", err);
    return res.status(500).json({ message: err.message || "Unable to build media token" });
  }
};

export const createMediaRoom = async (req: Request, res: Response) => {
  try {
    const provider = (req.body.provider || "twilio").toString().toLowerCase();
    const roomName = req.body.roomName || `room-${Date.now()}`;
    const roomType = req.body.roomType || "group";

    if (provider === "twilio") {
      const twilioRoom = await createTwilioRoom(roomName, roomType);
      return res.json({
        provider: "twilio",
        room: {
          sid: twilioRoom.sid,
          status: twilioRoom.status,
          uniqueName: twilioRoom.unique_name,
          type: twilioRoom.type,
          createdAt: twilioRoom.date_created,
          region: twilioRoom.region
        }
      });
    }

    return res.status(400).json({ message: "Unsupported room provider" });
  } catch (err: any) {
    console.error("createMediaRoom error", err);
    return res.status(500).json({ message: err.message || "Unable to create media room" });
  }
};

const hashCode = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getGeneratedAvatar = (req: Request, res: Response) => {
  const seed = String(req.params.seed || "user").slice(0, 80);
  const hash = hashCode(seed);
  const hueA = hash % 360;
  const hueB = (hash * 7) % 360;
  const hueC = (hash * 13) % 360;
  const letter = seed.replace(/[^a-zA-Z0-9]/g, "").charAt(0).toUpperCase() || "U";

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="avatar">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hueA} 72% 58%)" />
      <stop offset="100%" stop-color="hsl(${hueB} 72% 46%)" />
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#g)" />
  <circle cx="196" cy="62" r="46" fill="hsl(${hueC} 78% 65% / 0.45)" />
  <circle cx="54" cy="212" r="60" fill="hsl(${hueB} 78% 70% / 0.35)" />
  <text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" fill="white"
    font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    font-size="110" font-weight="700">${letter}</text>
</svg>`.trim();

  // Each seed has its own deterministic ETag so caches never cross-user.
  const etag = `"avatar-${encodeURIComponent(seed)}-${hash}"`;
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  // Force fresh fetch to prevent avatar mixing in aggressive proxies/dev tooling.
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Vary", "Accept, Accept-Encoding");
  res.setHeader("ETag", etag);
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(svg);
};
