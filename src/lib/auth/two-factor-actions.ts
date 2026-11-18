"use server";

import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { recoveryCodes, users } from "@/lib/db/schema";
import { sha256 } from "./crypto";
import { getCurrentSession } from "./dal";
import { verifyPassword } from "./password";
import { isIpLimited, recordAttempt } from "./rate-limit";
import { getClientMeta } from "./request";
import { revokeUserSessions } from "./session";
import { forgetTrustedDevices } from "./two-factor";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  groupSecret,
  normaliseRecoveryCode,
  otpauthUri,
  verifyTotp,
} from "./totp";

type Fail = { ok: false; message: string; field?: string };

async function saveNewRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await db.transaction(async (tx) => {
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    await tx.insert(recoveryCodes).values(codes.map((c) => ({ userId, codeHash: sha256(normaliseRecoveryCode(c)) })));
  });
  return codes;
}

async function checkPassword(userId: string, email: string, password: string): Promise<Fail | null> {
  const { ip } = await getClientMeta();
  if (await isIpLimited("change_password", ip)) return { ok: false, message: "Too many attempts. Try again in 15 minutes." };
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  const ok = row ? await verifyPassword(row.hash, password) : false;
  await recordAttempt("change_password", { email, ip, success: ok });
  return ok ? null : { ok: false, field: "password", message: "That isn't your current password." };
}

/** Step 1 — make a new secret and return the QR code to scan. Nothing is switched on yet. */
export async function startTwoFactorSetupAction(): Promise<
  { ok: true; qr: string; secret: string } | Fail
> {
  const s = await getCurrentSession();
  if (!s) return { ok: false, message: "Please sign in again." };
  const secret = generateTotpSecret();
  await db.update(users).set({ totpPendingSecret: encryptSecret(secret) }).where(eq(users.id, s.user.id));
  const qr = await QRCode.toDataURL(otpauthUri(secret, s.user.email), { margin: 1, width: 200, errorCorrectionLevel: "M" });
  return { ok: true, qr, secret: groupSecret(secret) };
}

/** Step 2 — the first code from the app proves it was set up; switch on and hand out recovery codes. */
export async function confirmTwoFactorSetupAction(input: { code: string }): Promise<{ ok: true; codes: string[] } | Fail> {
  const s = await getCurrentSession();
  if (!s) return { ok: false, message: "Please sign in again." };
  const code = z.string().trim().max(16).safeParse(input?.code);
  if (!code.success) return { ok: false, field: "code", message: "Enter the 6-digit code from your app." };

  const { ip } = await getClientMeta();
  if (await isIpLimited("two_factor", ip)) return { ok: false, message: "Too many wrong codes. Wait 15 minutes and try again." };

  const [row] = await db.select({ pending: users.totpPendingSecret }).from(users).where(eq(users.id, s.user.id)).limit(1);
  if (!row?.pending) return { ok: false, message: "Set-up timed out. Close this and start again." };

  const secret = decryptSecret(row.pending);
  const step = verifyTotp(secret, code.data, null);
  await recordAttempt("two_factor", { email: s.user.email, ip, success: step !== null });
  if (step === null) {
    return { ok: false, field: "code", message: "That code isn't right. Check the app shows “ABF New Companies” and type the newest code." };
  }

  await db
    .update(users)
    .set({ totpSecret: row.pending, totpPendingSecret: null, totpLastStep: step, twoFactorEnabled: true, updatedAt: new Date() })
    .where(eq(users.id, s.user.id));
  await forgetTrustedDevices(s.user.id);
  // Anyone else signed in to this account must now sign in with a code.
  await revokeUserSessions(s.user.id, s.sessionId);
  const codes = await saveNewRecoveryCodes(s.user.id);
  revalidatePath("/account");
  return { ok: true, codes };
}

/** Turn it off — needs the password so a walked-away-from computer can't do it. */
export async function disableTwoFactorAction(input: { password: string }): Promise<{ ok: true; message: string } | Fail> {
  const s = await getCurrentSession();
  if (!s) return { ok: false, message: "Please sign in again." };
  const pw = z.string().min(1).max(256).safeParse(input?.password);
  if (!pw.success) return { ok: false, field: "password", message: "Enter your password." };
  const fail = await checkPassword(s.user.id, s.user.email, pw.data);
  if (fail) return fail;

  await db
    .update(users)
    .set({ twoFactorEnabled: false, totpSecret: null, totpPendingSecret: null, totpLastStep: null, updatedAt: new Date() })
    .where(eq(users.id, s.user.id));
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, s.user.id));
  await forgetTrustedDevices(s.user.id);
  revalidatePath("/account");
  return { ok: true, message: "Two-step sign-in is off" };
}

/** New set of 10 recovery codes; the old ones stop working. */
export async function regenerateRecoveryCodesAction(input: { password: string }): Promise<{ ok: true; codes: string[] } | Fail> {
  const s = await getCurrentSession();
  if (!s) return { ok: false, message: "Please sign in again." };
  const pw = z.string().min(1).max(256).safeParse(input?.password);
  if (!pw.success) return { ok: false, field: "password", message: "Enter your password." };
  const fail = await checkPassword(s.user.id, s.user.email, pw.data);
  if (fail) return fail;

  const [row] = await db
    .select({ enabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, s.user.id))
    .limit(1);
  if (!row?.enabled) return { ok: false, message: "Turn on two-step sign-in first." };
  const codes = await saveNewRecoveryCodes(s.user.id);
  revalidatePath("/account");
  return { ok: true, codes };
}
