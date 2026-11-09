"use client";

import { useState } from "react";
import { setVacationPlanMarkAction } from "@/app/actions/vacation";
import { Dialog } from "@/components/ui/dialog";
import { useActionForm } from "@/components/ui/forms";
import {
  PLAN_KIND_COLOR,
  PLAN_KIND_LABEL,
  VACATION_PLAN_KINDS,
  type PlanCellKind,
  type VacationPlanKindName,
} from "@/modules/vacation/application/vacation-plan";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type PlanGridPerson = {
  principalId: string;
  name: string;
  role: string;
  editable: boolean;
  days: Array<{
    date: string;
    weekend: boolean;
    kind: PlanCellKind | null;
    fromRequest: boolean;
  }>;
};

export function VacationPlanGrid({
  organizationId,
  departmentId,
  people,
}: {
  organizationId: string;
  departmentId: string;
  people: PlanGridPerson[];
}) {
  const [selected, setSelected] = useState<{
    person: PlanGridPerson;
    date: string;
    kind: PlanCellKind | null;
    fromRequest: boolean;
  } | null>(null);
  const { pending, error, submit } = useActionForm(
    setVacationPlanMarkAction,
    () => setSelected(null),
  );

  function save(kind: VacationPlanKindName | null) {
    if (!selected) return;
    submit({
      organizationId,
      departmentId,
      principalId: selected.person.principalId,
      date: selected.date,
      kind,
    });
  }

  if (people.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        No people in this department yet.
      </p>
    );
  }

  const dates = people[0]?.days ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {VACATION_PLAN_KINDS.map((kind) => (
          <span
            key={kind}
            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[var(--color-border)] px-2.5 text-xs"
          >
            <span
              className="size-3 rounded-sm"
              style={{ backgroundColor: PLAN_KIND_COLOR[kind].background }}
            />
            {PLAN_KIND_LABEL[kind]}
          </span>
        ))}
      </div>
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
            {people.map((person) => (
              <tr key={person.principalId} className="border-t border-[var(--color-border)]">
                <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-2 py-1 text-left font-medium">
                  <span className="block max-w-36 truncate">{person.name}</span>
                  <span className="block max-w-36 truncate text-[10px] font-normal text-[var(--color-text-muted)]">
                    {person.role}
                  </span>
                </th>
                {person.days.map((day) => {
                  const paint = day.kind ? PLAN_KIND_COLOR[day.kind] : null;
                  const label = day.kind ? PLAN_KIND_LABEL[day.kind] : "Open";
                  return (
                    <td key={day.date} className="p-0.5">
                      {day.weekend || !person.editable ? (
                        <span
                          className="block size-11 rounded-sm"
                          style={
                            paint
                              ? { backgroundColor: paint.background }
                              : {
                                  backgroundColor: day.weekend
                                    ? "var(--color-surface-muted)"
                                    : "transparent",
                                }
                          }
                          title={day.weekend ? "Weekend" : label}
                        />
                      ) : (
                        <button
                          type="button"
                          className="block size-11 rounded-sm border border-transparent hover:border-[var(--color-border-strong)]"
                          style={
                            paint
                              ? { backgroundColor: paint.background }
                              : undefined
                          }
                          aria-label={`${person.name}, ${day.date}, ${label}`}
                          onClick={() =>
                            setSelected({
                              person,
                              date: day.date,
                              kind: day.kind,
                              fromRequest: day.fromRequest,
                            })
                          }
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={selected !== null}
        title={selected ? selected.person.name : "Day"}
        description={selected ? formatDay(selected.date) : undefined}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {selected ? (
          <div className="space-y-2">
            {selected.fromRequest ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                This day comes from a vacation request. A mark here stays on the plan.
              </p>
            ) : null}
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            <div className="grid gap-2">
              {VACATION_PLAN_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={pending}
                  className="min-h-11 rounded-[var(--radius-md)] px-3 text-left text-sm font-medium disabled:opacity-60"
                  style={{
                    backgroundColor: PLAN_KIND_COLOR[kind].background,
                    color: PLAN_KIND_COLOR[kind].color,
                  }}
                  onClick={() => save(kind)}
                >
                  {PLAN_KIND_LABEL[kind]}
                </button>
              ))}
              <button
                type="button"
                disabled={pending}
                className="secondary-button min-h-11"
                onClick={() => save(null)}
              >
                Clear this day
              </button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
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
