/**
 * Sends one test email through the SMTP settings in .env.local (or the env).
 * Run: npx tsx --conditions=react-server scripts/test-mail.ts you@example.com
 */
for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(f);
  } catch {}
}
import("../src/lib/mail").then(async ({ sendMail, mailConfigured }) => {
  const to = process.argv[2];
  if (!to) throw new Error("Usage: scripts/test-mail.ts you@example.com");
  if (!mailConfigured()) console.log("SMTP_HOST isn't set — the email will only be printed here.");
  const ok = await sendMail({ to, subject: "ABF New Companies — test email", text: "If you can read this, email from ABF New Companies works." });
  console.log(ok ? `Sent to ${to}` : "Not sent (see above)");
  process.exit(ok || !mailConfigured() ? 0 : 1);
});
