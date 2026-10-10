import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  RecordDecisionForm,
  ResolveConditionForm,
} from "@/components/governance/governance-forms";
import { outcomesForGateType } from "@/modules/governance/application/governance-presentation";
import {
  ApprovalStatusList,
  DecisionLogPanel,
  DecisionPackagePanel,
  humanize,
  statusToneClass,
} from "@/components/governance/governance-panels";
import { LifecycleClarityPanel } from "@/components/governance/governance-workspace";
import {
  InitiativeTabs,
  LifecycleRail,
  NextActionPanel,
} from "@/components/initiative/workspace";
import { StatusBadge } from "@/components/ui/status-badge";
import { Breadcrumbs, EmptyState, Panel } from "@/components/ui/page";
import { mapDecisionOutcomeBadge } from "@/modules/governance/application/governance-presentation";
import { buildInitiativeTrail } from "@/modules/navigation/breadcrumbs";
import { parseReturnContext } from "@/modules/navigation/return-context";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function InitiativeDecisionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ initiativeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { initiativeId } = await params;
  const query = await searchParams;
  const returnContext = parseReturnContext(query);
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

  const latestBadge = mapDecisionOutcomeBadge(latestDecision?.outcome);

  return (
    <div>
      <Breadcrumbs
        items={buildInitiativeTrail({
          initiativeId: item.id,
          referenceKey: item.referenceKey,
          title: item.title,
          leaf: "Decisions",
          returnContext,
        })}
      />
      <header className="mb-5">
        <p className="ds-eyebrow text-[10px]">
          Decision workspace · {item.referenceKey}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
          {item.title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Decision package, allowed outcomes, conditions, and immutable history.
          Recommendation text is informational only.
        </p>
      </header>
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
        preserveQuery={query}
      />

      <div className="mb-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Panel>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Decision required?
            </p>
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
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Latest outcome
            </p>
            <div className="mt-1">
              <StatusBadge
                status={latestBadge.status}
                label={latestBadge.label}
                size="compact"
              />
            </div>
          </Panel>
          <Panel>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Open conditions
            </p>
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

        {nextAction ? (
          <NextActionPanel
            label={nextAction.label}
            detail={nextAction.hint}
            blocked={nextAction.href === "#conditions"}
            href={nextAction.href === "#conditions" ? null : nextAction.href}
            ctaLabel={
              nextAction.href === "#conditions" ? null : nextAction.label
            }
          />
        ) : null}
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
          <LifecycleClarityPanel
            hasPoC={Boolean(item.poc)}
            hasPilot={Boolean(item.pilot)}
            hasProject={Boolean(item.project)}
            latestOutcome={latestDecision?.outcome}
            canCreatePoC={
              latestGateType === "PRE_STUDY_GATE" &&
              (latestDecision?.outcome === "GO" ||
                latestDecision?.outcome === "CONDITIONAL_GO") &&
              conditionsClear &&
              !item.poc
            }
            canCreatePilot={
              latestGateType === "POC_GATE" &&
              (latestDecision?.outcome === "GO" ||
                latestDecision?.outcome === "CONDITIONAL_GO") &&
              conditionsClear &&
              !item.pilot
            }
            canConvertProject={
              latestGateType === "PILOT_GATE" &&
              (latestDecision?.outcome === "SCALE" ||
                latestDecision?.outcome === "CONDITIONAL_SCALE") &&
              conditionsClear &&
              !item.project
            }
            projectHref={
              item.project ? `/initiatives/${item.id}/project` : null
            }
          />
          <Panel>
            <h2 className="mb-2 font-medium">Allowed outcomes</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">
              {latestDecision
                ? "History below is immutable. Further create/convert steps stay manual."
                : "Record a decision to unlock the next lifecycle step."}
            </p>
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
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link
                href={`/initiatives/${item.id}/governance`}
                className="text-[var(--color-accent)] underline"
              >
                Open governance
              </Link>
              {latestGateType === "POC_GATE" || item.poc ? (
                <Link
                  href={`/initiatives/${item.id}/poc`}
                  className="text-[var(--color-accent)] underline"
                >
                  Open PoC
                </Link>
              ) : null}
              {latestGateType === "PILOT_GATE" || item.pilot ? (
                <Link
                  href={`/initiatives/${item.id}/pilot`}
                  className="text-[var(--color-accent)] underline"
                >
                  Open Pilot
                </Link>
              ) : null}
            </div>
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
