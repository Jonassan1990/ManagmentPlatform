import Link from "next/link";
import {
  formatRoleCoverage,
  type RoleCoverageGap,
} from "@/modules/vacation/application/vacation-coverage";
import { formatDateOnly, toUtcDateOnly } from "@/modules/vacation/application/working-days";

export type CalendarEntry = {
  id: string;
  requesterDisplayName: string;
  startDate: string;
  endDate: string;
  durationKind?: "FULL_DAYS" | "HALF_DAY" | "HOURS";
  dayPart?: "MORNING" | "AFTERNOON" | null;
  hours?: number | null;
};

export function VacationMonthCalendar({
  year,
  month,
  entries,
  coverage = [],
}: {
  year: number;
  month: number;
  entries: CalendarEntry[];
  coverage?: RoleCoverageGap[];
}) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = (first.getUTCDay() + 6) % 7; // Monday-first
  const cells: Array<{ day: number | null; dateKey: string | null }> = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ day: null, dateKey: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = formatDateOnly(new Date(Date.UTC(year, month - 1, day)));
    cells.push({ day, dateKey });
  }

  function entriesForDay(dateKey: string) {
    const day = toUtcDateOnly(dateKey).getTime();
    return entries.filter((entry) => {
      const start = toUtcDateOnly(entry.startDate).getTime();
      const end = toUtcDateOnly(entry.endDate).getTime();
      return day >= start && day <= end;
    });
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 gap-px rounded-md border border-[var(--line)] bg-[var(--line)]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div
            key={label}
            className="bg-[var(--surface-muted)] px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]"
          >
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          const dayEntries = cell.dateKey ? entriesForDay(cell.dateKey) : [];
          const dayCover = cell.dateKey ? coverageForDay(cell.dateKey, coverage) : [];
          return (
            <div
              key={`${cell.dateKey ?? "empty"}-${index}`}
              className="min-h-24 bg-[var(--surface)] p-2"
            >
              {cell.day ? (
                <>
                  <p className="text-xs font-semibold text-[var(--ink)]">
                    {cell.day}
                  </p>
                  {dayCover.length > 0 ? (
                    <p
                      className="mt-0.5 text-[10px] font-semibold text-[var(--scania-blue-800,#041e42)]"
                      title={dayCover.map((gap) => formatRoleCoverage(gap)).join("\n")}
                    >
                      None available
                    </p>
                  ) : null}
                  <ul className="mt-1 space-y-1">
                    {dayEntries.slice(0, 3).map((entry) => (
                      <li key={`${entry.id}-${cell.dateKey}`}>
                        <Link
                          href={`/vacation/${entry.id}`}
                          className="block truncate rounded bg-[var(--color-accent-soft,rgba(0,100,80,0.12))] px-1.5 py-0.5 text-[11px] text-[var(--ink)] hover:underline"
                          title={calendarEntryLabel(entry)}
                        >
                          {calendarEntryLabel(entry)}
                        </Link>
                      </li>
                    ))}
                    {dayEntries.length > 3 ? (
                      <li className="text-[10px] text-[var(--muted)]">
                        +{dayEntries.length - 3} more
                      </li>
                    ) : null}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function coverageForDay(dateKey: string, coverage: RoleCoverageGap[]) {
  const day = toUtcDateOnly(dateKey).getUTCDay();
  if (day === 0 || day === 6) return [];
  return coverage.filter(
    (gap) => dateKey >= gap.startDate && dateKey <= gap.endDate,
  );
}

export function RoleCoverageList({ gaps }: { gaps: RoleCoverageGap[] }) {
  if (gaps.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No role is fully away in this period. Half days and hours still leave
        someone partly available.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {gaps.map((gap) => (
        <li key={`${gap.kind}-${gap.departmentId}-${gap.role}-${gap.startDate}`}>
          <p className="text-sm font-medium text-[var(--ink)]">
            {formatRoleCoverage(gap)}
          </p>
          <p className="text-sm text-[var(--muted)]">{gap.names.join(", ")}</p>
          {gap.waiting ? (
            <p className="text-sm text-[var(--muted)]">
              Includes a request still waiting for approval.
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function calendarEntryLabel(entry: CalendarEntry): string {
  if (entry.durationKind === "HALF_DAY") {
    const part = entry.dayPart === "AFTERNOON" ? "PM" : "AM";
    return `${entry.requesterDisplayName} · ${part}`;
  }
  if (entry.durationKind === "HOURS" && entry.hours) {
    return `${entry.requesterDisplayName} · ${entry.hours}h`;
  }
  return entry.requesterDisplayName;
}
