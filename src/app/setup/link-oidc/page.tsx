import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LinkOidcForm } from "@/components/identity/link-oidc-form";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";
import { prisma } from "@/server/db";
import { isOidcConfigured } from "@/server/env";

export const dynamic = "force-dynamic";

/**
 * Platform-admin cutover tool: attach an OIDC (issuer, subject) to an existing
 * Principal without auto-merging by email (ADR-018 / R1-B).
 */
export default async function LinkOidcPage() {
  const { authz } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/login");

  const canManage = await authz.can(principal, PERMISSIONS.ROLE_MANAGE, {
    type: "PLATFORM",
  });
  if (!canManage) {
    notFound();
  }

  const allPrincipals = await prisma.principal.findMany({
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, displayName: true, email: true },
  });
  const principalOptions = allPrincipals.map((p) => ({
    id: p.id,
    label: `${p.displayName ?? "Unnamed"} — ${p.id}`,
  }));

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Setup" },
          { label: "Link OIDC" },
        ]}
      />
      <PageHeader
        title="Link OIDC identity"
        description="Explicitly attach an enterprise SSO subject to an existing Principal. Does not grant roles and never merges by email."
        actions={
          <Link
            href="/"
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
          >
            Overview
          </Link>
        }
      />

      <Panel className="mb-4">
        <p className="text-sm text-[var(--muted)]">
          OIDC env configured:{" "}
          <strong>{isOidcConfigured() ? "yes" : "no"}</strong>. Temporary owner
          credentials remain available until Production SSO is verified and{" "}
          <code className="text-xs">TEMP_AUTH_*</code> is removed in a separate
          controlled change.
        </p>
      </Panel>

      <Panel>
        <LinkOidcForm principals={principalOptions} />
      </Panel>
    </div>
  );
}
