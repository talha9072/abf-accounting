import "server-only";

/**
 * Outgoing email. No provider is wired up yet — in development the message
 * is printed to the server console so reset links can be tested locally.
 * TODO(go-live): plug in SMTP / Postmark / SES here.
 */
export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`\n──── DEV EMAIL ────\nTo: ${to}\nSubject: ${subject}\n\n${text}\n───────────────────\n`);
    return;
  }
  console.warn(`[mail] No email provider configured — "${subject}" to ${to} was not sent.`);
}
