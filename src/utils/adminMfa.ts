import crypto from "crypto";

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGO = "sha1";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const leftPad = (value: string, length: number): string => value.padStart(length, "0");

const normalizeDigits = (value: string): string => value.replace(/\D/g, "");

const toCounterBuffer = (counter: number): Buffer => {
  const out = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  out.writeUInt32BE(high, 0);
  out.writeUInt32BE(low, 4);
  return out;
};

const hotp = (secret: Buffer, counter: number, digits = TOTP_DIGITS): string => {
  const digest = crypto.createHmac(TOTP_ALGO, secret).update(toCounterBuffer(counter)).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  const token = code % 10 ** digits;
  return leftPad(String(token), digits);
};

const toBase32 = (input: Buffer): string => {
  let bits = 0;
  let value = 0;
  let out = "";

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return out;
};

const hashValue = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");

export const generateTotpSecretHex = (): string => crypto.randomBytes(20).toString("hex");

export const generateTotpCode = (secretHex: string, at = Date.now()): string => {
  const counter = Math.floor(at / 1000 / TOTP_STEP_SECONDS);
  return hotp(Buffer.from(secretHex, "hex"), counter);
};

export const verifyTotpCode = (secretHex: string, code: string, window = 1): boolean => {
  const normalized = normalizeDigits(code);
  if (normalized.length !== TOTP_DIGITS) return false;
  const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
  const secret = Buffer.from(secretHex, "hex");

  for (let delta = -window; delta <= window; delta += 1) {
    if (hotp(secret, counter + delta) === normalized) return true;
  }
  return false;
};

export const buildTotpOtpAuthUrl = (secretHex: string, label: string, issuer: string): string => {
  const secretBase32 = toBase32(Buffer.from(secretHex, "hex"));
  const safeIssuer = encodeURIComponent(issuer);
  const safeLabel = encodeURIComponent(label);
  return `otpauth://totp/${safeIssuer}:${safeLabel}?secret=${secretBase32}&issuer=${safeIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
};

export const generateRecoveryCodes = (count = 8): string[] => {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
    out.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return out;
};

export const hashRecoveryCode = (code: string): string => hashValue(code.replace(/-/g, "").toUpperCase());

export const hashRecoveryCodes = (codes: string[]): string[] => codes.map((code) => hashRecoveryCode(code));

export const consumeRecoveryCode = (
  input: string,
  storedHashes: string[] | undefined
): { ok: boolean; remaining: string[] } => {
  const hashes = Array.isArray(storedHashes) ? [...storedHashes] : [];
  const target = hashRecoveryCode(input || "");
  const index = hashes.findIndex((value) => value === target);
  if (index === -1) return { ok: false, remaining: hashes };
  hashes.splice(index, 1);
  return { ok: true, remaining: hashes };
};

export const generateEmailOtp = (): { code: string; codeHash: string; expiresAt: Date } => {
  const code = leftPad(String(crypto.randomInt(0, 1_000_000)), 6);
  return {
    code,
    codeHash: hashValue(code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  };
};

export const verifyEmailOtp = (code: string, codeHash?: string, expiresAt?: Date): boolean => {
  if (!codeHash || !expiresAt) return false;
  if (expiresAt.getTime() < Date.now()) return false;
  const normalized = normalizeDigits(code);
  if (normalized.length !== 6) return false;
  return hashValue(normalized) === codeHash;
};
