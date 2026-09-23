"use client";

import {
  allocateWorkAction,
  moveAllocationAction,
} from "@/app/actions/pi-planning";
import {
  FormField,
  PrimaryButton,
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
  const form = useActionForm(async (input) => {
    const result = await moveAllocationAction(input);
    if (result.ok) onDone?.();
    return result;
  });
  const allowed = capabilities?.canAllocatePi !== false;

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          piId,
          allocationId,
          expectedVersion,
          iterationId: String(fd.get("iterationId") ?? ""),
          teamId: String(fd.get("teamId") ?? ""),
        });
      }}
    >
      <p className="text-xs font-medium">Move to…</p>
      {form.ErrorAlert}
      <FormField label="Iteration" htmlFor={`move-it-${allocationId}`}>
        <select
          id={`move-it-${allocationId}`}
          name="iterationId"
          required
          defaultValue={defaultIterationId}
          className={fieldClassName}
        >
          {iterations.map((it) => (
            <option key={it.id} value={it.id}>
              {it.sequence}. {it.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Team" htmlFor={`move-team-${allocationId}`}>
        <select
          id={`move-team-${allocationId}`}
          name="teamId"
          required
          defaultValue={defaultTeamId}
          className={fieldClassName}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.departmentName} / {t.name}
            </option>
          ))}
        </select>
      </FormField>
      <PrimaryButton
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Moving…" : "Move"}
      </PrimaryButton>
    </form>
  );
}

export function AllocateWorkForm({
  piId,
  workItemId,
  iterations,
  teams,
  capabilities,
  onDone,
}: {
  piId: string;
  workItemId: string;
  iterations: IterationOption[];
  teams: TeamOption[];
  capabilities?: Caps;
  onDone?: () => void;
}) {
  const form = useActionForm(async (input) => {
    const result = await allocateWorkAction(input);
    if (result.ok) onDone?.();
    return result;
  });
  const allowed = capabilities?.canAllocatePi !== false;

  if (iterations.length === 0 || teams.length === 0) {
    return (
      <p className="text-xs text-[var(--muted)]">
        Add iterations and participating teams before allocating.
      </p>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          piId,
          workItemId,
          iterationId: String(fd.get("iterationId") ?? ""),
          teamId: String(fd.get("teamId") ?? ""),
          plannedHours: optionalHours(fd.get("plannedHours")),
        });
      }}
    >
      <p className="text-xs font-medium">Allocate to…</p>
      {form.ErrorAlert}
      <FormField label="Iteration" htmlFor={`alloc-it-${workItemId}`}>
        <select
          id={`alloc-it-${workItemId}`}
          name="iterationId"
          required
          className={fieldClassName}
        >
          {iterations.map((it) => (
            <option key={it.id} value={it.id}>
              {it.sequence}. {it.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Team" htmlFor={`alloc-team-${workItemId}`}>
        <select
          id={`alloc-team-${workItemId}`}
          name="teamId"
          required
          className={fieldClassName}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.departmentName} / {t.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Planned hours (optional)" htmlFor={`alloc-hrs-${workItemId}`}>
        <input
          id={`alloc-hrs-${workItemId}`}
          name="plannedHours"
          type="number"
          min={0}
          step="0.5"
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Allocating…" : "Allocate"}
      </PrimaryButton>
    </form>
  );
}

function optionalHours(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}
