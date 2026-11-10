import Link from "next/link";
import { redirect } from "next/navigation";
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

  const vacationInbox = canReviewVacation
    ? await vacation.listInbox(principal)
    : [];
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
        description="Everything waiting for you as a manager: vacation requests and delivery gate reviews. Your section page shows the same list for that section."
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
    </div>
  );
}
