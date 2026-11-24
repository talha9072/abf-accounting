"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/dal";
import { CH_KEY_PATTERN, checkCompaniesHouseKey, removeCompaniesHouseKey, saveCompaniesHouseKey } from "./key";

export type ChKeyResult = { ok: true; message: string } | { ok: false; message: string; fieldError?: string };

function encryptionReady() {
  return Buffer.from(process.env.AUTH_ENCRYPTION_KEY ?? "", "base64").length === 32;
}

/** Business settings → Companies House: check the key with Companies House, then save it encrypted. Admins only. */
export async function saveCompaniesHouseKeyAction(input: string): Promise<ChKeyResult> {
  const s = await getCurrentSession();
  if (!s) return { ok: false, message: "Please sign in again." };
  if (s.user.role !== "admin") return { ok: false, message: "Only admins can change the Companies House key." };

  const key = String(input ?? "").trim();
  if (!CH_KEY_PATTERN.test(key)) {
    return { ok: false, message: "That doesn’t look like a Companies House API key.", fieldError: "Paste the REST API key from your Companies House developer account (letters, numbers and dashes)." };
  }
  if (!encryptionReady()) {
    return { ok: false, message: "The server is missing AUTH_ENCRYPTION_KEY, which protects saved keys. Ask whoever runs the server to set it (see the handover guide), then try again." };
  }

  const check = await checkCompaniesHouseKey(key);
  if (check === "rejected") {
    return { ok: false, message: "Companies House didn’t accept this key.", fieldError: "Companies House rejected this key. Check you copied the whole REST API key from a Live application." };
  }

  await saveCompaniesHouseKey(key, s.user.id);
  revalidatePath("/", "layout");
  return check === "ok"
    ? { ok: true, message: "Companies House key checked and saved — the next pull uses it" }
    : { ok: true, message: "Key saved, but Companies House didn’t answer to check it. Try “Run pull now” later" };
}

export async function removeCompaniesHouseKeyAction(): Promise<ChKeyResult> {
  const s = await getCurrentSession();
  if (!s) return { ok: false, message: "Please sign in again." };
  if (s.user.role !== "admin") return { ok: false, message: "Only admins can change the Companies House key." };
  await removeCompaniesHouseKey();
  revalidatePath("/", "layout");
  return { ok: true, message: "Companies House key removed — pulls stop until a new key is saved" };
}
