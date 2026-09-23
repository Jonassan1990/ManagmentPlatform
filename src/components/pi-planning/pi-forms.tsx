"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPIAction,
  updatePIAction,
  transitionPIAction,
  createIterationAction,
  updateIterationAction,
  addParticipatingDepartmentAction,
  removeParticipatingDepartmentAction,
  addParticipatingTeamAction,
  removeParticipatingTeamAction,
} from "@/app/actions/pi-planning";
import {
  FormField,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
  permissionTitle,
  useActionForm,
} from "@/components/ui/forms";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";
import { dateInputValue, piStatusLabel } from "./pi-nav";

type Caps = Partial<PrincipalCapabilities>;

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

type OrgOption = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
};

export function CreatePiForm({
  organizations,
  capabilities,
  defaultOrganizationId,
}: {
  organizations: OrgOption[];
  capabilities?: Caps;
  defaultOrganizationId?: string;
}) {
  const router = useRouter();
  const form = useActionForm(createPIAction, (data) => {
    const id = (data as { id?: string })?.id;
    if (id) router.push(`/pi/${id}`);
  });
  const allowed = capabilities?.canCreatePi !== false;
  const [orgId, setOrgId] = useState(
    defaultOrganizationId ?? organizations[0]?.id ?? "",
  );
  const sections =
    organizations.find((o) => o.id === orgId)?.sections ?? [];

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          organizationId: String(fd.get("organizationId") ?? ""),
          sectionId: optionalText(fd.get("sectionId")),
          name: String(fd.get("name") ?? ""),
          description: optionalText(fd.get("description")),
          startDate: new Date(String(fd.get("startDate") ?? "")),
          endDate: new Date(String(fd.get("endDate") ?? "")),
          planningOwnerName: optionalText(fd.get("planningOwnerName")),
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Organization" htmlFor="pi-org">
        <select
          id="pi-org"
          name="organizationId"
          required
          className={fieldClassName}
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Section (optional)" htmlFor="pi-section">
        <select
          id="pi-section"
          name="sectionId"
          className={fieldClassName}
          defaultValue=""
        >
          <option value="">— None —</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Name" htmlFor="pi-name">
        <input
          id="pi-name"
          name="name"
          required
          maxLength={300}
          className={fieldClassName}
          placeholder="e.g. PI 2026.1"
        />
      </FormField>
      <FormField label="Description" htmlFor="pi-desc">
        <textarea
          id="pi-desc"
          name="description"
          rows={3}
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Start date" htmlFor="pi-start">
          <input
            id="pi-start"
            name="startDate"
            type="date"
            required
            className={fieldClassName}
          />
        </FormField>
        <FormField label="End date" htmlFor="pi-end">
          <input
            id="pi-end"
            name="endDate"
            type="date"
            required
            className={fieldClassName}
          />
        </FormField>
      </div>
      <FormField label="Planning owner" htmlFor="pi-owner">
        <input
          id="pi-owner"
          name="planningOwnerName"
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Creating…" : "Create Program Increment"}
      </PrimaryButton>
    </form>
  );
}

export function UpdatePiForm({
  pi,
  sections,
  capabilities,
}: {
  pi: {
    id: string;
    version: number;
    name: string;
    description: string | null;
    startDate: Date | string;
    endDate: Date | string;
    planningOwnerName: string | null;
    sectionId: string | null;
  };
  sections: { id: string; name: string }[];
  capabilities?: Caps;
}) {
  const form = useActionForm(updatePIAction);
  const allowed = capabilities?.canEditPi !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          piId: pi.id,
          expectedVersion: pi.version,
          name: String(fd.get("name") ?? ""),
          description: optionalText(fd.get("description")),
          startDate: new Date(String(fd.get("startDate") ?? "")),
          endDate: new Date(String(fd.get("endDate") ?? "")),
          planningOwnerName: optionalText(fd.get("planningOwnerName")),
          sectionId: optionalText(fd.get("sectionId")),
        });
      }}
    >
      <h3 className="font-medium">PI details</h3>
      {form.ErrorAlert}
      <FormField label="Name" htmlFor="upd-pi-name">
        <input
          id="upd-pi-name"
          name="name"
          required
          defaultValue={pi.name}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Description" htmlFor="upd-pi-desc">
        <textarea
          id="upd-pi-desc"
          name="description"
          rows={3}
          defaultValue={pi.description ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Start date" htmlFor="upd-pi-start">
          <input
            id="upd-pi-start"
            name="startDate"
            type="date"
            required
            defaultValue={dateInputValue(pi.startDate)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="End date" htmlFor="upd-pi-end">
          <input
            id="upd-pi-end"
            name="endDate"
            type="date"
            required
            defaultValue={dateInputValue(pi.endDate)}
            className={fieldClassName}
          />
        </FormField>
      </div>
      <FormField label="Section" htmlFor="upd-pi-section">
        <select
          id="upd-pi-section"
          name="sectionId"
          className={fieldClassName}
          defaultValue={pi.sectionId ?? ""}
        >
          <option value="">— None —</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Planning owner" htmlFor="upd-pi-owner">
        <input
          id="upd-pi-owner"
          name="planningOwnerName"
          defaultValue={pi.planningOwnerName ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Save changes"}
      </PrimaryButton>
    </form>
  );
}

const NEXT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PLANNING"],
  PLANNING: ["REVIEW"],
  REVIEW: ["PLANNING"],
  BASELINED: ["ACTIVE", "REVIEW"],
  ACTIVE: ["CLOSED"],
  CLOSED: [],
};

export function TransitionPiButtons({
  piId,
  status,
  expectedVersion,
  capabilities,
}: {
  piId: string;
  status: string;
  expectedVersion: number;
  capabilities?: Caps;
}) {
  const form = useActionForm(transitionPIAction);
  const allowed = capabilities?.canTransitionPi !== false;
  const next = NEXT_TRANSITIONS[status] ?? [];

  if (next.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Status: {piStatusLabel(status)} — no further transitions.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {form.ErrorAlert}
      <p className="text-sm text-[var(--muted)]">
        Current status: <strong>{piStatusLabel(status)}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        {next.map((toStatus) => (
          <PrimaryButton
            key={toStatus}
            type="button"
            disabled={form.pending || !allowed}
            title={permissionTitle(allowed)}
            onClick={() => {
              if (!allowed) return;
              form.submit({
                piId,
                toStatus,
                expectedVersion,
              });
            }}
          >
            Move to {piStatusLabel(toStatus)}
          </PrimaryButton>
        ))}
      </div>
      {status === "REVIEW" ? (
        <p className="text-xs text-[var(--muted)]">
          To baseline, use the Baseline page (first baseline from Review).
        </p>
      ) : null}
    </div>
  );
}

export function CreateIterationForm({
  piId,
  nextSequence,
  piStart,
  piEnd,
  capabilities,
}: {
  piId: string;
  nextSequence: number;
  piStart: Date | string;
  piEnd: Date | string;
  capabilities?: Caps;
}) {
  const form = useActionForm(createIterationAction);
  const allowed = capabilities?.canEditPi !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          piId,
          name: String(fd.get("name") ?? ""),
          sequence: Number(fd.get("sequence") ?? nextSequence),
          startDate: new Date(String(fd.get("startDate") ?? "")),
          endDate: new Date(String(fd.get("endDate") ?? "")),
        });
      }}
    >
      <h3 className="font-medium">Add iteration</h3>
      {form.ErrorAlert}
      <FormField label="Name" htmlFor="it-name">
        <input
          id="it-name"
          name="name"
          required
          className={fieldClassName}
          placeholder="Iteration 1"
        />
      </FormField>
      <FormField label="Sequence" htmlFor="it-seq">
        <input
          id="it-seq"
          name="sequence"
          type="number"
          min={1}
          required
          defaultValue={nextSequence}
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Start" htmlFor="it-start">
          <input
            id="it-start"
            name="startDate"
            type="date"
            required
            min={dateInputValue(piStart)}
            max={dateInputValue(piEnd)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="End" htmlFor="it-end">
          <input
            id="it-end"
            name="endDate"
            type="date"
            required
            min={dateInputValue(piStart)}
            max={dateInputValue(piEnd)}
            className={fieldClassName}
          />
        </FormField>
      </div>
      <PrimaryButton
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Adding…" : "Add iteration"}
      </PrimaryButton>
    </form>
  );
}

export function UpdateIterationForm({
  iteration,
  piStart,
  piEnd,
  capabilities,
}: {
  iteration: {
    id: string;
    version: number;
    name: string;
    sequence: number;
    startDate: Date | string;
    endDate: Date | string;
  };
  piStart: Date | string;
  piEnd: Date | string;
  capabilities?: Caps;
}) {
  const form = useActionForm(updateIterationAction);
  const allowed = capabilities?.canEditPi !== false;
  return (
    <form
      className="space-y-2 border-t border-[var(--line)] pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          iterationId: iteration.id,
          expectedVersion: iteration.version,
          name: String(fd.get("name") ?? ""),
          sequence: Number(fd.get("sequence") ?? iteration.sequence),
          startDate: new Date(String(fd.get("startDate") ?? "")),
          endDate: new Date(String(fd.get("endDate") ?? "")),
        });
      }}
    >
      {form.ErrorAlert}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          name="name"
          required
          defaultValue={iteration.name}
          className={fieldClassName}
          aria-label="Iteration name"
        />
        <input
          name="sequence"
          type="number"
          min={1}
          required
          defaultValue={iteration.sequence}
          className={fieldClassName}
          aria-label="Sequence"
        />
        <input
          name="startDate"
          type="date"
          required
          defaultValue={dateInputValue(iteration.startDate)}
          min={dateInputValue(piStart)}
          max={dateInputValue(piEnd)}
          className={fieldClassName}
          aria-label="Start date"
        />
        <input
          name="endDate"
          type="date"
          required
          defaultValue={dateInputValue(iteration.endDate)}
          min={dateInputValue(piStart)}
          max={dateInputValue(piEnd)}
          className={fieldClassName}
          aria-label="End date"
        />
      </div>
      <SecondaryButton
        type="submit"
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Update iteration"}
      </SecondaryButton>
    </form>
  );
}

export function AddDepartmentForm({
  piId,
  departments,
  capabilities,
}: {
  piId: string;
  departments: { id: string; name: string; sectionName: string }[];
  capabilities?: Caps;
}) {
  const form = useActionForm(addParticipatingDepartmentAction);
  const allowed = capabilities?.canEditPi !== false;
  if (departments.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        All organization departments already participate, or none exist.
      </p>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          piId,
          departmentId: String(fd.get("departmentId") ?? ""),
          planningOwnerName: optionalText(fd.get("planningOwnerName")),
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Department" htmlFor="add-dept">
        <select
          id="add-dept"
          name="departmentId"
          required
          className={fieldClassName}
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.sectionName} / {d.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Planning owner" htmlFor="add-dept-owner">
        <input
          id="add-dept-owner"
          name="planningOwnerName"
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
      >
        Add department
      </PrimaryButton>
    </form>
  );
}

export function RemoveDepartmentButton({
  piId,
  departmentId,
  capabilities,
}: {
  piId: string;
  departmentId: string;
  capabilities?: Caps;
}) {
  const form = useActionForm(removeParticipatingDepartmentAction);
  const allowed = capabilities?.canEditPi !== false;
  return (
    <>
      {form.ErrorAlert}
      <SecondaryButton
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
        onClick={() => {
          if (!allowed) return;
          form.submit({ piId, departmentId });
        }}
      >
        Remove
      </SecondaryButton>
    </>
  );
}

export function AddTeamForm({
  piId,
  teams,
  capabilities,
}: {
  piId: string;
  teams: { id: string; name: string; departmentId: string; departmentName: string }[];
  capabilities?: Caps;
}) {
  const form = useActionForm(addParticipatingTeamAction);
  const allowed = capabilities?.canEditPi !== false;
  if (teams.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No teams available to add from participating departments.
      </p>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        const teamId = String(fd.get("teamId") ?? "");
        const team = teams.find((t) => t.id === teamId);
        if (!team) return;
        form.submit({
          piId,
          teamId: team.id,
          departmentId: team.departmentId,
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Team" htmlFor="add-team">
        <select id="add-team" name="teamId" required className={fieldClassName}>
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
        Add team
      </PrimaryButton>
    </form>
  );
}

export function RemoveTeamButton({
  piId,
  teamId,
  capabilities,
}: {
  piId: string;
  teamId: string;
  capabilities?: Caps;
}) {
  const form = useActionForm(removeParticipatingTeamAction);
  const allowed = capabilities?.canEditPi !== false;
  return (
    <>
      {form.ErrorAlert}
      <SecondaryButton
        disabled={form.pending || !allowed}
        title={permissionTitle(allowed)}
        onClick={() => {
          if (!allowed) return;
          form.submit({ piId, teamId });
        }}
      >
        Remove
      </SecondaryButton>
    </>
  );
}
