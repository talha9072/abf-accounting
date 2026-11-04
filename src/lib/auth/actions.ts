"use server";

import { redirect } from "next/navigation";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { sendMail } from "@/lib/mail";
import { generateToken, sha256 } from "./crypto";
import { getCurrentSession } from "./dal";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import {
  LOCK_WINDOW_MS,
  SIGN_IN_MAX_FAILURES,
  isIpLimited,
  recentSignInFailures,
  recordAttempt,
} from "./rate-limit";
import { getClientMeta } from "./request";
import { createSession, destroyCurrentSession, revokeUserSessions } from "./session";
import {
  changePasswordSchema,
  forgotSchema,
  registerSchema,
  resetSchema,
  safeNextPath,
  signInSchema,
} from "./validation";

export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echo non-secret values back so the form keeps them after an error. */
  values?: Record<string, string>;
} | null;

const fieldErrors = (e: z.ZodError) => z.flattenError(e).fieldErrors as Record<string, string[] | undefined>;
const RESET_TTL_MS = 30 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Sign in                                                             */
/* ------------------------------------------------------------------ */

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember"),
    next: formData.get("next") ?? undefined,
  });
  const emailValue = String(formData.get("email") ?? "").slice(0, 254);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: { email: emailValue } };

  const { email, password, remember, next } = parsed.data;
  const { ip } = await getClientMeta();

  if (await isIpLimited("sign_in", ip)) {
    return { message: "Too many sign-in attempts from this network. Wait 15 minutes and try again.", values: { email } };
  }

  const failures = await recentSignInFailures(email);
  if (failures >= SIGN_IN_MAX_FAILURES) {
    await burnPasswordCheck(password);
    return {
      message: "This account is locked for 15 minutes after too many attempts. Reset your password or try again later.",
      values: { email },
    };
  }

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, status: users.status })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let valid = false;
  if (user) valid = await verifyPassword(user.passwordHash, password);
  else await burnPasswordCheck(password);

  if (!valid || !user || user.status !== "active") {
    await recordAttempt("sign_in", { email, ip, success: false });
    const left = SIGN_IN_MAX_FAILURES - (failures + 1);
    if (user) {
      await db
        .update(users)
        .set({
          failedLoginCount: failures + 1,
          lockedUntil: left <= 0 ? new Date(Date.now() + LOCK_WINDOW_MS) : null,
        })
        .where(eq(users.id, user.id));
    }
    return {
      fieldErrors: {
        password: [
          left > 0
            ? `That email and password don't match. ${left} ${left === 1 ? "attempt" : "attempts"} left before a 15-minute lock.`
            : "That email and password don't match. This account is now locked for 15 minutes.",
        ],
      },
      values: { email },
    };
  }

  await recordAttempt("sign_in", { email, ip, success: true });
  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  await createSession(user.id, remember);

  redirect(safeNextPath(next));
}

/* ------------------------------------------------------------------ */
/* Register                                                            */
/* ------------------------------------------------------------------ */

function allowedDomain(email: string) {
  const domains = (process.env.ALLOWED_SIGNUP_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) return true;
  const domain = email.split("@")[1] ?? "";
  return domains.includes(domain);
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    firstName: String(formData.get("firstName") ?? "").slice(0, 80),
    lastName: String(formData.get("lastName") ?? "").slice(0, 80),
    email: String(formData.get("email") ?? "").slice(0, 254),
  };

  if (process.env.REGISTRATION_ENABLED === "false") {
    return { message: "New accounts are created by your admin. Ask them to invite you.", values };
  }

  const parsed = registerSchema.safeParse({
    ...values,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const { ip } = await getClientMeta();
  if (await isIpLimited("register", ip)) {
    return { message: "Too many accounts created from this network. Try again in an hour.", values };
  }

  const { firstName, lastName, email, password } = parsed.data;
  if (!allowedDomain(email)) {
    await recordAttempt("register", { email, ip, success: false });
    return { fieldErrors: { email: ["Use your work email address to create an account."] }, values };
  }

  const passwordHash = await hashPassword(password);
  const [{ n: existingUsers }] = await db.select({ n: count() }).from(users);

  const inserted = await db
    .insert(users)
    .values({
      email,
      firstName,
      lastName,
      passwordHash,
      // The very first account becomes the admin.
      role: existingUsers === 0 ? "admin" : "staff",
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  await recordAttempt("register", { email, ip, success: inserted.length > 0 });

  if (inserted.length === 0) {
    return {
      fieldErrors: { email: ["An account already uses this email. Sign in, or reset your password."] },
      values,
    };
  }

  await createSession(inserted[0].id, false);
  redirect("/new-companies");
}

/* ------------------------------------------------------------------ */
/* Forgot password → reset link                                        */
/* ------------------------------------------------------------------ */

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  const emailValue = String(formData.get("email") ?? "").slice(0, 254);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: { email: emailValue } };

  const { email } = parsed.data;
  const { ip } = await getClientMeta();

  // Same response whether or not the account exists (no enumeration).
  const done: FormState = { ok: true, values: { email } };

  if (await isIpLimited("reset_request", ip)) return done;
  await recordAttempt("reset_request", { email, ip, success: true });

  const [user] = await db
    .select({ id: users.id, firstName: users.firstName, status: users.status })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user || user.status !== "active") return done;

  // One live link at a time: invalidate older unused tokens.
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

  const token = generateToken();
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
    requestedIp: ip,
  });

  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await sendMail({
    to: email,
    subject: "Reset your ABF New Companies password",
    text: `Hi ${user.firstName},\n\nUse this link to choose a new password. It works for 30 minutes and can only be used once:\n\n${base}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
  });

  return done;
}

/* ------------------------------------------------------------------ */
/* Reset password (from emailed link)                                  */
/* ------------------------------------------------------------------ */

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const errs = fieldErrors(parsed.error);
    if (errs.token) return { message: "This reset link isn't valid." };
    return { fieldErrors: errs };
  }

  const { ip } = await getClientMeta();
  if (await isIpLimited("reset", ip)) return { message: "Too many attempts. Try again in an hour." };

  const { token, password } = parsed.data;
  const [row] = await db
    .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, sha256(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  await recordAttempt("reset", { ip, success: Boolean(row) });
  if (!row) return { message: "This reset link has expired or was already used." };

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    await tx
      .update(users)
      .set({ passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, row.userId));
  });
  // Kill every existing session — anyone holding an old cookie is signed out.
  await revokeUserSessions(row.userId);

  redirect("/sign-in?reset=1");
}

/* ------------------------------------------------------------------ */
/* Signed-in actions                                                   */
/* ------------------------------------------------------------------ */

export async function signOutAction() {
  await destroyCurrentSession();
  redirect("/sign-in");
}

export async function signOutOtherDevicesAction(): Promise<FormState> {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  await revokeUserSessions(session.user.id, session.sessionId);
  return { ok: true, message: "Other devices have been signed out." };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const { ip } = await getClientMeta();
  if (await isIpLimited("change_password", ip)) return { message: "Too many attempts. Try again in 15 minutes." };

  const [user] = await db
    .select({ passwordHash: users.passwordHash, email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const ok = user ? await verifyPassword(user.passwordHash, parsed.data.currentPassword) : false;
  await recordAttempt("change_password", { email: user?.email, ip, success: ok });
  if (!ok) return { fieldErrors: { currentPassword: ["That isn't your current password."] } };

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password), passwordChangedAt: new Date() })
    .where(eq(users.id, session.user.id));
  await revokeUserSessions(session.user.id, session.sessionId);

  return { ok: true, message: "Password changed. Other devices were signed out." };
}
