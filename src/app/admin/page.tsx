import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PlatformAdminPanel,
  type PlatformAdminStatusView,
} from "@/components/admin/platform-admin-panel";
import { buttonClassName } from "@/components/ui/button";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import {
  ensureTempAuthOwnerPlatformAccess,
  getPlatformAdminStatus,
} from "@/modules/demo/ensure-platform-admin-ready";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";
import { getTempAuthEnv } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function AdminIndexPage() {
  const { authz, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/login");

  await ensureTempAuthOwnerPlatformAccess(principal.id);

  const temp = getTempAuthEnv();
  const isTempOwner = temp?.TEMP_AUTH_PRINCIPAL_ID === principal.id;
  const canPlatform = await authz.can(principal, PERMISSIONS.ROLE_MANAGE, {
    type: "PLATFORM",
  });

  if (!canPlatform && !isTempOwner) {
    // Fall through to org-admin picker for organization admins.
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
          description="Confirm users, roles, and departments, place people in the hierarchy, and manage access."
        />
        {adminOrgs.length === 0 ? (
          <EmptyState
            title="No organization you can administer"
            description="Ask a platform admin to grant you organization admin, or sign in with the owner account."
            action={
              <Link
                href="/"
                className={buttonClassName({ variant: "secondary" })}
              >
                Back home
              </Link>
            }
          />
        ) : (
          <OrgAdminPicker orgs={adminOrgs} />
        )}
      </div>
    );
  }

  const status = (await getPlatformAdminStatus(
    principal.id,
  )) as PlatformAdminStatusView;

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
          canStructure,
          canAccess,
        };
      }),
    )
  ).filter((row): row is NonNullable<typeof row> => Boolean(row));

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
        description="Set up the application, sync people for View as, and open organization admin tools."
      />

      <PlatformAdminPanel status={status} />

      {adminOrgs.length > 0 ? (
        <Panel className="mt-4">
          <h2 className="mb-3 text-base font-semibold text-[var(--ink)]">
            Organization admin pages
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
                  className={buttonClassName({
                    variant: "primary",
                    size: "sm",
                  })}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function OrgAdminPicker({
  orgs,
}: {
  orgs: Array<{
    id: string;
    name: string;
    canStructure: boolean;
    canAccess: boolean;
  }>;
}) {
  return (
    <Panel>
      <h2 className="mb-3 text-base font-semibold text-[var(--ink)]">
        Choose an organization
      </h2>
      <ul className="divide-y divide-[var(--line)]">
        {orgs.map((org) => (
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
  );
}
