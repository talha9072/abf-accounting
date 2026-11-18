import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Authenticator-app codes (TOTP, RFC 6238): HMAC-SHA1, 6 digits, 30-second steps —
 * the defaults every app (Google Authenticator, Microsoft Authenticator, 1Password, Authy) uses.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
/** Accept the previous and next step too, for phone clocks that are a little off. */
const DRIFT_STEPS = 1;
const ISSUER = "ABF New Companies";

/* ------------------------------------------------------------------ */
/* Base32 (RFC 4648) — the format authenticator apps expect             */
/* ------------------------------------------------------------------ */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/* ------------------------------------------------------------------ */
/* TOTP                                                                */
/* ------------------------------------------------------------------ */

/** 160-bit random secret, base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0xf;
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return bin.toString().padStart(DIGITS, "0");
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/** The code an app would show right now (used by tests). */
export function totpCode(secretBase32: string, now = Date.now()): string {
  return hotp(base32Decode(secretBase32), currentStep(now));
}

/**
 * Checks a 6-digit code. Returns the step it matched, or null.
 * Steps at or before `lastUsedStep` are refused so a code can't be replayed.
 */
export function verifyTotp(secretBase32: string, code: string, lastUsedStep: number | null, now = Date.now()): number | null {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const secret = base32Decode(secretBase32);
  const step = currentStep(now);
  for (let s = step - DRIFT_STEPS; s <= step + DRIFT_STEPS; s++) {
    if (lastUsedStep !== null && s <= lastUsedStep) continue;
    const expected = Buffer.from(hotp(secret, s));
    if (timingSafeEqual(expected, Buffer.from(digits))) return s;
  }
  return null;
}

/** otpauth:// link that the QR code carries. */
export function otpauthUri(secretBase32: string, email: string): string {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer: ISSUER, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** "ABCD EFGH …" — easier to type into an app by hand. */
export function groupSecret(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}

/* ------------------------------------------------------------------ */
/* Recovery codes                                                      */
/* ------------------------------------------------------------------ */

const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i

/** 10 codes like "k7m2-x9pq" (≈50 bits each). */
export function generateRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const bytes = randomBytes(8);
    const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
  });
}

/** Lower-case, no spaces or dashes — so "K7M2 X9PQ" matches "k7m2-x9pq". */
export function normaliseRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/* ------------------------------------------------------------------ */
/* Encryption at rest (AES-256-GCM)                                    */
/* ------------------------------------------------------------------ */

function encryptionKey(): Buffer {
  const raw = process.env.AUTH_ENCRYPTION_KEY ?? "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("AUTH_ENCRYPTION_KEY must be 32 random bytes, base64 encoded (see .env.example).");
  }
  return key;
}

/** "v1.<iv>.<tag>.<ciphertext>" — all base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
