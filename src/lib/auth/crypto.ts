import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256-bit random token, URL-safe. Sent to the browser / in reset links. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest. Only hashes of tokens are ever stored in the database. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
