"use client";

import { useRouter } from "next/navigation";
import {
  cancelOnboardingChecklistAction,
  createOnboardingChecklistAction,
  toggleOnboardingItemAction,
} from "@/app/actions/onboarding";
import {
  FormField,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
  useActionForm,
} from "@/components/ui/forms";

export function CreateOnboardingForm({
  organizations,
  principals,
  defaultOrganizationId,
}: {
  organizations: Array<{ id: string; name: string }>;
  principals: Array<{ id: string; displayName: string | null }>;
  defaultOrganizationId: string | null;
}) {
  const router = useRouter();
  const { pending, ErrorAlert, submit } = useActionForm(
    createOnboardingChecklistAction,
    (data) => {
      const id = (data as { id?: string } | null)?.id;
      if (id) router.push(`/onboarding/${id}`);
    },
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        submit({
          organizationId: String(fd.get("organizationId") ?? ""),
          title: String(fd.get("title") ?? "") || undefined,
          employeePrincipalId: String(fd.get("employeePrincipalId") ?? ""),
          onboarderPrincipalId: String(fd.get("onboarderPrincipalId") ?? ""),
          notes: String(fd.get("notes") ?? "") || null,
        });
      }}
    >
      {ErrorAlert}
      <FormField label="Organization" htmlFor="organizationId" required>
        <select
          id="organizationId"
          name="organizationId"
          className={fieldClassName}
          defaultValue={defaultOrganizationId ?? organizations[0]?.id}
          required
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Title (optional)" htmlFor="title">
        <input
          id="title"
          name="title"
          className={fieldClassName}
          maxLength={300}
          placeholder="Onboarding — Alex"
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="New employee" htmlFor="employeePrincipalId" required>
          <select
            id="employeePrincipalId"
            name="employeePrincipalId"
            className={fieldClassName}
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select employee
            </option>
            {principals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName ?? p.id}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Onboarder" htmlFor="onboarderPrincipalId" required>
          <select
            id="onboarderPrincipalId"
            name="onboarderPrincipalId"
            className={fieldClassName}
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select onboarder
            </option>
            {principals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName ?? p.id}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField label="Notes (optional)" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className={fieldClassName}
          maxLength={4000}
        />
      </FormField>
      <PrimaryButton disabled={pending || organizations.length === 0}>
        {pending ? "Creating…" : "Start onboarding checklist"}
      </PrimaryButton>
    </form>
  );
}

export function ToggleOnboardingCheckButton({
  checklistId,
  itemId,
  expectedVersion,
  role,
  checked,
  disabled,
  label,
}: {
  checklistId: string;
  itemId: string;
  expectedVersion: number;
  role: "EMPLOYEE" | "ONBOARDER";
  checked: boolean;
  disabled?: boolean;
  label: string;
}) {
  const { pending, ErrorAlert, submit } = useActionForm(
    toggleOnboardingItemAction,
  );

  return (
    <div className="space-y-1">
      {ErrorAlert}
      <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          className="size-4"
          checked={checked}
          disabled={disabled || pending}
          onChange={(event) => {
            submit({
              checklistId,
              itemId,
              expectedVersion,
              role,
              checked: event.target.checked,
            });
          }}
        />
        <span>{label}</span>
      </label>
    </div>
  );
}

export function CancelOnboardingButton({
  checklistId,
  expectedVersion,
}: {
  checklistId: string;
  expectedVersion: number;
}) {
  const { pending, ErrorAlert, submit } = useActionForm(
    cancelOnboardingChecklistAction,
  );

  return (
    <div className="space-y-2">
      {ErrorAlert}
      <SecondaryButton
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Cancel this onboarding checklist?")) return;
          submit({ checklistId, expectedVersion, comment: null });
        }}
      >
        {pending ? "Cancelling…" : "Cancel checklist"}
      </SecondaryButton>
    </div>
  );
}
