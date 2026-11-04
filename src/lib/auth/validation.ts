import { z } from "zod";

/** Small deny-list of the most common passwords (top breached + obvious ones). */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd",
  "123456789012", "1234567890", "qwertyuiop", "qwerty123456", "iloveyou1234",
  "letmein12345", "welcome12345", "administrator", "abfaccounting", "accounting123",
  "changeme1234", "football1234", "sunshine1234", "trustno11234", "aaaaaaaaaaaa",
]);

export const emailSchema = z
  .string({ error: "Enter your work email." })
  .trim()
  .toLowerCase()
  .min(1, "Enter your work email.")
  .max(254, "That email is too long.")
  .pipe(z.email("Enter a valid email address, like name@abfaccounting.com."));

export const newPasswordSchema = z
  .string({ error: "Enter a password." })
  .min(12, "Use at least 12 characters.")
  .max(128, "Use 128 characters or fewer.")
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), "That password is too common. Pick something harder to guess.")
  .refine((v) => new Set(v).size >= 5, "Use a mix of different characters.");

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(80, `Your ${label} is too long.`)
    .regex(/^[\p{L}\p{M}' .-]+$/u, `Use letters only in your ${label}.`);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(256),
  remember: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  next: z.string().optional(),
});

export const registerSchema = z
  .object({
    firstName: name("first name"),
    lastName: name("last name"),
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match.",
  })
  .refine((d) => !d.password.toLowerCase().includes(d.email.split("@")[0] ?? "\u0000"), {
    path: ["password"],
    message: "Don't include your email in your password.",
  });

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords don't match.",
  });

/** Only allow same-site relative redirects after sign-in (no open redirects). */
export function safeNextPath(next: unknown, fallback = "/new-companies"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/^\/(sign-in|register|forgot-password|reset-password)/.test(next)) return fallback;
  return next;
}
