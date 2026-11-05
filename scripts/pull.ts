/**
 * Companies House pull from the command line.
 *
 *   npm run pull            → run only if today's 06:00 (South Africa) pull is due — safe for cron every 5–30 min
 *   npm run pull -- --now   → run a manual pull right now (covers up to today)
 *
 * Example crontab on a server where PULL_SCHEDULER=external:
 *   *\/10 * * * *  cd /var/www/abf && npm run pull >> logs/pull.log 2>&1
 */
for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(f);
  } catch {}
}

async function main() {
  const { runScheduledPull, startPull } = await import("../src/lib/pull/run-pull");
  const { getPullOverview } = await import("../src/lib/pull/status");
  const { pool } = await import("../src/lib/db");

  try {
    if (process.argv.includes("--now")) {
      const r = await startPull({ trigger: "manual", wait: true });
      if (r.status === "busy") console.log("Another pull is already running.");
    } else {
      const r = await runScheduledPull();
      if (!r.ran) console.log(`No pull needed (${r.reason}).`);
    }
    const { latest } = await getPullOverview();
    if (latest) {
      console.log(
        `Latest: ${latest.status} · ${latest.fromDate}→${latest.toDate} · found ${latest.companiesFound}, new ${latest.companiesNew}, ready ${latest.companiesEligible}${latest.error ? ` · error: ${latest.error}` : ""}`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
