import { notFound, redirect } from "next/navigation";
import { EditTeamForm } from "@/components/organization/org-forms";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
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
        items={[
          { label: "Overview", href: "/" },
          { label: "Organization", href: "/organization" },
          { label: org.name, href: `/organization/${org.id}` },
          {
            label: team.department.section.name,
            href: `/organization/${org.id}/sections/${team.department.sectionId}`,
          },
          {
            label: team.department.name,
            href: `/organization/${org.id}/departments/${team.departmentId}`,
          },
          { label: team.name },
        ]}
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
