import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ManagerApprovalsPanel } from "@/components/manager/manager-approvals-panel";
import {
  CreateDepartmentForm,
  EditSectionForm,
} from "@/components/organization/org-forms";
import { OrgModeToggle } from "@/components/organization/org-mode-toggle";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
import { buildOrganizationTrail } from "@/modules/navigation/breadcrumbs";
import {
  parseOrgUiMode,
  withOrgMode,
} from "@/modules/organization/application/org-ui-mode";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; sectionId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { organizationId, sectionId } = await params;
  const { mode: modeParam } = await searchParams;
  const mode = parseOrgUiMode(modeParam);
  const { authz, organization, vacation, governance } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let section;
  let departments;
  let org;
  try {
    org = await organization.getOrganization(principal, organizationId);
    section = await organization.getSection(principal, sectionId);
    if (section.organizationId !== organizationId) notFound();
    departments = await organization.listDepartments(principal, sectionId);
  } catch {
    notFound();
  }

  const canManage = await authz.can(
    principal,
    PERMISSIONS.ORG_STRUCTURE_MANAGE,
    { type: "ORGANIZATION", organizationId },
  );
  const showConfig = canManage && mode === "config";
  const [canReviewVacation, canReviewGovernance] = await Promise.all([
    authz.hasPermissionInOrganization(
      principal,
      PERMISSIONS.VACATION_REVIEW,
      organizationId,
    ),
    authz.hasPermissionInOrganization(
      principal,
      PERMISSIONS.APPROVAL_REVIEW,
      organizationId,
    ),
  ]);
  const vacationInbox =
    !showConfig && canReviewVacation
      ? await vacation.listInbox(principal, {
          organizationId,
          sectionId,
        })
      : [];
  const governanceRequests =
    !showConfig && canReviewGovernance
      ? await governance.listMyApprovals(principal)
      : [];
  const governanceCaps =
    governanceRequests.length > 0
      ? await governance.getPrincipalCapabilities(principal, organizationId)
      : undefined;
  const governanceRows = governanceRequests.map((request) => ({
    ...request,
    capabilities: governanceCaps,
  }));
  const showApprovals =
    !showConfig && (canReviewVacation || canReviewGovernance);

  return (
    <div>
      <Breadcrumbs
        items={buildOrganizationTrail({
          organizationId: org.id,
          organizationName: org.name,
          section: { id: section.id, name: section.name },
        })}
      />
      <PageHeader
        title={section.name}
        description={
          showConfig
            ? "Configure this section and its departments (including parent → child such as INF → INFB)."
            : (section.description ??
              "Browse departments under this section. Open one to see resources, projects, and initiatives.")
        }
        actions={
          <Suspense fallback={null}>
            <OrgModeToggle canConfigure={canManage} />
          </Suspense>
        }
      />

      {showConfig ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel>
            <h2 className="mb-3 font-medium">Edit section</h2>
            <EditSectionForm
              id={section.id}
              name={section.name}
              description={section.description}
              version={section.version}
            />
          </Panel>
          <div className="space-y-4">
            <Panel>
              <CreateDepartmentForm
                sectionId={section.id}
                parents={departments.map((department) => ({
                  id: department.id,
                  name: department.name,
                }))}
              />
            </Panel>
            <Panel>
              <h2 className="mb-3 font-medium">Departments in this section</h2>
              {departments.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No departments yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {departments.map((department) => {
                    const parentName = department.parentDepartmentId
                      ? departments.find(
                          (row) => row.id === department.parentDepartmentId,
                        )?.name
                      : null;
                    return (
                      <li key={department.id} className="py-2">
                        <Link
                          href={withOrgMode(
                            `/organization/${org.id}/departments/${department.id}`,
                            "config",
                          )}
                          className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                        >
                          {department.name}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">
                          {parentName
                            ? `Under ${parentName}`
                            : "Top department in this section"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {showApprovals ? (
            <Panel>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium">Approvals</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Everything waiting for you in this section. Accept vacation
                    here, or open the full Approvals list.
                  </p>
                </div>
                <Link
                  href="/approvals"
                  className={buttonClassName({ variant: "secondary", size: "sm" })}
                >
                  All approvals
                </Link>
              </div>
              <ManagerApprovalsPanel
                vacation={vacationInbox}
                governance={governanceRows}
                emptyDescription="Nothing is waiting for you in this section."
              />
            </Panel>
          ) : null}
          <Panel>
            <h2 className="mb-3 font-medium">Departments</h2>
            {departments.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No departments yet.
                {canManage
                  ? " Switch to Config to add INF, ING, INA, and child departments."
                  : ""}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {departments.map((department) => {
                  const parentName = department.parentDepartmentId
                    ? departments.find(
                        (row) => row.id === department.parentDepartmentId,
                      )?.name
                    : null;
                  return (
                    <li key={department.id} className="py-2">
                      <Link
                        href={`/organization/${org.id}/departments/${department.id}`}
                        className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                      >
                        {department.name}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">
                        {parentName
                          ? `Under ${parentName}`
                          : "Top department in this section"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          {!canManage ? (
            <Alert tone="info" live="polite">
              You can browse this section. Structure changes need organization
              manage permission.
            </Alert>
          ) : null}
        </div>
      )}
    </div>
  );
}
