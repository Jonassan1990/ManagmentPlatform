import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Light edge guard: unauthenticated users hitting protected paths → /login.
 * Access-without-bindings is handled in layout/shell after principal resolve
 * (JWT has no role claims; bindings live in DB).
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/access-not-configured",
  "/_next",
  "/favicon.ico",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    const res = NextResponse.next();
    res.headers.set("x-mgmt-pathname", pathname);
    return res;
  }

  // Session cookie names used by Auth.js (JWT strategy). DEV auth has no cookie;
  // layout still resolves DEV principal server-side when ALLOW_DEV_AUTH is on.
  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-next-auth.session-token") ??
    request.cookies.get("next-auth.session-token");

  const isDev =
    process.env.NODE_ENV === "development" &&
    (process.env.ALLOW_DEV_AUTH === "true" ||
      process.env.ALLOW_DEV_AUTH === "1");

  if (!sessionCookie && !isDev) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  const res = NextResponse.next();
  res.headers.set("x-mgmt-pathname", pathname);
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets.
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
