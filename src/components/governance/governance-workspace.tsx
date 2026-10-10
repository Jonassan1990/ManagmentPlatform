/**
 * M5C-B — Premium Governance / PoC / Pilot workspace chrome (presentation only).
 */
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { Panel } from "@/components/ui/page";
import {
  buildGovernanceDecisionContext,
  describeGovernanceNextAction,
  describeLifecycleClarity,
  evidenceSummary,
  humanizeGovernanceToken,
  mapApprovalRequestBadge,
  mapDecisionOutcomeBadge,
  mapGateStatusBadge,
  mapSubmissionStatusBadge,
  recommendationVsDecisionCopy,
  splitApprovalRequests,
  type GovernanceDecisionContext,
  type GovernanceNextActionView,
} from "@/modules/governance/application/governance-presentation";
import { NextActionPanel } from "@/components/initiative/workspace";

export function DisclosureSection({
  id,
  title,
  summary,
  defaultOpen = false,
  badge,
  children,
}: {
  id: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      className="group rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] open:shadow-sm"
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-[family-name:var(--font-display)] text-base text-[var(--ink)]">
            {title}
          </span>
          {summary ? (
            <span className="text-xs text-[var(--muted)]">{summary}</span>
          ) : null}
        </span>
        <span className="flex items-center gap-2">
          {badge}
          <span
            aria-hidden
            className="text-xs font-medium uppercase tracking-wide text-[var(--color-accent)] group-open:hidden"
          >
            Show
          </span>
          <span
            aria-hidden
            className="hidden text-xs font-medium uppercase tracking-wide text-[var(--color-accent)] group-open:inline"
          >
            Hide
          </span>
        </span>
      </summary>
      <div className="border-t border-[var(--line)] px-4 py-4">{children}</div>
    </details>
  );
}

export function DecisionContextPanel({
  context,
}: {
  context: GovernanceDecisionContext;
}) {
  const gateBadge = mapGateStatusBadge(
    context.submissionStatus ?? context.gateType,
  );
  const submissionBadge = mapSubmissionStatusBadge(context.submissionStatus);

  return (
    <section
      aria-labelledby="governance-decision-context"
      className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-4 py-4 sm:px-5"
    >
      <p className="ds-eyebrow text-[10px]">
        Decision context
      </p>
      <h2
        id="governance-decision-context"
        className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
      >
        {context.initiativeTitle}
      </h2>
      <p className="mt-0.5 text-sm text-[var(--muted)]">
        {context.initiativeReference}
        {context.revision != null ? ` · Revision ${context.revision}` : ""}
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Gate
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-[var(--ink)]">
            {context.gateTypeLabel}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Submission
          </dt>
          <dd className="mt-1">
            <StatusBadge
              status={submissionBadge.status}
              label={submissionBadge.label}
              size="compact"
            />
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Lifecycle
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {context.lifecycleStageLabel}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Decision owner
          </dt>
          <dd className="mt-0.5 text-sm text-[var(--ink)]">
            {context.decisionOwnerLabel ?? "Not assigned in this view"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Blocking
          </dt>
          <dd className="mt-1">
            <StatusBadge
              status={
                context.blockingKind === "none"
                  ? "completed"
                  : context.blockingKind === "awaiting_approvals" ||
                      context.blockingKind === "decision_required"
                    ? "pending"
                    : "at-risk"
              }
              label={context.blockingLabel}
              size="compact"
            />
          </dd>
        </div>
      </dl>
      <p className="sr-only">
        Gate presentation status: {gateBadge.label}. Submission:{" "}
        {submissionBadge.label}.
      </p>
    </section>
  );
}

export function EvidenceTable({
  entries,
}: {
  entries: {
    id: string;
    label: string;
    present: boolean;
    requirementLevel: string;
    kind: string;
  }[];
}) {
  const summary = evidenceSummary(entries);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No evidence package yet. Submit for governance to freeze a review
        snapshot.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]" role="status">
        {summary.label}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Evidence package completeness for the current submission
          </caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Evidence
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Kind
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Requirement
              </th>
              <th scope="col" className="py-2 font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-[var(--line)] last:border-0"
              >
                <th
                  scope="row"
                  className="py-2.5 pr-3 font-medium text-[var(--ink)]"
                >
                  {entry.label}
                </th>
                <td className="py-2.5 pr-3 text-[var(--muted)]">
                  {humanizeGovernanceToken(entry.kind)}
                </td>
                <td className="py-2.5 pr-3 text-[var(--muted)]">
                  {humanizeGovernanceToken(entry.requirementLevel)}
                </td>
                <td className="py-2.5">
                  <StatusBadge
                    status={entry.present ? "completed" : "at-risk"}
                    label={entry.present ? "Present" : "Missing"}
                    size="compact"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReviewSummary({
  requests,
}: {
  requests: {
    id: string;
    label: string;
    status: string;
    authorityKey: string;
    record?: {
      outcome: string;
      comment: string | null;
      createdAt?: Date | string;
    } | null;
  }[];
}) {
  const { pending, completed } = splitApprovalRequests(requests);

  if (requests.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No approval requests yet. They appear when a submission enters review.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <StatusBadge
          status="pending"
          label={`${pending.length} pending`}
          size="compact"
        />
        <StatusBadge
          status="approved"
          label={`${completed.length} completed`}
          size="compact"
        />
        <StatusBadge
          status={
            pending.length === 0 && completed.length > 0
              ? "approved"
              : "pending"
          }
          label={
            pending.length === 0 && completed.length > 0
              ? "Decision ready when package requires it"
              : "Decision not ready — approvals outstanding"
          }
          size="compact"
        />
      </div>

      {pending.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Pending approvals
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {pending.map((request) => {
              const badge = mapApprovalRequestBadge(request.status);
              return (
                <li
                  key={request.id}
                  className="flex flex-wrap items-start justify-between gap-2 border-t border-[var(--line)] pt-2 first:border-0 first:pt-0"
                >
                  <div>
                    <p className="font-medium text-[var(--ink)]">
                      {request.label}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Authority: {humanizeGovernanceToken(request.authorityKey)}
                    </p>
                  </div>
                  <StatusBadge
                    status={badge.status}
                    label={badge.label}
                    size="compact"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {completed.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Completed approvals
          </h3>
          <ul className="mt-2 space-y-2 text-sm">
            {completed.map((request) => {
              const badge = mapApprovalRequestBadge(
                request.status,
                request.record?.outcome,
              );
              return (
                <li
                  key={request.id}
                  className="border-t border-[var(--line)] pt-2 first:border-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--ink)]">
                        {request.label}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        Authority:{" "}
                        {humanizeGovernanceToken(request.authorityKey)}
                      </p>
                    </div>
                    <StatusBadge
                      status={badge.status}
                      label={badge.label}
                      size="compact"
                    />
                  </div>
                  {request.record?.comment ? (
                    <p className="mt-1 text-[var(--muted)]">
                      {request.record.comment}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function DecisionOutcomeSummary({
  decisionPackage,
  decision,
  historyHref,
}: {
  decisionPackage: {
    question: string;
    whyNeeded: string | null;
    recommendationText: string | null;
  } | null;
  decision?: {
    outcome: string;
    decidedAt: Date | string;
    rationale: string;
    conditions?: {
      id: string;
      description: string;
      status: string;
      requiredBeforeProgression: boolean;
    }[];
  } | null;
  historyHref?: string;
}) {
  if (!decisionPackage && !decision) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No decision package or recorded outcome yet.
      </p>
    );
  }

  const outcomeBadge = mapDecisionOutcomeBadge(decision?.outcome);

  return (
    <div className="space-y-4 text-sm">
      {decisionPackage ? (
        <dl className="space-y-3">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Question
            </dt>
            <dd className="mt-0.5 font-medium text-[var(--ink)]">
              {decisionPackage.question}
            </dd>
          </div>
          {decisionPackage.recommendationText ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Recommendation (informational)
              </dt>
              <dd className="mt-0.5 text-[var(--ink)]">
                {decisionPackage.recommendationText}
              </dd>
              <dd className="mt-0.5 text-xs text-[var(--muted)]">
                Not the formal decision.
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {decision ? (
        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusBadge
              status={outcomeBadge.status}
              label={`Outcome · ${outcomeBadge.label}`}
            />
            <time className="text-xs text-[var(--muted)]">
              {typeof decision.decidedAt === "string"
                ? decision.decidedAt.slice(0, 10)
                : decision.decidedAt.toISOString().slice(0, 10)}
            </time>
          </div>
          <p className="mt-2 text-[var(--ink)]">{decision.rationale}</p>
          {(decision.conditions?.length ?? 0) > 0 ? (
            <ul className="mt-3 space-y-1">
              {decision.conditions!.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap justify-between gap-2 text-xs"
                >
                  <span>
                    {c.description}
                    {c.requiredBeforeProgression ? " · blocks progression" : ""}
                  </span>
                  <StatusBadge
                    status={
                      c.status === "OPEN"
                        ? "at-risk"
                        : c.status === "RESOLVED"
                          ? "completed"
                          : "pending"
                    }
                    label={humanizeGovernanceToken(c.status)}
                    size="compact"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Allowed outcomes appear when an authorized decision maker records the
          gate result. History is immutable once recorded.
        </p>
      )}

      {historyHref ? (
        <Link
          href={historyHref}
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Open decision workspace / immutable history
        </Link>
      ) : null}
    </div>
  );
}

export function GovernanceNextActionSlot({
  action,
  children,
}: {
  action: GovernanceNextActionView;
  children?: React.ReactNode;
}) {
  return (
    <NextActionPanel
      label={action.label}
      detail={action.detail}
      blocked={action.blocked}
      href={action.href}
      ctaLabel={action.ctaLabel}
    >
      {children}
    </NextActionPanel>
  );
}

export function RecommendationVsDecisionCallout({
  surface,
}: {
  surface: "poc" | "pilot";
}) {
  const copy = recommendationVsDecisionCopy(surface);
  return (
    <Panel className="mb-4" aria-labelledby={`${surface}-distinction`}>
      <h2
        id={`${surface}-distinction`}
        className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]"
      >
        Keep these distinct
      </h2>
      <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <li className="rounded-md border border-[var(--line)] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Operational evaluation
          </p>
          <p className="mt-1 text-[var(--muted)]">{copy.evaluation}</p>
        </li>
        <li className="rounded-md border border-[var(--line)] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Recommendation
          </p>
          <p className="mt-1 text-[var(--muted)]">{copy.recommendation}</p>
        </li>
        <li className="rounded-md border border-[var(--line)] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Formal decision
          </p>
          <p className="mt-1 text-[var(--muted)]">{copy.decision}</p>
        </li>
      </ul>
    </Panel>
  );
}

export function LifecycleClarityPanel({
  hasPoC,
  hasPilot,
  hasProject,
  latestOutcome,
  canCreatePoC,
  canCreatePilot,
  canConvertProject,
  projectHref,
}: {
  hasPoC: boolean;
  hasPilot: boolean;
  hasProject: boolean;
  latestOutcome?: string | null;
  canCreatePoC?: boolean;
  canCreatePilot?: boolean;
  canConvertProject?: boolean;
  projectHref?: string | null;
}) {
  const clarity = describeLifecycleClarity({
    hasPoC,
    hasPilot,
    hasProject,
    latestOutcome,
    canCreatePoC,
    canCreatePilot,
    canConvertProject,
  });

  return (
    <Panel aria-labelledby="lifecycle-clarity">
      <h2
        id="lifecycle-clarity"
        className="font-[family-name:var(--font-display)] text-base text-[var(--ink)]"
      >
        Lifecycle clarity
      </h2>
      <p className="mt-1 text-sm font-medium text-[var(--ink)]">{clarity.chain}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">{clarity.autoCreate}</p>
      {clarity.nextAuthorized ? (
        <p className="mt-2 text-sm text-[var(--ink)]" role="status">
          {clarity.nextAuthorized}
        </p>
      ) : null}
      {hasProject && projectHref ? (
        <Link
          href={projectHref}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)] underline"
        >
          Open Project workspace
        </Link>
      ) : null}
    </Panel>
  );
}

export function ApprovalTaskCardHeader({
  referenceKey,
  title,
  gateType,
  reviewLabel,
  revision,
  status,
  initiativeId,
}: {
  referenceKey: string;
  title: string;
  gateType: string;
  reviewLabel: string;
  revision: number;
  status: string;
  initiativeId: string;
}) {
  const badge = mapApprovalRequestBadge(status);
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="ds-eyebrow text-[10px]">
          Approval task · {referenceKey}
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {humanizeGovernanceToken(gateType)} · Review:{" "}
          <span className="font-medium text-[var(--ink)]">{reviewLabel}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge
            status={badge.status}
            label={badge.label}
            size="compact"
          />
          <span className="text-xs text-[var(--muted)]">
            Revision {revision}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Link
          href={`/initiatives/${initiativeId}/governance`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Open gate workspace
        </Link>
        <Link
          href={`/initiatives/${initiativeId}`}
          className="inline-flex min-h-11 items-center text-sm text-[var(--muted)] underline"
        >
          Open initiative
        </Link>
      </div>
    </div>
  );
}

export function ExperimentSummaryGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode; hint?: string }[];
}) {
  return (
    <dl className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
        >
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-[var(--ink)]">
            {item.value}
          </dd>
          {item.hint ? (
            <dd className="mt-0.5 text-[11px] text-[var(--muted)]">
              {item.hint}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export {
  buildGovernanceDecisionContext,
  describeGovernanceNextAction,
  mapDecisionOutcomeBadge,
  mapSubmissionStatusBadge,
};
