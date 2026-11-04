import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { validateSession, type SessionUser } from "./session";

/**
 * Data Access Layer — the single place pages, layouts and server actions
 * ask "who is signed in?". Memoised per request with React `cache`.
 */
export const getCurrentSession = cache(async () => validateSession());

/** Use in protected pages/layouts/actions. Redirects to sign-in if not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

/** Use on auth pages: bounce signed-in users straight to the app. */
export async function redirectIfSignedIn() {
  const session = await getCurrentSession();
  if (session) redirect("/new-companies");
}
