import Link from "next/link";
import { redirect } from "next/navigation";
import { ManagerApprovalsHistory } from "@/components/manager/manager-approvals-history";
import { ManagerApprovalsPanel } from "@/components/manager/manager-approvals-panel";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
import { hasPermissionInAnyOrganization } from "@/modules/identity-access/application/org-permission";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const { authz, governance, organization, vacation } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const orgs = await organization.listOrganizations(principal);
  const orgIds = orgs.map((org) => org.id);
  const [canReviewVacation, canReviewGovernance] = await Promise.all([
    hasPermissionInAnyOrganization(
      authz,
      principal,
      PERMISSIONS.VACATION_REVIEW,
      orgIds,
    ),
    hasPermissionInAnyOrganization(
      authz,
      principal,
      PERMISSIONS.APPROVAL_REVIEW,
      orgIds,
    ),
  ]);
  if (!canReviewVacation && !canReviewGovernance) redirect("/");

  const preferredOrgId = orgs[0]?.id ?? null;
  const sections = preferredOrgId
    ? await organization.listSections(principal, preferredOrgId)
    : [];
  const sectionHref =
    preferredOrgId && sections[0]
      ? `/organization/${preferredOrgId}/sections/${sections[0].id}`
      : null;

  const [vacationInbox, vacationHistory] = canReviewVacation
    ? await Promise.all([
        vacation.listInbox(principal),
        vacation.listRecentDecisions(principal, { limit: 40 }),
      ])
    : [[], []];
  const governanceRequests = canReviewGovernance
    ? await governance.listMyApprovals(principal)
    : [];
  const governanceOrgIds = [
    ...new Set(
      governanceRequests.map((row) => row.submission.initiative.organizationId),
    ),
  ];
  const capsEntries = await Promise.all(
    governanceOrgIds.map(async (organizationId) =>
      [
        organizationId,
        await governance.getPrincipalCapabilities(principal, organizationId),
      ] as const,
    ),
  );
  const capsByOrg = Object.fromEntries(capsEntries);
  const governanceRows = governanceRequests.map((request) => ({
    ...request,
    capabilities: capsByOrg[request.submission.initiative.organizationId],
  }));

  const total = vacationInbox.length + governanceRows.length;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Approvals" },
        ]}
      />
      <PageHeader
        title="Approvals"
        description="Waiting work for you as a manager, plus recent decided vacation with an audit trail on each request. Your section page shows the same waiting list for that section."
        actions={
          sectionHref ? (
            <Link
              href={sectionHref}
              className={buttonClassName({ variant: "secondary" })}
            >
              Open section
            </Link>
          ) : null
        }
      />

      {total === 0 ? (
        <EmptyState
          title="Nothing waiting for your approval"
          description="When people ask for vacation, or a delivery gate needs your review, it appears here and on your section page."
          action={
            <Link
              href="/vacation/plan"
              className={buttonClassName({ variant: "primary" })}
            >
              Open vacation plan
            </Link>
          }
        />
      ) : (
        <Panel>
          <ManagerApprovalsPanel
            vacation={vacationInbox}
            governance={governanceRows}
            emptyDescription="Nothing waiting for your approval."
          />
        </Panel>
      )}

      {canReviewVacation ? (
        <Panel className="mt-6">
          <h2 className="mb-2 text-base font-semibold text-[var(--ink)]">
            Recent decisions
          </h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Trackable history in your scope. Open a row for the full audit
            trail (who submitted, approved, rejected, or asked for changes).
          </p>
          <ManagerApprovalsHistory vacation={vacationHistory} />
        </Panel>
      ) : null}
    </div>
  );
}
