"use client";

import { useState } from "react";
import {
  allocateWorkAction,
  moveAllocationAction,
} from "@/app/actions/pi-planning";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  FormField,
  fieldClassName,
  permissionTitle,
  useActionForm,
} from "@/components/ui/forms";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";

type Caps = Partial<PrincipalCapabilities>;

type IterationOption = { id: string; name: string; sequence: number };
type TeamOption = {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
};

export function MoveWorkForm({
  piId,
  allocationId,
  expectedVersion,
  iterations,
  teams,
  defaultIterationId,
  defaultTeamId,
  capabilities,
  onDone,
}: {
  piId: string;
  allocationId: string;
  expectedVersion: number;
  iterations: IterationOption[];
  teams: TeamOption[];
  defaultIterationId?: string;
  defaultTeamId?: string;
  capabilities?: Caps;
  onDone?: () => void;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const form = useActionForm(async (input) => {
    const result = await moveAllocationAction(input);
    if (result.ok) onDone?.();
    return result;
  });
  const allowed = capabilities?.canAllocatePi !== false;
  const itId = `move-it-${allocationId}`;
  const teamId = `move-team-${allocationId}`;

  return (
    <form
      className="space-y-2"
      aria-label="Move allocation"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed || form.pending) return;
        const fd = new FormData(e.currentTarget);
        const iterationId = String(fd.get("iterationId") ?? "");
        const nextTeamId = String(fd.get("teamId") ?? "");
        if (!iterationId || !nextTeamId) {
          setLocalError("Choose both an iteration and a team.");
          return;
        }
        setLocalError(null);
        form.submit({
          piId,
          allocationId,
          expectedVersion,
          iterationId,
          teamId: nextTeamId,
        });
      }}
    >
      <p className="text-xs font-medium">Move allocation</p>
      <p className="text-[11px] text-[var(--muted)]">
        Relocate this work item to another team × iteration cell. Capacity rules
        still apply on save.
      </p>
      {localError ? <Alert tone="danger">{localError}</Alert> : null}
      {form.ErrorAlert}
      <FormField
        label="Target iteration"
        htmlFor={itId}
        hint="Planning iteration for this allocation."
      >
        <select
          id={itId}
          name="iterationId"
          required
          defaultValue={defaultIterationId}
          className={fieldClassName}
          disabled={!allowed || form.pending}
        >
          {iterations.map((it) => (
            <option key={it.id} value={it.id}>
              {it.sequence}. {it.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Target team"
        htmlFor={teamId}
        hint="Department / team that will own the work."
      >
        <select
          id={teamId}
          name="teamId"
          required
          defaultValue={defaultTeamId}
          className={fieldClassName}
          disabled={!allowed || form.pending}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.departmentName} / {t.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={form.pending}
          disabled={form.pending || !allowed}
          title={permissionTitle(allowed)}
        >
          Save move
        </Button>
        {onDone ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={form.pending}
            onClick={() => {
              setLocalError(null);
              onDone();
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function AllocateWorkForm({
  piId,
  revisionId,
  workItemId,
  iterations,
  teams,
  estimateHours,
  capabilities,
  onDone,
}: {
  piId: string;
  revisionId?: string;
  workItemId: string;
  iterations: IterationOption[];
  teams: TeamOption[];
  /** Optional estimate from the work item — display hint only. */
  estimateHours?: string | null;
  capabilities?: Caps;
  onDone?: () => void;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const form = useActionForm(async (input) => {
    const result = await allocateWorkAction(input);
    if (result.ok) onDone?.();
    return result;
  });
  const allowed = capabilities?.canAllocatePi !== false;
  const itId = `alloc-it-${workItemId}`;
  const teamFieldId = `alloc-team-${workItemId}`;
  const hrsId = `alloc-hrs-${workItemId}`;

  if (iterations.length === 0 || teams.length === 0) {
    return (
      <p className="text-xs text-[var(--muted)]" role="status">
        Add iterations and participating teams before allocating.
      </p>
    );
  }

  return (
    <form
      className="space-y-2"
      aria-label="Allocate work item"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed || form.pending) return;
        const fd = new FormData(e.currentTarget);
        const iterationId = String(fd.get("iterationId") ?? "");
        const teamId = String(fd.get("teamId") ?? "");
        const hoursRaw = String(fd.get("plannedHours") ?? "").trim();
        if (!iterationId || !teamId) {
          setLocalError("Choose both an iteration and a team.");
          return;
        }
        if (hoursRaw !== "") {
          const n = Number(hoursRaw);
          if (!Number.isFinite(n) || n < 0) {
            setLocalError("Planned hours must be zero or a positive number.");
            return;
          }
        }
        setLocalError(null);
        form.submit({
          piId,
          workItemId,
          iterationId,
          teamId,
          plannedHours: hoursRaw || null,
          ...(revisionId ? { revisionId } : {}),
        });
      }}
    >
      <p className="text-xs font-medium">Allocate to board</p>
      <p className="text-[11px] text-[var(--muted)]">
        Places this backlog item on a team × iteration cell
        {estimateHours
          ? ` (estimate ${estimateHours}h — planned hours optional).`
          : ". Planned hours are optional."}
      </p>
      {localError ? <Alert tone="danger">{localError}</Alert> : null}
      {form.ErrorAlert}
      <FormField
        label="Iteration"
        htmlFor={itId}
        hint="Which PI iteration receives the allocation."
      >
        <select
          id={itId}
          name="iterationId"
          required
          className={fieldClassName}
          disabled={!allowed || form.pending}
        >
          {iterations.map((it) => (
            <option key={it.id} value={it.id}>
              {it.sequence}. {it.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Team"
        htmlFor={teamFieldId}
        hint="Department / team capacity bucket."
      >
        <select
          id={teamFieldId}
          name="teamId"
          required
          className={fieldClassName}
          disabled={!allowed || form.pending}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.departmentName} / {t.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Planned hours"
        htmlFor={hrsId}
        hint="Optional load against team capacity for that iteration."
      >
        <input
          id={hrsId}
          name="plannedHours"
          type="number"
          min={0}
          step="0.5"
          inputMode="decimal"
          placeholder={estimateHours ? String(estimateHours) : "e.g. 8"}
          className={fieldClassName}
          disabled={!allowed || form.pending}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={form.pending}
          disabled={form.pending || !allowed}
          title={permissionTitle(allowed)}
        >
          Save allocation
        </Button>
        {onDone ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={form.pending}
            onClick={() => {
              setLocalError(null);
              onDone();
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
