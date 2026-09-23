import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CreateTeamForm,
  EditDepartmentForm,
} from "@/components/organization/org-forms";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ organizationId: string; departmentId: string }>;
}) {
  const { organizationId, departmentId } = await params;
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let department;
  let teams;
  let org;
  try {
    org = await organization.getOrganization(principal, organizationId);
    department = await organization.getDepartment(principal, departmentId);
    if (department.section.organizationId !== organizationId) notFound();
    teams = await organization.listTeams(principal, departmentId);
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
            label: department.section.name,
            href: `/organization/${org.id}/sections/${department.sectionId}`,
          },
          { label: department.name },
        ]}
      />
      <PageHeader
        title={department.name}
        description={department.description ?? "Department workspace"}
      />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <h2 className="mb-3 font-medium">Teams</h2>
          {teams.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No teams yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {teams.map((team) => (
                <li key={team.id} className="py-2">
                  <Link
                    href={`/organization/${org.id}/teams/${team.id}`}
                    className="font-medium hover:text-[var(--accent)]"
                  >
                    {team.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel>
            <h2 className="mb-3 font-medium">Edit department</h2>
            <EditDepartmentForm
              id={department.id}
              name={department.name}
              description={department.description}
              version={department.version}
            />
          </Panel>
          <Panel>
            <CreateTeamForm departmentId={department.id} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
