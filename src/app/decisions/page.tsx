import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RecordDecisionForm,
  outcomesForGateType,
} from "@/components/governance/governance-forms";
import {
  ApprovalStatusList,
  DecisionPackagePanel,
  humanize,
} from "@/components/governance/governance-panels";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function DecisionsInboxPage() {
  const { authz, governance } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const submissions = await governance.listMyDecisions(principal);
  const orgIds = [...new Set(submissions.map((s) => s.initiative.organizationId))];
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
          { label: "Decisions" },
        ]}
      />
      <PageHeader
        title="My Decisions"
        description="Packages where required approvals are complete and a governance decision is still needed."
      />

      {submissions.length === 0 ? (
        <EmptyState
          title="No decisions waiting"
          description="When all required approvals finish, packages that need your decision appear here."
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
          {submissions.map((submission) => (
            <Panel key={submission.id}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--muted)]">
                    {submission.initiative.referenceKey} ·{" "}
                    {humanize(submission.gate.gateType)}
                  </p>
                  <h2 className="font-[family-name:var(--font-display)] text-xl">
                    {submission.initiative.title}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Revision {submission.revision} · approvals complete
                  </p>
                </div>
                <Link
                  href={`/initiatives/${submission.initiativeId}/decisions`}
                  className="text-sm text-[var(--accent)] underline"
                >
                  Open decision workspace
                </Link>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <DecisionPackagePanel
                  decisionPackage={submission.decisionPackage}
                />
                <ApprovalStatusList requests={submission.approvalRequests} />
              </div>
              {submission.decisionPackage ? (
                <div className="mt-4 border-t border-[var(--line)] pt-4">
                  <RecordDecisionForm
                    submissionId={submission.id}
                    expectedPackageVersion={submission.decisionPackage.version}
                    question={submission.decisionPackage.question}
                    recommendationText={
                      submission.decisionPackage.recommendationText
                    }
                    allowedOutcomes={outcomesForGateType(submission.gate.gateType)}
                    capabilities={capsByOrg[submission.initiative.organizationId]}
                  />
                </div>
              ) : null}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
