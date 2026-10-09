import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { SessionProvider } from "@/components/shell/session-provider";
import { DEFAULT_SHELL_CAPABILITIES } from "@/modules/navigation/nav-definition";
import { resolveShellNavContext } from "@/modules/navigation/resolve-shell-nav";
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

  const path =
    pathname ||
    headerList.get("x-invoke-path") ||
    headerList.get("x-matched-path") ||
    "";

  const { authz, identity, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  const env = getEnv();
  const dev = isDevAuthEnabled(env);

  let hasAccess = false;
  if (principal) {
    hasAccess = await identity.hasAnyAccess(principal.id);
    if (!hasAccess && (dev || env.NODE_ENV === "test")) {
      await authz.ensureBootstrapBinding(principal.id);
      hasAccess = await identity.hasAnyAccess(principal.id);
    }
  }

  const requestPath =
    headerList.get("x-mgmt-pathname") || path || "/";

  if (
    principal &&
    !hasAccess &&
    !pathAllowedWithoutAccess(requestPath)
  ) {
    redirect("/access-not-configured");
  }

  let nav = {
    capabilities: DEFAULT_SHELL_CAPABILITIES,
    organizationId: null as string | null,
  };

  if (principal && hasAccess) {
    try {
      const orgs = await organization.listOrganizations(principal);
      const resolved = await resolveShellNavContext(
        authz,
        principal,
        orgs.map((o) => o.id),
      );
      nav = {
        capabilities: resolved.capabilities,
        organizationId: resolved.organizationId,
      };
    } catch {
      // Fail soft for chrome — pages still enforce AuthZ.
      nav = {
        capabilities: {
          ...DEFAULT_SHELL_CAPABILITIES,
          canManageGovernancePolicy: false,
          canManageAccess: false,
          canCreatePi: false,
          canCreateInitiative: false,
        },
        organizationId: null,
      };
    }
  } else if (!principal) {
    nav = {
      capabilities: {
        canViewApprovals: false,
        canViewDecisions: false,
        canManageGovernancePolicy: false,
        canManageAccess: false,
        canViewPi: false,
        canCreatePi: false,
        canViewInitiatives: false,
        canCreateInitiative: false,
      },
      organizationId: null,
    };
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
        nav={nav}
      >
        {children}
      </AppShell>
    </SessionProvider>
  );
}
