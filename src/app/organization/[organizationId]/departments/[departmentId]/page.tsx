import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CreateTeamForm,
  EditDepartmentForm,
} from "@/components/organization/org-forms";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import {
  mapInitiativeStageBadge,
  mapProjectStatusBadge,
} from "@/components/ui/status-adapters";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildOrganizationTrail } from "@/modules/navigation/breadcrumbs";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ organizationId: string; departmentId: string }>;
}) {
  const { organizationId, departmentId } = await params;
  const { authz, organization } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let workspace;
  let org;
  let siblingDepartments: { id: string; name: string; parentDepartmentId: string | null }[] =
    [];
  try {
    org = await organization.getOrganization(principal, organizationId);
    workspace = await organization.getDepartmentWorkspace(principal, departmentId);
    if (workspace.organizationId !== organizationId) notFound();
    siblingDepartments = await organization.listDepartments(
      principal,
      workspace.department.sectionId,
    );
  } catch {
    notFound();
  }

  const { department, teams, members, initiatives, projects, counts } = workspace;
  const childDepartments = siblingDepartments.filter(
    (row) => row.parentDepartmentId === department.id,
  );
  const parentDepartment = department.parentDepartmentId
    ? siblingDepartments.find((row) => row.id === department.parentDepartmentId) ??
      null
    : null;

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
        description={
          department.description ??
          "Resources, projects, and initiatives for this department."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/portfolio?organizationId=${org.id}&departmentId=${department.id}`}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 text-sm"
            >
              Portfolio view
            </Link>
            <Link
              href={`/organization/${org.id}#org-chart`}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 text-sm"
            >
              Back to hierarchy
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountChip label="Resources" value={counts.resources} />
        <CountChip label="Projects" value={counts.projects} />
        <CountChip label="Initiatives" value={counts.initiatives} />
        <CountChip label="Teams" value={counts.teams} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Panel>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="mp-section-title">Resources</h2>
              <Link
                href={`/organization/${org.id}/resources`}
                className="text-sm text-[var(--accent)]"
              >
                All resources
              </Link>
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No people in this department yet. Assign people to a team under
                this department.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {members.map((member) => (
                  <li key={member.id} className="py-2">
                    <Link
                      href={`/organization/${org.id}/resources/${member.id}`}
                      className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                    >
                      {member.name}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">
                      {[member.role, member.teams.join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="mp-section-title">Projects</h2>
              <Link
                href={`/portfolio/explorer?organizationId=${org.id}&departmentId=${department.id}`}
                className="text-sm text-[var(--accent)]"
              >
                Explorer
              </Link>
            </div>
            {projects.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No projects owned by or participating with this department.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {projects.map((project) => (
                  <li
                    key={project.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div>
                      <Link
                        href={`/initiatives/${project.initiativeId}/project`}
                        className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                      >
                        {project.referenceKey} · {project.name}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">
                        {project.relation === "owns" ? "Owns" : "Participates"}
                      </p>
                    </div>
                    <StatusBadge {...mapProjectStatusBadge(project.status)} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="mp-section-title">Initiatives</h2>
              <Link
                href={`/initiatives?organizationId=${org.id}`}
                className="text-sm text-[var(--accent)]"
              >
                All initiatives
              </Link>
            </div>
            {initiatives.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No initiatives owned by this department yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {initiatives.map((initiative) => (
                  <li
                    key={initiative.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div>
                      <Link
                        href={`/initiatives/${initiative.id}`}
                        className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                      >
                        {initiative.referenceKey} · {initiative.title}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">
                        Stage: {initiative.currentStage.replaceAll("_", " ")}
                      </p>
                    </div>
                    <StatusBadge
                      {...mapInitiativeStageBadge(initiative.currentStage)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <h2 className="mp-section-title mb-3">Teams</h2>
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
        </div>

        <div className="space-y-4">
          <Panel>
            <h2 className="mb-2 font-medium">In this hierarchy</h2>
            <p className="text-sm text-[var(--muted)]">
              Section{" "}
              <Link
                href={`/organization/${org.id}/sections/${department.sectionId}`}
                className="text-[var(--accent)]"
              >
                {department.section.name}
              </Link>
              {parentDepartment ? (
                <>
                  {" → "}
                  <Link
                    href={`/organization/${org.id}/departments/${parentDepartment.id}`}
                    className="text-[var(--accent)]"
                  >
                    {parentDepartment.name}
                  </Link>
                </>
              ) : null}
              {" → "}
              <span className="font-medium text-[var(--fg)]">{department.name}</span>
            </p>
            {childDepartments.length > 0 ? (
              <ul className="mt-3 divide-y divide-[var(--line)]">
                {childDepartments.map((child) => (
                  <li key={child.id} className="py-2">
                    <Link
                      href={`/organization/${org.id}/departments/${child.id}`}
                      className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                    >
                      {child.name}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">Child department</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No child departments. Add teams below, or create a child department
                under this one from the section page.
              </p>
            )}
          </Panel>
          {canManage ? (
            <>
              <Panel>
                <h2 className="mb-3 font-medium">Edit department</h2>
                <EditDepartmentForm
                  id={department.id}
                  name={department.name}
                  description={department.description}
                  version={department.version}
                  parentDepartmentId={department.parentDepartmentId}
                  parents={siblingDepartments.map((row) => ({
                    id: row.id,
                    name: row.name,
                  }))}
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
