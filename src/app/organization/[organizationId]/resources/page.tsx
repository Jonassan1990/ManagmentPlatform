import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateResourceForm } from "@/components/organization/org-forms";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { buildOrganizationTrail } from "@/modules/navigation/breadcrumbs";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let org;
  let resources;
  let hierarchy;
  try {
    org = await organization.getOrganization(principal, organizationId);
    resources = await organization.listResources(principal, organizationId);
    hierarchy = await organization.getHierarchy(principal, organizationId);
  } catch {
    notFound();
  }

  const canManage = await authz.can(
    principal,
    PERMISSIONS.ORG_STRUCTURE_MANAGE,
    { type: "ORGANIZATION", organizationId },
  );

  const teams =
    hierarchy?.sections.flatMap((section) =>
      section.departments.flatMap((department) =>
        department.teams.map((team) => ({
          id: team.id,
          name: `${section.name} / ${department.name} / ${team.name}`,
        })),
      ),
    ) ?? [];

  return (
    <div>
      <Breadcrumbs
        items={buildOrganizationTrail({
          organizationId: org.id,
          organizationName: org.name,
          leaf: "Resources",
        })}
      />
      <PageHeader
        title="Resources"
        description="Capacity-bearing entities. Distinct from authenticated user accounts."
      />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          {resources.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No resources yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {resources.map((resource) => (
                <li key={resource.id} className="py-2">
                  <Link
                    href={`/organization/${org.id}/resources/${resource.id}`}
                    className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                  >
                    {resource.name}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {resource.type}
                    {resource.referenceCode ? ` · ${resource.referenceCode}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          {canManage ? (
            <CreateResourceForm organizationId={org.id} teams={teams} />
          ) : (
            <>
              <h2 className="mb-3 font-medium">Create resource</h2>
              <Alert tone="info" live="polite">
                Creating resources requires organization structure manage
                permission.
              </Alert>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
