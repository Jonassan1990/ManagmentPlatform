import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { EditTeamForm } from "@/components/organization/org-forms";
import { OrgModeToggle } from "@/components/organization/org-mode-toggle";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { buildOrganizationTrail } from "@/modules/navigation/breadcrumbs";
import { parseOrgUiMode } from "@/modules/organization/application/org-ui-mode";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; teamId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { organizationId, teamId } = await params;
  const { mode: modeParam } = await searchParams;
  const mode = parseOrgUiMode(modeParam);
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

  const canManage = await authz.can(
    principal,
    PERMISSIONS.ORG_STRUCTURE_MANAGE,
    { type: "ORGANIZATION", organizationId },
  );
  const showConfig = canManage && mode === "config";

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
        description={
          showConfig
            ? "Configure this team’s name and description."
            : (team.description ?? "Team overview")
        }
        actions={
          <Suspense fallback={null}>
            <OrgModeToggle canConfigure={canManage} />
          </Suspense>
        }
      />

      {showConfig ? (
        <Panel className="max-w-xl">
          <h2 className="mb-3 font-medium">Edit team</h2>
          <EditTeamForm
            id={team.id}
            name={team.name}
            description={team.description}
            version={team.version}
          />
        </Panel>
      ) : (
        <div className="space-y-4 max-w-2xl">
          <Panel>
            <h2 className="mb-2 font-medium">Team</h2>
            <p className="text-sm text-[var(--muted)]">
              Part of department{" "}
              <Link
                href={`/organization/${org.id}/departments/${team.departmentId}`}
                className="text-[var(--accent)]"
              >
                {team.department.name}
              </Link>
              .
            </p>
            {team.description ? (
              <p className="mt-3 text-sm">{team.description}</p>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No description yet.
              </p>
            )}
          </Panel>
          {!canManage ? (
            <Alert tone="info" live="polite">
              You can browse this team. Structure changes need organization
              manage permission.
            </Alert>
          ) : null}
        </div>
      )}
    </div>
  );
}
