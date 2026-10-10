import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  GateReadinessPanel,
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
import {
  AddPilotFeedbackForm,
  ConvertToProjectForm,
  CreatePilotForm,
  EvaluatePilotCriterionForm,
  PilotCriterionForm,
  PilotResultsForm,
  SubmitPilotButton,
  TransitionPilotButtons,
  UpdatePilotForm,
} from "@/components/pilot/pilot-forms";
import { StatusBadge } from "@/components/ui/status-badge";
import { Breadcrumbs, EmptyState, Panel } from "@/components/ui/page";
import { mapDecisionOutcomeBadge } from "@/modules/governance/application/governance-presentation";
import { buildInitiativeTrail } from "@/modules/navigation/breadcrumbs";
import { parseReturnContext } from "@/modules/navigation/return-context";
import {
  evaluatePilotStartReadiness,
  PILOT_STATUS_ORDER,
} from "@/modules/governance/application/pilot-readiness-policy";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PilotPage({
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
  const pilot = item.pilot;
  const criteria = pilot?.criteria ?? [];
  const feedback = pilot?.feedbackEntries ?? [];
  const extensions = pilot?.extensions ?? [];

  const pocGo = item.decisions.find(
    (d) =>
      (d.outcome === "GO" || d.outcome === "CONDITIONAL_GO") &&
      // Prefer PoC-gate decisions when gate relation is present
      true,
  );
  // Prefer decisions linked via PoC gate submissions
  const pocGate = item.governanceGates.find((g) => g.gateType === "POC_GATE");
  const pocGateDecision =
    pocGate?.decisions.find(
      (d) => d.outcome === "GO" || d.outcome === "CONDITIONAL_GO",
    ) ??
    item.decisions.find((d) => d.outcome === "GO" || d.outcome === "CONDITIONAL_GO");

  const openBlocking = item.decisions.flatMap((d) =>
    (d.conditions ?? []).filter(
      (c) => c.requiredBeforeProgression && c.status === "OPEN",
    ),
  );
  const canCreate =
    !pilot &&
    item.currentStage === "POC" &&
    Boolean(pocGateDecision ?? pocGo) &&
    openBlocking.length === 0;

  const pilotGate = item.governanceGates.find((g) => g.gateType === "PILOT_GATE");
  const activePilotSubmission = pilotGate?.submissions.find(
    (s) =>
      s.status === "IN_REVIEW" ||
      s.status === "SUBMITTED" ||
      s.status === "APPROVALS_COMPLETE" ||
      s.status === "CHANGES_REQUESTED",
  );
  const canSubmitPilot =
    Boolean(pilot) &&
    item.currentStage === "PILOT" &&
    Boolean(gateWorkspace.pilotReadiness?.ready) &&
    !activePilotSubmission;

  const scaleDecision = item.decisions.find(
    (d) => d.outcome === "SCALE" || d.outcome === "CONDITIONAL_SCALE",
  );
  const openScaleBlocking = (scaleDecision?.conditions ?? []).filter(
    (c) => c.requiredBeforeProgression && c.status === "OPEN",
  );
  const canConvert =
    !item.project &&
    item.currentStage === "PILOT" &&
    Boolean(scaleDecision) &&
    openScaleBlocking.length === 0;

  const startReadiness =
    pilot != null
      ? evaluatePilotStartReadiness(pilot, criteria)
      : null;

  const scaleBadge = mapDecisionOutcomeBadge(scaleDecision?.outcome);

  return (
    <div>
      <Breadcrumbs
        items={buildInitiativeTrail({
          initiativeId: item.id,
          referenceKey: item.referenceKey,
          title: item.title,
          leaf: "Pilot",
          returnContext,
        })}
      />
      <header className="mb-5">
        <p className="ds-eyebrow text-[10px]">
          Pilot workspace · {item.referenceKey}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
          {item.title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Pilot evaluation and scale readiness. SCALE does not auto-create a
          Project — conversion is an explicit action.
        </p>
      </header>
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs
        initiativeId={item.id}
        active="pilot"
        currentStage={item.currentStage}
        hasGovernance={item.governanceGates.length > 0}
        hasPoC={Boolean(item.poc)}
        hasPilot={Boolean(item.pilot)}
        hasProject={Boolean(item.project)}
        preserveQuery={query}
      />

      <RecommendationVsDecisionCallout surface="pilot" />

      {!pilot ? (
        <div className="space-y-4">
          {canCreate ? (
            <Panel>
              <CreatePilotForm
                initiativeId={item.id}
                capabilities={capabilities}
              />
            </Panel>
          ) : (
            <EmptyState
              title="No Pilot yet"
              description={
                !(pocGateDecision ?? pocGo)
                  ? "A Pilot can be created after a Go or Conditional go PoC decision."
                  : openBlocking.length > 0
                    ? "Blocking decision conditions must be resolved before creating a Pilot."
                    : item.currentStage !== "POC"
                      ? "Pilot creation is only available from PoC after a governing decision."
                      : "Pilot is not available in the current state."
              }
              action={
                <Link
                  href={
                    openBlocking.length > 0
                      ? `/initiatives/${item.id}/decisions`
                      : `/initiatives/${item.id}/poc`
                  }
                  className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  {openBlocking.length > 0 ? "Resolve conditions" : "Open PoC"}
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
                label: "Pilot status",
                value: (
                  <span className={statusToneClass(pilot.status)}>
                    {humanize(pilot.status)}
                  </span>
                ),
              },
              {
                label: "Owner / team",
                value: pilot.ownerName?.trim() || "Not set",
                hint: pilot.resourceNotes?.trim()
                  ? "See resource notes below"
                  : undefined,
              },
              {
                label: "Target users / sites",
                value:
                  [pilot.targetUsers, pilot.siteOrArea]
                    .filter((v) => v?.trim())
                    .join(" · ") || "Not set",
              },
              {
                label: "Success criteria / KPIs",
                value: `${criteria.length} total · ${criteria.filter((c) => c.required).length} required`,
              },
              {
                label: "Costs",
                value:
                  pilot.estimatedCost != null || pilot.actualCost != null
                    ? `Est. ${pilot.estimatedCost ?? "—"} / Actual ${pilot.actualCost ?? "—"} ${pilot.currencyCode}`
                    : "Not set",
              },
              {
                label: "Scale recommendation",
                value:
                  pilot.businessFindings?.trim() ||
                  pilot.operationalFindings?.trim()
                    ? "Findings recorded"
                    : "Not recorded yet",
                hint: "Operational — not the formal SCALE decision",
              },
              {
                label: "Formal rollout decision",
                value: (
                  <StatusBadge
                    status={scaleBadge.status}
                    label={scaleBadge.label}
                    size="compact"
                  />
                ),
              },
              {
                label: "Lessons learned",
                value: pilot.lessonsLearned?.trim()
                  ? "Captured"
                  : "Not recorded yet",
              },
            ]}
          />

          <Panel>
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Pilot scope
            </h2>
            <dl className="mt-3 grid gap-3 text-sm lg:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Objective
                </dt>
                <dd className="mt-1 text-[var(--ink)]">{pilot.objective}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Scope
                </dt>
                <dd className="mt-1 text-[var(--ink)]">{pilot.scope}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Out of scope
                </dt>
                <dd className="mt-1 text-[var(--ink)]">
                  {pilot.outOfScope?.trim() || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Planned dates
                </dt>
                <dd className="mt-1 text-[var(--ink)]">
                  {pilot.plannedStart || pilot.plannedEnd
                    ? `${pilot.plannedStart ? new Date(pilot.plannedStart).toISOString().slice(0, 10) : "—"} → ${pilot.plannedEnd ? new Date(pilot.plannedEnd).toISOString().slice(0, 10) : "—"}`
                    : "Not set"}
                </dd>
              </div>
            </dl>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <Panel>
                <UpdatePilotForm pilot={pilot} capabilities={capabilities} />
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
                          <span className="font-medium">{criterion.title}</span>
                          <span className={statusToneClass(criterion.evaluationState)}>
                            {humanize(criterion.evaluationState)}
                            {criterion.required ? " · required" : ""}
                          </span>
                        </div>
                        <p className="mb-3 text-xs text-[var(--muted)]">
                          {criterion.category.replaceAll("_", " ")} · Measure:{" "}
                          {criterion.measurementMethod} · Target: {criterion.target}
                          {criterion.unit ? ` ${criterion.unit}` : ""}
                        </p>
                        <PilotCriterionForm
                          pilotId={pilot.id}
                          initiativeId={item.id}
                          existing={criterion}
                          capabilities={capabilities}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <PilotCriterionForm
                  pilotId={pilot.id}
                  initiativeId={item.id}
                  capabilities={capabilities}
                />
              </Panel>

              <Panel>
                <h2 className="mb-3 font-medium">Feedback</h2>
                {feedback.length === 0 ? (
                  <p className="mb-4 text-sm text-[var(--muted)]">
                    No feedback entries yet.
                  </p>
                ) : (
                  <ul className="mb-5 space-y-3 text-sm">
                    {feedback.map((entry) => (
                      <li
                        key={entry.id}
                        className="border-t border-[var(--line)] pt-3 first:border-0 first:pt-0"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">{entry.sourceType}</span>
                          <span className="text-xs text-[var(--muted)]">
                            {entry.sentiment
                              ? humanize(entry.sentiment)
                              : "—"}{" "}
                            ·{" "}
                            {entry.submittedAt.toISOString().slice(0, 10)}
                          </span>
                        </div>
                        <p className="mt-1">{entry.summary}</p>
                        {entry.details ? (
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {entry.details}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <AddPilotFeedbackForm
                  pilotId={pilot.id}
                  initiativeId={item.id}
                  capabilities={capabilities}
                />
              </Panel>

              {(pilot.status === "EVALUATION" ||
                pilot.status === "COMPLETED" ||
                pilot.status === "IN_PROGRESS") && (
                <Panel>
                  <h2 className="mb-3 font-medium">Evaluate criteria</h2>
                  <div className="space-y-5">
                    {criteria.map((criterion) => (
                      <div
                        key={`eval-${criterion.id}`}
                        className="border-t border-[var(--line)] pt-4 first:border-0 first:pt-0"
                      >
                        <EvaluatePilotCriterionForm
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
                <PilotResultsForm pilot={pilot} capabilities={capabilities} />
              </Panel>
            </div>

            <div className="space-y-4">
              {startReadiness ? (
                <GateReadinessPanel
                  title="Start readiness"
                  ready={startReadiness.ready}
                  items={startReadiness.items.map((i) => ({
                    key: i.key,
                    label: i.label,
                    ok: i.ok,
                    detail: i.detail,
                  }))}
                />
              ) : null}
              <GateReadinessPanel
                title="Pilot governance readiness"
                ready={Boolean(gateWorkspace.pilotReadiness?.ready)}
                items={(gateWorkspace.pilotReadiness?.items ?? []).map((i) => ({
                  key: i.key,
                  label: i.label,
                  ok: i.ok,
                  detail: i.detail,
                }))}
              />
              <Panel>
                <h2 className="mb-3 font-medium">Execution</h2>
                <TransitionPilotButtons
                  pilotId={pilot.id}
                  initiativeId={item.id}
                  status={
                    PILOT_STATUS_ORDER.includes(
                      pilot.status as (typeof PILOT_STATUS_ORDER)[number],
                    )
                      ? (pilot.status as (typeof PILOT_STATUS_ORDER)[number])
                      : "DRAFT"
                  }
                  expectedVersion={pilot.version}
                  capabilities={capabilities}
                />
              </Panel>
              {extensions.length > 0 ? (
                <Panel>
                  <h2 className="mb-2 font-medium">Extensions</h2>
                  <ul className="space-y-2 text-sm">
                    {extensions.map((ext) => (
                      <li key={ext.id}>
                        New end:{" "}
                        {ext.newPlannedEnd
                          ? ext.newPlannedEnd.toISOString().slice(0, 10)
                          : "—"}
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">
                          {ext.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
              <Panel>
                <h2 className="mb-2 font-medium">Submit for governance</h2>
                {canSubmitPilot ? (
                  <SubmitPilotButton
                    initiativeId={item.id}
                    capabilities={capabilities}
                  />
                ) : activePilotSubmission ? (
                  <p className="text-sm text-[var(--muted)]">
                    Pilot gate is already in flight (
                    {humanize(activePilotSubmission.status)}).{" "}
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
                latestOutcome={scaleDecision?.outcome}
                canConvertProject={canConvert}
                projectHref={
                  item.project ? `/initiatives/${item.id}/project` : null
                }
              />
              <Panel>
                <h2 className="mb-2 font-medium">After scale decision</h2>
                {item.project ? (
                  <p className="text-sm text-[var(--muted)]">
                    Project exists.{" "}
                    <Link
                      href={`/initiatives/${item.id}/project`}
                      className="text-[var(--accent)] underline"
                    >
                      Open project workspace
                    </Link>
                  </p>
                ) : canConvert ? (
                  <ConvertToProjectForm
                    initiativeId={item.id}
                    defaultName={item.title}
                    capabilities={capabilities}
                  />
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    After a Scale or Conditional scale decision (and closed
                    blocking conditions), convert to a Project from here.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <Link
                    href={`/initiatives/${item.id}/governance`}
                    className="text-[var(--color-accent)] underline"
                  >
                    Open governance
                  </Link>
                  <Link
                    href={`/initiatives/${item.id}/decisions`}
                    className="text-[var(--color-accent)] underline"
                  >
                    Open decisions
                  </Link>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
