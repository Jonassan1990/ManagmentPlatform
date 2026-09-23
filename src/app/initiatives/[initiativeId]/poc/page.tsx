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
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import { Breadcrumbs, EmptyState, PageHeader, Panel } from "@/components/ui/page";
import { POC_STATUS_ORDER } from "@/modules/governance/application/poc-readiness-policy";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PoCPage({
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

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey, href: `/initiatives/${item.id}` },
          { label: "PoC" },
        ]}
      />
      <PageHeader
        title={item.title}
        description={`${item.referenceKey} · Proof of Concept`}
      />
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
      />

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
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel>
              <p className="text-sm text-[var(--muted)]">PoC status</p>
              <p className={`mt-1 font-medium ${statusToneClass(poc.status)}`}>
                {humanize(poc.status)}
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
                  gateWorkspace.pocReadiness?.ready
                    ? "text-[var(--ok)]"
                    : "text-[var(--danger)]"
                }`}
              >
                {gateWorkspace.pocReadiness?.ready ? "Yes" : "Not yet"}
              </p>
            </Panel>
          </div>

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
              <Panel>
                <h2 className="mb-2 font-medium">After PoC decision</h2>
                <p className="text-sm text-[var(--muted)]">
                  After a Go or Conditional go decision (and closed blocking
                  conditions), create a Pilot from the{" "}
                  <a
                    href={`/initiatives/${item.id}/pilot`}
                    className="text-[var(--accent)] underline"
                  >
                    Pilot workspace
                  </a>
                  . PoC GO does not auto-create a Pilot.
                </p>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
