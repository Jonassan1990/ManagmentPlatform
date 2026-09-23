import Link from "next/link";
import { redirect } from "next/navigation";
import { ApprovalDecisionForm } from "@/components/governance/governance-forms";
import { humanize, statusToneClass } from "@/components/governance/governance-panels";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
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
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Browse initiatives
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Panel key={request.id}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--muted)]">
                    {request.submission.initiative.referenceKey} ·{" "}
                    {humanize(request.submission.gate.gateType)}
                  </p>
                  <h2 className="font-[family-name:var(--font-display)] text-xl">
                    {request.submission.initiative.title}
                  </h2>
                  <p className="mt-1 text-sm">
                    Review: <span className="font-medium">{request.label}</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Revision {request.submission.revision} ·{" "}
                    <span className={statusToneClass(request.status)}>
                      {humanize(request.status)}
                    </span>
                  </p>
                </div>
                <Link
                  href={`/initiatives/${request.submission.initiativeId}/governance`}
                  className="text-sm text-[var(--accent)] underline"
                >
                  Open gate workspace
                </Link>
              </div>
              <ApprovalDecisionForm
                approvalRequestId={request.id}
                expectedVersion={request.version}
                initiativeId={request.submission.initiativeId}
                label={request.label}
                capabilities={
                  capsByOrg[request.submission.initiative.organizationId]
                }
              />
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
