import Link from "next/link";
import { redirect } from "next/navigation";
import { ApprovalDecisionForm } from "@/components/governance/governance-forms";
import { ApprovalTaskCardHeader } from "@/components/governance/governance-workspace";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const { authz, governance } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const requests = await governance.listMyApprovals(principal);
  const orgIds = [
    ...new Set(
      requests.map((r) => r.submission.initiative.organizationId),
    ),
  ];
  const capsEntries = await Promise.all(
    orgIds.map(async (organizationId) => [
      organizationId,
      await governance.getPrincipalCapabilities(principal, organizationId),
    ] as const),
  );
  const capsByOrg = Object.fromEntries(capsEntries);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Approvals" },
        ]}
      />
      <PageHeader
        title="My Approvals"
        description="Authority reviews waiting for your outcome. Approvals are immutable once recorded."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="Nothing waiting for your approval"
          description="When initiatives are submitted for governance and your authority is required, they appear here."
          action={
            <Link
              href="/initiatives"
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
            >
              Browse initiatives
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const caps =
              capsByOrg[request.submission.initiative.organizationId];
            const canReview = caps?.canReviewApprovals !== false;

            return (
              <Panel key={request.id}>
                <ApprovalTaskCardHeader
                  referenceKey={request.submission.initiative.referenceKey}
                  title={request.submission.initiative.title}
                  gateType={request.submission.gate.gateType}
                  reviewLabel={request.label}
                  revision={request.submission.revision}
                  status={request.status}
                  initiativeId={request.submission.initiativeId}
                />

                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-[var(--line)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      What requires review
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--ink)]">
                      {request.label}
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--line)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Evidence summary
                    </p>
                    <p className="mt-1 text-sm text-[var(--ink)]">
                      Frozen on revision {request.submission.revision}.{" "}
                      <Link
                        href={`/initiatives/${request.submission.initiativeId}/governance`}
                        className="text-[#087f78] underline"
                      >
                        Inspect evidence in gate workspace
                      </Link>
                    </p>
                  </div>
                  <div className="rounded-md border border-[var(--line)] px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Allowed action
                    </p>
                    <div className="mt-1">
                      {canReview ? (
                        <StatusBadge
                          status="pending"
                          label="Approve / Reject / Request changes"
                          size="compact"
                        />
                      ) : (
                        <StatusBadge
                          status="blocked"
                          label="Read-only — no approval permission"
                          size="compact"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <ApprovalDecisionForm
                  approvalRequestId={request.id}
                  expectedVersion={request.version}
                  initiativeId={request.submission.initiativeId}
                  label={request.label}
                  capabilities={caps}
                />
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
