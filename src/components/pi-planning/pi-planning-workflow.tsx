"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import type { StatusBadgeMapping } from "@/components/ui/status-adapters";
import { StatusBadge } from "@/components/ui/status-badge";
import { readinessClassificationLabel } from "@/modules/pi-planning/application/pi-planning-presentation";
import type {
  PiPlanningWorkflowView,
  PiWorkflowStage,
  PiWorkflowStageStatus,
} from "@/modules/pi-planning/application/pi-planning-workflow";

function statusBadge(status: PiWorkflowStageStatus): {
  status: "completed" | "in-progress" | "pending" | "blocked" | "draft";
  label: string;
} {
  switch (status) {
    case "completed":
      return { status: "completed", label: "Done" };
    case "current":
      return { status: "in-progress", label: "In progress" };
    case "blocked":
      return { status: "blocked", label: "Blocked" };
    case "available":
      return { status: "pending", label: "Available" };
    default:
      return { status: "draft", label: "Upcoming" };
  }
}

function stageTone(status: PiWorkflowStageStatus): string {
  switch (status) {
    case "completed":
      return "border-[var(--ok)]/40 bg-[var(--ok)]/5";
    case "current":
      return "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]";
    case "blocked":
      return "border-[var(--danger)]/40 bg-[var(--danger)]/5";
    case "available":
      return "border-[var(--line)] bg-[var(--surface)]";
    default:
      return "border-[var(--line)] bg-[var(--surface)] opacity-70";
  }
}

export function PiPlanningWorkflowBar({
  workflow,
}: {
  workflow: PiPlanningWorkflowView;
}) {
  return (
    <nav
      aria-label="PI planning workflow"
      className="mb-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:px-4"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Guided workflow
        </p>
        <p className="text-xs text-[var(--muted)]">{workflow.lifecycleNote}</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {workflow.stages.map((stage, index) => (
          <WorkflowStageItem
            key={stage.id}
            stage={stage}
            index={index}
            isCurrent={stage.id === workflow.currentStageId}
          />
        ))}
      </ol>
    </nav>
  );
}

function WorkflowStageItem({
  stage,
  index,
  isCurrent,
}: {
  stage: PiWorkflowStage;
  index: number;
  isCurrent: boolean;
}) {
  const badge = statusBadge(stage.status);
  const content = (
    <>
      <span className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {index + 1}. {stage.shortLabel}
        </span>
        <StatusBadge
          status={badge.status}
          label={badge.label}
          size="compact"
        />
      </span>
      <span className="mt-1 block text-xs leading-snug text-[var(--ink)]">
        {stage.detail}
      </span>
    </>
  );

  const className = `block min-h-[4.5rem] rounded-[var(--radius-md)] border px-2 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${stageTone(stage.status)}`;

  return (
    <li aria-current={isCurrent ? "step" : undefined}>
      {stage.href ? (
        <Link href={stage.href} className={className} title={stage.label}>
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

export function PiWorkflowPrimaryActionCard({
  workflow,
}: {
  workflow: PiPlanningWorkflowView;
}) {
  const action = workflow.primaryAction;
  return (
    <section
      aria-label="Next planning action"
      className="mb-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:px-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Next action
      </p>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--ink)]">
            {action.label}
          </p>
          {action.reasons.length > 0 ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {action.reasons.join(" ")}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Complete this step in the section below. Consequential changes
              always ask for confirmation.
            </p>
          )}
        </div>
        {action.href ? (
          <Link
            href={action.href}
            className={`inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${
              action.blocked
                ? "border border-[var(--line)] text-[var(--muted)]"
                : "bg-[var(--accent)] text-white hover:brightness-110"
            }`}
          >
            {action.blocked ? "See blockers" : "Go to step"}
          </Link>
        ) : null}
      </div>
      {action.blocked && action.reasons.length > 0 ? (
        <div className="mt-3">
          <Alert tone="warning" title="Action blocked" live="assertive">
            {action.reasons.join(" ")}
          </Alert>
        </div>
      ) : null}
    </section>
  );
}

export type ReviewSummaryProps = {
  selectedLabel: string | null;
  readinessClassification: string | null;
  conflictCount: number;
  blockerConflictCount: number;
  committedHours: number | null;
  currentRevisionVersion: number | null;
  approvalStateMessage: string;
  approvalBadge: StatusBadgeMapping;
  baselineLabel: string | null;
};

export function ReviewSummaryStrip({
  selectedLabel,
  readinessClassification,
  conflictCount,
  blockerConflictCount,
  committedHours,
  currentRevisionVersion,
  approvalStateMessage,
  approvalBadge,
  baselineLabel,
}: ReviewSummaryProps) {
  return (
    <section
      aria-label="Review summary"
      className="mb-4 grid gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:grid-cols-2 lg:grid-cols-3 sm:px-4"
    >
      <SummaryItem label="Selected scenario" value={selectedLabel ?? "None"} />
      <SummaryItem
        label="Readiness"
        value={readinessClassificationLabel(readinessClassification)}
      />
      <SummaryItem
        label="Project / team impact"
        value={
          committedHours != null
            ? `${committedHours}h committed · ${blockerConflictCount} blocker / ${conflictCount} total`
            : `${blockerConflictCount} blocker / ${conflictCount} total`
        }
      />
      <SummaryItem
        label="Current plan version"
        value={
          currentRevisionVersion != null
            ? `v${currentRevisionVersion}`
            : "—"
        }
      />
      <div className="space-y-1 text-sm">
        <p className="text-xs font-medium text-[var(--muted)]">
          Approval version
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={approvalBadge.status}
            label={approvalBadge.label}
            size="compact"
          />
          <span className="text-[var(--ink)]">{approvalStateMessage}</span>
        </div>
      </div>
      <SummaryItem
        label="Approved baseline"
        value={baselineLabel ?? "Not baselined — immutable once created"}
      />
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1 text-sm">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="truncate font-medium text-[var(--ink)]" title={value}>
        {value}
      </p>
    </div>
  );
}
