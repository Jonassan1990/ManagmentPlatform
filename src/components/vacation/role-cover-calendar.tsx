"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type {
  DayCover,
  DayCoverPerson,
  DayCoverTone,
} from "@/modules/vacation/application/vacation-coverage";
import { toUtcDateOnly } from "@/modules/vacation/application/working-days";

const TONE_CLASS: Record<DayCoverTone, string> = {
  green: "bg-[var(--color-success-soft)] text-[var(--ok)]",
  yellow: "bg-[var(--color-warning-soft)] text-[var(--warning)]",
  red: "bg-[var(--color-error-soft)] text-[var(--danger)]",
  closed: "bg-[var(--surface)] text-[var(--muted)]",
};

const TONE_LABEL: Record<DayCoverTone, string> = {
  green: "All roles available",
  yellow: "At least one person available",
  red: "No role available",
  closed: "Not a working day",
};

export function RoleCoverCalendar({
  year,
  month,
  days,
  selectedDate = null,
}: {
  year: number;
  month: number;
  days: DayCover[];
  selectedDate?: string | null;
}) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const [openDate, setOpenDate] = useState<string | null>(selectedDate);
  const selected = openDate ? byDate.get(openDate) : undefined;
  const popup =
    selected && (selected.tone === "yellow" || selected.tone === "red")
      ? selected
      : null;

  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = (first.getUTCDay() + 6) % 7;
  const cells: Array<string | null> = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    cells.push(date.toISOString().slice(0, 10));
  }

  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Legend tone="green" label="All roles available" />
        <Legend tone="yellow" label="At least one person available" />
        <Legend tone="red" label="No role available" />
      </ul>
      <div className="grid grid-cols-7 gap-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div
            key={label}
            className="px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]"
          >
            {label}
          </div>
        ))}
        {cells.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="min-h-11" />;
          const day = byDate.get(date);
          const tone = day?.tone ?? "closed";
          const dayNumber = Number(date.slice(8, 10));
          const label = `${dayLabel(date)}. ${TONE_LABEL[tone]}`;
          const className = `flex min-h-11 flex-col items-center justify-center rounded-md px-1 py-1 text-center text-sm font-semibold ${TONE_CLASS[tone]} ${
            popup?.date === date ? "ring-2 ring-[var(--ink)] ring-offset-1" : ""
          }`;
          if (tone === "yellow" || tone === "red") {
            const offCount = day?.off.length ?? 0;
            const hint =
              offCount === 0 ? "Part" : offCount === 1 ? "1 off" : `${offCount} off`;
            return (
              <button
                key={date}
                type="button"
                aria-label={label}
                aria-haspopup="dialog"
                aria-expanded={popup?.date === date}
                onClick={() => setOpenDate(date)}
                className={className}
              >
                <span>{dayNumber}</span>
                <span className="text-[10px] font-medium leading-tight">{hint}</span>
              </button>
            );
          }
          return (
            <div key={date} className={className} aria-label={label}>
              <span>{dayNumber}</span>
            </div>
          );
        })}
      </div>
      <Dialog
        open={popup !== null}
        onOpenChange={(next) => {
          if (!next) setOpenDate(null);
        }}
        title={popup ? dayLabel(popup.date) : "Availability"}
        description={
          popup
            ? popup.tone === "red"
              ? "No role is available."
              : "At least one person is still available."
            : undefined
        }
        footer={
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpenDate(null)}
          >
            Close
          </Button>
        }
      >
        {popup ? <DayPopup day={popup} /> : null}
      </Dialog>
    </div>
  );
}

function Legend({
  tone,
  label,
}: {
  tone: "green" | "yellow" | "red";
  label: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`inline-block h-3 w-3 rounded-sm ${TONE_CLASS[tone]}`}
        aria-hidden
      />
      <span className="text-[var(--ink)]">{label}</span>
    </li>
  );
}

function DayPopup({ day }: { day: DayCover }) {
  const departments = groupDepartments([...day.off, ...day.available]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <CountPill tone="red" count={day.off.length} label="off" />
        <CountPill tone="green" count={day.available.length} label="available" />
      </div>
      {departments.map((department) => (
        <section key={department.id} className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--ink)]">
            {department.name}
          </h3>
          <PersonGroup title="Off" tone="red" people={department.off} />
          <PersonGroup
            title="Available"
            tone="green"
            people={department.available}
          />
        </section>
      ))}
    </div>
  );
}

function CountPill({
  tone,
  count,
  label,
}: {
  tone: "red" | "green";
  count: number;
  label: string;
}) {
  const className =
    tone === "red"
      ? "bg-[var(--color-error-soft)] text-[var(--danger)]"
      : "bg-[var(--color-success-soft)] text-[var(--ok)]";
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${className}`}>
      {count} {label}
    </span>
  );
}

function PersonGroup({
  title,
  tone,
  people,
}: {
  title: string;
  tone: "red" | "green";
  people: DayCoverPerson[];
}) {
  if (people.length === 0) return null;
  const wash =
    tone === "red"
      ? "bg-[var(--color-error-soft)]"
      : "bg-[var(--color-success-soft)]";
  return (
    <div className={`rounded-lg p-3 ${wash}`}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink)]">
        {title}
      </p>
      <ul className="space-y-2">
        {people.map((person) => (
          <li
            key={person.principalId}
            className="flex items-start gap-3 rounded-md border border-[var(--line)] bg-white px-3 py-2.5"
          >
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                tone === "red"
                  ? "bg-[var(--color-error-soft)] text-[var(--danger)]"
                  : "bg-[var(--color-success-soft)] text-[var(--ok)]"
              }`}
              aria-hidden
            >
              {initials(person.displayName)}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--ink)]">
                {person.displayName}
              </span>
              <span className="block text-xs text-[var(--muted)]">{person.role}</span>
              {person.note ? (
                <span className="mt-1 inline-flex rounded-full bg-[var(--color-warning-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--warning)]">
                  {person.note}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2);
  return parts.join("").toUpperCase();
}

function groupDepartments(people: DayCoverPerson[]) {
  const groups = new Map<
    string,
    { id: string; name: string; off: DayCoverPerson[]; available: DayCoverPerson[] }
  >();
  for (const person of people) {
    const group = groups.get(person.departmentId) ?? {
      id: person.departmentId,
      name: person.departmentName,
      off: [],
      available: [],
    };
    if (person.availability === "off") group.off.push(person);
    else group.available.push(person);
    groups.set(person.departmentId, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.off.length !== b.off.length) return b.off.length - a.off.length;
    return a.name.localeCompare(b.name);
  });
}

function dayLabel(date: string): string {
  return toUtcDateOnly(date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
