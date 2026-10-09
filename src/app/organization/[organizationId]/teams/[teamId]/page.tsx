import { notFound, redirect } from "next/navigation";
import { EditTeamForm } from "@/components/organization/org-forms";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { buildOrganizationTrail } from "@/modules/navigation/breadcrumbs";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ organizationId: string; teamId: string }>;
}) {
  const { organizationId, teamId } = await params;
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let team;
  let org;
  try {
    org = await organization.getOrganization(principal, organizationId);
    team = await organization.getTeam(principal, teamId);
    if (team.department.section.organizationId !== organizationId) notFound();
  } catch {
    notFound();
  }

  return (
    <div>
      <Breadcrumbs
        items={buildOrganizationTrail({
          organizationId: org.id,
          organizationName: org.name,
          section: {
            id: team.department.sectionId,
            name: team.department.section.name,
          },
          department: {
            id: team.departmentId,
            name: team.department.name,
          },
          team: { id: team.id, name: team.name },
        })}
      />
      <PageHeader
        title={team.name}
        description={team.description ?? "Team workspace"}
      />
      <Panel className="max-w-xl">
        <h2 className="mb-3 font-medium">Edit team</h2>
        <EditTeamForm
          id={team.id}
          name={team.name}
          description={team.description}
          version={team.version}
        />
      </Panel>
    </div>
  );
}
