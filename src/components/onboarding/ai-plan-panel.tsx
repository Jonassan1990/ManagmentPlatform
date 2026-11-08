"use client";

import { useState } from "react";
import {
  FormField,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
} from "@/components/ui/forms";
import { Alert } from "@/components/ui/alert";

export type AiOnboardingItem = {
  title: string;
  description: string;
};

export function AiOnboardingPlanPanel() {
  const [roleTitle, setRoleTitle] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AiOnboardingItem[]>([]);

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding/ai-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleTitle: roleTitle || undefined,
          departmentName: departmentName || undefined,
          notes: notes || undefined,
        }),
      });
      const data = (await response.json()) as {
        items?: AiOnboardingItem[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Generation failed");
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("Network error while calling the AI plan API");
      setItems([]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-medium text-[var(--ink)]">AI onboarding plan</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Uses the Vercel AI Gateway to draft dual-check steps (employee +
          onboarder). Review before you create the checklist.
        </p>
      </div>
      {error ? (
        <Alert tone="error" live="assertive">
          {error}
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Role title" htmlFor="ai-role">
          <input
            id="ai-role"
            className={fieldClassName}
            value={roleTitle}
            onChange={(event) => setRoleTitle(event.target.value)}
            placeholder="Software engineer"
            maxLength={200}
          />
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
      <FormField label="Notes (optional)" htmlFor="ai-notes">
        <textarea
          id="ai-notes"
          className={fieldClassName}
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          placeholder="First week on site, needs badge and laptop"
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <PrimaryButton disabled={pending} onClick={() => void generate()}>
          {pending ? "Generating…" : "Generate plan with AI"}
        </PrimaryButton>
        {items.length > 0 ? (
          <SecondaryButton
            disabled={pending}
            onClick={() => {
              void navigator.clipboard.writeText(
                items
                  .map((item, index) => `${index + 1}. ${item.title} — ${item.description}`)
                  .join("\n"),
              );
            }}
          >
            Copy plan
          </SecondaryButton>
        ) : null}
      </div>
      {items.length > 0 ? (
        <ol className="space-y-2 rounded-md border border-[var(--line)] p-3 text-sm">
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <p className="font-medium text-[var(--ink)]">
                {index + 1}. {item.title}
              </p>
              <p className="text-[var(--muted)]">{item.description}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
