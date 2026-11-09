"use client";

import { useState } from "react";
import { updateOnboardingItemsAction } from "@/app/actions/onboarding";
import {
  OnboardingStepsEditor,
  type EditableOnboardingStep,
} from "@/components/onboarding/onboarding-steps-editor";
import { Alert } from "@/components/ui/alert";
import { PrimaryButton, useActionForm } from "@/components/ui/forms";

export function EditOnboardingItems({
  checklistId,
  expectedVersion,
  items,
}: {
  checklistId: string;
  expectedVersion: number;
  items: Array<{ id: string; title: string; description: string | null }>;
}) {
  const [draft, setDraft] = useState<EditableOnboardingStep[]>(() =>
    items.map((item) => ({
      key: item.id,
      id: item.id,
      title: item.title,
      description: item.description ?? "",
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const { pending, ErrorAlert, submit } = useActionForm(
    updateOnboardingItemsAction,
  );

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-[var(--ink)]">Edit steps</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Change the draft while onboarding is in progress. Checks already
          made on a step stay when you keep that step.
        </p>
      </div>
      {error ? (
        <Alert tone="error" live="assertive">
          {error}
        </Alert>
      ) : null}
      {ErrorAlert}
      <OnboardingStepsEditor items={draft} onChange={setDraft} disabled={pending} />
      <PrimaryButton
        type="button"
        disabled={pending}
        onClick={() => {
          const ready = draft.filter((item) => item.title.trim());
          if (ready.length === 0) {
            setError("Add at least one step with a title.");
            return;
          }
          setError(null);
          submit({
            checklistId,
            expectedVersion,
            items: ready.map((item) => ({
              id: item.id,
              title: item.title.trim(),
              description: item.description.trim() || null,
            })),
          });
        }}
      >
        {pending ? "Saving…" : "Save step edits"}
      </PrimaryButton>
    </div>
  );
}
