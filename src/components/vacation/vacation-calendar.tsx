import Link from "next/link";
import { formatDateOnly, toUtcDateOnly } from "@/modules/vacation/application/working-days";

export type CalendarEntry = {
  id: string;
  requesterDisplayName: string;
  startDate: string;
  endDate: string;
};

export function VacationMonthCalendar({
  year,
  month,
  entries,
}: {
  year: number;
  month: number;
  entries: CalendarEntry[];
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
                  <ul className="mt-1 space-y-1">
                    {dayEntries.slice(0, 3).map((entry) => (
                      <li key={`${entry.id}-${cell.dateKey}`}>
                        <Link
                          href={`/vacation/${entry.id}`}
                          className="block truncate rounded bg-[var(--color-accent-soft,rgba(0,100,80,0.12))] px-1.5 py-0.5 text-[11px] text-[var(--ink)] hover:underline"
                          title={entry.requesterDisplayName}
                        >
                          {entry.requesterDisplayName}
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
