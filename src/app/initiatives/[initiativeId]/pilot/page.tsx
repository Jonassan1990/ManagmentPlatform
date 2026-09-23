import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  GateReadinessPanel,
  humanize,
  statusToneClass,
} from "@/components/governance/governance-panels";
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
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import {
  evaluatePilotStartReadiness,
  PILOT_STATUS_ORDER,
} from "@/modules/governance/application/pilot-readiness-policy";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PilotPage({
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

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey, href: `/initiatives/${item.id}` },
          { label: "Pilot" },
        ]}
      />
      <PageHeader
        title={item.title}
        description={`${item.referenceKey} · Pilot`}
      />
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
      />

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
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel>
              <p className="text-sm text-[var(--muted)]">Pilot status</p>
              <p className={`mt-1 font-medium ${statusToneClass(pilot.status)}`}>
                {humanize(pilot.status)}
              </p>
            </Panel>
            <Panel>
              <p className="text-sm text-[var(--muted)]">Success criteria</p>
              <p className="mt-1 font-medium">
                {criteria.length} total ·{" "}
                {criteria.filter((c) => c.required).length} required
              </p>
            </Panel>
            <Panel>
              <p className="text-sm text-[var(--muted)]">Ready for decision?</p>
              <p
                className={`mt-1 font-medium ${
                  gateWorkspace.pilotReadiness?.ready
                    ? "text-[var(--ok)]"
                    : "text-[var(--danger)]"
                }`}
              >
                {gateWorkspace.pilotReadiness?.ready ? "Yes" : "Not yet"}
              </p>
            </Panel>
          </div>

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
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
