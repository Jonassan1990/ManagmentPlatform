"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createOnboardingChecklistAction } from "@/app/actions/onboarding";
import {
  OnboardingStepsEditor,
  type EditableOnboardingStep,
} from "@/components/onboarding/onboarding-steps-editor";
import { Alert } from "@/components/ui/alert";
import {
  FormField,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
  useActionForm,
} from "@/components/ui/forms";
import { ONBOARDING_ROLE_TEMPLATES } from "@/modules/onboarding/application/role-templates";

function stepsFromTemplate(roleKey: string): EditableOnboardingStep[] {
  const template =
    ONBOARDING_ROLE_TEMPLATES.find((item) => item.key === roleKey) ??
    ONBOARDING_ROLE_TEMPLATES[0];
  return (template?.items ?? []).map((item, index) => ({
    key: `${template?.key}-${index}`,
    title: item.title,
    description: item.description,
  }));
}

export function OnboardingDraftPanel({
  organizations,
  principals,
  defaultOrganizationId,
}: {
  organizations: Array<{ id: string; name: string }>;
  principals: Array<{ id: string; displayName: string | null }>;
  defaultOrganizationId: string | null;
}) {
  const router = useRouter();
  const [roleKey, setRoleKey] = useState(ONBOARDING_ROLE_TEMPLATES[0]?.key ?? "engineer");
  const [departmentName, setDepartmentName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<EditableOnboardingStep[]>(() =>
    stepsFromTemplate(ONBOARDING_ROLE_TEMPLATES[0]?.key ?? "engineer"),
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const template = useMemo(
    () => ONBOARDING_ROLE_TEMPLATES.find((item) => item.key === roleKey),
    [roleKey],
  );
  const { pending, ErrorAlert, submit } = useActionForm(
    createOnboardingChecklistAction,
    (data) => {
      const id = (data as { id?: string } | null)?.id;
      if (id) router.push(`/onboarding/${id}`);
    },
  );

  function selectRole(nextKey: string) {
    setRoleKey(nextKey);
    setItems(stepsFromTemplate(nextKey));
    setError(null);
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleKey,
          roleTitle: template?.label,
          departmentName: departmentName || undefined,
          notes: notes || undefined,
        }),
      });
      const data = (await response.json()) as {
        items?: Array<{ title: string; description: string }>;
        error?: string;
      };
      if (!response.ok || !data.items?.length) {
        setError(data.error ?? "Could not draft the plan. The role template is still editable.");
        return;
      }
      setItems(
        data.items.map((item, index) => ({
          key: `${roleKey}-ai-${index}`,
          title: item.title,
          description: item.description,
        })),
      );
    } catch {
      setError("Network error while calling the AI plan API. The role template is still editable.");
    } finally {
      setGenerating(false);
    }
  }

  function createChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const ready = items.filter((item) => item.title.trim());
    if (ready.length === 0) {
      setError("Add at least one step with a title.");
      return;
    }
    setError(null);
    submit({
      organizationId: String(fd.get("organizationId") ?? ""),
      title: String(fd.get("title") ?? "") || undefined,
      employeePrincipalId: String(fd.get("employeePrincipalId") ?? ""),
      onboarderPrincipalId: String(fd.get("onboarderPrincipalId") ?? ""),
      notes: notes || null,
      roleTemplate: roleKey,
      items: ready.map((item) => ({
        title: item.title.trim(),
        description: item.description.trim() || null,
      })),
    });
  }

  return (
    <form className="space-y-4" onSubmit={createChecklist}>
      <div>
        <h2 className="font-medium text-[var(--ink)]">Role template and draft</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pick a role. AI drafts the steps for that template. Edit the draft,
          then create the checklist. Employee and onboarder still both check
          every step.
        </p>
        {template ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{template.summary}</p>
        ) : null}
      </div>
      {error ? (
        <Alert tone="error" live="assertive">
          {error}
        </Alert>
      ) : null}
      {ErrorAlert}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Role template" htmlFor="onboarding-role">
          <select
            id="onboarding-role"
            className={fieldClassName}
            value={roleKey}
            onChange={(event) => selectRole(event.target.value)}
          >
            {ONBOARDING_ROLE_TEMPLATES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Department" htmlFor="ai-department">
          <input
            id="ai-department"
            className={fieldClassName}
            value={departmentName}
            onChange={(event) => setDepartmentName(event.target.value)}
            placeholder="INFB"
            maxLength={200}
          />
        </FormField>
      </div>
      <FormField label="Notes for the AI draft (optional)" htmlFor="ai-notes">
        <textarea
          id="ai-notes"
          className={fieldClassName}
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          placeholder="Focus area is plant maintenance apps. Starts next Monday."
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <SecondaryButton
          disabled={generating || pending}
          onClick={() => {
            void generate();
          }}
        >
          {generating ? "Drafting…" : "Draft with AI"}
        </SecondaryButton>
        <SecondaryButton
          disabled={generating || pending}
          onClick={() => selectRole(roleKey)}
        >
          Reset to template
        </SecondaryButton>
      </div>
      <OnboardingStepsEditor
        items={items}
        onChange={setItems}
        disabled={generating || pending}
      />
      <div className="grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
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
            placeholder={
              template ? `Onboarding — ${template.label}` : "Onboarding"
            }
          />
        </FormField>
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
            {principals.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName ?? person.id}
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
            {principals.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName ?? person.id}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <PrimaryButton
        disabled={pending || generating || organizations.length === 0}
      >
        {pending ? "Creating…" : "Create checklist from draft"}
      </PrimaryButton>
    </form>
  );
}
