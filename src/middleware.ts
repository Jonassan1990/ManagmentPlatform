import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Light edge guard: unauthenticated users hitting protected paths → /login.
 * Access-without-bindings is handled in layout/shell after principal resolve
 * (JWT has no role claims; bindings live in DB).
 *
 * Also mints/propagates `x-request-id` for log correlation (R1-C).
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/health",
  "/access-not-configured",
  "/_next",
  "/favicon.ico",
];

function resolveRequestId(headerValue: string | null): string {
  const trimmed = headerValue?.trim();
  if (trimmed && /^[A-Za-z0-9._-]{8,128}$/.test(trimmed)) {
    return trimmed;
  }
  // Edge-safe id (no crypto.randomUUID dependency assumptions)
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = resolveRequestId(request.headers.get("x-request-id"));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isPublic) {
    const res = NextResponse.next({
      request: { headers: requestHeaders },
    });
    res.headers.set("x-mgmt-pathname", pathname);
    res.headers.set("x-request-id", requestId);
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
    const res = NextResponse.redirect(login);
    res.headers.set("x-request-id", requestId);
    return res;
  }

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set("x-mgmt-pathname", pathname);
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
