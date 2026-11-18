/**
 * Checks the two-step sign-in maths: RFC 6238 test vectors, replay protection,
 * clock drift, recovery codes and secret encryption.
 * Run: npx tsx --conditions=react-server scripts/test-totp.ts
 */
import { randomBytes } from "node:crypto";
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  normaliseRecoveryCode,
  otpauthUri,
  totpCode,
  verifyTotp,
} from "../src/lib/auth/totp";

let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failed++;
};

// RFC 6238 appendix B (SHA-1 secret "12345678901234567890"), last 6 of the 8 digits.
const rfc = base32Encode(Buffer.from("12345678901234567890"));
for (const [t, code] of [[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"]] as const) {
  check(`RFC 6238 T=${t} → ${code}`, totpCode(rfc, t * 1000) === code);
}

check("base32 round trip", base32Decode(base32Encode(Buffer.from("hello world!"))).toString() === "hello world!");

const secret = generateTotpSecret();
check("secret is 32 base32 chars (160 bits)", /^[A-Z2-7]{32}$/.test(secret));
const now = Date.now();
const code = totpCode(secret, now);
const step = verifyTotp(secret, code, null, now);
check("current code accepted", step !== null);
check("same code refused the second time (replay)", verifyTotp(secret, code, step, now) === null);
check("code from 30 s ago still accepted (drift)", verifyTotp(secret, totpCode(secret, now - 30_000), null, now) !== null);
check("code from 2 min ago refused", verifyTotp(secret, totpCode(secret, now - 120_000), null, now) === null);
check("spaces in code allowed", verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, null, now) !== null);
check("wrong code refused", verifyTotp(secret, code === "000000" ? "111111" : "000000", null, now) === null);
check("letters refused", verifyTotp(secret, "abcdef", null, now) === null);

const codes = generateRecoveryCodes();
check("10 recovery codes", codes.length === 10 && new Set(codes).size === 10);
check("recovery code format xxxx-xxxx", codes.every((c) => /^[a-z2-9]{4}-[a-z2-9]{4}$/.test(c)));
check("recovery code normalises", normaliseRecoveryCode(" K7M2 x9pq ") === "k7m2x9pq");

process.env.AUTH_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
const enc = encryptSecret(secret);
check("encrypted secret doesn't contain the secret", !enc.includes(secret));
check("decrypts back", decryptSecret(enc) === secret);
check("two encryptions differ (random IV)", encryptSecret(secret) !== enc);
let tampered = false;
try {
  decryptSecret(enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA"));
} catch {
  tampered = true;
}
check("tampered ciphertext rejected", tampered);
check("otpauth link", otpauthUri(secret, "a@b.com").startsWith("otpauth://totp/ABF%20New%20Companies%3Aa%40b.com?secret="));

console.log(failed ? `\n${failed} failed` : "\nAll two-step checks passed");
process.exit(failed ? 1 : 0);
