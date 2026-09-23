import Link from "next/link";
import { Alert, Panel } from "@/components/ui/page";

export function statusToneClass(status: string): string {
  switch (status) {
    case "APPROVED":
    case "APPROVALS_COMPLETE":
    case "DECISION_RECORDED":
    case "GO":
    case "RESOLVED":
    case "PASS":
    case "READY":
    case "COMPLETED":
      return "text-[var(--ok)]";
    case "CHANGES_REQUESTED":
    case "REJECTED":
    case "NO_GO":
    case "FAIL":
    case "OPEN":
      return "text-[var(--danger)]";
    case "CONDITIONAL_GO":
    case "HOLD":
    case "IN_REVIEW":
    case "SUBMITTED":
    case "PENDING":
    case "INCONCLUSIVE":
    case "WAIVED":
      return "text-[var(--warning)]";
    default:
      return "text-[var(--muted)]";
  }
}

export function humanize(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function GateReadinessPanel({
  title,
  ready,
  items,
}: {
  title: string;
  ready: boolean;
  items: { key: string; label: string; ok?: boolean; status?: string; detail: string }[];
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{title}</h2>
        <span
          className={`text-sm font-medium ${
            ready ? "text-[var(--ok)]" : "text-[var(--danger)]"
          }`}
        >
          {ready ? "READY" : "NOT READY"}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Readiness means enough evidence to ask for review. It is not an approval
        or a decision.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.map((item) => {
          const ok =
            item.ok ??
            (item.status === "complete" || item.status === "ok");
          return (
            <li key={item.key} className="flex justify-between gap-3">
              <span>
                {item.label}
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  {item.detail}
                </span>
              </span>
              <span className={ok ? "text-[var(--ok)]" : "text-[var(--danger)]"}>
                {ok ? "Complete" : "Missing"}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function ChangesRequestedBanner({
  revision,
  onRevise,
}: {
  revision: number;
  onRevise?: React.ReactNode;
}) {
  return (
    <Alert tone="warning">
      <div className="space-y-2">
        <p>
          Changes requested on revision {revision}. Update the underlying work,
          then revise and resubmit for a fresh review.
        </p>
        {onRevise}
      </div>
    </Alert>
  );
}

export function EvidenceCompletenessPanel({
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
  if (entries.length === 0) {
    return (
      <Panel>
        <h2 className="font-medium">Evidence package</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          No evidence package yet. Submit for governance to freeze a review
          snapshot.
        </p>
      </Panel>
    );
  }

  const missing = entries.filter((e) => !e.present);
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Evidence completeness</h2>
        <span
          className={`text-sm ${
            missing.length === 0 ? "text-[var(--ok)]" : "text-[var(--warning)]"
          }`}
        >
          {missing.length === 0
            ? "All listed evidence present"
            : `${missing.length} gap(s)`}
        </span>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="flex justify-between gap-3">
            <span>
              {entry.label}
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {humanize(entry.kind)} · {humanize(entry.requirementLevel)}
              </span>
            </span>
            <span
              className={
                entry.present ? "text-[var(--ok)]" : "text-[var(--danger)]"
              }
            >
              {entry.present ? "Present" : "Missing"}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function ApprovalStatusList({
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
  if (requests.length === 0) {
    return (
      <Panel>
        <h2 className="font-medium">Approvals</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          No approval requests yet.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <h2 className="mb-3 font-medium">Who needs to approve?</h2>
      <ul className="space-y-3 text-sm">
        {requests.map((request) => (
          <li key={request.id} className="border-t border-[var(--line)] pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{request.label}</p>
                <p className="text-xs text-[var(--muted)]">
                  Authority: {humanize(request.authorityKey)}
                </p>
              </div>
              <span
                className={statusToneClass(
                  request.record?.outcome ?? request.status,
                )}
              >
                {request.record
                  ? humanize(request.record.outcome)
                  : humanize(request.status)}
              </span>
            </div>
            {request.record?.comment ? (
              <p className="mt-1 text-[var(--muted)]">{request.record.comment}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function DecisionPackagePanel({
  decisionPackage,
  submissionHref,
}: {
  decisionPackage: {
    question: string;
    whyNeeded: string | null;
    recommendationText: string | null;
  } | null;
  submissionHref?: string;
}) {
  if (!decisionPackage) {
    return (
      <Panel>
        <h2 className="font-medium">Decision package</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          A decision package is created when work is submitted for governance.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <h2 className="font-medium">Decision package</h2>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-[var(--muted)]">Question</dt>
          <dd className="font-medium">{decisionPackage.question}</dd>
        </div>
        {decisionPackage.whyNeeded ? (
          <div>
            <dt className="text-[var(--muted)]">Why a decision is needed</dt>
            <dd>{decisionPackage.whyNeeded}</dd>
          </div>
        ) : null}
        {decisionPackage.recommendationText ? (
          <div>
            <dt className="text-[var(--muted)]">
              Recommendation (informational)
            </dt>
            <dd>{decisionPackage.recommendationText}</dd>
          </div>
        ) : null}
      </dl>
      {submissionHref ? (
        <p className="mt-3">
          <Link
            href={submissionHref}
            className="text-sm text-[var(--accent)] underline"
          >
            Open decision workspace
          </Link>
        </p>
      ) : null}
    </Panel>
  );
}

export function DecisionLogPanel({
  decisions,
}: {
  decisions: {
    id: string;
    referenceKey: string;
    outcome: string;
    rationale: string;
    question: string;
    decidedAt: Date | string;
    conditions?: {
      id: string;
      description: string;
      status: string;
      requiredBeforeProgression: boolean;
      ownerName: string | null;
    }[];
  }[];
}) {
  if (decisions.length === 0) {
    return (
      <Panel>
        <h2 className="font-medium">Decision log</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          No decisions recorded yet for this initiative.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <h2 className="mb-3 font-medium">Decision log</h2>
      <ul className="space-y-4">
        {decisions.map((decision) => (
          <li key={decision.id} className="border-t border-[var(--line)] pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {decision.referenceKey} ·{" "}
                <span className={statusToneClass(decision.outcome)}>
                  {humanize(decision.outcome)}
                </span>
              </p>
              <p className="text-xs text-[var(--muted)]">
                {typeof decision.decidedAt === "string"
                  ? decision.decidedAt.slice(0, 10)
                  : decision.decidedAt.toISOString().slice(0, 10)}
              </p>
            </div>
            <p className="mt-1 text-sm">{decision.question}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{decision.rationale}</p>
            {(decision.conditions?.length ?? 0) > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {decision.conditions!.map((condition) => (
                  <li key={condition.id} className="flex justify-between gap-2">
                    <span>
                      {condition.description}
                      {condition.ownerName ? ` · ${condition.ownerName}` : ""}
                      {condition.requiredBeforeProgression
                        ? " · blocks progression"
                        : ""}
                    </span>
                    <span className={statusToneClass(condition.status)}>
                      {humanize(condition.status)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function PoCReadinessPanel({
  readiness,
}: {
  readiness: {
    ready: boolean;
    items: { key: string; label: string; ok: boolean; detail: string }[];
  } | null;
}) {
  if (!readiness) return null;
  return (
    <GateReadinessPanel
      title="PoC readiness for decision"
      ready={readiness.ready}
      items={readiness.items}
    />
  );
}

export function SubmissionSummaryPanel({
  submission,
}: {
  submission: {
    revision: number;
    status: string;
    submittedAt: Date | string;
    gateType?: string;
    notes?: string | null;
  } | null;
}) {
  if (!submission) {
    return (
      <Panel>
        <h2 className="font-medium">Current submission</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Nothing is in governance review yet.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <h2 className="font-medium">Current submission</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">Revision</dt>
          <dd>{submission.revision}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">Status</dt>
          <dd className={statusToneClass(submission.status)}>
            {humanize(submission.status)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">Submitted</dt>
          <dd>
            {typeof submission.submittedAt === "string"
              ? submission.submittedAt.slice(0, 10)
              : submission.submittedAt.toISOString().slice(0, 10)}
          </dd>
        </div>
        {submission.gateType ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--muted)]">Gate</dt>
            <dd>{humanize(submission.gateType)}</dd>
          </div>
        ) : null}
      </dl>
      {submission.notes ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{submission.notes}</p>
      ) : null}
    </Panel>
  );
}
