import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { OrganizationChart } from "@/components/organization/organization-chart";
import { OrgModeToggle } from "@/components/organization/org-mode-toggle";
import {
  CreateResourceForm,
  CreateSectionForm,
  EditOrganizationForm,
} from "@/components/organization/org-forms";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { buildOrganizationTrail } from "@/modules/navigation/breadcrumbs";
import {
  parseOrgUiMode,
  withOrgMode,
} from "@/modules/organization/application/org-ui-mode";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createOrganizationService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function OrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { organizationId } = await params;
  const { mode: modeParam } = await searchParams;
  const mode = parseOrgUiMode(modeParam);
  const { authz, organization } = createOrganizationService();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let hierarchy;
  try {
    hierarchy = await organization.getHierarchy(principal, organizationId);
  } catch {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Overview", href: "/" },
            { label: "Organization", href: "/organization" },
            { label: "Unavailable" },
          ]}
        />
        <PageHeader title="Organization unavailable" />
        <Panel>
          <Alert tone="error">
            You do not have access to this organization, or it no longer
            exists.{" "}
            <Link href="/organization" className="underline">
              Back to Organization
            </Link>
          </Alert>
        </Panel>
      </div>
    );
  }
  if (!hierarchy) notFound();

  let chart = null;
  try {
    chart = await organization.getOrganizationChart(principal, organizationId);
  } catch {
    chart = null;
  }
  const visibleOrgs = await organization.listOrganizations(principal);

  const canManage = await authz.can(
    principal,
    PERMISSIONS.ORG_STRUCTURE_MANAGE,
    { type: "ORGANIZATION", organizationId },
  );
  const showConfig = canManage && mode === "config";

  const allTeams = hierarchy.sections.flatMap((section) =>
    section.departments.flatMap((department) =>
      department.teams.map((team) => ({
        id: team.id,
        name: `${section.name} / ${department.name} / ${team.name}`,
      })),
    ),
  );

  return (
    <div>
      <Breadcrumbs
        items={buildOrganizationTrail({
          organizationId,
          organizationName: hierarchy.name,
        })}
      />
      <PageHeader
        title={hierarchy.name}
        description={
          showConfig
            ? "Configure organization structure: sections, resources, and parent organization."
            : (hierarchy.description ??
              "Browse the hierarchy. Open a department for resources, projects, and initiatives.")
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Suspense fallback={null}>
              <OrgModeToggle canConfigure={canManage} />
            </Suspense>
            {showConfig ? (
              <>
                <Link
                  href={`/organization/${hierarchy.id}/admin`}
                  className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 text-sm"
                >
                  Admin config
                </Link>
                <Link
                  href={`/organization/${hierarchy.id}/access`}
                  className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 text-sm"
                >
                  Access & roles
                </Link>
                <Link
                  href={`/organization/${hierarchy.id}/governance-policy`}
                  className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-3 text-sm"
                >
                  Governance policy
                </Link>
              </>
            ) : null}
          </div>
        }
      />

      {showConfig ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel>
            <h2 className="mb-3 font-medium">Edit organization</h2>
            <EditOrganizationForm
              id={hierarchy.id}
              name={hierarchy.name}
              description={hierarchy.description}
              version={hierarchy.version}
              parentOrganizationId={hierarchy.parentOrganizationId}
              parents={visibleOrgs.map((org) => ({ id: org.id, name: org.name }))}
            />
          </Panel>
          <div className="space-y-4">
            <Panel>
              <CreateSectionForm organizationId={hierarchy.id} />
            </Panel>
            <Panel>
              <CreateResourceForm
                organizationId={hierarchy.id}
                teams={allTeams}
              />
            </Panel>
            <Panel>
              <h2 className="mb-2 font-medium">Existing sections</h2>
              {hierarchy.sections.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No sections yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {hierarchy.sections.map((section) => (
                    <li key={section.id} className="py-2">
                      <Link
                        href={withOrgMode(
                          `/organization/${hierarchy.id}/sections/${section.id}`,
                          "config",
                        )}
                        className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                      >
                        {section.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Panel>
            {chart ? (
              <OrganizationChart chart={chart} canAssign={false} />
            ) : (
              <p className="text-sm text-[var(--muted)]">
                This organization could not be drawn.
              </p>
            )}
          </Panel>

          <Panel>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-medium">Resources</h2>
              <Link
                href={`/organization/${hierarchy.id}/resources`}
                className="inline-flex min-h-11 items-center text-sm text-[var(--accent)]"
              >
                View all
              </Link>
            </div>
            {hierarchy.resources.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No resources yet. Switch to Config to add people and capacity
                resources.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {hierarchy.resources.map((resource) => (
                  <li key={resource.id} className="py-2">
                    <Link
                      href={`/organization/${hierarchy.id}/resources/${resource.id}`}
                      className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)]"
                    >
                      {resource.name}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">
                      {resource.type}
                      {resource.functionRole ? ` · ${resource.functionRole}` : ""}
                      {resource.memberships.length > 0
                        ? ` · ${resource.memberships
                            .map((m) => m.team.name)
                            .join(", ")}`
                        : " · no team membership"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {!canManage ? (
            <Alert tone="info" live="polite">
              You can browse this organization. Structure changes need
              organization manage permission.
            </Alert>
          ) : null}
        </div>
      )}
    </div>
  );
}
