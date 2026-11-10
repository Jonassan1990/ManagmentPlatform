"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setVacationPlanMarkAction } from "@/app/actions/vacation";
import { Dialog } from "@/components/ui/dialog";
import { useActionForm } from "@/components/ui/forms";
import {
  SHEET_KIND_COLOR,
  SHEET_KIND_LABEL,
  SHEET_PLAN_KINDS,
  type SheetPlanKind,
} from "@/modules/vacation/application/vacation-plan-sheet";
import type { ShownPlanKind } from "@/modules/vacation/application/vacation-plan-day";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WAITING_COLOR = { background: "#F4B183", color: "#15202b" };

export type SheetGridPerson = {
  principalId: string | null;
  name: string;
  role: string;
  group: string | null;
  manager: boolean;
  days: Array<{
    date: string;
    weekend: boolean;
    holiday: string | null;
    kind: ShownPlanKind | null;
    waiting: boolean;
  }>;
};

export function VacationSheetGrid({
  organizationId,
  departmentId,
  departmentCode,
  year,
  month,
  canEdit,
  groups,
  searchPeople,
  highlight,
  people,
}: {
  organizationId: string;
  departmentId: string | null;
  departmentCode: string;
  year: number;
  month: number;
  canEdit: boolean;
  groups: Array<{ label: string; departments: Array<{ code: string; people: number }> }>;
  searchPeople: Array<{ name: string; code: string }>;
  highlight: string | null;
  people: SheetGridPerson[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{
    person: SheetGridPerson;
    date: string;
    kind: ShownPlanKind | null;
    waiting: boolean;
  } | null>(null);
  const { pending, error, submit } = useActionForm(setVacationPlanMarkAction, () =>
    setSelected(null),
  );
  const dates = people[0]?.days ?? [];
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return searchPeople
      .filter((person) => person.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [query, searchPeople]);

  useEffect(() => {
    if (!highlight) return;
    const row = document.querySelector(`[data-person="${CSS.escape(highlight)}"]`);
    row?.scrollIntoView({ block: "center" });
  }, [highlight, people]);

  function openDepartment(code: string, person?: string) {
    const query = new URLSearchParams({
      department: code,
      year: String(year),
      month: String(month),
    });
    if (person) query.set("person", person);
    router.push(`/vacation/plan?${query.toString()}`);
  }

  function save(kind: "VACATION" | "EDUCATION" | "COMPENSATORY" | "ON_CALL" | "PARENTAL" | "IN_OFFICE" | null) {
    if (!selected?.person.principalId || !departmentId) return;
    submit({
      organizationId,
      departmentId,
      principalId: selected.person.principalId,
      date: selected.date,
      kind,
    });
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Find a person</span>
        <input
          className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
          value={query}
          placeholder="Name"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {matches.length > 0 ? (
        <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
          {matches.map((person) => (
            <li key={`${person.code}:${person.name}`}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm hover:bg-[var(--color-surface-muted)]"
                onClick={() => {
                  setQuery("");
                  openDepartment(person.code, person.name);
                }}
              >
                <span>{person.name}</span>
                <span className="text-[var(--color-text-muted)]">{person.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Department</span>
        <select
          className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3"
          value={departmentCode}
          onChange={(event) => openDepartment(event.target.value)}
        >
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.departments.map((department) => (
                <option key={department.code} value={department.code}>
                  {department.code} · {department.people} people
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        {MONTHS.map((label, index) => {
          const monthNumber = index + 1;
          const active = monthNumber === month;
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
            </a>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {SHEET_PLAN_KINDS.map((kind) => (
          <Legend key={kind} kind={kind} />
        ))}
        <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[var(--color-border)] px-2.5 text-xs">
          <span className="size-3 rounded-sm" style={{ backgroundColor: WAITING_COLOR.background }} />
          Waiting for approval
        </span>
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          No row is visible in this department for you.
        </p>
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
                      title={day.holiday ?? undefined}
                      className={`min-w-11 px-0.5 py-1 text-center font-medium ${
                        day.weekend || day.holiday ? "text-[var(--color-text-muted)]" : ""
                      }`}
                    >
                      <span className="block">{WEEKDAYS[date.getUTCDay()]?.slice(0, 1)}</span>
                      <span className="block">{date.getUTCDate()}</span>
                      {day.holiday ? <span className="block text-[9px]">Hol</span> : null}
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
                    highlighted={highlight === person.name}
                    onOpen={(date, kind, waiting) =>
                      setSelected({ person, date, kind, waiting })
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={selected !== null}
        title={selected?.person.name ?? "Day"}
        description={selected ? formatDay(selected.date) : undefined}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected ? (
          <div className="space-y-2">
            {selected.waiting ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                This day is waiting for a manager to accept the vacation request.
              </p>
            ) : null}
            {selected.kind && !selected.waiting ? (
              <p
                className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-3 text-sm font-medium"
                style={paintFor(selected.kind)}
              >
                {labelFor(selected.kind)}
              </p>
            ) : null}
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            {canEdit && selected.person.principalId && departmentId ? (
              <div className="grid gap-2">
                {(["VACATION", "EDUCATION", "COMPENSATORY", "ON_CALL", "PARENTAL"] as const).map(
                  (kind) => (
                    <button
                      key={kind}
                      type="button"
                      disabled={pending}
                      className="min-h-11 rounded-[var(--radius-md)] px-3 text-left text-sm font-medium disabled:opacity-60"
                      style={paintFor(kind)}
                      onClick={() => save(kind)}
                    >
                      {labelFor(kind)}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={pending}
                  className="secondary-button min-h-11"
                  onClick={() => save("IN_OFFICE")}
                >
                  In the office
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="secondary-button min-h-11"
                  onClick={() => save(null)}
                >
                  Use the sheet
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function SheetRow({
  person,
  showGroup,
  columnCount,
  highlighted,
  onOpen,
}: {
  person: SheetGridPerson;
  showGroup: boolean;
  columnCount: number;
  highlighted: boolean;
  onOpen: (date: string, kind: ShownPlanKind | null, waiting: boolean) => void;
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
      <tr
        className="border-t border-[var(--color-border)]"
        data-person={person.name}
      >
        <th
          className={`sticky left-0 z-10 px-2 py-1 text-left font-medium ${
            highlighted ? "bg-[var(--color-surface-muted)]" : "bg-[var(--color-surface)]"
          }`}
        >
          <span className="block max-w-36 truncate">{person.name}</span>
          <span className="block max-w-36 truncate text-[10px] font-normal text-[var(--color-text-muted)]">
            {person.manager ? "Manager" : person.role}
          </span>
        </th>
        {person.days.map((day) => {
          const paint = day.kind ? paintFor(day.kind) : null;
          const label = day.holiday
            ? day.holiday
            : day.kind
              ? labelFor(day.kind)
              : "Open";
          return (
            <td key={day.date} className="p-0.5">
              <button
                type="button"
                className="block size-11 rounded-sm border border-transparent"
                style={{
                  backgroundColor:
                    paint?.background ??
                    (day.weekend || day.holiday ? "var(--color-surface-muted)" : "transparent"),
                }}
                aria-label={`${person.name}, ${day.date}, ${label}`}
                title={label}
                onClick={() => onOpen(day.date, day.kind, day.waiting)}
              />
            </td>
          );
        })}
      </tr>
    </>
  );
}

function Legend({ kind }: { kind: SheetPlanKind }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[var(--color-border)] px-2.5 text-xs">
      <span className="size-3 rounded-sm" style={{ backgroundColor: SHEET_KIND_COLOR[kind].background }} />
      {SHEET_KIND_LABEL[kind]}
    </span>
  );
}

function labelFor(kind: ShownPlanKind): string {
  if (kind === "WAITING") return "Waiting for approval";
  if (kind === "PARTIAL") return "Part of the day";
  return SHEET_KIND_LABEL[kind];
}

function paintFor(kind: ShownPlanKind): { background: string; color: string } {
  if (kind === "WAITING") return WAITING_COLOR;
  if (kind === "PARTIAL") return { background: "#fff4df", color: "#9a3412" };
  return SHEET_KIND_COLOR[kind];
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}
