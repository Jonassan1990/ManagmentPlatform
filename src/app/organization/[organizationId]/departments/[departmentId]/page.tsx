import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CreateTeamForm,
  EditDepartmentForm,
} from "@/components/organization/org-forms";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { buildOrganizationTrail } from "@/modules/navigation/breadcrumbs";
import { PERMISSIONS } from "@/modules/shared/permissions";
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

  const canManage = await authz.can(
    principal,
    PERMISSIONS.ORG_STRUCTURE_MANAGE,
    { type: "ORGANIZATION", organizationId },
  );

  return (
    <div>
      <Breadcrumbs
        items={buildOrganizationTrail({
          organizationId: org.id,
          organizationName: org.name,
          section: {
            id: department.sectionId,
            name: department.section.name,
          },
          department: { id: department.id, name: department.name },
        })}
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
                    className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                  >
                    {team.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-4">
          {canManage ? (
            <>
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
            </>
          ) : (
            <Panel>
              <h2 className="mb-3 font-medium">Structure changes</h2>
              <Alert tone="info" live="polite">
                This department is read-only for your account. Organization
                structure manage permission is required to edit departments or
                add teams.
              </Alert>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
