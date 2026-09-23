import { notFound, redirect } from "next/navigation";
import {
  AssignMembershipForm,
  EditResourceForm,
} from "@/components/organization/org-forms";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string; resourceId: string }>;
}) {
  const { organizationId, resourceId } = await params;
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let org;
  let resource;
  let hierarchy;
  try {
    org = await organization.getOrganization(principal, organizationId);
    resource = await organization.getResource(principal, resourceId);
    if (resource.organizationId !== organizationId) notFound();
    hierarchy = await organization.getHierarchy(principal, organizationId);
  } catch {
    notFound();
  }

  const skills = Array.isArray(resource.skillsJson)
    ? (resource.skillsJson as string[])
    : [];
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
        items={[
          { label: "Overview", href: "/" },
          { label: "Organization", href: "/organization" },
          { label: org.name, href: `/organization/${org.id}` },
          { label: "Resources", href: `/organization/${org.id}/resources` },
          { label: resource.name },
        ]}
      />
      <PageHeader
        title={resource.name}
        description="Resource profile and team memberships"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-medium">Edit resource</h2>
          <EditResourceForm
            id={resource.id}
            name={resource.name}
            referenceCode={resource.referenceCode}
            type={resource.type}
            functionRole={resource.functionRole}
            skills={skills}
            capacityHoursPerWeek={
              resource.capacityHoursPerWeek
                ? Number(resource.capacityHoursPerWeek)
                : null
            }
            version={resource.version}
          />
        </Panel>
        <div className="space-y-4">
          <Panel>
            <h2 className="mb-3 font-medium">Current memberships</h2>
            {resource.memberships.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No team memberships.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {resource.memberships.map((membership) => (
                  <li key={membership.id}>
                    {membership.team.name}
                    {membership.isPrimary ? " (primary)" : ""}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <AssignMembershipForm resourceId={resource.id} teams={teams} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
