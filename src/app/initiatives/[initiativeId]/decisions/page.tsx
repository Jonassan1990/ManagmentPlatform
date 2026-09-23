import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  RecordDecisionForm,
  ResolveConditionForm,
  outcomesForGateType,
} from "@/components/governance/governance-forms";
import {
  ApprovalStatusList,
  DecisionLogPanel,
  DecisionPackagePanel,
  humanize,
  statusToneClass,
} from "@/components/governance/governance-panels";
import {
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function InitiativeDecisionsPage({
  params,
}: {
  params: Promise<{ initiativeId: string }>;
}) {
  const { initiativeId } = await params;
  const { authz, governance } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let gateWorkspace;
  try {
    gateWorkspace = await governance.getGateWorkspace(principal, initiativeId);
  } catch {
    notFound();
  }

  const item = gateWorkspace.initiative;
  const capabilities = await governance.getPrincipalCapabilities(
    principal,
    item.organizationId,
  );
  const decisions = item.decisions;
  const awaitingDecision = item.governanceGates
    .flatMap((g) =>
      g.submissions
        .filter((s) => s.status === "APPROVALS_COMPLETE")
        .map((s) => ({ gate: g, submission: s })),
    )
    .sort(
      (a, b) =>
        b.submission.revision - a.submission.revision ||
        b.submission.submittedAt.getTime() - a.submission.submittedAt.getTime(),
    );

  const focus = awaitingDecision[0] ?? null;
  const openConditions = decisions.flatMap((d) =>
    (d.conditions ?? [])
      .filter((c) => c.status === "OPEN")
      .map((c) => ({ decision: d, condition: c })),
  );

  const latestDecision = decisions[0] ?? null;
  const latestGateType =
    latestDecision != null
      ? (item.governanceGates.find((g) => g.id === latestDecision.gateId)
          ?.gateType ?? null)
      : null;
  const latestBlockingOpen =
    latestDecision != null
      ? (latestDecision.conditions ?? []).filter(
          (c) => c.requiredBeforeProgression && c.status === "OPEN",
        ).length
      : 0;
  const conditionsClear = latestBlockingOpen === 0;
  const overviewHref = `/initiatives/${item.id}`;
  const nextAction =
    latestDecision && latestGateType === "PRE_STUDY_GATE" &&
    (latestDecision.outcome === "GO" ||
      latestDecision.outcome === "CONDITIONAL_GO") &&
    conditionsClear &&
    !item.poc
      ? {
          label: "Next: Create PoC on initiative overview",
          href: overviewHref,
          hint: "Pre-study decision allows PoC. Open the overview to create the PoC definition.",
        }
      : latestDecision &&
          latestGateType === "POC_GATE" &&
          (latestDecision.outcome === "GO" ||
            latestDecision.outcome === "CONDITIONAL_GO") &&
          conditionsClear &&
          !item.pilot
        ? {
            label: "Next: Create Pilot on initiative overview",
            href: overviewHref,
            hint: "PoC decision allows Pilot. Open the overview (or PoC workspace) to create the Pilot.",
          }
        : latestDecision &&
            latestGateType === "PILOT_GATE" &&
            (latestDecision.outcome === "SCALE" ||
              latestDecision.outcome === "CONDITIONAL_SCALE") &&
            conditionsClear &&
            !item.project
          ? {
              label: "Next: Convert to Project from Pilot workspace",
              href: `/initiatives/${item.id}/pilot`,
              hint: "Scale decision allows Project conversion. Convert is an explicit action on the Pilot page or overview.",
            }
          : latestDecision && !conditionsClear
            ? {
                label: "Resolve open conditions first",
                href: `#conditions`,
                hint: "Blocking conditions must be closed before the next lifecycle step.",
              }
            : null;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey, href: `/initiatives/${item.id}` },
          { label: "Decisions" },
        ]}
      />
      <PageHeader
        title={item.title}
        description={`${item.referenceKey} · Decision package and log`}
      />
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs
        initiativeId={item.id}
        active="decisions"
        currentStage={item.currentStage}
        hasGovernance={item.governanceGates.length > 0}
        hasPoC={Boolean(item.poc)}
        hasPilot={Boolean(item.pilot)}
        hasProject={Boolean(item.project)}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Panel>
          <p className="text-sm text-[var(--muted)]">Decision required?</p>
          <p
            className={`mt-1 text-sm font-medium ${
              focus ? "text-[var(--warning)]" : "text-[var(--muted)]"
            }`}
          >
            {focus
              ? `${humanize(focus.gate.gateType)} · revision ${focus.submission.revision}`
              : "No package is waiting for a decision"}
          </p>
        </Panel>
        <Panel>
          <p className="text-sm text-[var(--muted)]">Open conditions</p>
          <p
            className={`mt-1 text-sm font-medium ${
              openConditions.length > 0
                ? "text-[var(--danger)]"
                : "text-[var(--muted)]"
            }`}
          >
            {openConditions.length === 0
              ? "None"
              : `${openConditions.length} open`}
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          {focus ? (
            <>
              <DecisionPackagePanel
                decisionPackage={focus.submission.decisionPackage}
              />
              <ApprovalStatusList
                requests={focus.submission.approvalRequests}
              />
              <Panel>
                <RecordDecisionForm
                  submissionId={focus.submission.id}
                  expectedPackageVersion={
                    focus.submission.decisionPackage?.version ?? 1
                  }
                  question={focus.submission.decisionPackage?.question}
                  recommendationText={
                    focus.submission.decisionPackage?.recommendationText
                  }
                  allowedOutcomes={outcomesForGateType(focus.gate.gateType)}
                  capabilities={capabilities}
                />
              </Panel>
            </>
          ) : decisions.length === 0 ? (
            <EmptyState
              title="No decision package yet"
              description="Submit work for governance and complete required approvals before a decision can be recorded."
              action={
                <Link
                  href={`/initiatives/${item.id}/governance`}
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  Open governance
                </Link>
              }
            />
          ) : (
            <Panel>
              <h2 className="font-medium">Latest package</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                All current submissions either still need approvals or already
                have a recorded decision.
              </p>
            </Panel>
          )}

          <DecisionLogPanel decisions={decisions} />
        </div>

        <div className="space-y-4">
          <Panel>
            <h2 className="mb-2 font-medium">What happens after?</h2>
            {nextAction ? (
              <div className="mb-4 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
                <p className="text-sm text-[var(--muted)]">{nextAction.hint}</p>
                <Link
                  href={nextAction.href}
                  className="mt-3 inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  {nextAction.label}
                </Link>
                {nextAction.href === overviewHref &&
                latestGateType === "POC_GATE" ? (
                  <Link
                    href={`/initiatives/${item.id}/poc`}
                    className="mt-2 ml-3 inline-block text-sm text-[var(--accent)] underline"
                  >
                    Or open PoC workspace
                  </Link>
                ) : null}
                {nextAction.href.endsWith("/pilot") ? (
                  <Link
                    href={overviewHref}
                    className="mt-2 ml-3 inline-block text-sm text-[var(--accent)] underline"
                  >
                    Or open overview
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="mb-3 text-sm text-[var(--muted)]">
                {latestDecision
                  ? "No further create/convert step is waiting on this decision."
                  : "Record a decision to unlock the next lifecycle step."}
              </p>
            )}
            <ul className="space-y-2 text-sm text-[var(--muted)]">
              <li>
                <span className={statusToneClass("GO")}>Go</span> — proceed
                (e.g. create a PoC after pre-study).
              </li>
              <li>
                <span className={statusToneClass("CONDITIONAL_GO")}>
                  Conditional go
                </span>{" "}
                — proceed only after required conditions are closed.
              </li>
              <li>
                <span className={statusToneClass("SCALE")}>Scale</span> — allow
                Project conversion after Pilot (explicit action).
              </li>
              <li>
                <span className={statusToneClass("CONDITIONAL_SCALE")}>
                  Conditional scale
                </span>{" "}
                — scale after conditions close.
              </li>
              <li>
                <span className={statusToneClass("EXTEND_PILOT")}>
                  Extend pilot
                </span>{" "}
                — lengthen the Pilot window.
              </li>
              <li>
                <span className={statusToneClass("HOLD")}>Hold</span> — pause
                the initiative.
              </li>
              <li>
                <span className={statusToneClass("NO_GO")}>No-go / Stop</span> —
                cancel the initiative.
              </li>
            </ul>
          </Panel>

          <div id="conditions">
          <Panel>
            <h2 className="mb-3 font-medium">Conditions to resolve</h2>
            {openConditions.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No open conditions. Progression is not blocked by decision
                conditions.
              </p>
            ) : (
              <div className="space-y-5">
                {openConditions.map(({ decision, condition }) => (
                  <div
                    key={condition.id}
                    className="border-t border-[var(--line)] pt-4 first:border-0 first:pt-0"
                  >
                    <p className="mb-2 text-xs text-[var(--muted)]">
                      {decision.referenceKey}
                      {condition.requiredBeforeProgression
                        ? " · blocks progression"
                        : ""}
                    </p>
                    <ResolveConditionForm
                      conditionId={condition.id}
                      expectedVersion={condition.version}
                      initiativeId={item.id}
                      description={condition.description}
                      capabilities={capabilities}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
