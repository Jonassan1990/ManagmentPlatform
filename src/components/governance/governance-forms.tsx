"use client";

import { useState } from "react";
import {
  createPoCAction,
  recordApprovalAction,
  recordDecisionAction,
  resolveDecisionConditionAction,
  reviseGovernanceSubmissionAction,
  submitPoCForGovernanceAction,
  submitPreStudyForGovernanceAction,
  transitionPoCAction,
  updateCriterionEvaluationAction,
  updatePoCAction,
  updatePoCResultsAction,
  upsertPoCCriterionAction,
} from "@/app/actions/governance";
import {
  FormField,
  PrimaryButton,
  SecondaryButton,
  fieldClassName,
  permissionTitle,
  useActionForm,
} from "@/components/ui/forms";
import { POC_STATUS_ORDER } from "@/modules/governance/application/poc-readiness-policy";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";

type Caps = Partial<PrincipalCapabilities>;

export type DecisionOutcomeOption = {
  value: string;
  label: string;
};

export const PRE_STUDY_POC_OUTCOMES: DecisionOutcomeOption[] = [
  { value: "GO", label: "Go" },
  { value: "CONDITIONAL_GO", label: "Conditional go" },
  { value: "NO_GO", label: "No-go" },
  { value: "HOLD", label: "Hold" },
];

export const PILOT_GATE_OUTCOMES: DecisionOutcomeOption[] = [
  { value: "SCALE", label: "Scale" },
  { value: "EXTEND_PILOT", label: "Extend pilot" },
  { value: "CONDITIONAL_SCALE", label: "Conditional scale" },
  { value: "STOP", label: "Stop" },
  { value: "HOLD", label: "Hold" },
];

export function outcomesForGateType(
  gateType: string | null | undefined,
): DecisionOutcomeOption[] {
  return gateType === "PILOT_GATE" ? PILOT_GATE_OUTCOMES : PRE_STUDY_POC_OUTCOMES;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  return text ? new Date(text) : null;
}

function dateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function SubmitPreStudyButton({
  initiativeId,
  expectedInitiativeVersion,
  disabled,
  capabilities,
}: {
  initiativeId: string;
  expectedInitiativeVersion?: number;
  disabled?: boolean;
  capabilities?: Caps;
}) {
  const form = useActionForm(submitPreStudyForGovernanceAction);
  const allowed = capabilities?.canSubmitGovernance !== false;
  return (
    <div className="space-y-2">
      {form.ErrorAlert}
      <p className="text-sm text-[var(--muted)]">
        Submits a frozen evidence package for authority review. This is not a
        decision.
      </p>
      <PrimaryButton
        type="button"
        disabled={disabled || !allowed || form.pending}
        title={permissionTitle(allowed)}
        onClick={() =>
          form.submit({
            initiativeId,
            expectedInitiativeVersion,
            notes: null,
          })
        }
      >
        {form.pending ? "Submitting…" : "Submit pre-study for governance"}
      </PrimaryButton>
    </div>
  );
}

export function SubmitPoCButton({
  initiativeId,
  disabled,
  capabilities,
}: {
  initiativeId: string;
  disabled?: boolean;
  capabilities?: Caps;
}) {
  const form = useActionForm(submitPoCForGovernanceAction);
  const allowed = capabilities?.canSubmitGovernance !== false;
  return (
    <div className="space-y-2">
      {form.ErrorAlert}
      <p className="text-sm text-[var(--muted)]">
        Submits PoC results and evaluations for authority review before a
        decision.
      </p>
      <PrimaryButton
        type="button"
        disabled={disabled || !allowed || form.pending}
        title={permissionTitle(allowed)}
        onClick={() => form.submit({ initiativeId, notes: null })}
      >
        {form.pending ? "Submitting…" : "Submit PoC for governance"}
      </PrimaryButton>
    </div>
  );
}

export function ReviseSubmissionButton({
  previousSubmissionId,
  initiativeId,
  capabilities,
}: {
  previousSubmissionId: string;
  initiativeId: string;
  capabilities?: Caps;
}) {
  const form = useActionForm(reviseGovernanceSubmissionAction);
  const allowed = capabilities?.canSubmitGovernance !== false;
  return (
    <div className="space-y-2">
      {form.ErrorAlert}
      <p className="text-sm text-[var(--muted)]">
        Creates a new revision with updated evidence after changes were
        requested.
      </p>
      <PrimaryButton
        type="button"
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
        onClick={() =>
          form.submit({
            previousSubmissionId,
            notes: null,
            initiativeId,
          })
        }
      >
        {form.pending ? "Revising…" : "Revise and resubmit"}
      </PrimaryButton>
    </div>
  );
}

export function ApprovalDecisionForm({
  approvalRequestId,
  expectedVersion,
  initiativeId,
  label,
  capabilities,
}: {
  approvalRequestId: string;
  expectedVersion: number;
  initiativeId: string;
  label?: string;
  capabilities?: Caps;
}) {
  const form = useActionForm(recordApprovalAction);
  const allowed = capabilities?.canReviewApprovals !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          approvalRequestId,
          expectedVersion,
          initiativeId,
          outcome: String(fd.get("outcome") ?? "APPROVED"),
          comment: optionalText(fd.get("comment")),
          conditionsText: optionalText(fd.get("conditionsText")),
        });
      }}
    >
      <h3 className="font-medium">
        {label ? `Review: ${label}` : "Record approval"}
      </h3>
      <p className="text-xs text-[var(--muted)]">
        Your outcome is permanent for this request. Re-review requires a new
        submission revision.
      </p>
      {form.ErrorAlert}
      <FormField label="Outcome" htmlFor={`outcome-${approvalRequestId}`}>
        <select
          id={`outcome-${approvalRequestId}`}
          name="outcome"
          required
          className={fieldClassName}
          defaultValue="APPROVED"
          disabled={!allowed}
        >
          <option value="APPROVED">Approve</option>
          <option value="REJECTED">Reject</option>
          <option value="CHANGES_REQUESTED">Request changes</option>
        </select>
      </FormField>
      <FormField label="Comment" htmlFor={`comment-${approvalRequestId}`}>
        <textarea
          id={`comment-${approvalRequestId}`}
          name="comment"
          rows={2}
          className={fieldClassName}
          placeholder="What did you review, and why this outcome?"
          disabled={!allowed}
        />
      </FormField>
      <FormField
        label="Conditions / notes (optional)"
        htmlFor={`conditions-${approvalRequestId}`}
      >
        <textarea
          id={`conditions-${approvalRequestId}`}
          name="conditionsText"
          rows={2}
          className={fieldClassName}
          disabled={!allowed}
        />
      </FormField>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Recording…" : "Record approval"}
      </PrimaryButton>
    </form>
  );
}

type ConditionDraft = {
  key: string;
  description: string;
  ownerName: string;
  dueDate: string;
  requiredBeforeProgression: boolean;
};

export function RecordDecisionForm({
  submissionId,
  expectedPackageVersion,
  question,
  recommendationText,
  allowedOutcomes,
  capabilities,
}: {
  submissionId: string;
  expectedPackageVersion: number;
  question?: string | null;
  recommendationText?: string | null;
  /** Outcomes permitted for this gate. Defaults to pre-study / PoC outcomes. */
  allowedOutcomes?: DecisionOutcomeOption[];
  capabilities?: Caps;
}) {
  const outcomes = allowedOutcomes?.length
    ? allowedOutcomes
    : PRE_STUDY_POC_OUTCOMES;
  const form = useActionForm(recordDecisionAction);
  const allowed = capabilities?.canMakeDecisions !== false;
  const [outcome, setOutcome] = useState(outcomes[0]?.value ?? "GO");
  const [conditions, setConditions] = useState<ConditionDraft[]>([]);
  const needsConditions =
    outcome === "CONDITIONAL_GO" || outcome === "CONDITIONAL_SCALE";
  const needsExtension = outcome === "EXTEND_PILOT";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          submissionId,
          expectedPackageVersion,
          outcome,
          rationale: String(fd.get("rationale") ?? ""),
          recommendationText: optionalText(fd.get("recommendationText")),
          conditions: needsConditions
            ? conditions
                .filter((c) => c.description.trim())
                .map((c) => ({
                  description: c.description.trim(),
                  ownerName: c.ownerName.trim() || null,
                  dueDate: c.dueDate ? new Date(c.dueDate) : null,
                  requiredBeforeProgression: c.requiredBeforeProgression,
                }))
            : [],
          extension: needsExtension
            ? {
                newPlannedEnd: new Date(String(fd.get("newPlannedEnd") ?? "")),
                reason: String(fd.get("extensionReason") ?? ""),
              }
            : undefined,
        });
      }}
    >
      <h3 className="font-medium">Record decision</h3>
      {question ? (
        <p className="text-sm text-[var(--muted)]">Question: {question}</p>
      ) : null}
      <p className="text-xs text-[var(--muted)]">
        Recommendation text is informational only — the outcome you select is the
        recorded decision.
      </p>
      {form.ErrorAlert}
      <FormField label="Outcome" htmlFor="decision-outcome">
        <select
          id="decision-outcome"
          name="outcome"
          className={fieldClassName}
          value={outcome}
          disabled={!allowed}
          onChange={(e) => setOutcome(e.target.value)}
        >
          {outcomes.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Rationale" htmlFor="decision-rationale">
        <textarea
          id="decision-rationale"
          name="rationale"
          required
          rows={3}
          className={fieldClassName}
          placeholder="Why this outcome? What evidence mattered?"
          disabled={!allowed}
        />
      </FormField>
      <FormField
        label="Recommendation note (optional)"
        htmlFor="decision-recommendation"
        hint="Does not auto-set the outcome."
      >
        <textarea
          id="decision-recommendation"
          name="recommendationText"
          rows={2}
          defaultValue={recommendationText ?? ""}
          className={fieldClassName}
          disabled={!allowed}
        />
      </FormField>

      {needsExtension ? (
        <div className="space-y-3 rounded-md border border-[var(--line)] p-3">
          <h4 className="text-sm font-medium">Pilot extension</h4>
          <FormField label="New planned end" htmlFor="extension-end">
            <input
              id="extension-end"
              name="newPlannedEnd"
              type="date"
              required
              className={fieldClassName}
              disabled={!allowed}
            />
          </FormField>
          <FormField label="Reason" htmlFor="extension-reason">
            <textarea
              id="extension-reason"
              name="extensionReason"
              required
              rows={2}
              className={fieldClassName}
              disabled={!allowed}
            />
          </FormField>
        </div>
      ) : null}

      {needsConditions ? (
        <div className="space-y-3 rounded-md border border-[var(--line)] p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium">Conditions</h4>
            <SecondaryButton
              type="button"
              disabled={!allowed}
              title={permissionTitle(allowed)}
              onClick={() =>
                setConditions((prev) => [
                  ...prev,
                  {
                    key: `c-${prev.length + 1}-${Date.now()}`,
                    description: "",
                    ownerName: "",
                    dueDate: "",
                    requiredBeforeProgression: true,
                  },
                ])
              }
            >
              Add condition
            </SecondaryButton>
          </div>
          {conditions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Conditional outcomes require at least one condition that must be
              tracked.
            </p>
          ) : (
            conditions.map((condition, index) => (
              <div
                key={condition.key}
                className="space-y-2 border-t border-[var(--line)] pt-3"
              >
                <FormField
                  label={`Condition ${index + 1}`}
                  htmlFor={`${condition.key}-desc`}
                >
                  <textarea
                    id={`${condition.key}-desc`}
                    required
                    rows={2}
                    className={fieldClassName}
                    value={condition.description}
                    disabled={!allowed}
                    onChange={(e) =>
                      setConditions((prev) =>
                        prev.map((c) =>
                          c.key === condition.key
                            ? { ...c, description: e.target.value }
                            : c,
                        ),
                      )
                    }
                  />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Owner" htmlFor={`${condition.key}-owner`}>
                    <input
                      id={`${condition.key}-owner`}
                      className={fieldClassName}
                      value={condition.ownerName}
                      disabled={!allowed}
                      onChange={(e) =>
                        setConditions((prev) =>
                          prev.map((c) =>
                            c.key === condition.key
                              ? { ...c, ownerName: e.target.value }
                              : c,
                          ),
                        )
                      }
                    />
                  </FormField>
                  <FormField label="Due date" htmlFor={`${condition.key}-due`}>
                    <input
                      id={`${condition.key}-due`}
                      type="date"
                      className={fieldClassName}
                      value={condition.dueDate}
                      disabled={!allowed}
                      onChange={(e) =>
                        setConditions((prev) =>
                          prev.map((c) =>
                            c.key === condition.key
                              ? { ...c, dueDate: e.target.value }
                              : c,
                          ),
                        )
                      }
                    />
                  </FormField>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={condition.requiredBeforeProgression}
                    disabled={!allowed}
                    onChange={(e) =>
                      setConditions((prev) =>
                        prev.map((c) =>
                          c.key === condition.key
                            ? {
                                ...c,
                                requiredBeforeProgression: e.target.checked,
                              }
                            : c,
                        ),
                      )
                    }
                  />
                  Blocks progression until resolved
                </label>
              </div>
            ))
          )}
        </div>
      ) : null}

      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Recording…" : "Record decision"}
      </PrimaryButton>
    </form>
  );
}

export function ResolveConditionForm({
  conditionId,
  expectedVersion,
  initiativeId,
  description,
  capabilities,
}: {
  conditionId: string;
  expectedVersion: number;
  initiativeId: string;
  description: string;
  capabilities?: Caps;
}) {
  const form = useActionForm(resolveDecisionConditionAction);
  const allowed = capabilities?.canResolveConditions !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          conditionId,
          expectedVersion,
          initiativeId,
          status: String(fd.get("status") ?? "RESOLVED"),
          resolutionNote: String(fd.get("resolutionNote") ?? ""),
        });
      }}
    >
      <p className="text-sm">{description}</p>
      {form.ErrorAlert}
      <FormField label="Resolution" htmlFor={`status-${conditionId}`}>
        <select
          id={`status-${conditionId}`}
          name="status"
          className={fieldClassName}
          defaultValue="RESOLVED"
          disabled={!allowed}
        >
          <option value="RESOLVED">Resolved</option>
          <option value="WAIVED">Waived</option>
        </select>
      </FormField>
      <FormField label="Note" htmlFor={`note-${conditionId}`}>
        <textarea
          id={`note-${conditionId}`}
          name="resolutionNote"
          required
          rows={2}
          className={fieldClassName}
          placeholder="How was this condition closed?"
          disabled={!allowed}
        />
      </FormField>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Close condition"}
      </PrimaryButton>
    </form>
  );
}

const pocFieldDefaults = {
  title: "",
  objective: "",
  hypothesis: "",
  scope: "",
  outOfScope: "" as string | null,
  ownerName: "" as string | null,
  plannedStart: null as Date | string | null,
  plannedEnd: null as Date | string | null,
  estimatedCost: "" as string | null,
  resourceNotes: "" as string | null,
  technicalConstraints: "" as string | null,
  dependencyNotes: "" as string | null,
};

export function CreatePoCForm({
  initiativeId,
  capabilities,
}: {
  initiativeId: string;
  capabilities?: Caps;
}) {
  const form = useActionForm(createPoCAction);
  const allowed = capabilities?.canCreatePoC !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          initiativeId,
          title: String(fd.get("title") ?? ""),
          objective: String(fd.get("objective") ?? ""),
          hypothesis: String(fd.get("hypothesis") ?? ""),
          scope: String(fd.get("scope") ?? ""),
          outOfScope: optionalText(fd.get("outOfScope")),
          ownerName: optionalText(fd.get("ownerName")),
          plannedStart: optionalDate(fd.get("plannedStart")),
          plannedEnd: optionalDate(fd.get("plannedEnd")),
          estimatedCost: optionalText(fd.get("estimatedCost")),
          resourceNotes: optionalText(fd.get("resourceNotes")),
          technicalConstraints: optionalText(fd.get("technicalConstraints")),
          dependencyNotes: optionalText(fd.get("dependencyNotes")),
        });
      }}
    >
      <h3 className="font-medium">Create PoC</h3>
      <p className="text-xs text-[var(--muted)]">
        Available after a Go or Conditional go pre-study decision, once blocking
        conditions are closed. Creating a PoC advances the initiative to PoC.
      </p>
      {form.ErrorAlert}
      <PoCFields defaults={pocFieldDefaults} idPrefix="create-poc" />
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Creating…" : "Create PoC"}
      </PrimaryButton>
    </form>
  );
}

export function UpdatePoCForm({
  poc,
  capabilities,
}: {
  poc: {
    id: string;
    initiativeId: string;
    version: number;
    title: string;
    objective: string;
    hypothesis: string;
    scope: string;
    outOfScope: string | null;
    ownerName: string | null;
    plannedStart: Date | string | null;
    plannedEnd: Date | string | null;
    estimatedCost: string | null;
    resourceNotes: string | null;
    technicalConstraints: string | null;
    dependencyNotes: string | null;
  };
  capabilities?: Caps;
}) {
  const form = useActionForm(updatePoCAction);
  const allowed = capabilities?.canEditPoC !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          pocId: poc.id,
          expectedVersion: poc.version,
          title: String(fd.get("title") ?? ""),
          objective: String(fd.get("objective") ?? ""),
          hypothesis: String(fd.get("hypothesis") ?? ""),
          scope: String(fd.get("scope") ?? ""),
          outOfScope: optionalText(fd.get("outOfScope")),
          ownerName: optionalText(fd.get("ownerName")),
          plannedStart: optionalDate(fd.get("plannedStart")),
          plannedEnd: optionalDate(fd.get("plannedEnd")),
          estimatedCost: optionalText(fd.get("estimatedCost")),
          resourceNotes: optionalText(fd.get("resourceNotes")),
          technicalConstraints: optionalText(fd.get("technicalConstraints")),
          dependencyNotes: optionalText(fd.get("dependencyNotes")),
        });
      }}
    >
      <h3 className="font-medium">Update PoC definition</h3>
      {form.ErrorAlert}
      <PoCFields defaults={poc} idPrefix="update-poc" />
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Save PoC"}
      </PrimaryButton>
    </form>
  );
}

function PoCFields({
  defaults,
  idPrefix,
}: {
  defaults: typeof pocFieldDefaults & { title?: string };
  idPrefix: string;
}) {
  return (
    <>
      <FormField label="Title" htmlFor={`${idPrefix}-title`}>
        <input
          id={`${idPrefix}-title`}
          name="title"
          required
          defaultValue={defaults.title}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Objective" htmlFor={`${idPrefix}-objective`}>
        <textarea
          id={`${idPrefix}-objective`}
          name="objective"
          required
          rows={2}
          defaultValue={defaults.objective}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Hypothesis" htmlFor={`${idPrefix}-hypothesis`}>
        <textarea
          id={`${idPrefix}-hypothesis`}
          name="hypothesis"
          required
          rows={2}
          defaultValue={defaults.hypothesis}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Scope" htmlFor={`${idPrefix}-scope`}>
        <textarea
          id={`${idPrefix}-scope`}
          name="scope"
          required
          rows={2}
          defaultValue={defaults.scope}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Out of scope" htmlFor={`${idPrefix}-oos`}>
        <textarea
          id={`${idPrefix}-oos`}
          name="outOfScope"
          rows={2}
          defaultValue={defaults.outOfScope ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Owner" htmlFor={`${idPrefix}-owner`}>
          <input
            id={`${idPrefix}-owner`}
            name="ownerName"
            defaultValue={defaults.ownerName ?? ""}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Estimated cost" htmlFor={`${idPrefix}-cost`}>
          <input
            id={`${idPrefix}-cost`}
            name="estimatedCost"
            defaultValue={defaults.estimatedCost ?? ""}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Planned start" htmlFor={`${idPrefix}-start`}>
          <input
            id={`${idPrefix}-start`}
            name="plannedStart"
            type="date"
            defaultValue={dateInputValue(defaults.plannedStart)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Planned end" htmlFor={`${idPrefix}-end`}>
          <input
            id={`${idPrefix}-end`}
            name="plannedEnd"
            type="date"
            defaultValue={dateInputValue(defaults.plannedEnd)}
            className={fieldClassName}
          />
        </FormField>
      </div>
      <FormField label="Resource notes" htmlFor={`${idPrefix}-resources`}>
        <textarea
          id={`${idPrefix}-resources`}
          name="resourceNotes"
          rows={2}
          defaultValue={defaults.resourceNotes ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField
        label="Technical constraints"
        htmlFor={`${idPrefix}-constraints`}
      >
        <textarea
          id={`${idPrefix}-constraints`}
          name="technicalConstraints"
          rows={2}
          defaultValue={defaults.technicalConstraints ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Dependencies" htmlFor={`${idPrefix}-deps`}>
        <textarea
          id={`${idPrefix}-deps`}
          name="dependencyNotes"
          rows={2}
          defaultValue={defaults.dependencyNotes ?? ""}
          className={fieldClassName}
        />
      </FormField>
    </>
  );
}

export function TransitionPoCButtons({
  pocId,
  initiativeId,
  status,
  expectedVersion,
  capabilities,
}: {
  pocId: string;
  initiativeId: string;
  status: (typeof POC_STATUS_ORDER)[number];
  expectedVersion: number;
  capabilities?: Caps;
}) {
  const form = useActionForm(transitionPoCAction);
  const allowed = capabilities?.canTransitionPoC !== false;
  const fromIdx = POC_STATUS_ORDER.indexOf(status);
  const next =
    fromIdx >= 0 && fromIdx < POC_STATUS_ORDER.length - 1
      ? POC_STATUS_ORDER[fromIdx + 1]
      : null;

  if (!next) {
    return (
      <p className="text-sm text-[var(--muted)]">
        PoC is complete — no further execution transitions.
      </p>
    );
  }

  const labels: Record<string, string> = {
    READY: "Mark definition ready",
    IN_PROGRESS: "Start execution",
    EVALUATION: "Move to evaluation",
    COMPLETED: "Mark completed",
  };

  return (
    <div className="space-y-2">
      {form.ErrorAlert}
      <p className="text-sm text-[var(--muted)]">
        Current status: <strong>{status}</strong>. Advance one step at a time.
      </p>
      <PrimaryButton
        type="button"
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
        onClick={() =>
          form.submit({
            pocId,
            initiativeId,
            toStatus: next,
            expectedVersion,
          })
        }
      >
        {form.pending ? "Updating…" : labels[next] ?? `Advance to ${next}`}
      </PrimaryButton>
    </div>
  );
}

export function CriterionForm({
  pocId,
  initiativeId,
  existing,
  capabilities,
}: {
  pocId: string;
  initiativeId: string;
  existing?: {
    id: string;
    description: string;
    measurementMethod: string;
    target: string;
    unit: string | null;
    required: boolean;
    sortOrder: number;
    version: number;
  };
  capabilities?: Caps;
}) {
  const form = useActionForm(upsertPoCCriterionAction);
  const allowed = capabilities?.canEditPoC !== false;
  const prefix = existing?.id ?? "new";
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          pocId,
          initiativeId,
          criterionId: existing?.id,
          expectedVersion: existing?.version,
          description: String(fd.get("description") ?? ""),
          measurementMethod: String(fd.get("measurementMethod") ?? ""),
          target: String(fd.get("target") ?? ""),
          unit: optionalText(fd.get("unit")),
          required: fd.get("required") === "on",
          sortOrder: Number(fd.get("sortOrder") ?? existing?.sortOrder ?? 0),
        });
        if (!existing) e.currentTarget.reset();
      }}
    >
      <h3 className="font-medium">
        {existing ? "Update success criterion" : "Add success criterion"}
      </h3>
      {form.ErrorAlert}
      <FormField label="What must be true?" htmlFor={`${prefix}-desc`}>
        <textarea
          id={`${prefix}-desc`}
          name="description"
          required
          rows={2}
          defaultValue={existing?.description ?? ""}
          className={fieldClassName}
          disabled={!allowed}
        />
      </FormField>
      <FormField label="How will you measure it?" htmlFor={`${prefix}-method`}>
        <textarea
          id={`${prefix}-method`}
          name="measurementMethod"
          required
          rows={2}
          defaultValue={existing?.measurementMethod ?? ""}
          className={fieldClassName}
          disabled={!allowed}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Target" htmlFor={`${prefix}-target`}>
          <input
            id={`${prefix}-target`}
            name="target"
            required
            defaultValue={existing?.target ?? ""}
            className={fieldClassName}
            disabled={!allowed}
          />
        </FormField>
        <FormField label="Unit" htmlFor={`${prefix}-unit`}>
          <input
            id={`${prefix}-unit`}
            name="unit"
            defaultValue={existing?.unit ?? ""}
            className={fieldClassName}
            disabled={!allowed}
          />
        </FormField>
        <FormField label="Sort order" htmlFor={`${prefix}-order`}>
          <input
            id={`${prefix}-order`}
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={existing?.sortOrder ?? 0}
            className={fieldClassName}
            disabled={!allowed}
          />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="required"
          defaultChecked={existing?.required ?? true}
          disabled={!allowed}
        />
        Required for governance readiness
      </label>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : existing ? "Update criterion" : "Add criterion"}
      </PrimaryButton>
    </form>
  );
}

export function EvaluateCriterionForm({
  criterion,
  initiativeId,
  capabilities,
}: {
  initiativeId: string;
  criterion: {
    id: string;
    description: string;
    evaluationState: string;
    actualResult: string | null;
    evidenceReference: string | null;
    evaluationNotes: string | null;
    version: number;
  };
  capabilities?: Caps;
}) {
  const form = useActionForm(updateCriterionEvaluationAction);
  const allowed = capabilities?.canEvaluatePoC !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          criterionId: criterion.id,
          initiativeId,
          expectedVersion: criterion.version,
          evaluationState: String(fd.get("evaluationState") ?? "NOT_EVALUATED"),
          actualResult: optionalText(fd.get("actualResult")),
          evidenceReference: optionalText(fd.get("evidenceReference")),
          evaluationNotes: optionalText(fd.get("evaluationNotes")),
        });
      }}
    >
      <p className="text-sm font-medium">{criterion.description}</p>
      {form.ErrorAlert}
      <FormField label="Evaluation" htmlFor={`eval-${criterion.id}`}>
        <select
          id={`eval-${criterion.id}`}
          name="evaluationState"
          className={fieldClassName}
          defaultValue={criterion.evaluationState}
          disabled={!allowed}
        >
          <option value="NOT_EVALUATED">Not evaluated</option>
          <option value="PASS">Pass</option>
          <option value="FAIL">Fail</option>
          <option value="INCONCLUSIVE">Inconclusive</option>
        </select>
      </FormField>
      <FormField label="Actual result" htmlFor={`actual-${criterion.id}`}>
        <input
          id={`actual-${criterion.id}`}
          name="actualResult"
          defaultValue={criterion.actualResult ?? ""}
          className={fieldClassName}
          disabled={!allowed}
        />
      </FormField>
      <FormField label="Evidence reference" htmlFor={`evidence-${criterion.id}`}>
        <input
          id={`evidence-${criterion.id}`}
          name="evidenceReference"
          defaultValue={criterion.evidenceReference ?? ""}
          className={fieldClassName}
          placeholder="Document, link, or observation reference"
          disabled={!allowed}
        />
      </FormField>
      <FormField label="Notes" htmlFor={`notes-${criterion.id}`}>
        <textarea
          id={`notes-${criterion.id}`}
          name="evaluationNotes"
          rows={2}
          defaultValue={criterion.evaluationNotes ?? ""}
          className={fieldClassName}
          disabled={!allowed}
        />
      </FormField>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Save evaluation"}
      </PrimaryButton>
    </form>
  );
}

export function PoCResultsForm({
  poc,
  capabilities,
}: {
  poc: {
    id: string;
    initiativeId: string;
    version: number;
    results: string | null;
    findings: string | null;
    lessonsLearned: string | null;
    actualCost: string | null;
    actualStart: Date | string | null;
    actualEnd: Date | string | null;
  };
  capabilities?: Caps;
}) {
  const form = useActionForm(updatePoCResultsAction);
  const allowed = capabilities?.canEvaluatePoC !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          pocId: poc.id,
          expectedVersion: poc.version,
          results: optionalText(fd.get("results")),
          findings: optionalText(fd.get("findings")),
          lessonsLearned: optionalText(fd.get("lessonsLearned")),
          actualCost: optionalText(fd.get("actualCost")),
          actualStart: optionalDate(fd.get("actualStart")),
          actualEnd: optionalDate(fd.get("actualEnd")),
        });
      }}
    >
      <h3 className="font-medium">PoC results</h3>
      <p className="text-xs text-[var(--muted)]">
        Results and findings are required before PoC can be submitted for a
        governance decision.
      </p>
      {form.ErrorAlert}
      <FormField label="Results" htmlFor="poc-results">
        <textarea
          id="poc-results"
          name="results"
          rows={3}
          defaultValue={poc.results ?? ""}
          className={fieldClassName}
          disabled={!allowed}
        />
      </FormField>
      <FormField label="Findings" htmlFor="poc-findings">
        <textarea
          id="poc-findings"
          name="findings"
          rows={3}
          defaultValue={poc.findings ?? ""}
          className={fieldClassName}
          disabled={!allowed}
        />
      </FormField>
      <FormField label="Lessons learned" htmlFor="poc-lessons">
        <textarea
          id="poc-lessons"
          name="lessonsLearned"
          rows={2}
          defaultValue={poc.lessonsLearned ?? ""}
          className={fieldClassName}
          disabled={!allowed}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Actual cost" htmlFor="poc-actual-cost">
          <input
            id="poc-actual-cost"
            name="actualCost"
            defaultValue={poc.actualCost ?? ""}
            className={fieldClassName}
            disabled={!allowed}
          />
        </FormField>
        <FormField label="Actual start" htmlFor="poc-actual-start">
          <input
            id="poc-actual-start"
            name="actualStart"
            type="date"
            defaultValue={dateInputValue(poc.actualStart)}
            className={fieldClassName}
            disabled={!allowed}
          />
        </FormField>
        <FormField label="Actual end" htmlFor="poc-actual-end">
          <input
            id="poc-actual-end"
            name="actualEnd"
            type="date"
            defaultValue={dateInputValue(poc.actualEnd)}
            className={fieldClassName}
            disabled={!allowed}
          />
        </FormField>
      </div>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Save results"}
      </PrimaryButton>
    </form>
  );
}
