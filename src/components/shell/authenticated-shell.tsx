import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { SessionProvider } from "@/components/shell/session-provider";
import { createServices } from "@/server/container";
import { isDevAuthEnabled, getEnv } from "@/server/env";

const OPEN_WHEN_NO_ACCESS = new Set([
  "/login",
  "/access-not-configured",
  "/setup/bootstrap",
]);

function pathAllowedWithoutAccess(pathname: string): boolean {
  if (OPEN_WHEN_NO_ACCESS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  return false;
}

export async function AuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname =
    headerList.get("x-pathname") ??
    headerList.get("x-url") ??
    headerList.get("next-url") ??
    "";

  // Fallback: middleware sets x-middleware-request-pathname in some setups;
  // also try referer-less path from x-invoke-path.
  const path =
    pathname ||
    headerList.get("x-invoke-path") ||
    headerList.get("x-matched-path") ||
    "";

  const { authz, identity } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  const env = getEnv();
  const dev = isDevAuthEnabled(env);

  let hasAccess = false;
  if (principal) {
    hasAccess = await identity.hasAnyAccess(principal.id);
    // DEV empty-state bootstrap may grant on first ensureBootstrapBinding call;
    // re-check after ensuring for DEV so shell reflects access.
    if (!hasAccess && (dev || env.NODE_ENV === "test")) {
      await authz.ensureBootstrapBinding(principal.id);
      hasAccess = await identity.hasAnyAccess(principal.id);
    }
  }

  // Prefer pathname from request URL rewritten by our middleware header.
  const requestPath =
    headerList.get("x-mgmt-pathname") || path || "/";

  if (
    principal &&
    !hasAccess &&
    !pathAllowedWithoutAccess(requestPath)
  ) {
    redirect("/access-not-configured");
  }

  return (
    <SessionProvider>
      <AppShell
        principal={
          principal
            ? {
                displayName: principal.displayName,
                email: principal.email ?? null,
                source: principal.source,
                hasAccess,
              }
            : null
        }
      >
        {children}
      </AppShell>
    </SessionProvider>
  );
}
