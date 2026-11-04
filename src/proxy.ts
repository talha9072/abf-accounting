import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route guard. It only checks that a session cookie exists —
 * real validation (DB lookup, expiry, revocation) happens in the DAL
 * (`requireUser`) inside every protected layout, page and server action.
 */
const SESSION_COOKIES = ["__Host-abf_session", "abf_session"];
const PUBLIC_PATHS = ["/sign-in", "/register", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  // Authenticated pages must never be cached by shared proxies.
  if (!isPublic) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, static files and the brand assets.
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
