import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Breadcrumbs,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function OrganizationIndexPage() {
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) {
    redirect("/");
  }

  const orgs = await organization.listOrganizations(principal);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Organization" },
        ]}
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
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
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
                    className="block hover:text-[var(--accent)]"
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
            <CreateOrganizationForm redirectToOrg />
          </Panel>
        </div>
      )}
    </div>
  );
}
