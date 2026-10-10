import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { Alert } from "@/components/ui/alert";
import { homeCrumb, organizationHubCrumb } from "@/modules/navigation/breadcrumbs";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function OrganizationIndexPage() {
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) {
    redirect("/");
  }

  const orgs = await organization.listOrganizations(principal);
  const canCreateAnother =
    orgs.length > 0
      ? await authz.can(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
          type: "PLATFORM",
        })
      : false;

  return (
    <div>
      <Breadcrumbs
        items={[homeCrumb(), { label: organizationHubCrumb().label }]}
      />
      <PageHeader
        title="Organization"
        description="Configure the organizational hierarchy used across management and planning."
      />

      {orgs.length === 0 ? (
        <EmptyState
          title="No organization has been configured yet"
          description="Create the first organization to unlock sections, departments, teams, and resources."
          action={
            <Link
              href="/organization/setup"
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Set up organization
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel>
            <h2 className="mb-3 font-medium">Organizations</h2>
            <ul className="divide-y divide-[var(--line)]">
              {orgs.map((org) => (
                <li key={org.id} className="py-3">
                  <Link
                    href={`/organization/${org.id}`}
                    className="block min-h-11 rounded-sm py-1 hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    <p className="font-medium">{org.name}</p>
                    {org.description ? (
                      <p className="text-sm text-[var(--muted)]">
                        {org.description}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <h2 className="mb-3 font-medium">Create another organization</h2>
            {canCreateAnother ? (
              <CreateOrganizationForm redirectToOrg />
            ) : (
              <Alert tone="info" live="polite">
                Creating another organization requires platform organization
                structure manage permission. You can still browse organizations
                you can read.
              </Alert>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
