"use client";

import { useState } from "react";
import { updateOnboardingTaskAction } from "@/app/actions/onboarding";
import { useActionForm } from "@/components/ui/forms";
import {
  PHASE_HINT,
  PHASE_LABEL,
  ONBOARDING_PHASES,
  type OnboardingPhase,
} from "@/modules/onboarding/application/infb-new-hire-template";

export type SheetTask = {
  id: string;
  title: string;
  description: string | null;
  phase: OnboardingPhase;
  assigneeLabel: string | null;
  dueDate: string | null;
  taskStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  notes: string | null;
};

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETE", label: "Complete" },
] as const;

export function OnboardingSheet({
  checklistId,
  expectedVersion,
  editable,
  profile,
  tasks,
}: {
  checklistId: string;
  expectedVersion: number;
  editable: boolean;
  profile: {
    employeeName: string;
    jobTitle: string | null;
    department: string | null;
    hiringManager: string | null;
    startDate: string | null;
    onboarderName: string;
  };
  tasks: SheetTask[];
}) {
  const { pending, ErrorAlert, submit } = useActionForm(updateOnboardingTaskAction);
  const required = tasks.filter((task) => task.phase !== "FEEDBACK");
  const done = required.filter((task) => task.taskStatus === "COMPLETE").length;
  const firstOpen =
    ONBOARDING_PHASES.find((phase) =>
      tasks.some(
        (task) =>
          task.phase === phase &&
          (phase === "FEEDBACK" ? !task.notes : task.taskStatus !== "COMPLETE"),
      ),
    ) ?? "PREBOARDING";
  const [openPhase, setOpenPhase] = useState<OnboardingPhase>(firstOpen);

  function save(
    task: SheetTask,
    patch: {
      taskStatus?: SheetTask["taskStatus"];
      notes?: string | null;
      dueDate?: string | null;
    },
  ) {
    submit({
      checklistId,
      itemId: task.id,
      expectedVersion,
      ...patch,
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--line)] bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              New hire
            </p>
            <h2 className="text-xl font-semibold text-[var(--ink)]">
              {profile.employeeName}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              {[profile.jobTitle, profile.department].filter(Boolean).join(" · ") ||
                "Role and department not set"}
            </p>
          </div>
          <p className="text-sm font-semibold text-[var(--ink)]">
            {done} of {required.length} tasks complete
          </p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-success-soft)]"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-[var(--ok)]"
            style={{
              width: required.length === 0 ? "0%" : `${Math.round((done / required.length) * 100)}%`,
            }}
          />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <ProfileItem label="Hiring manager" value={profile.hiringManager} />
          <ProfileItem label="Start date" value={formatDay(profile.startDate)} />
          <ProfileItem label="Onboarder" value={profile.onboarderName} />
          <ProfileItem label="Department" value={profile.department} />
        </dl>
      </section>

      {ErrorAlert}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ONBOARDING_PHASES.map((phase) => {
          const rows = tasks.filter((task) => task.phase === phase);
          const complete =
            phase === "FEEDBACK"
              ? rows.filter((task) => task.notes).length
              : rows.filter((task) => task.taskStatus === "COMPLETE").length;
          return (
            <button
              key={phase}
              type="button"
              aria-pressed={openPhase === phase}
              onClick={() => setOpenPhase(phase)}
              className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold ${
                openPhase === phase
                  ? "bg-[var(--scania-blue-800,#041e42)] text-white"
                  : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)]"
              }`}
            >
              {PHASE_LABEL[phase]} {complete}/{rows.length}
            </button>
          );
        })}
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--ink)]">
            {PHASE_LABEL[openPhase]}
          </h3>
          <p className="text-sm text-[var(--muted)]">{PHASE_HINT[openPhase]}</p>
        </div>
        {tasks
          .filter((task) => task.phase === openPhase)
          .map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              editable={editable && !pending}
              feedback={openPhase === "FEEDBACK"}
              onSave={(patch) => save(task, patch)}
            />
          ))}
      </section>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[var(--ink)]">{value || "—"}</dd>
    </div>
  );
}

function TaskCard({
  task,
  editable,
  feedback,
  onSave,
}: {
  task: SheetTask;
  editable: boolean;
  feedback: boolean;
  onSave: (patch: {
    taskStatus?: SheetTask["taskStatus"];
    notes?: string | null;
    dueDate?: string | null;
  }) => void;
}) {
  const [notes, setNotes] = useState(task.notes ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-semibold text-[var(--ink)]">{task.title}</h4>
          {task.description ? (
            <p className="mt-1 text-sm text-[var(--muted)]">{task.description}</p>
          ) : null}
        </div>
        {task.assigneeLabel ? (
          <span className="rounded-full bg-[var(--surface-muted,#f4f6f8)] px-2.5 py-1 text-xs font-medium text-[var(--ink)]">
            {task.assigneeLabel}
          </span>
        ) : null}
      </div>

      {feedback ? (
        <label className="mt-3 block text-sm">
          <span className="font-medium text-[var(--ink)]">Response</span>
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
            value={notes}
            disabled={!editable}
            maxLength={2000}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => {
              const next = notes.trim();
              if (next !== (task.notes ?? "")) onSave({ notes: next || null });
            }}
          />
        </label>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-1">
            {STATUS_OPTIONS.map((option) => {
              const selected = task.taskStatus === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  disabled={!editable}
                  onClick={() => {
                    if (!selected) onSave({ taskStatus: option.value });
                  }}
                  className={`min-h-11 rounded-md px-2 text-xs font-semibold ${statusClass(option.value, selected)}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <label className="block text-sm">
              <span className="font-medium text-[var(--ink)]">Due date</span>
              <input
                type="date"
                className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-2 text-sm text-[var(--ink)]"
                value={dueDate}
                disabled={!editable}
                onChange={(event) => {
                  const next = event.target.value;
                  setDueDate(next);
                  if (next !== (task.dueDate ?? "")) onSave({ dueDate: next || null });
                }}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[var(--ink)]">Notes</span>
              <textarea
                className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
                value={notes}
                disabled={!editable}
                maxLength={2000}
                rows={2}
                onChange={(event) => setNotes(event.target.value)}
                onBlur={() => {
                  const next = notes.trim();
                  if (next !== (task.notes ?? "")) onSave({ notes: next || null });
                }}
              />
            </label>
          </div>
        </>
      )}
    </article>
  );
}

function statusClass(
  status: SheetTask["taskStatus"],
  selected: boolean,
): string {
  if (!selected) return "bg-white text-[var(--muted)] ring-1 ring-[var(--line)]";
  if (status === "COMPLETE") return "bg-[var(--color-success-soft)] text-[var(--ok)]";
  if (status === "IN_PROGRESS") {
    return "bg-[var(--color-warning-soft)] text-[var(--warning)]";
  }
  return "bg-[var(--surface-muted,#f4f6f8)] text-[var(--ink)]";
}

function formatDay(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
