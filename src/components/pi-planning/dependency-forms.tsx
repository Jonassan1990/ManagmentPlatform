"use client";

import { useState } from "react";
import {
  createDependencyAction,
  updateDependencyAction,
} from "@/app/actions/pi-planning";
import { humanize } from "@/components/governance/governance-panels";
import {
  FormField,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
  permissionTitle,
  useActionForm,
} from "@/components/ui/forms";
import { Panel } from "@/components/ui/page";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import { dateInputValue } from "./pi-nav";

type Caps = Partial<PrincipalCapabilities>;

type DependencyRow = {
  id: string;
  version: number;
  type: string;
  status: string;
  criticality: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  ownerName: string | null;
  neededByDate: Date | string | null;
  description: string | null;
};

type ConflictHint = {
  type: string;
  severity: string;
  message: string;
  subjectId: string;
  relatedIds?: string[];
};

export function DependencyPanels({
  piId,
  organizationId,
  dependencies,
  conflicts,
  workItemOptions,
  projectOptions,
  capabilities,
}: {
  piId: string;
  organizationId: string;
  dependencies: DependencyRow[];
  conflicts: ConflictHint[];
  workItemOptions: { id: string; label: string }[];
  projectOptions: { id: string; label: string }[];
  capabilities?: Caps;
}) {
  const timingConflictIds = new Set(
    conflicts
      .filter((c) => c.type === "DEPENDENCY_TIMING")
      .flatMap((c) => [c.subjectId, ...(c.relatedIds ?? [])]),
  );

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="font-medium">Create dependency</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          MVP supports Work item → Work item or Project → Project links.
        </p>
        <div className="mt-4">
          <CreateDependencyForm
            piId={piId}
            organizationId={organizationId}
            workItemOptions={workItemOptions}
            projectOptions={projectOptions}
            capabilities={capabilities}
          />
        </div>
      </Panel>

      <Panel>
        <h2 className="font-medium">Dependencies</h2>
        {dependencies.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No planning dependencies recorded for this organization yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {dependencies.map((dep) => {
              const hasTiming =
                timingConflictIds.has(dep.id) ||
                timingConflictIds.has(dep.sourceId) ||
                timingConflictIds.has(dep.targetId);
              return (
                <li key={dep.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {humanize(dep.type)} · {humanize(dep.criticality)}
                        {hasTiming ? (
                          <span className="ml-2 rounded bg-[var(--warning)]/15 px-1.5 py-0.5 text-xs text-[var(--warning)]">
                            Timing conflict
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {dep.sourceType}:{dep.sourceId.slice(0, 8)}… →{" "}
                        {dep.targetType}:{dep.targetId.slice(0, 8)}…
                      </p>
                      {dep.description ? (
                        <p className="mt-1 text-sm">{dep.description}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Status: {humanize(dep.status)}
                        {dep.ownerName ? ` · Owner: ${dep.ownerName}` : ""}
                        {dep.neededByDate
                          ? ` · Needed by: ${dateInputValue(dep.neededByDate)}`
                          : ""}
                      </p>
                    </div>
                    <UpdateDependencyForm
                      piId={piId}
                      dependency={dep}
                      capabilities={capabilities}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function CreateDependencyForm({
  piId,
  organizationId,
  workItemOptions,
  projectOptions,
  capabilities,
}: {
  piId: string;
  organizationId: string;
  workItemOptions: { id: string; label: string }[];
  projectOptions: { id: string; label: string }[];
  capabilities?: Caps;
}) {
  const form = useActionForm(createDependencyAction);
  const allowed = capabilities?.canManagePiDependency !== false;
  const [subjectKind, setSubjectKind] = useState<"WORK_ITEM" | "PROJECT">(
    "WORK_ITEM",
  );
  const options =
    subjectKind === "WORK_ITEM" ? workItemOptions : projectOptions;

  return (
    <form
      className="grid max-w-3xl gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        const kind = String(fd.get("subjectKind") ?? "WORK_ITEM") as
          | "WORK_ITEM"
          | "PROJECT";
        form.submit({
          piId,
          organizationId,
          type: String(fd.get("type") ?? "BLOCKS"),
          criticality: String(fd.get("criticality") ?? "MEDIUM"),
          sourceType: kind,
          sourceId: String(fd.get("sourceId") ?? ""),
          targetType: kind,
          targetId: String(fd.get("targetId") ?? ""),
          ownerName: optionalText(fd.get("ownerName")),
          neededByDate: optionalDate(fd.get("neededByDate")),
          description: optionalText(fd.get("description")),
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Subject kind" htmlFor="dep-kind">
        <select
          id="dep-kind"
          name="subjectKind"
          className={fieldClassName}
          value={subjectKind}
          onChange={(e) =>
            setSubjectKind(e.target.value as "WORK_ITEM" | "PROJECT")
          }
        >
          <option value="WORK_ITEM">Work items</option>
          <option value="PROJECT">Projects</option>
        </select>
      </FormField>
      <FormField label="Type" htmlFor="dep-type">
        <select id="dep-type" name="type" className={fieldClassName}>
          <option value="BLOCKS">Blocks</option>
          <option value="DEPENDS_ON">Depends on</option>
          <option value="RELATED">Related</option>
        </select>
      </FormField>
      <FormField label="Source" htmlFor="dep-source">
        <select
          id="dep-source"
          name="sourceId"
          required
          className={fieldClassName}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Target" htmlFor="dep-target">
        <select
          id="dep-target"
          name="targetId"
          required
          className={fieldClassName}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Criticality" htmlFor="dep-crit">
        <select id="dep-crit" name="criticality" className={fieldClassName}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </FormField>
      <FormField label="Needed by" htmlFor="dep-needed">
        <input
          id="dep-needed"
          name="neededByDate"
          type="date"
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Owner" htmlFor="dep-owner">
        <input id="dep-owner" name="ownerName" className={fieldClassName} />
      </FormField>
      <div className="sm:col-span-2">
        <FormField label="Description" htmlFor="dep-desc">
          <textarea
            id="dep-desc"
            name="description"
            rows={2}
            className={fieldClassName}
          />
        </FormField>
      </div>
      <PrimaryButton
        disabled={form.pending || !allowed || options.length < 2}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Creating…" : "Create dependency"}
      </PrimaryButton>
    </form>
  );
}

function UpdateDependencyForm({
  piId,
  dependency,
  capabilities,
}: {
  piId: string;
  dependency: DependencyRow;
  capabilities?: Caps;
}) {
  const form = useActionForm(updateDependencyAction);
  const allowed = capabilities?.canManagePiDependency !== false;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          piId,
          dependencyId: dependency.id,
          expectedVersion: dependency.version,
          status: String(fd.get("status") ?? dependency.status),
          criticality: String(fd.get("criticality") ?? dependency.criticality),
          ownerName: dependency.ownerName,
          neededByDate: dependency.neededByDate
            ? new Date(dependency.neededByDate)
            : null,
          description: dependency.description,
        });
      }}
    >
      {form.ErrorAlert}
      <select
        name="status"
        defaultValue={dependency.status}
        className={fieldClassName}
        aria-label="Status"
      >
        <option value="OPEN">Open</option>
        <option value="RESOLVED">Resolved</option>
        <option value="ACCEPTED">Accepted</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <select
        name="criticality"
        defaultValue={dependency.criticality}
        className={fieldClassName}
        aria-label="Criticality"
      >
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
      <SecondaryButton
        type="submit"
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
      >
        Update
      </SecondaryButton>
    </form>
  );
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  return text ? new Date(text) : null;
}
