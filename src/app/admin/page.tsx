import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage() {
  const { authz, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const orgs = await organization.listOrganizations(principal);
  const adminOrgs = (
    await Promise.all(
      orgs.map(async (org) => {
        const [canStructure, canAccess] = await Promise.all([
          authz.can(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
            type: "ORGANIZATION",
            organizationId: org.id,
          }),
          authz.can(principal, PERMISSIONS.ROLE_MANAGE, {
            type: "ORGANIZATION",
            organizationId: org.id,
          }),
        ]);
        if (!canStructure && !canAccess) return null;
        return {
          id: org.id,
          name: org.name,
          description: org.description,
          canStructure,
          canAccess,
        };
      }),
    )
  ).filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (adminOrgs.length === 1) {
    redirect(`/organization/${adminOrgs[0]!.id}/admin`);
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Admin config" },
        ]}
      />
      <PageHeader
        title="Admin config"
        description="Confirm users, roles, and departments, place people in the hierarchy, and manage access — all in one place."
      />

      {adminOrgs.length === 0 ? (
        <EmptyState
          title="No organization you can administer"
          description="You need organization-level structure or access management permission. Ask an organization admin if you need Admin config."
          action={
            <Link
              href="/organization"
              className={buttonClassName({ variant: "secondary" })}
            >
              Open Organization
            </Link>
          }
        />
      ) : (
        <Panel>
          <h2 className="mb-3 text-base font-semibold text-[var(--ink)]">
            Choose an organization
          </h2>
          <ul className="divide-y divide-[var(--line)]">
            {adminOrgs.map((org) => (
              <li
                key={org.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium text-[var(--ink)]">{org.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {[
                      org.canStructure ? "Hierarchy & people" : null,
                      org.canAccess ? "Roles & logins" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Link
                  href={`/organization/${org.id}/admin`}
                  className={buttonClassName({ variant: "primary", size: "sm" })}
                >
                  Open admin config
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
