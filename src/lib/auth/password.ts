import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id with OWASP-recommended parameters
 * (m = 19 MiB, t = 2, p = 1). Output is a self-describing PHC string,
 * so parameters can be raised later without breaking old hashes.
 */
const ARGON2_OPTIONS = {
  algorithm: 2 as const, // Argon2id
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * Used when the email doesn't exist so a failed sign-in takes the same
 * time either way (prevents account enumeration by timing).
 */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  await verifyPassword(await dummyHash, password);
}
