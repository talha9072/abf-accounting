/**
 * Runs once when the Next.js server starts.
 * Starts the daily Companies House pull scheduler unless PULL_SCHEDULER is
 * "external" (you run `npm run pull` from cron) or "off".
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const mode = (process.env.PULL_SCHEDULER ?? "internal").toLowerCase();
  if (mode !== "internal") return;
  // The Companies House key is entered in Business settings; each tick checks for it.
  if (!process.env.DATABASE_URL) {
    console.warn("[pull-scheduler] not started — DATABASE_URL missing");
    return;
  }
  const { startPullScheduler } = await import("./lib/pull/scheduler");
  startPullScheduler();
}
