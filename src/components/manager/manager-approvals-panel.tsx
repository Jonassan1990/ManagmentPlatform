import Link from "next/link";
import { ApprovalDecisionForm } from "@/components/governance/governance-forms";
import { ApprovalTaskCardHeader } from "@/components/governance/governance-workspace";
import { ReviewVacationForm } from "@/components/vacation/vacation-forms";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatVacationAmount,
  formatVacationSpan,
} from "@/modules/vacation/application/vacation-duration";
import { mapVacationStatusBadge } from "@/modules/vacation/application/vacation-status";

export type ManagerVacationApproval = {
  id: string;
  version: number;
  status: string;
  startDate: string | Date;
  endDate: string | Date;
  durationKind: "FULL_DAYS" | "HALF_DAY" | "HOURS";
  dayPart?: "MORNING" | "AFTERNOON" | null;
  hours?: number | null;
  workingDays: number;
  reason: string | null;
  requesterDisplayName: string;
  approvers: Array<{ displayName: string | null }>;
};

export type ManagerGovernanceApproval = {
  id: string;
  version: number;
  label: string;
  status: string;
  submission: {
    revision: number;
    initiativeId: string;
    initiative: {
      referenceKey: string;
      title: string;
      organizationId: string;
    };
    gate: { gateType: string };
  };
  capabilities?: {
    canReviewApprovals?: boolean;
  };
};

export function ManagerApprovalsPanel({
  vacation,
  governance,
  emptyDescription,
}: {
  vacation: ManagerVacationApproval[];
  governance: ManagerGovernanceApproval[];
  emptyDescription: string;
}) {
  if (vacation.length === 0 && governance.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">{emptyDescription}</p>
    );
  }

  return (
    <div className="space-y-4">
      {vacation.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Vacation
          </h3>
          {vacation.map((row) => {
            const badge = mapVacationStatusBadge(row.status);
            return (
              <div
                key={row.id}
                className="rounded-[var(--radius-md)] border border-[var(--line)] p-4"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--muted)]">
                      Owner · {row.requesterDisplayName}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      Approver ·{" "}
                      {row.approvers.length > 0
                        ? row.approvers
                            .map((approver) => approver.displayName)
                            .join(", ")
                        : "not assigned"}
                    </p>
                    <Link
                      href={`/vacation/${row.id}`}
                      className="text-base font-semibold text-[var(--ink)] hover:underline"
                    >
                      {formatVacationSpan(
                        row.startDate,
                        row.endDate,
                        row.durationKind,
                      )}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {formatVacationAmount(row)}
                      {row.reason ? ` · ${row.reason}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={badge.status} label={badge.label} />
                </div>
                <ReviewVacationForm
                  requestId={row.id}
                  expectedVersion={row.version}
                />
              </div>
            );
          })}
        </section>
      ) : null}

      {governance.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Delivery gates
          </h3>
          {governance.map((request) => {
            const canReview = request.capabilities?.canReviewApprovals !== false;
            return (
              <div
                key={request.id}
                className="rounded-[var(--radius-md)] border border-[var(--line)] p-4"
              >
                <ApprovalTaskCardHeader
                  referenceKey={request.submission.initiative.referenceKey}
                  title={request.submission.initiative.title}
                  gateType={request.submission.gate.gateType}
                  reviewLabel={request.label}
                  revision={request.submission.revision}
                  status={request.status}
                  initiativeId={request.submission.initiativeId}
                />
                <div className="mb-4">
                  {canReview ? (
                    <StatusBadge
                      status="pending"
                      label="Approve / Reject / Request changes"
                      size="compact"
                    />
                  ) : (
                    <StatusBadge
                      status="blocked"
                      label="Read-only — no approval permission"
                      size="compact"
                    />
                  )}
                </div>
                <ApprovalDecisionForm
                  approvalRequestId={request.id}
                  expectedVersion={request.version}
                  initiativeId={request.submission.initiativeId}
                  label={request.label}
                  capabilities={request.capabilities}
                />
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
