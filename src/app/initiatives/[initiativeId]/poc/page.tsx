import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CreatePoCForm,
  CriterionForm,
  EvaluateCriterionForm,
  PoCResultsForm,
  SubmitPoCButton,
  TransitionPoCButtons,
  UpdatePoCForm,
} from "@/components/governance/governance-forms";
import {
  PoCReadinessPanel,
  humanize,
  statusToneClass,
} from "@/components/governance/governance-panels";
import {
  ExperimentSummaryGrid,
  LifecycleClarityPanel,
  RecommendationVsDecisionCallout,
} from "@/components/governance/governance-workspace";
import {
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import { StatusBadge } from "@/components/ui/status-badge";
import { Breadcrumbs, EmptyState, Panel } from "@/components/ui/page";
import { mapDecisionOutcomeBadge } from "@/modules/governance/application/governance-presentation";
import { buildInitiativeTrail } from "@/modules/navigation/breadcrumbs";
import { parseReturnContext } from "@/modules/navigation/return-context";
import { POC_STATUS_ORDER } from "@/modules/governance/application/poc-readiness-policy";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PoCPage({
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
  const poc = item.poc;
  const criteria = poc?.criteria ?? [];
  const preStudyGo = item.decisions.find(
    (d) => d.outcome === "GO" || d.outcome === "CONDITIONAL_GO",
  );
  const openBlocking = item.decisions.flatMap((d) =>
    (d.conditions ?? []).filter(
      (c) => c.requiredBeforeProgression && c.status === "OPEN",
    ),
  );
  const canCreate =
    !poc &&
    item.currentStage === "PRE_STUDY" &&
    Boolean(preStudyGo) &&
    openBlocking.length === 0;

  const pocGate = item.governanceGates.find((g) => g.gateType === "POC_GATE");
  const activePoCSubmission = pocGate?.submissions.find(
    (s) =>
      s.status === "IN_REVIEW" ||
      s.status === "SUBMITTED" ||
      s.status === "APPROVALS_COMPLETE" ||
      s.status === "CHANGES_REQUESTED",
  );
  const canSubmitPoC =
    Boolean(poc) &&
    item.currentStage === "POC" &&
    Boolean(gateWorkspace.pocReadiness?.ready) &&
    !activePoCSubmission;

  const pocGateDecision = item.governanceGates
    .find((g) => g.gateType === "POC_GATE")
    ?.decisions.find(
      (d) =>
        d.outcome === "GO" ||
        d.outcome === "CONDITIONAL_GO" ||
        d.outcome === "NO_GO" ||
        d.outcome === "HOLD",
    );
  const formalDecisionBadge = mapDecisionOutcomeBadge(
    pocGateDecision?.outcome,
  );

  return (
    <div>
      <Breadcrumbs
        items={buildInitiativeTrail({
          initiativeId: item.id,
          referenceKey: item.referenceKey,
          title: item.title,
          leaf: "PoC",
          returnContext,
        })}
      />
      <header className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#087f78]">
          PoC workspace · {item.referenceKey}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
          {item.title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Proof of Concept evaluation. Operational recommendation is distinct
          from the formal governance decision.
        </p>
      </header>
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs
        initiativeId={item.id}
        active="poc"
        currentStage={item.currentStage}
        hasGovernance={item.governanceGates.length > 0}
        hasPoC={Boolean(item.poc)}
        hasPilot={Boolean(item.pilot)}
        hasProject={Boolean(item.project)}
        preserveQuery={query}
      />

      <RecommendationVsDecisionCallout surface="poc" />

      {!poc ? (
        <div className="space-y-4">
          {canCreate ? (
            <Panel>
              <CreatePoCForm initiativeId={item.id} capabilities={capabilities} />
            </Panel>
          ) : (
            <EmptyState
              title="No PoC yet"
              description={
                !preStudyGo
                  ? "A PoC can be created after a Go or Conditional go pre-study decision."
                  : openBlocking.length > 0
                    ? "Blocking decision conditions must be resolved before creating a PoC."
                    : item.currentStage !== "PRE_STUDY"
                      ? "PoC creation is only available from Pre-study after a governing decision."
                      : "PoC is not available in the current state."
              }
              action={
                <Link
                  href={
                    openBlocking.length > 0
                      ? `/initiatives/${item.id}/decisions`
                      : `/initiatives/${item.id}/governance`
                  }
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  {openBlocking.length > 0
                    ? "Resolve conditions"
                    : "Open governance"}
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ExperimentSummaryGrid
            items={[
              {
                label: "PoC status",
                value: (
                  <span className={statusToneClass(poc.status)}>
                    {humanize(poc.status)}
                  </span>
                ),
              },
              {
                label: "Owner",
                value: poc.ownerName?.trim() || "Not set",
              },
              {
                label: "Planned dates",
                value:
                  poc.plannedStart || poc.plannedEnd
                    ? `${poc.plannedStart ? new Date(poc.plannedStart).toISOString().slice(0, 10) : "—"} → ${poc.plannedEnd ? new Date(poc.plannedEnd).toISOString().slice(0, 10) : "—"}`
                    : "Not set",
              },
              {
                label: "Success criteria",
                value: `${criteria.length} total · ${criteria.filter((c) => c.required).length} required`,
              },
              {
                label: "Ready for governance?",
                value: gateWorkspace.pocReadiness?.ready ? "Yes" : "Not yet",
                hint: "Readiness ≠ approval",
              },
              {
                label: "Operational recommendation",
                value: poc.findings?.trim()
                  ? "Findings recorded"
                  : "Not recorded yet",
                hint: "From PoC findings — not the formal decision",
              },
              {
                label: "Formal governance decision",
                value: (
                  <StatusBadge
                    status={formalDecisionBadge.status}
                    label={formalDecisionBadge.label}
                    size="compact"
                  />
                ),
                hint: "Recorded under Decisions after approvals",
              },
              {
                label: "Evidence / results",
                value: poc.results?.trim() ? "Results captured" : "No results yet",
              },
            ]}
          />

          <Panel>
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Objectives & hypothesis
            </h2>
            <dl className="mt-3 grid gap-3 text-sm lg:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Objective
                </dt>
                <dd className="mt-1 text-[var(--ink)]">{poc.objective}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Hypothesis
                </dt>
                <dd className="mt-1 text-[var(--ink)]">{poc.hypothesis}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Scope
                </dt>
                <dd className="mt-1 text-[var(--ink)]">{poc.scope}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Out of scope
                </dt>
                <dd className="mt-1 text-[var(--ink)]">
                  {poc.outOfScope?.trim() || "Not set"}
                </dd>
              </div>
            </dl>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <Panel>
                <UpdatePoCForm poc={poc} capabilities={capabilities} />
              </Panel>

              <Panel>
                <h2 className="mb-3 font-medium">Success criteria</h2>
                {criteria.length === 0 ? (
                  <p className="mb-4 text-sm text-[var(--muted)]">
                    Add at least one required criterion before marking the
                    definition ready.
                  </p>
                ) : (
                  <ul className="mb-5 space-y-4">
                    {criteria.map((criterion) => (
                      <li
                        key={criterion.id}
                        className="border-t border-[var(--line)] pt-4 first:border-0 first:pt-0"
                      >
                        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                          <span className="font-medium">
                            {criterion.description}
                          </span>
                          <span className={statusToneClass(criterion.evaluationState)}>
                            {humanize(criterion.evaluationState)}
                            {criterion.required ? " · required" : ""}
                          </span>
                        </div>
                        <p className="mb-3 text-xs text-[var(--muted)]">
                          Measure: {criterion.measurementMethod} · Target:{" "}
                          {criterion.target}
                          {criterion.unit ? ` ${criterion.unit}` : ""}
                        </p>
                        <CriterionForm
                          pocId={poc.id}
                          initiativeId={item.id}
                          existing={criterion}
                          capabilities={capabilities}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <CriterionForm pocId={poc.id} initiativeId={item.id} capabilities={capabilities} />
              </Panel>

              {(poc.status === "EVALUATION" ||
                poc.status === "COMPLETED" ||
                poc.status === "IN_PROGRESS") && (
                <Panel>
                  <h2 className="mb-3 font-medium">Evaluate criteria</h2>
                  <div className="space-y-5">
                    {criteria.map((criterion) => (
                      <div
                        key={`eval-${criterion.id}`}
                        className="border-t border-[var(--line)] pt-4 first:border-0 first:pt-0"
                      >
                        <EvaluateCriterionForm
                          initiativeId={item.id}
                          criterion={criterion}
                          capabilities={capabilities}
                        />
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              <Panel>
                <PoCResultsForm poc={poc} capabilities={capabilities} />
              </Panel>
            </div>

            <div className="space-y-4">
              <PoCReadinessPanel readiness={gateWorkspace.pocReadiness} />
              <Panel>
                <h2 className="mb-3 font-medium">Execution</h2>
                <TransitionPoCButtons
                  pocId={poc.id}
                  initiativeId={item.id}
                  status={
                    POC_STATUS_ORDER.includes(
                      poc.status as (typeof POC_STATUS_ORDER)[number],
                    )
                      ? (poc.status as (typeof POC_STATUS_ORDER)[number])
                      : "DRAFT"
                  }
                  expectedVersion={poc.version}
                  capabilities={capabilities}
                />
              </Panel>
              <Panel>
                <h2 className="mb-2 font-medium">Submit for governance</h2>
                {canSubmitPoC ? (
                  <SubmitPoCButton initiativeId={item.id} capabilities={capabilities} />
                ) : activePoCSubmission ? (
                  <p className="text-sm text-[var(--muted)]">
                    PoC gate is already in flight (
                    {humanize(activePoCSubmission.status)}).{" "}
                    <Link
                      href={`/initiatives/${item.id}/governance`}
                      className="text-[var(--accent)] underline"
                    >
                      View governance
                    </Link>
                  </p>
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    Complete evaluation, required criteria, results, and findings
                    before submitting.
                  </p>
                )}
              </Panel>
              <LifecycleClarityPanel
                hasPoC={Boolean(item.poc)}
                hasPilot={Boolean(item.pilot)}
                hasProject={Boolean(item.project)}
                latestOutcome={pocGateDecision?.outcome}
                canCreatePilot={
                  Boolean(pocGateDecision) &&
                  (pocGateDecision?.outcome === "GO" ||
                    pocGateDecision?.outcome === "CONDITIONAL_GO") &&
                  openBlocking.length === 0 &&
                  !item.pilot &&
                  item.currentStage === "POC"
                }
                projectHref={
                  item.project ? `/initiatives/${item.id}/project` : null
                }
              />
              <Panel>
                <h2 className="mb-2 font-medium">After PoC decision</h2>
                <p className="text-sm text-[var(--muted)]">
                  After a Go or Conditional go decision (and closed blocking
                  conditions), create a Pilot from the{" "}
                  <Link
                    href={`/initiatives/${item.id}/pilot`}
                    className="text-[var(--accent)] underline"
                  >
                    Pilot workspace
                  </Link>
                  . PoC GO does not auto-create a Pilot.
                </p>
                <Link
                  href={`/initiatives/${item.id}/governance`}
                  className="mt-3 inline-flex min-h-11 items-center text-sm text-[#087f78] underline"
                >
                  Open governance
                </Link>
                {" · "}
                <Link
                  href={`/initiatives/${item.id}/decisions`}
                  className="inline-flex min-h-11 items-center text-sm text-[#087f78] underline"
                >
                  Open decisions
                </Link>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
