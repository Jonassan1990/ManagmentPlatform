import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { humanize } from "@/components/governance/governance-panels";
import { TransitionPiButtons } from "@/components/pi-planning/pi-forms";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import {
  PiPlanningWorkflowBar,
  PiWorkflowPrimaryActionCard,
  ReviewSummaryStrip,
} from "@/components/pi-planning/pi-planning-workflow";
import { PlanApprovalPanel } from "@/components/pi-planning/plan-approval-panel";
import {
  ReviewJourneyNav,
  ReviewStageSection,
} from "@/components/pi-planning/review-stage-section";
import { ScenarioPromotionPanel } from "@/components/pi-planning/scenario-promotion-panel";
import { ScenarioSelectionPanel } from "@/components/pi-planning/scenario-selection-panel";
import { mapApprovalStateBadge } from "@/components/ui/status-adapters";
import {
  Breadcrumbs,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { buildPiTrail } from "@/modules/navigation/breadcrumbs";
import {
  appendPreservedQuery,
  parseReturnContext,
  PI_CONTEXT_QUERY_KEYS,
} from "@/modules/navigation/return-context";
import { derivePiPlanningWorkflow } from "@/modules/pi-planning/application/pi-planning-workflow";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ piId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { piId } = await params;
  const query = await searchParams;
  const returnContext = parseReturnContext(query);
  const { authz, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let overview;
  let selection;
  let scenarios;
  let history;
  let readiness = null;
  let promotionPreview;
  let approvalPreview;
  try {
    overview = await planning.getPiOverview(principal, piId);
    selection = await planning.getScenarioSelection(principal, piId);
    scenarios = await planning.listScenarios(principal, piId, {
      includeArchived: true,
    });
    history = await planning.listScenarioSelectionHistory(principal, piId);
    promotionPreview = await planning.getScenarioPromotionPreview(
      principal,
      piId,
    );
    approvalPreview = await planning.getPlanApprovalPreview(principal, piId);
    const readinessTarget =
      selection.selectedRevision?.id ??
      scenarios.find((s) => !s.isCurrent && s.status !== "ARCHIVED")?.id;
    if (readinessTarget) {
      readiness = await planning.evaluateScenarioReadiness(principal, {
        piId,
        revisionId: readinessTarget,
      });
    }
  } catch {
    notFound();
  }

  const { pi, metrics, attention, conflicts } = overview;
  const capabilities = await resolveCapabilities(
    authz,
    principal,
    pi.organizationId,
  );

  const checklist = [
    {
      ok: metrics.iterationCount > 0,
      label: "Iterations defined",
      detail: `${metrics.iterationCount} iteration(s)`,
    },
    {
      ok: metrics.departmentCount > 0,
      label: "Participating departments",
      detail: `${metrics.departmentCount} department(s), ${metrics.teamCount} team(s)`,
    },
    {
      ok: metrics.blockerConflictCount === 0,
      label: "No blocker conflicts",
      detail:
        metrics.blockerConflictCount === 0
          ? "No blocker conflicts derived"
          : `${metrics.blockerConflictCount} blocker(s) need attention`,
    },
    {
      ok: metrics.overloadTeamSlots === 0,
      label: "No overloaded team slots",
      detail:
        metrics.overloadTeamSlots === 0
          ? "No team×iteration overload"
          : `${metrics.overloadTeamSlots} overloaded slot(s)`,
    },
    {
      ok: metrics.backlogCount === 0 || metrics.allocationCount > 0,
      label: "Allocations present when work exists",
      detail: `${metrics.backlogCount} unallocated · capacity slots with load: ${metrics.allocationCount}`,
    },
    {
      ok: attention.every((a) => a.severity !== "blocker"),
      label: "No structural blockers",
      detail:
        attention.filter((a) => a.severity === "blocker").length === 0
          ? "Structure looks complete"
          : attention
              .filter((a) => a.severity === "blocker")
              .map((a) => a.message)
              .join("; "),
    },
  ];

  const readyForBaseline =
    pi.status === "REVIEW" && checklist.every((c) => c.ok);

  const boardHref = appendPreservedQuery(
    `/pi/${piId}/board`,
    query,
    PI_CONTEXT_QUERY_KEYS,
  );
  const compareHref = appendPreservedQuery(
    `/pi/${piId}/compare`,
    query,
    PI_CONTEXT_QUERY_KEYS,
  );
  const reviewHref = appendPreservedQuery(
    `/pi/${piId}/review`,
    query,
    PI_CONTEXT_QUERY_KEYS,
  );
  const baselineHref = appendPreservedQuery(
    `/pi/${piId}/baseline`,
    query,
    PI_CONTEXT_QUERY_KEYS,
  );

  const selected = selection.selectedRevision;
  const workflow = derivePiPlanningWorkflow({
    piId,
    hasSelection: Boolean(selected),
    approvalState: approvalPreview.stateLabel,
    canPromote: promotionPreview.canPromote,
    promoteDisabledReasons: promotionPreview.disabledReasons,
    canApprove: approvalPreview.canApprove,
    approveDisabledReasons: approvalPreview.approveDisabledReasons,
    canBaseline: approvalPreview.canBaseline,
    baselineDisabledReasons: approvalPreview.baselineDisabledReasons,
    canReviewPi: capabilities.canReviewPi === true,
    canBaselinePi: capabilities.canBaselinePi === true,
    readinessClassification:
      readiness?.classification ??
      promotionPreview.readiness?.classification ??
      approvalPreview.readiness?.classification ??
      null,
    selectedLabel: selected?.label ?? selected?.key ?? null,
    currentRevisionVersion: approvalPreview.currentRevision?.version ?? null,
    hasBaseline: approvalPreview.stateLabel === "BASELINED",
  });

  const stageStatus = (id: (typeof workflow.stages)[number]["id"]) =>
    workflow.stages.find((s) => s.id === id)?.status ?? "upcoming";

  const approvalBadge = mapApprovalStateBadge({
    hasValidApproval: Boolean(approvalPreview.activeApproval),
    hasBaseline: approvalPreview.stateLabel === "BASELINED",
    invalidated: approvalPreview.latestApproval?.status === "INVALIDATED",
  });

  return (
    <div>
      <Breadcrumbs
        items={buildPiTrail({
          piId,
          referenceKey: pi.referenceKey,
          name: pi.name,
          leaf: "Review",
          returnContext,
        })}
      />
      <PageHeader
        title="Management review"
        description={`${pi.name} · ${piStatusLabel(pi.status)} — guided Select → Promote → Approve → Baseline. Selected is not approved.`}
      />
      <PiTabs piId={piId} active="review" preserveQuery={query} />

      <ReviewJourneyNav
        boardHref={boardHref}
        compareHref={compareHref}
        reviewHref={reviewHref}
        baselineHref={baselineHref}
      />

      <PiPlanningWorkflowBar workflow={workflow} />

      <ReviewSummaryStrip
        selectedLabel={selected?.label ?? selected?.key ?? null}
        readinessClassification={
          readiness?.classification ??
          promotionPreview.readiness?.classification ??
          null
        }
        conflictCount={conflicts.length}
        blockerConflictCount={metrics.blockerConflictCount}
        committedHours={approvalPreview.committedHours}
        currentRevisionVersion={
          approvalPreview.currentRevision?.version ?? null
        }
        approvalStateMessage={approvalPreview.stateMessage}
        approvalBadge={approvalBadge}
        baselineLabel={
          approvalPreview.stateLabel === "BASELINED"
            ? "Baselined (immutable)"
            : null
        }
      />

      <PiWorkflowPrimaryActionCard workflow={workflow} />

      <ReviewStageSection
        title="3. Select preferred scenario"
        description="Choose one draft for review. Does not change CURRENT allocations."
        status={stageStatus("select")}
        defaultOpen={
          workflow.currentStageId === "select" ||
          stageStatus("select") === "blocked"
        }
        emphasize={workflow.currentStageId === "select"}
      >
        <ScenarioSelectionPanel
          piId={piId}
          piVersion={selection.piVersion}
          selection={selection}
          readiness={readiness}
          history={history}
          scenarios={scenarios.map((s) => ({
            id: s.id,
            key: s.key,
            label: s.label,
            status: s.status,
            isCurrent: s.isCurrent,
            version: s.version,
            archivedAt: s.archivedAt,
          }))}
          capabilities={capabilities}
          embedded
          compareHref={compareHref}
        />
      </ReviewStageSection>

      <ReviewStageSection
        title="4. Promote to CURRENT"
        description="Atomic copy into the authoritative plan — not approval, not a baseline."
        status={stageStatus("promote")}
        defaultOpen={
          workflow.currentStageId === "promote" ||
          stageStatus("promote") === "blocked"
        }
        emphasize={workflow.currentStageId === "promote"}
      >
        <ScenarioPromotionPanel
          preview={promotionPreview}
          capabilities={capabilities}
          embedded
        />
      </ReviewStageSection>

      <ReviewStageSection
        title="5. Approve CURRENT version"
        description="Binds approval to an exact CURRENT version and fingerprint."
        status={stageStatus("approve")}
        defaultOpen={
          workflow.currentStageId === "approve" ||
          stageStatus("approve") === "blocked"
        }
        emphasize={workflow.currentStageId === "approve"}
      >
        <PlanApprovalPanel
          preview={approvalPreview}
          capabilities={capabilities}
          embedded
          focus="approve"
        />
      </ReviewStageSection>

      <ReviewStageSection
        title="6. Baseline immutable commitment"
        description="Append-only snapshot. Requires PI_BASELINE when creating."
        status={stageStatus("baseline")}
        defaultOpen={
          workflow.currentStageId === "baseline" ||
          stageStatus("baseline") === "blocked"
        }
        emphasize={workflow.currentStageId === "baseline"}
      >
        <PlanApprovalPanel
          preview={approvalPreview}
          capabilities={capabilities}
          embedded
          focus="baseline"
        />
      </ReviewStageSection>

      <ReviewStageSection
        title="Supporting details"
        description="Checklist, conflicts, PI status transitions, and related links."
        status="available"
        defaultOpen={false}
      >
        <div className="grid gap-4 p-3 lg:grid-cols-3 sm:p-4">
          <div className="space-y-4 lg:col-span-2">
            <Panel>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">Review checklist</h2>
                <span
                  className={`text-sm ${
                    readyForBaseline
                      ? "text-[var(--ok)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {readyForBaseline
                    ? "Ready to baseline"
                    : pi.status !== "REVIEW"
                      ? `Status is ${piStatusLabel(pi.status)}`
                      : "Resolve open items before baselining"}
                </span>
              </div>
              <ul className="mt-4 space-y-3">
                {checklist.map((item) => (
                  <li
                    key={item.label}
                    className="flex gap-3 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                  >
                    <span
                      className={
                        item.ok ? "text-[var(--ok)]" : "text-[var(--danger)]"
                      }
                      aria-hidden
                    >
                      {item.ok ? "✓" : "✗"}
                    </span>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {pi.status === "REVIEW" && capabilities.canBaselinePi ? (
                <Link
                  href={baselineHref}
                  className="mt-4 inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  Go to baseline
                </Link>
              ) : null}
            </Panel>

            <Panel>
              <h2 className="font-medium">Derived conflicts</h2>
              {conflicts.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  No conflicts derived from the current plan.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {conflicts.map((c, i) => (
                    <li
                      key={`${c.type}-${c.subjectId}-${i}`}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        c.severity === "BLOCKER"
                          ? "border-[var(--danger)]/40"
                          : c.severity === "WARNING"
                            ? "border-[var(--warning)]/40"
                            : "border-[var(--line)]"
                      }`}
                    >
                      <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        {humanize(c.severity)} · {c.type.replaceAll("_", " ")}
                      </span>
                      <p>{c.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel>
              <h2 className="mb-3 font-medium">Status</h2>
              <TransitionPiButtons
                piId={pi.id}
                status={pi.status}
                expectedVersion={pi.version}
                capabilities={capabilities}
              />
            </Panel>
            <Panel>
              <h2 className="font-medium">Links</h2>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  <Link
                    href={boardHref}
                    className="inline-flex min-h-11 items-center text-[var(--accent)]"
                  >
                    Planning board
                  </Link>
                </li>
                <li>
                  <Link
                    href={compareHref}
                    className="inline-flex min-h-11 items-center text-[var(--accent)]"
                  >
                    Compare scenarios
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/pi/${piId}/capacity`}
                    className="inline-flex min-h-11 items-center text-[var(--accent)]"
                  >
                    Capacity
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/pi/${piId}/dependencies`}
                    className="inline-flex min-h-11 items-center text-[var(--accent)]"
                  >
                    Dependencies
                  </Link>
                </li>
                <li>
                  <Link
                    href={baselineHref}
                    className="inline-flex min-h-11 items-center text-[var(--accent)]"
                  >
                    Baseline history
                  </Link>
                </li>
              </ul>
            </Panel>
          </div>
        </div>
      </ReviewStageSection>
    </div>
  );
}
