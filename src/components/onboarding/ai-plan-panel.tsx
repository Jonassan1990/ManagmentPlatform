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
import {
  INFB_NEW_HIRE_ITEMS,
  PHASE_LABEL,
  ONBOARDING_PHASES,
} from "@/modules/onboarding/application/infb-new-hire-template";
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
  const [plan, setPlan] = useState<"infb" | "role">("infb");
  const [roleKey, setRoleKey] = useState(ONBOARDING_ROLE_TEMPLATES[0]?.key ?? "developer");
  const [departmentName, setDepartmentName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [hiringManagerName, setHiringManagerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<EditableOnboardingStep[]>(() =>
    stepsFromTemplate(ONBOARDING_ROLE_TEMPLATES[0]?.key ?? "developer"),
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
    if (plan === "role" && ready.length === 0) {
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
      jobTitle: jobTitle || null,
      departmentLabel: departmentName || null,
      hiringManagerName: hiringManagerName || null,
      startDate: startDate || null,
      roleTemplate: plan === "infb" ? "infb-new-hire" : roleKey,
      ...(plan === "infb"
        ? {}
        : {
            items: ready.map((item) => ({
              title: item.title.trim(),
              description: item.description.trim() || null,
            })),
          }),
    });
  }

  return (
    <form className="space-y-4" onSubmit={createChecklist}>
      <div>
        <h2 className="font-medium text-[var(--ink)]">Choose a checklist</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          The INFB new hire checklist follows preboarding, the first week, the
          first 30 days, and feedback. A role from the catalog can still be
          drafted and edited.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={plan === "infb"}
          className={planButtonClass(plan === "infb")}
          onClick={() => setPlan("infb")}
        >
          INFB new hire
        </button>
        <button
          type="button"
          aria-pressed={plan === "role"}
          className={planButtonClass(plan === "role")}
          onClick={() => setPlan("role")}
        >
          Role catalog
        </button>
      </div>
      {error ? (
        <Alert tone="error" live="assertive">
          {error}
        </Alert>
      ) : null}
      {ErrorAlert}
      {plan === "infb" ? (
        <div className="space-y-3">
          <ul className="grid gap-2 sm:grid-cols-2">
            {ONBOARDING_PHASES.map((phase) => {
              const count = INFB_NEW_HIRE_ITEMS.filter(
                (item) => item.phase === phase,
              ).length;
              return (
                <li
                  key={phase}
                  className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-[var(--ink)]">
                    {PHASE_LABEL[phase]}
                  </span>
                  <span className="text-[var(--muted)]"> · {count} steps</span>
                </li>
              );
            })}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Job title" htmlFor="job-title">
              <input
                id="job-title"
                className={fieldClassName}
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                maxLength={200}
                placeholder="Senior Developer"
              />
            </FormField>
            <FormField label="Department / team" htmlFor="infb-department">
              <input
                id="infb-department"
                className={fieldClassName}
                value={departmentName}
                onChange={(event) => setDepartmentName(event.target.value)}
                maxLength={200}
                placeholder="INFB"
              />
            </FormField>
            <FormField label="Hiring manager" htmlFor="hiring-manager">
              <input
                id="hiring-manager"
                className={fieldClassName}
                value={hiringManagerName}
                onChange={(event) => setHiringManagerName(event.target.value)}
                maxLength={200}
                placeholder="Name"
              />
            </FormField>
            <FormField label="Start date" htmlFor="start-date">
              <input
                id="start-date"
                type="date"
                className={fieldClassName}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </FormField>
          </div>
        </div>
      ) : (
      <>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Role" htmlFor="onboarding-role">
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
      </>
      )}
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
        {pending ? "Creating…" : plan === "infb" ? "Create INFB checklist" : "Create checklist from draft"}
      </PrimaryButton>
    </form>
  );
}

function planButtonClass(selected: boolean): string {
  return `min-h-11 rounded-full px-4 text-sm font-semibold ${
    selected
      ? "bg-[var(--scania-blue-800,#041e42)] text-white"
      : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)]"
  }`;
}
