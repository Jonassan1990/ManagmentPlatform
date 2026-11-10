import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatVacationAmount,
  formatVacationSpan,
} from "@/modules/vacation/application/vacation-duration";
import { mapVacationStatusBadge } from "@/modules/vacation/application/vacation-status";

export type ManagerVacationDecision = {
  id: string;
  status: string;
  startDate: string | Date;
  endDate: string | Date;
  durationKind: "FULL_DAYS" | "HALF_DAY" | "HOURS";
  dayPart?: "MORNING" | "AFTERNOON" | null;
  hours?: number | null;
  workingDays: number;
  reason: string | null;
  requesterDisplayName: string;
  reviewerDisplayName: string | null;
  decidedAt: string | Date;
};

function whenLabel(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function ManagerApprovalsHistory({
  vacation,
}: {
  vacation: ManagerVacationDecision[];
}) {
  if (vacation.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No decided vacation requests in your scope yet. Each decision keeps a
        full audit trail on the request page.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
            <th className="py-2 pr-3 font-semibold">Decided</th>
            <th className="py-2 pr-3 font-semibold">Person</th>
            <th className="py-2 pr-3 font-semibold">When</th>
            <th className="py-2 pr-3 font-semibold">Status</th>
            <th className="py-2 pr-3 font-semibold">Reviewer</th>
            <th className="py-2 font-semibold">Audit</th>
          </tr>
        </thead>
        <tbody>
          {vacation.map((row) => {
            const badge = mapVacationStatusBadge(row.status);
            return (
              <tr
                key={row.id}
                className="border-b border-[var(--line)] align-top"
              >
                <td className="py-2 pr-3 whitespace-nowrap text-[var(--muted)]">
                  {whenLabel(row.decidedAt)}
                </td>
                <td className="py-2 pr-3 text-[var(--ink)]">
                  {row.requesterDisplayName}
                  {row.reason ? (
                    <span className="block text-xs text-[var(--muted)]">
                      {row.reason}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 pr-3">
                  <span className="text-[var(--ink)]">
                    {formatVacationSpan(
                      row.startDate,
                      row.endDate,
                      row.durationKind,
                    )}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    {formatVacationAmount(row)}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <StatusBadge status={badge.status} label={badge.label} />
                </td>
                <td className="py-2 pr-3 text-[var(--muted)]">
                  {row.reviewerDisplayName ?? "—"}
                </td>
                <td className="py-2">
                  <Link
                    href={`/vacation/${row.id}`}
                    className="text-[var(--color-accent)] underline"
                  >
                    Open trail
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
