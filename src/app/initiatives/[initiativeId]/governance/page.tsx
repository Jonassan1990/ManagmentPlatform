import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ReviseSubmissionButton,
  SubmitPreStudyButton,
} from "@/components/governance/governance-forms";
import {
  ChangesRequestedBanner,
  GateReadinessPanel,
  SubmissionSummaryPanel,
} from "@/components/governance/governance-panels";
import {
  DecisionContextPanel,
  DecisionOutcomeSummary,
  DisclosureSection,
  EvidenceTable,
  GovernanceNextActionSlot,
  LifecycleClarityPanel,
  ReviewSummary,
  buildGovernanceDecisionContext,
  describeGovernanceNextAction,
} from "@/components/governance/governance-workspace";
import {
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import { StatusBadge } from "@/components/ui/status-badge";
import { Breadcrumbs, Panel } from "@/components/ui/page";
import { evidenceSummary } from "@/modules/governance/application/governance-presentation";
import { buildInitiativeTrail } from "@/modules/navigation/breadcrumbs";
import { parseReturnContext } from "@/modules/navigation/return-context";
import { evaluatePreStudyReadiness } from "@/modules/initiative/application/readiness-policy";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function GovernancePage({
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
  const preStudyGate = item.governanceGates.find(
    (g) => g.gateType === "PRE_STUDY_GATE",
  );
  const pocGate = item.governanceGates.find((g) => g.gateType === "POC_GATE");
  const pilotGate = item.governanceGates.find((g) => g.gateType === "PILOT_GATE");
  const activeGate =
    item.currentStage === "PILOT" && pilotGate
      ? pilotGate
      : item.currentStage === "POC" && pocGate
        ? pocGate
        : preStudyGate ?? pocGate ?? pilotGate;
  const latestSubmission = activeGate?.submissions[0] ?? null;
  const evidenceEntries = latestSubmission?.evidencePackage?.entries ?? [];
  const approvalRequests = latestSubmission?.approvalRequests ?? [];
  const decisionPackage = latestSubmission?.decisionPackage ?? null;
  const relatedDecision =
    item.decisions.find((d) => d.gateId === activeGate?.id) ?? null;
  const evidence = evidenceSummary(evidenceEntries);

  const preStudyReadiness = evaluatePreStudyReadiness({
    demand: item.demand,
    requirements: item.requirements,
    assessments: item.preStudy?.assessments ?? [],
    alternatives: item.preStudy?.alternatives ?? [],
    risks: item.risks,
    documents: [],
  });

  const openReviewExists = (preStudyGate?.submissions ?? [])
    .concat(pocGate?.submissions ?? [])
    .concat(pilotGate?.submissions ?? [])
    .some(
      (s) =>
        s.status === "IN_REVIEW" ||
        s.status === "SUBMITTED" ||
        s.status === "APPROVALS_COMPLETE",
    );

  const canSubmitFresh =
    item.currentStage === "PRE_STUDY" &&
    preStudyReadiness.ready &&
    !openReviewExists;

  const changesRequested =
    (preStudyGate?.submissions ?? [])
      .concat(pocGate?.submissions ?? [])
      .concat(pilotGate?.submissions ?? [])
      .find((s) => s.status === "CHANGES_REQUESTED") ?? null;

  const openBlocking = item.decisions.flatMap((d) =>
    (d.conditions ?? []).filter(
      (c) => c.requiredBeforeProgression && c.status === "OPEN",
    ),
  );

  const decisionOwnerName =
    typeof item.businessOwnerName === "string" && item.businessOwnerName.trim()
      ? item.businessOwnerName.trim()
      : null;

  const context = buildGovernanceDecisionContext({
    referenceKey: item.referenceKey,
    title: item.title,
    currentStage: item.currentStage,
    gateType: activeGate?.gateType,
    submissionStatus: latestSubmission?.status,
    revision: latestSubmission?.revision,
    decisionOwnerName,
    changesRequested: Boolean(changesRequested),
    openBlockingConditions: openBlocking.length,
  });

  const nextAction = describeGovernanceNextAction({
    initiativeId: item.id,
    currentStage: item.currentStage,
    canSubmitFresh,
    preStudyReady: preStudyReadiness.ready,
    changesRequested: Boolean(changesRequested),
    submissionStatus: latestSubmission?.status,
    openBlockingConditions: openBlocking.length,
  });

  const hasActiveSubmission = Boolean(
    latestSubmission &&
      (latestSubmission.status === "IN_REVIEW" ||
        latestSubmission.status === "SUBMITTED" ||
        latestSubmission.status === "APPROVALS_COMPLETE" ||
        latestSubmission.status === "CHANGES_REQUESTED"),
  );

  return (
    <div>
      <Breadcrumbs
        items={buildInitiativeTrail({
          initiativeId: item.id,
          referenceKey: item.referenceKey,
          title: item.title,
          leaf: "Governance",
          returnContext,
        })}
      />

      <header className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#087f78]">
          Governance workspace · {item.referenceKey}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--ink)]">
          {item.title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Evidence, approvals, and decisions for this initiative. GO does not
          auto-create PoC, Pilot, or Project.
        </p>
      </header>

      <div className="mb-5">
        <LifecycleRail
          current={item.currentStage}
          premium={{
            currentStage: item.currentStage,
            hasActiveSubmission,
            submissionStatus: latestSubmission?.status ?? null,
            hasPreStudyGoDecision: item.decisions.some(
              (d) => d.outcome === "GO" || d.outcome === "CONDITIONAL_GO",
            ),
            openBlockingConditions: openBlocking.length,
          }}
        />
      </div>
      <InitiativeTabs
        initiativeId={item.id}
        active="governance"
        currentStage={item.currentStage}
        hasGovernance={item.governanceGates.length > 0}
        hasPoC={Boolean(item.poc)}
        hasPilot={Boolean(item.pilot)}
        hasProject={Boolean(item.project)}
        preserveQuery={query}
      />

      <div className="mb-4 space-y-4">
        <DecisionContextPanel context={context} />

        <GovernanceNextActionSlot action={nextAction}>
          {canSubmitFresh ? (
            <SubmitPreStudyButton
              initiativeId={item.id}
              expectedInitiativeVersion={item.version}
              disabled={!preStudyReadiness.ready}
              capabilities={capabilities}
            />
          ) : null}
          {changesRequested ? (
            <ReviseSubmissionButton
              previousSubmissionId={changesRequested.id}
              initiativeId={item.id}
              capabilities={capabilities}
            />
          ) : null}
        </GovernanceNextActionSlot>

        {changesRequested ? (
          <ChangesRequestedBanner revision={changesRequested.revision} />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <DisclosureSection
            id="governance-evidence"
            title="Evidence"
            summary={evidence.label}
            defaultOpen={evidenceEntries.length > 0 || canSubmitFresh}
            badge={
              <StatusBadge
                status={
                  evidence.total === 0
                    ? "unavailable"
                    : evidence.missing === 0
                      ? "completed"
                      : "at-risk"
                }
                label={
                  evidence.total === 0
                    ? "None"
                    : evidence.missing === 0
                      ? "Complete"
                      : `${evidence.missing} missing`
                }
                size="compact"
              />
            }
          >
            {(item.currentStage === "PRE_STUDY" ||
              activeGate?.gateType === "PRE_STUDY_GATE") && (
              <div className="mb-4">
                <GateReadinessPanel
                  title="Pre-study readiness"
                  ready={preStudyReadiness.ready}
                  items={preStudyReadiness.items.map((i) => ({
                    key: i.key,
                    label: i.label,
                    status: i.status,
                    detail: i.detail,
                  }))}
                />
              </div>
            )}
            {gateWorkspace.pocReadiness ? (
              <div className="mb-4">
                <GateReadinessPanel
                  title="PoC readiness"
                  ready={gateWorkspace.pocReadiness.ready}
                  items={gateWorkspace.pocReadiness.items.map((i) => ({
                    key: i.key,
                    label: i.label,
                    ok: i.ok,
                    detail: i.detail,
                  }))}
                />
              </div>
            ) : null}
            {gateWorkspace.pilotReadiness ? (
              <div className="mb-4">
                <GateReadinessPanel
                  title="Pilot readiness"
                  ready={gateWorkspace.pilotReadiness.ready}
                  items={gateWorkspace.pilotReadiness.items.map((i) => ({
                    key: i.key,
                    label: i.label,
                    ok: i.ok,
                    detail: i.detail,
                  }))}
                />
              </div>
            ) : null}
            <EvidenceTable entries={evidenceEntries} />
          </DisclosureSection>

          <DisclosureSection
            id="governance-review"
            title="Review"
            summary={
              approvalRequests.length === 0
                ? "No approval requests"
                : `${approvalRequests.filter((r) => r.status === "PENDING" && !r.record).length} pending · ${approvalRequests.filter((r) => r.status !== "PENDING" || r.record).length} completed`
            }
            defaultOpen={
              latestSubmission?.status === "IN_REVIEW" ||
              latestSubmission?.status === "APPROVALS_COMPLETE"
            }
          >
            <ReviewSummary requests={approvalRequests} />
            {latestSubmission?.status === "IN_REVIEW" ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Reviewers act from{" "}
                <Link
                  href="/approvals"
                  className="text-[#087f78] underline"
                >
                  My Approvals
                </Link>
                . Outcomes are immutable.
              </p>
            ) : null}
          </DisclosureSection>

          <DisclosureSection
            id="governance-decision"
            title="Decision"
            summary={
              relatedDecision
                ? `Recorded · ${relatedDecision.outcome.replaceAll("_", " ")}`
                : decisionPackage
                  ? "Package ready — awaiting formal outcome"
                  : "No decision package yet"
            }
            defaultOpen={
              latestSubmission?.status === "APPROVALS_COMPLETE" ||
              Boolean(relatedDecision)
            }
          >
            <DecisionOutcomeSummary
              decisionPackage={decisionPackage}
              decision={
                relatedDecision
                  ? {
                      outcome: relatedDecision.outcome,
                      decidedAt: relatedDecision.decidedAt,
                      rationale: relatedDecision.rationale,
                      conditions: relatedDecision.conditions,
                    }
                  : null
              }
              historyHref={`/initiatives/${item.id}/decisions`}
            />
          </DisclosureSection>
        </div>

        <div className="space-y-4">
          <SubmissionSummaryPanel
            submission={
              latestSubmission
                ? {
                    revision: latestSubmission.revision,
                    status: latestSubmission.status,
                    submittedAt: latestSubmission.submittedAt,
                    gateType: activeGate?.gateType,
                    notes: latestSubmission.notes,
                  }
                : null
            }
          />
          <LifecycleClarityPanel
            hasPoC={Boolean(item.poc)}
            hasPilot={Boolean(item.pilot)}
            hasProject={Boolean(item.project)}
            latestOutcome={relatedDecision?.outcome}
            projectHref={
              item.project ? `/initiatives/${item.id}/project` : null
            }
          />
          <Panel>
            <h2 className="mb-2 font-[family-name:var(--font-display)] text-base text-[var(--ink)]">
              Related workspaces
            </h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href={`/initiatives/${item.id}/poc`}
                  className="text-[#087f78] underline"
                >
                  PoC workspace
                </Link>
              </li>
              <li>
                <Link
                  href={`/initiatives/${item.id}/pilot`}
                  className="text-[#087f78] underline"
                >
                  Pilot workspace
                </Link>
              </li>
              <li>
                <Link
                  href={`/initiatives/${item.id}/decisions`}
                  className="text-[#087f78] underline"
                >
                  Decision workspace
                </Link>
              </li>
              <li>
                <Link href="/approvals" className="text-[#087f78] underline">
                  My Approvals
                </Link>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
