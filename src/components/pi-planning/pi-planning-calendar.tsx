"use client";

import { useMemo } from "react";
import type { WorkCardData } from "./work-card";

export type CalendarGranularity = "week" | "month";

export type CalendarIteration = {
  id: string;
  name: string;
  sequence: number;
  referenceKey: string;
  startDate: string;
  endDate: string;
};

export type CalendarAllocation = {
  allocationId: string;
  teamId: string;
  teamName: string;
  departmentId: string;
  departmentName: string;
  iterationId: string;
  plannedHours: string;
  card: WorkCardData;
};

type Bucket = {
  key: string;
  label: string;
  sublabel: string;
  startMs: number;
  endMs: number;
};

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function addUtcDays(ms: number, days: number): number {
  return ms + days * 86_400_000;
}

function startOfUtcWeek(ms: number): number {
  const d = new Date(startOfUtcDay(ms));
  // Monday-start ISO-ish week in UTC
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addUtcDays(d.getTime(), diff);
}

function startOfUtcMonth(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function endOfUtcMonth(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999);
}

function formatShort(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMonth(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildCalendarBuckets(
  piStartIso: string,
  piEndIso: string,
  granularity: CalendarGranularity,
): Bucket[] {
  const startMs = startOfUtcDay(Date.parse(piStartIso));
  const endMs = startOfUtcDay(Date.parse(piEndIso));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return [];
  }

  const buckets: Bucket[] = [];
  if (granularity === "week") {
    let cursor = startOfUtcWeek(startMs);
    let week = 1;
    while (cursor <= endMs) {
      const bucketEnd = addUtcDays(cursor, 6);
      buckets.push({
        key: `w-${cursor}`,
        label: `W${week}`,
        sublabel: `${formatShort(Math.max(cursor, startMs))} – ${formatShort(Math.min(bucketEnd, endMs))}`,
        startMs: cursor,
        endMs: bucketEnd + 86_400_000 - 1,
      });
      cursor = addUtcDays(cursor, 7);
      week += 1;
      if (week > 52) break;
    }
  } else {
    let cursor = startOfUtcMonth(startMs);
    while (cursor <= endMs) {
      const bucketEnd = endOfUtcMonth(cursor);
      buckets.push({
        key: `m-${cursor}`,
        label: formatMonth(cursor),
        sublabel: `${formatShort(Math.max(cursor, startMs))} – ${formatShort(Math.min(startOfUtcDay(bucketEnd), endMs))}`,
        startMs: cursor,
        endMs: bucketEnd,
      });
      const d = new Date(cursor);
      cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
      if (buckets.length > 24) break;
    }
  }
  return buckets;
}

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

function statusTone(status: string): string {
  const s = status.toUpperCase();
  if (s.includes("BLOCK") || s === "CANCELLED") {
    return "bg-[var(--scania-red-400,#d1001b)] text-white";
  }
  if (s.includes("DONE") || s.includes("COMPLETE")) {
    return "bg-[#00664f] text-white";
  }
  if (s.includes("PROGRESS") || s.includes("ACTIVE")) {
    return "bg-[var(--scania-blue-700,#0f3263)] text-white";
  }
  return "bg-[var(--scania-blue-500,#2058a8)] text-white";
}

/**
 * PI overview calendar — week or month columns across the PI window.
 * Allocations are placed by their iteration date range (authoritative plan slots).
 */
export function PiPlanningCalendar({
  granularity,
  piStartDate,
  piEndDate,
  iterations,
  allocations,
  onSelectAllocation,
}: {
  granularity: CalendarGranularity;
  piStartDate: string;
  piEndDate: string;
  iterations: CalendarIteration[];
  allocations: CalendarAllocation[];
  onSelectAllocation?: (allocationId: string) => void;
}) {
  const buckets = useMemo(
    () => buildCalendarBuckets(piStartDate, piEndDate, granularity),
    [piStartDate, piEndDate, granularity],
  );

  const iterationById = useMemo(() => {
    const map = new Map<string, CalendarIteration>();
    for (const it of iterations) map.set(it.id, it);
    return map;
  }, [iterations]);

  const rows = useMemo(() => {
    const byTeam = new Map<
      string,
      {
        teamId: string;
        teamName: string;
        departmentName: string;
        items: CalendarAllocation[];
      }
    >();
    for (const a of allocations) {
      const row = byTeam.get(a.teamId) ?? {
        teamId: a.teamId,
        teamName: a.teamName,
        departmentName: a.departmentName,
        items: [],
      };
      row.items.push(a);
      byTeam.set(a.teamId, row);
    }
    return [...byTeam.values()].sort((a, b) =>
      `${a.departmentName}/${a.teamName}`.localeCompare(
        `${b.departmentName}/${b.teamName}`,
      ),
    );
  }, [allocations]);

  if (buckets.length === 0) {
    return (
      <p className="tegel-card p-4 text-sm text-[var(--muted)]" role="status">
        PI dates are missing or invalid — set the planning period in Settings.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="tegel-card p-4 text-sm text-[var(--muted)]" role="status">
        No allocated work matches the current filters. Switch to Detail to
        allocate from the backlog, or clear filters.
      </p>
    );
  }

  const colMin = granularity === "week" ? "110px" : "140px";
  const columnTemplate = `180px repeat(${buckets.length}, minmax(${colMin}, 1fr))`;
  const laneTemplate = `repeat(${buckets.length}, minmax(${colMin}, 1fr))`;

  return (
    <div
      className="tegel-card overflow-x-auto"
      data-testid="pi-planning-calendar"
      data-granularity={granularity}
    >
      <div className="min-w-[720px] text-xs">
        <div
          className="grid border-b border-[var(--scania-grey-200)] bg-[#e8eef8] font-bold text-[var(--scania-blue-900)]"
          style={{ gridTemplateColumns: columnTemplate }}
        >
          <div className="p-3">Team</div>
          {buckets.map((b) => (
            <div
              key={b.key}
              className="border-l border-[var(--scania-grey-200)] p-3 text-center"
            >
              {b.label}
              <span className="mt-1 block font-normal text-[var(--muted)]">
                {b.sublabel}
              </span>
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <div
            key={row.teamId}
            className="grid min-h-[4.5rem] border-b border-[var(--scania-grey-100)] last:border-b-0"
            style={{ gridTemplateColumns: columnTemplate }}
            data-testid={`pi-calendar-row-${row.teamId}`}
          >
            <div className="bg-[var(--scania-grey-50)] p-3 font-bold text-[var(--scania-blue-900)]">
              {row.teamName}
              <span className="mt-1 block font-normal text-[var(--muted)]">
                {row.departmentName} · {row.items.length} item
                {row.items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div
              className="relative min-h-[4.5rem]"
              style={{ gridColumn: `2 / span ${buckets.length}` }}
            >
              <div
                className="pointer-events-none absolute inset-0 grid"
                style={{ gridTemplateColumns: laneTemplate }}
                aria-hidden
              >
                {buckets.map((b) => (
                  <div
                    key={b.key}
                    className="border-l border-[var(--scania-grey-100)] bg-white"
                  />
                ))}
              </div>
              <div
                className="relative grid gap-y-1 py-2"
                style={{ gridTemplateColumns: laneTemplate }}
              >
                {row.items.map((item) => {
                  const it = iterationById.get(item.iterationId);
                  if (!it) return null;
                  const itemStart = startOfUtcDay(Date.parse(it.startDate));
                  const itemEnd = startOfUtcDay(Date.parse(it.endDate));
                  if (!Number.isFinite(itemStart) || !Number.isFinite(itemEnd)) {
                    return null;
                  }
                  let startCol = -1;
                  let endCol = -1;
                  buckets.forEach((b, index) => {
                    if (overlaps(itemStart, itemEnd, b.startMs, b.endMs)) {
                      if (startCol < 0) startCol = index + 1;
                      endCol = index + 1;
                    }
                  });
                  if (startCol < 0 || endCol < 0) return null;
                  const span = Math.max(1, endCol - startCol + 1);
                  return (
                    <button
                      key={item.allocationId}
                      type="button"
                      className={`z-10 mx-1 min-w-0 self-start overflow-hidden rounded-[4px] px-2 py-1.5 text-left shadow-sm ${statusTone(item.card.workItem.status)}`}
                      style={{ gridColumn: `${startCol} / span ${span}` }}
                      title={`${item.card.workItem.title} · ${it.name} · ${item.plannedHours}h`}
                      onClick={() => onSelectAllocation?.(item.allocationId)}
                      data-testid={`pi-calendar-item-${item.allocationId}`}
                    >
                      <div className="truncate font-bold">
                        {item.card.workItem.referenceKey}
                      </div>
                      <div className="truncate text-[10px] text-white/85">
                        {item.card.workItem.project.referenceKey}
                        {item.card.workItem.project.initiative
                          ? ` · ${item.card.workItem.project.initiative.referenceKey}`
                          : ""}{" "}
                        · {item.plannedHours}h
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
