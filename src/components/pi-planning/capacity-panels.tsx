"use client";

import { setResourceAvailabilityAction } from "@/app/actions/pi-planning";
import {
  FormField,
  PrimaryButton,
  fieldClassName,
  permissionTitle,
  useActionForm,
} from "@/components/ui/forms";
import { CapacityBar } from "@/components/ui/capacity-bar";
import { Panel } from "@/components/ui/page";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import { formatHours } from "./pi-nav";

type Caps = Partial<PrincipalCapabilities>;

type TeamCap = {
  teamId: string;
  teamName: string;
  departmentId: string;
  iterationId: string;
  effectiveCapacityHours: number;
  plannedLoadHours: number;
  utilization: number | null;
  band: string;
};

type ResourceCap = {
  resourceId: string;
  resourceName: string;
  teamId: string;
  iterationId: string;
  allocationPercent: number;
  effectiveCapacityHours: number;
  plannedLoadHours: number;
  utilization: number | null;
  band: string;
};

export function CapacityPanels({
  piId,
  iterations,
  teams,
  resources,
  resourceOptions,
  capabilities,
}: {
  piId: string;
  iterations: { id: string; name: string; sequence: number }[];
  teams: TeamCap[];
  resources: ResourceCap[];
  resourceOptions: { id: string; name: string }[];
  capabilities?: Caps;
}) {
  const iterationName = (id: string) =>
    iterations.find((i) => i.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="font-medium">Team capacity by iteration</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Utilization is planned load ÷ effective capacity (hours). Overload means
          planned work exceeds capacity.
        </p>
        {teams.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No team capacity yet — add participating teams and resource memberships.
          </p>
        ) : (
          <div
            className="mt-4 overflow-x-auto"
            role="region"
            tabIndex={0}
            aria-label="Team capacity by iteration"
          >
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">
                Team capacity, load, and utilization by iteration
              </caption>
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Team
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Iteration
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Capacity
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Load
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Utilization
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {teams.map((row) => (
                  <tr key={`${row.teamId}-${row.iterationId}`}>
                    <td className="py-3 pr-3">{row.teamName}</td>
                    <td className="py-3 pr-3 text-[var(--muted)]">
                      {iterationName(row.iterationId)}
                    </td>
                    <td className="py-3 pr-3">
                      {formatHours(row.effectiveCapacityHours)}
                    </td>
                    <td className="py-3 pr-3">
                      {formatHours(row.plannedLoadHours)}
                    </td>
                    <td className="py-3 min-w-[12rem]">
                      <CapacityBar
                        available={row.effectiveCapacityHours}
                        committed={row.plannedLoadHours}
                        unavailable={row.band === "none"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <h2 className="font-medium">Resource capacity by iteration</h2>
        {resources.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No resource capacity rows — ensure resources have team memberships and
            weekly capacity hours.
          </p>
        ) : (
          <div
            className="mt-4 overflow-x-auto"
            role="region"
            tabIndex={0}
            aria-label="Resource capacity by iteration"
          >
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">
                Resource capacity, load, and utilization by iteration
              </caption>
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Resource
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Iteration
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Alloc %
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Capacity
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Load
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Utilization
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {resources.map((row) => (
                  <tr key={`${row.resourceId}-${row.iterationId}-${row.teamId}`}>
                    <td className="py-3 pr-3">{row.resourceName}</td>
                    <td className="py-3 pr-3 text-[var(--muted)]">
                      {iterationName(row.iterationId)}
                    </td>
                    <td className="py-3 pr-3">{row.allocationPercent}%</td>
                    <td className="py-3 pr-3">
                      {formatHours(row.effectiveCapacityHours)}
                    </td>
                    <td className="py-3 pr-3">
                      {formatHours(row.plannedLoadHours)}
                    </td>
                    <td className="py-3 min-w-[12rem]">
                      <CapacityBar
                        available={row.effectiveCapacityHours}
                        committed={row.plannedLoadHours}
                        unavailable={row.band === "none"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <h2 className="font-medium">Set resource availability</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Override available hours or apply a reduction for leave / unavailability
          in an iteration.
        </p>
        <div className="mt-4">
          <SetAvailabilityForm
            piId={piId}
            iterations={iterations}
            resources={resourceOptions}
            capabilities={capabilities}
          />
        </div>
      </Panel>
    </div>
  );
}

function SetAvailabilityForm({
  piId,
  iterations,
  resources,
  capabilities,
}: {
  piId: string;
  iterations: { id: string; name: string; sequence: number }[];
  resources: { id: string; name: string }[];
  capabilities?: Caps;
}) {
  const form = useActionForm(setResourceAvailabilityAction);
  const allowed = capabilities?.canManagePiCapacity !== false;

  if (iterations.length === 0 || resources.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Need at least one iteration and one resource to set availability.
      </p>
    );
  }

  return (
    <form
      className="grid max-w-2xl gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          piId,
          resourceId: String(fd.get("resourceId") ?? ""),
          iterationId: String(fd.get("iterationId") ?? ""),
          availableHours: optionalNum(fd.get("availableHours")),
          reductionHours: optionalNum(fd.get("reductionHours")),
          notes: optionalText(fd.get("notes")),
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Resource" htmlFor="avail-res">
        <select
          id="avail-res"
          name="resourceId"
          required
          className={fieldClassName}
        >
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Iteration" htmlFor="avail-it">
        <select
          id="avail-it"
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
      <FormField label="Available hours override" htmlFor="avail-hrs">
        <input
          id="avail-hrs"
          name="availableHours"
          type="number"
          min={0}
          step="0.5"
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Reduction hours" htmlFor="avail-red">
        <input
          id="avail-red"
          name="reductionHours"
          type="number"
          min={0}
          step="0.5"
          className={fieldClassName}
        />
      </FormField>
      <div className="sm:col-span-2">
        <FormField label="Notes" htmlFor="avail-notes">
          <input id="avail-notes" name="notes" className={fieldClassName} />
        </FormField>
      </div>
      <PrimaryButton
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Save availability"}
      </PrimaryButton>
    </form>
  );
}

function optionalNum(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}
