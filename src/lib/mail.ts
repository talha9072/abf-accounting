import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email over SMTP — works with any provider: Microsoft 365, Google Workspace,
 * your host's mailbox, or Postmark / Brevo / SES SMTP. Set SMTP_* in the environment.
 *
 * Without SMTP_HOST: in development the message is printed to the server console
 * (so reset links can be tested locally); in production it is logged as not sent.
 */
let transporter: Transporter | null = null;

function smtp(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const local = host === "localhost" || host === "127.0.0.1";
    transporter = nodemailer.createTransport({
      host,
      port,
      // 465 = TLS from the start; 587 / 25 upgrade with STARTTLS (required, never plain text).
      // A relay on this machine (e.g. Mailpit for testing) may be plain.
      secure: port === 465,
      requireTLS: port !== 465 && !local,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return transporter;
}

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}

export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }): Promise<boolean> {
  const t = smtp();
  if (!t) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n──── DEV EMAIL ────\nTo: ${to}\nSubject: ${subject}\n\n${text}\n───────────────────\n`);
    } else {
      console.warn(`[mail] SMTP_HOST is not set — "${subject}" to ${to} was not sent.`);
    }
    return false;
  }
  const from = process.env.MAIL_FROM?.trim() || `ABF New Companies <${process.env.SMTP_USER ?? "no-reply@localhost"}>`;
  try {
    await t.sendMail({ from, to, subject, text });
    return true;
  } catch (err) {
    // Never let a mail outage break sign-in or the pull; log it for the admin instead.
    console.error(`[mail] Sending "${subject}" to ${to} failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}
