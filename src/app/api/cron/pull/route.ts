import { timingSafeEqual } from "node:crypto";
import { runScheduledPull } from "@/lib/pull/run-pull";

/**
 * External-cron entry point (e.g. cPanel cron, Vercel cron, GitHub Actions):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/pull
 * Returns immediately; the pull runs in the background if it is due.
 */
function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!authorised(req)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  void runScheduledPull().catch((e) => console.error("[cron] pull failed", e));
  return Response.json({ accepted: true }, { status: 202 });
}

export const GET = handle;
export const POST = handle;
