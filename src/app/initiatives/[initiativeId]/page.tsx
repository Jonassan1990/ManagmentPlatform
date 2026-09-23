import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CreatePoCForm,
  SubmitPreStudyButton,
} from "@/components/governance/governance-forms";
import { AdvanceLifecycleButton } from "@/components/initiative/initiative-forms";
import {
  AttentionPanel,
  InitiativeTabs,
  LifecycleRail,
  ReadinessPanel,
} from "@/components/initiative/workspace";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { stageLabel } from "@/modules/initiative/application/attention";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function InitiativeOverviewPage({
  params,
}: {
  params: Promise<{ initiativeId: string }>;
}) {
  const { initiativeId } = await params;
  const { authz, initiative, governance } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let workspace;
  let gateWorkspace;
  try {
    workspace = await initiative.getInitiativeWorkspace(principal, initiativeId);
    gateWorkspace = await governance.getGateWorkspace(principal, initiativeId);
  } catch {
    notFound();
  }

  const { initiative: item, attention, readiness, pocReadiness } = workspace;
  const gateItem = gateWorkspace.initiative;
  const activeSubmission = gateItem.governanceGates
    .flatMap((g) => g.submissions)
    .find(
      (s) =>
        s.status === "IN_REVIEW" ||
        s.status === "SUBMITTED" ||
        s.status === "APPROVALS_COMPLETE" ||
        s.status === "CHANGES_REQUESTED",
    );
  const preStudyGo = gateItem.decisions.find(
    (d) => d.outcome === "GO" || d.outcome === "CONDITIONAL_GO",
  );
  const openBlocking = gateItem.decisions.flatMap((d) =>
    (d.conditions ?? []).filter(
      (c) => c.requiredBeforeProgression && c.status === "OPEN",
    ),
  );
  const canCreatePoC =
    !gateItem.poc &&
    item.currentStage === "PRE_STUDY" &&
    Boolean(preStudyGo) &&
    openBlocking.length === 0;
  const canSubmitPreStudy =
    item.currentStage === "PRE_STUDY" &&
    Boolean(readiness?.ready) &&
    !activeSubmission;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey },
        ]}
      />
      <PageHeader
        title={item.title}
        description={`${item.referenceKey} · ${item.department.name} · Owner: ${item.businessOwnerName}`}
        actions={
          <span className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm">
            {stageLabel(item.currentStage)}
          </span>
        }
      />

      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>

      <InitiativeTabs
        initiativeId={item.id}
        active="overview"
        currentStage={item.currentStage}
        hasGovernance={gateItem.governanceGates.length > 0}
        hasPoC={Boolean(gateItem.poc)}
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <AttentionPanel items={attention} />
          <ReadinessPanel readiness={readiness} />
          {pocReadiness ? (
            <Panel>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">PoC readiness</h2>
                <span
                  className={`text-sm font-medium ${
                    pocReadiness.ready ? "text-[var(--ok)]" : "text-[var(--danger)]"
                  }`}
                >
                  {pocReadiness.ready ? "READY" : "NOT READY"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Ready means PoC evidence can be submitted for a governance
                decision.
              </p>
            </Panel>
          ) : null}
          <Panel>
            <h2 className="mb-2 font-medium">Next action</h2>
            {item.currentStage === "DEMAND" ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Complete demand details, then advance to Requirements.
                </p>
                <Link
                  href={`/initiatives/${item.id}/demand`}
                  className="mr-2 text-sm text-[var(--accent)] underline"
                >
                  Open demand
                </Link>
                <AdvanceLifecycleButton
                  initiativeId={item.id}
                  expectedVersion={item.version}
                  toStage="REQUIREMENTS"
                  label="Advance to Requirements"
                />
              </div>
            ) : null}
            {item.currentStage === "REQUIREMENTS" ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Capture and accept requirements, then advance to Pre-study.
                </p>
                <Link
                  href={`/initiatives/${item.id}/requirements`}
                  className="mr-2 text-sm text-[var(--accent)] underline"
                >
                  Open requirements
                </Link>
                <AdvanceLifecycleButton
                  initiativeId={item.id}
                  expectedVersion={item.version}
                  toStage="PRE_STUDY"
                  label="Advance to Pre-study"
                />
              </div>
            ) : null}
            {item.currentStage === "PRE_STUDY" ? (
              <div className="space-y-3">
                {canSubmitPreStudy ? (
                  <>
                    <p className="text-sm text-[var(--muted)]">
                      Pre-study is ready. Submit for governance review so
                      authorities can approve before a decision.
                    </p>
                    <SubmitPreStudyButton
                      initiativeId={item.id}
                      expectedInitiativeVersion={item.version}
                    />
                    <Link
                      href={`/initiatives/${item.id}/governance`}
                      className="block text-sm text-[var(--accent)] underline"
                    >
                      Open governance workspace
                    </Link>
                  </>
                ) : activeSubmission?.status === "CHANGES_REQUESTED" ? (
                  <>
                    <p className="text-sm text-[var(--muted)]">
                      Changes were requested. Update the work, then revise the
                      submission.
                    </p>
                    <Link
                      href={`/initiatives/${item.id}/governance`}
                      className="text-sm text-[var(--accent)] underline"
                    >
                      Revise in governance
                    </Link>
                  </>
                ) : activeSubmission?.status === "APPROVALS_COMPLETE" ? (
                  <>
                    <p className="text-sm text-[var(--muted)]">
                      Approvals are complete. A decision is required.
                    </p>
                    <Link
                      href={`/initiatives/${item.id}/decisions`}
                      className="text-sm text-[var(--accent)] underline"
                    >
                      Record decision
                    </Link>
                  </>
                ) : activeSubmission?.status === "IN_REVIEW" ||
                  activeSubmission?.status === "SUBMITTED" ? (
                  <>
                    <p className="text-sm text-[var(--muted)]">
                      Governance review is in progress. Track approvals and the
                      decision package.
                    </p>
                    <Link
                      href={`/initiatives/${item.id}/governance`}
                      className="mr-3 text-sm text-[var(--accent)] underline"
                    >
                      Open governance
                    </Link>
                    <Link
                      href="/approvals"
                      className="text-sm text-[var(--accent)] underline"
                    >
                      My Approvals
                    </Link>
                  </>
                ) : canCreatePoC ? (
                  <>
                    <p className="text-sm text-[var(--muted)]">
                      Pre-study decision allows a PoC. Create the PoC definition
                      to advance the lifecycle.
                    </p>
                    <CreatePoCForm initiativeId={item.id} />
                  </>
                ) : openBlocking.length > 0 ? (
                  <>
                    <p className="text-sm text-[var(--muted)]">
                      {openBlocking.length} blocking condition(s) must be
                      resolved before creating a PoC.
                    </p>
                    <Link
                      href={`/initiatives/${item.id}/decisions`}
                      className="text-sm text-[var(--accent)] underline"
                    >
                      Resolve conditions
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[var(--muted)]">
                      Complete assessments, alternatives, and risks until
                      readiness is READY, then submit for governance.
                    </p>
                    <Link
                      href={`/initiatives/${item.id}/pre-study`}
                      className="mr-3 text-sm text-[var(--accent)] underline"
                    >
                      Open pre-study
                    </Link>
                    <Link
                      href={`/initiatives/${item.id}/governance`}
                      className="text-sm text-[var(--accent)] underline"
                    >
                      Governance
                    </Link>
                  </>
                )}
              </div>
            ) : null}
            {item.currentStage === "POC" ? (
              <div className="space-y-3">
                {pocReadiness?.ready &&
                !activeSubmission ? (
                  <>
                    <p className="text-sm text-[var(--muted)]">
                      PoC is ready for a governance decision. Submit the PoC gate
                      from the PoC workspace.
                    </p>
                    <Link
                      href={`/initiatives/${item.id}/poc`}
                      className="text-sm text-[var(--accent)] underline"
                    >
                      Open PoC workspace
                    </Link>
                  </>
                ) : activeSubmission?.status === "APPROVALS_COMPLETE" ? (
                  <>
                    <p className="text-sm text-[var(--muted)]">
                      PoC approvals are complete. Record the decision.
                    </p>
                    <Link
                      href={`/initiatives/${item.id}/decisions`}
                      className="text-sm text-[var(--accent)] underline"
                    >
                      Record decision
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[var(--muted)]">
                      Continue PoC definition, execution, evaluation, and results
                      until readiness is READY.
                    </p>
                    <Link
                      href={`/initiatives/${item.id}/poc`}
                      className="mr-3 text-sm text-[var(--accent)] underline"
                    >
                      Open PoC
                    </Link>
                    <Link
                      href={`/initiatives/${item.id}/governance`}
                      className="text-sm text-[var(--accent)] underline"
                    >
                      Governance
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </Panel>
        </div>
        <Panel>
          <h2 className="mb-3 font-medium">Context</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Requester</dt>
              <dd>{item.requesterName}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Business owner</dt>
              <dd>{item.businessOwnerName}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Department</dt>
              <dd>{item.department.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Updated</dt>
              <dd>{item.updatedAt.toISOString().slice(0, 10)}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
