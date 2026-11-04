import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP. Behind a reverse proxy (nginx, Vercel, cPanel),
 * make sure the proxy sets X-Forwarded-For / X-Real-IP and strips client values.
 */
export async function getClientMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (forwarded || h.get("x-real-ip") || "unknown").slice(0, 64);
  const userAgent = (h.get("user-agent") ?? "").slice(0, 512);
  return { ip, userAgent };
}
