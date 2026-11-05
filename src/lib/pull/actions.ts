"use server";

import { getCurrentSession } from "@/lib/auth/dal";
import { startPull } from "./run-pull";

export type StartPullResult = { ok: true; pullId: string } | { ok: false; message: string };

/** "Run pull now" / "Retry now" — any signed-in user. The pull keeps running in the background. */
export async function startPullNowAction(): Promise<StartPullResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, message: "Please sign in again." };
  if (!process.env.COMPANIES_HOUSE_API_KEY) return { ok: false, message: "The Companies House API key isn’t set up yet." };

  const r = await startPull({ trigger: "manual", userId: session.user.id, wait: false });
  if (r.status === "busy") return { ok: false, message: "A pull is already running — it’s shown below." };
  return { ok: true, pullId: r.pullId };
}
