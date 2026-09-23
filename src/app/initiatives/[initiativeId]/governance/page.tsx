import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ReviseSubmissionButton,
  SubmitPreStudyButton,
} from "@/components/governance/governance-forms";
import {
  ApprovalStatusList,
  ChangesRequestedBanner,
  DecisionPackagePanel,
  EvidenceCompletenessPanel,
  GateReadinessPanel,
  SubmissionSummaryPanel,
  humanize,
  statusToneClass,
} from "@/components/governance/governance-panels";
import {
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { evaluatePreStudyReadiness } from "@/modules/initiative/application/readiness-policy";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function GovernancePage({
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
  const preStudyGate = item.governanceGates.find(
    (g) => g.gateType === "PRE_STUDY_GATE",
  );
  const pocGate = item.governanceGates.find((g) => g.gateType === "POC_GATE");
  const activeGate =
    item.currentStage === "POC" && pocGate ? pocGate : preStudyGate ?? pocGate;
  const latestSubmission = activeGate?.submissions[0] ?? null;
  const evidenceEntries = latestSubmission?.evidencePackage?.entries ?? [];
  const approvalRequests = latestSubmission?.approvalRequests ?? [];
  const decisionPackage = latestSubmission?.decisionPackage ?? null;

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
      .find((s) => s.status === "CHANGES_REQUESTED") ?? null;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey, href: `/initiatives/${item.id}` },
          { label: "Governance" },
        ]}
      />
      <PageHeader
        title={item.title}
        description={`${item.referenceKey} · Governance gate workspace`}
      />
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs
        initiativeId={item.id}
        active="governance"
        currentStage={item.currentStage}
        hasGovernance={item.governanceGates.length > 0}
        hasPoC={Boolean(item.poc)}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Panel>
          <p className="text-sm text-[var(--muted)]">What needs approval?</p>
          <p className="mt-1 text-sm font-medium">
            {activeGate
              ? humanize(activeGate.gateType)
              : item.currentStage === "PRE_STUDY"
                ? "Pre-study gate (not submitted)"
                : "No active gate"}
          </p>
        </Panel>
        <Panel>
          <p className="text-sm text-[var(--muted)]">Blocking?</p>
          <p
            className={`mt-1 text-sm font-medium ${
              changesRequested ||
              latestSubmission?.status === "IN_REVIEW" ||
              latestSubmission?.status === "APPROVALS_COMPLETE"
                ? "text-[var(--warning)]"
                : "text-[var(--muted)]"
            }`}
          >
            {changesRequested
              ? "Changes requested — revise before progressing"
              : latestSubmission?.status === "APPROVALS_COMPLETE"
                ? "Approvals complete — decision required"
                : latestSubmission?.status === "IN_REVIEW"
                  ? "Awaiting required approvals"
                  : "Nothing blocking governance right now"}
          </p>
        </Panel>
        <Panel>
          <p className="text-sm text-[var(--muted)]">Gate status</p>
          <p
            className={`mt-1 text-sm font-medium ${statusToneClass(
              activeGate?.status ?? "NONE",
            )}`}
          >
            {activeGate ? humanize(activeGate.status) : "Not started"}
          </p>
        </Panel>
      </div>

      {changesRequested ? (
        <div className="mb-4">
          <ChangesRequestedBanner
            revision={changesRequested.revision}
            onRevise={
              <ReviseSubmissionButton
                previousSubmissionId={changesRequested.id}
                initiativeId={item.id}
              />
            }
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {item.currentStage === "PRE_STUDY" ||
          activeGate?.gateType === "PRE_STUDY_GATE" ? (
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
          ) : null}

          {gateWorkspace.pocReadiness ? (
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
          ) : null}

          <EvidenceCompletenessPanel entries={evidenceEntries} />
          <ApprovalStatusList requests={approvalRequests} />
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
          <DecisionPackagePanel
            decisionPackage={decisionPackage}
            submissionHref={
              latestSubmission
                ? `/initiatives/${item.id}/decisions`
                : undefined
            }
          />
          <Panel>
            <h2 className="mb-2 font-medium">Next action</h2>
            {canSubmitFresh ? (
              <SubmitPreStudyButton
                initiativeId={item.id}
                expectedInitiativeVersion={item.version}
                disabled={!preStudyReadiness.ready}
              />
            ) : item.currentStage === "PRE_STUDY" && !preStudyReadiness.ready ? (
              <p className="text-sm text-[var(--muted)]">
                Complete pre-study readiness blockers before submitting for
                governance.{" "}
                <Link
                  href={`/initiatives/${item.id}/pre-study`}
                  className="text-[var(--accent)] underline"
                >
                  Open pre-study
                </Link>
              </p>
            ) : item.currentStage === "POC" ? (
              <p className="text-sm text-[var(--muted)]">
                Manage PoC evidence and submission from the{" "}
                <Link
                  href={`/initiatives/${item.id}/poc`}
                  className="text-[var(--accent)] underline"
                >
                  PoC workspace
                </Link>
                .
              </p>
            ) : latestSubmission?.status === "APPROVALS_COMPLETE" ? (
              <p className="text-sm text-[var(--muted)]">
                Approvals are complete.{" "}
                <Link
                  href={`/initiatives/${item.id}/decisions`}
                  className="text-[var(--accent)] underline"
                >
                  Record the decision
                </Link>
                .
              </p>
            ) : latestSubmission?.status === "IN_REVIEW" ? (
              <p className="text-sm text-[var(--muted)]">
                Waiting for required authorities. Reviewers see this under{" "}
                <Link href="/approvals" className="text-[var(--accent)] underline">
                  My Approvals
                </Link>
                .
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                No governance action required in the current state.
              </p>
            )}
          </Panel>
          <Panel>
            <h2 className="mb-2 font-medium">After approval</h2>
            <p className="text-sm text-[var(--muted)]">
              When all required approvals are complete, an authorized decision
              maker records Go, Conditional go, No-go, or Hold. Conditional go
              conditions must be resolved before creating a PoC.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
