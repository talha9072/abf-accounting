import "server-only";
import { runScheduledPull } from "./run-pull";

const TICK_MS = 60_000;
const g = globalThis as unknown as { __abfPullScheduler?: NodeJS.Timeout };

/**
 * In-process scheduler for a long-running Node server (`next start`, PM2, cPanel Node app).
 * Every minute it asks "is a pull due?" — the answer comes from the database, so restarts,
 * several server processes, or an extra external cron can never double-run a pull
 * (a Postgres advisory lock guards the pull itself).
 */
export function startPullScheduler() {
  if (g.__abfPullScheduler) return;
  const tick = async () => {
    try {
      const r = await runScheduledPull();
      if (r.ran) console.info("[pull-scheduler] pull finished", r.pullId);
    } catch (e) {
      console.error("[pull-scheduler] tick failed", e);
    }
  };
  g.__abfPullScheduler = setInterval(tick, TICK_MS);
  g.__abfPullScheduler.unref?.();
  setTimeout(tick, 15_000).unref?.();
  console.info("[pull-scheduler] started — daily pull at 06:00 South Africa time, retries every 30 minutes");
}
