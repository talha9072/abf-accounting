import { getCurrentSession } from "@/lib/auth/dal";
import { getPullOverview } from "@/lib/pull/status";

/** Live pull progress for the "Pulling new companies" modal (polled every few seconds). */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "Unauthorised" }, { status: 401 });
  return Response.json(await getPullOverview(), { headers: { "Cache-Control": "no-store" } });
}
