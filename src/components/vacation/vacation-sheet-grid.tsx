"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import {
  SHEET_KIND_COLOR,
  SHEET_KIND_LABEL,
  SHEET_PLAN_KINDS,
  type SheetPlanKind,
} from "@/modules/vacation/application/vacation-plan-sheet";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type SheetGridPerson = {
  name: string;
  group: string | null;
  days: Array<{ date: string; weekend: boolean; kind: SheetPlanKind | null }>;
};

export function VacationSheetGrid({
  departmentCode,
  year,
  month,
  departments,
  monthCounts,
  people,
}: {
  departmentCode: string;
  year: number;
  month: number;
  departments: Array<{ code: string; people: number }>;
  monthCounts: number[];
  people: SheetGridPerson[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{
    name: string;
    date: string;
    kind: SheetPlanKind;
  } | null>(null);
  const dates = people[0]?.days ?? [];

  function openDepartment(code: string) {
    router.push(`/vacation/plan?department=${encodeURIComponent(code)}&year=${year}&month=${month}`);
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Department</span>
        <select
          className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
          value={departmentCode}
          onChange={(event) => openDepartment(event.target.value)}
        >
          {departments.map((department) => (
            <option key={department.code} value={department.code}>
              {department.code} · {department.people} people
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        {monthCounts.map((count, index) => {
          const monthNumber = index + 1;
          const active = monthNumber === month;
          const label = new Date(Date.UTC(year, index, 1)).toLocaleString("en-GB", {
            month: "short",
            timeZone: "UTC",
          });
          return (
            <a
              key={label}
              href={`/vacation/plan?department=${encodeURIComponent(departmentCode)}&year=${year}&month=${monthNumber}`}
              className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm ${
                active
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]"
                  : "border-[var(--color-border)]"
              }`}
              style={active ? { color: "#ffffff" } : undefined}
              aria-current={active ? "page" : undefined}
            >
              {label}
              {count > 0 ? <span className="ml-1 text-xs opacity-80">{count}</span> : null}
            </a>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {SHEET_PLAN_KINDS.map((kind) => (
          <span
            key={kind}
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[var(--color-border)] px-2.5 text-xs"
          >
            <span
              className="size-3 rounded-sm"
              style={{ backgroundColor: SHEET_KIND_COLOR[kind].background }}
            />
            {SHEET_KIND_LABEL[kind]}
          </span>
        ))}
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No people on this department sheet.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-36 bg-[var(--color-surface)] px-2 py-2 text-left">
                  Name
                </th>
                {dates.map((day) => {
                  const date = new Date(`${day.date}T00:00:00.000Z`);
                  return (
                    <th
                      key={day.date}
                      className={`min-w-11 px-0.5 py-1 text-center font-medium ${day.weekend ? "text-[var(--color-text-muted)]" : ""}`}
                    >
                      <span className="block">{WEEKDAYS[date.getUTCDay()]?.slice(0, 1)}</span>
                      <span className="block">{date.getUTCDate()}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {people.map((person, index) => {
                const showGroup = person.group && person.group !== people[index - 1]?.group;
                return (
                  <SheetRow
                    key={`${person.group ?? ""}-${person.name}`}
                    person={person}
                    showGroup={Boolean(showGroup)}
                    columnCount={dates.length + 1}
                    onOpen={(date, kind) => setSelected({ name: person.name, date, kind })}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={selected !== null}
        title={selected?.name ?? "Day"}
        description={selected ? formatDay(selected.date) : undefined}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected ? (
          <p
            className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-3 text-sm font-medium"
            style={{
              backgroundColor: SHEET_KIND_COLOR[selected.kind].background,
              color: SHEET_KIND_COLOR[selected.kind].color,
            }}
          >
            {SHEET_KIND_LABEL[selected.kind]}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}

function SheetRow({
  person,
  showGroup,
  columnCount,
  onOpen,
}: {
  person: SheetGridPerson;
  showGroup: boolean;
  columnCount: number;
  onOpen: (date: string, kind: SheetPlanKind) => void;
}) {
  return (
    <>
      {showGroup ? (
        <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]">
          <th
            colSpan={columnCount}
            className="sticky left-0 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide"
          >
            {person.group}
          </th>
        </tr>
      ) : null}
      <tr className="border-t border-[var(--color-border)]">
        <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-2 py-1 text-left font-medium">
          <span className="block max-w-36 truncate">{person.name}</span>
        </th>
        {person.days.map((day) => {
          const paint = day.kind ? SHEET_KIND_COLOR[day.kind] : null;
          const label = day.kind ? SHEET_KIND_LABEL[day.kind] : "Open";
          return (
            <td key={day.date} className="p-0.5">
              {day.kind ? (
                <button
                  type="button"
                  className="block size-11 rounded-sm"
                  style={{ backgroundColor: paint?.background }}
                  aria-label={`${person.name}, ${day.date}, ${label}`}
                  onClick={() => onOpen(day.date, day.kind!)}
                />
              ) : (
                <span
                  className="block size-11 rounded-sm"
                  style={{
                    backgroundColor: day.weekend ? "var(--color-surface-muted)" : "transparent",
                  }}
                />
              )}
            </td>
          );
        })}
      </tr>
    </>
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}
