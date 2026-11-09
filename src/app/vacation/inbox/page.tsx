import Link from "next/link";
import { redirect } from "next/navigation";
import { ReviewVacationForm } from "@/components/vacation/vacation-forms";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { hasPermissionInAnyOrganization } from "@/modules/identity-access/application/org-permission";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { mapVacationStatusBadge } from "@/modules/vacation/application/vacation-status";
import {
  formatVacationAmount,
  formatVacationSpan,
} from "@/modules/vacation/application/vacation-duration";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function VacationInboxPage() {
  const { authz, vacation, organization } = createServices();
  await authz.ensureSystemRoles();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const orgs = await organization.listOrganizations(principal);
  const canReview = await hasPermissionInAnyOrganization(
    authz,
    principal,
    PERMISSIONS.VACATION_REVIEW,
    orgs.map((org) => org.id),
  );
  if (!canReview) redirect("/vacation");

  const inbox = await vacation.listInbox(principal);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Vacation", href: "/vacation" },
          { label: "Manager inbox" },
        ]}
      />
      <PageHeader
        title="Vacation inbox"
        description="Accept, reject, or ask for changes on vacation requests in your scope."
      />

      {inbox.length === 0 ? (
        <EmptyState
          title="Nothing waiting for review"
          description="When people in your section or department submit vacation requests, they appear here."
          action={
            <Link href="/vacation" className="text-[var(--color-accent)] underline">
              Back to my requests
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {inbox.map((row) => {
            const badge = mapVacationStatusBadge(row.status);
            return (
              <Panel key={row.id}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--muted)]">
                      Owner · {row.requesterDisplayName}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      Approver ·{" "}
                      {row.approvers.length > 0
                        ? row.approvers
                            .map((approver) => approver.displayName)
                            .join(", ")
                        : "not assigned"}
                    </p>
                    <Link
                      href={`/vacation/${row.id}`}
                      className="text-lg font-semibold text-[var(--ink)] hover:underline"
                    >
                      {formatVacationSpan(
                        row.startDate,
                        row.endDate,
                        row.durationKind,
                      )}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatVacationAmount(row)}
                      {row.reason ? ` · ${row.reason}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={badge.status} label={badge.label} />
                </div>
                <ReviewVacationForm
                  requestId={row.id}
                  expectedVersion={row.version}
                />
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
