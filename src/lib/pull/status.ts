import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pulls } from "@/lib/db/schema";
import { formatDay, formatSaTime } from "./dates";

export type PullSummary = {
  id: string;
  status: "running" | "succeeded" | "failed";
  stage: string;
  trigger: string;
  fromDate: string;
  toDate: string;
  fromLabel: string;
  toLabel: string;
  pagesDone: number;
  pagesTotal: number;
  companiesFound: number;
  companiesNew: number;
  companiesEligible: number;
  officersDone: number;
  officersTotal: number;
  attempt: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  /** "06:04" South Africa time */
  timeLabel: string;
  /** 0–100 overall progress */
  percent: number;
};

type PullRow = typeof pulls.$inferSelect;

/** A "running" pull with no heartbeat for this long has died (server restart / crash). */
const STALE_MS = 3 * 60 * 1000;

function toSummary(row: PullRow): PullSummary {
  const stale = row.status === "running" && Date.now() - row.heartbeatAt.getTime() > STALE_MS;
  const p: PullRow = stale
    ? { ...row, status: "failed", error: "Interrupted — the server stopped while the pull was running.", finishedAt: row.heartbeatAt }
    : row;
  const fetchShare = p.pagesTotal ? Math.min(1, p.pagesDone / p.pagesTotal) : 0;
  const officerShare = p.officersTotal ? Math.min(1, p.officersDone / p.officersTotal) : 0;
  const percent =
    p.status === "succeeded"
      ? 100
      : p.stage === "fetch"
        ? Math.round(fetchShare * 20)
        : p.stage === "rules"
          ? 25
          : p.stage === "officers"
            ? Math.round(30 + officerShare * 70)
            : 100;
  return {
    id: p.id,
    status: p.status as PullSummary["status"],
    stage: p.stage,
    trigger: p.trigger,
    fromDate: p.fromDate,
    toDate: p.toDate,
    fromLabel: formatDay(p.fromDate),
    toLabel: formatDay(p.toDate),
    pagesDone: p.pagesDone,
    pagesTotal: p.pagesTotal ?? 0,
    companiesFound: p.companiesFound,
    companiesNew: p.companiesNew,
    companiesEligible: p.companiesEligible,
    officersDone: p.officersDone,
    officersTotal: p.officersTotal,
    attempt: p.attempt,
    error: p.error,
    startedAt: p.startedAt.toISOString(),
    finishedAt: p.finishedAt?.toISOString() ?? null,
    timeLabel: formatSaTime(p.finishedAt ?? p.startedAt),
    percent,
  };
}

/** Latest pull (any status) and the latest successful one. */
export async function getPullOverview(): Promise<{ latest: PullSummary | null; lastSuccess: PullSummary | null }> {
  const [latest] = await db.select().from(pulls).orderBy(desc(pulls.startedAt)).limit(1);
  const [ok] =
    latest?.status === "succeeded"
      ? [latest]
      : await db.select().from(pulls).where(eq(pulls.status, "succeeded")).orderBy(desc(pulls.finishedAt)).limit(1);
  return { latest: latest ? toSummary(latest) : null, lastSuccess: ok ? toSummary(ok) : null };
}
