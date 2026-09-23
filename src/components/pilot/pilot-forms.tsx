"use client";

import {
  addPilotFeedbackAction,
  convertToProjectAction,
  createPilotAction,
  evaluatePilotCriterionAction,
  submitPilotForGovernanceAction,
  transitionPilotAction,
  updatePilotAction,
  updatePilotResultsAction,
  upsertPilotCriterionAction,
} from "@/app/actions/pilot";
import {
  FormField,
  NO_PERMISSION_TITLE,
  PrimaryButton,
  fieldClassName,
  permissionTitle,
  useActionForm,
} from "@/components/ui/forms";
import { PILOT_STATUS_ORDER } from "@/modules/governance/application/pilot-readiness-policy";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";

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

function moneyValue(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

type Caps = Partial<PrincipalCapabilities>;

const pilotFieldDefaults = {
  objective: "",
  scope: "",
  outOfScope: "" as string | null,
  ownerName: "" as string | null,
  siteOrArea: "" as string | null,
  targetUsers: "" as string | null,
  plannedStart: null as Date | string | null,
  plannedEnd: null as Date | string | null,
  estimatedCost: "" as string | null,
  currencyCode: "EUR",
  resourceNotes: "" as string | null,
  environment: "" as string | null,
  operationalConstraints: "" as string | null,
  supportModel: "" as string | null,
  rollbackPlan: "" as string | null,
};

export function CreatePilotForm({
  initiativeId,
  capabilities,
}: {
  initiativeId: string;
  capabilities?: Caps;
}) {
  const form = useActionForm(createPilotAction);
  const allowed = capabilities?.canCreatePilot !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          initiativeId,
          objective: String(fd.get("objective") ?? ""),
          scope: String(fd.get("scope") ?? ""),
          outOfScope: optionalText(fd.get("outOfScope")),
          ownerName: optionalText(fd.get("ownerName")),
          siteOrArea: optionalText(fd.get("siteOrArea")),
          targetUsers: optionalText(fd.get("targetUsers")),
          plannedStart: optionalDate(fd.get("plannedStart")),
          plannedEnd: optionalDate(fd.get("plannedEnd")),
          estimatedCost: optionalText(fd.get("estimatedCost")),
          currencyCode: String(fd.get("currencyCode") ?? "EUR") || "EUR",
          resourceNotes: optionalText(fd.get("resourceNotes")),
          environment: optionalText(fd.get("environment")),
          operationalConstraints: optionalText(fd.get("operationalConstraints")),
          supportModel: optionalText(fd.get("supportModel")),
          rollbackPlan: optionalText(fd.get("rollbackPlan")),
        });
      }}
    >
      <h3 className="font-medium">Create Pilot</h3>
      <p className="text-xs text-[var(--muted)]">
        Available after a Go or Conditional go PoC decision, once blocking
        conditions are closed. Creating a Pilot advances the initiative to Pilot.
      </p>
      {form.ErrorAlert}
      <PilotFields defaults={pilotFieldDefaults} idPrefix="create-pilot" />
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Creating…" : "Create Pilot"}
      </PrimaryButton>
    </form>
  );
}

export function UpdatePilotForm({
  pilot,
  capabilities,
}: {
  pilot: {
    id: string;
    initiativeId: string;
    version: number;
    objective: string;
    scope: string;
    outOfScope: string | null;
    ownerName: string | null;
    siteOrArea: string | null;
    targetUsers: string | null;
    plannedStart: Date | string | null;
    plannedEnd: Date | string | null;
    estimatedCost: unknown;
    currencyCode: string;
    resourceNotes: string | null;
    environment: string | null;
    operationalConstraints: string | null;
    supportModel: string | null;
    rollbackPlan: string | null;
  };
  capabilities?: Caps;
}) {
  const form = useActionForm(updatePilotAction);
  const allowed = capabilities?.canEditPilot !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          pilotId: pilot.id,
          initiativeId: pilot.initiativeId,
          expectedVersion: pilot.version,
          objective: String(fd.get("objective") ?? ""),
          scope: String(fd.get("scope") ?? ""),
          outOfScope: optionalText(fd.get("outOfScope")),
          ownerName: optionalText(fd.get("ownerName")),
          siteOrArea: optionalText(fd.get("siteOrArea")),
          targetUsers: optionalText(fd.get("targetUsers")),
          plannedStart: optionalDate(fd.get("plannedStart")),
          plannedEnd: optionalDate(fd.get("plannedEnd")),
          estimatedCost: optionalText(fd.get("estimatedCost")),
          currencyCode: String(fd.get("currencyCode") ?? "EUR") || "EUR",
          resourceNotes: optionalText(fd.get("resourceNotes")),
          environment: optionalText(fd.get("environment")),
          operationalConstraints: optionalText(fd.get("operationalConstraints")),
          supportModel: optionalText(fd.get("supportModel")),
          rollbackPlan: optionalText(fd.get("rollbackPlan")),
        });
      }}
    >
      <h3 className="font-medium">Update Pilot definition</h3>
      {form.ErrorAlert}
      <PilotFields
        defaults={{
          ...pilot,
          estimatedCost: moneyValue(pilot.estimatedCost),
        }}
        idPrefix="update-pilot"
      />
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Save Pilot"}
      </PrimaryButton>
    </form>
  );
}

function PilotFields({
  defaults,
  idPrefix,
}: {
  defaults: typeof pilotFieldDefaults;
  idPrefix: string;
}) {
  return (
    <>
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
        <FormField label="Site / area" htmlFor={`${idPrefix}-site`}>
          <input
            id={`${idPrefix}-site`}
            name="siteOrArea"
            defaultValue={defaults.siteOrArea ?? ""}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Target users" htmlFor={`${idPrefix}-users`}>
          <input
            id={`${idPrefix}-users`}
            name="targetUsers"
            defaultValue={defaults.targetUsers ?? ""}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Environment" htmlFor={`${idPrefix}-env`}>
          <input
            id={`${idPrefix}-env`}
            name="environment"
            defaultValue={defaults.environment ?? ""}
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
        <FormField label="Currency" htmlFor={`${idPrefix}-currency`}>
          <input
            id={`${idPrefix}-currency`}
            name="currencyCode"
            defaultValue={defaults.currencyCode ?? "EUR"}
            maxLength={3}
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
      <FormField label="Support model" htmlFor={`${idPrefix}-support`}>
        <textarea
          id={`${idPrefix}-support`}
          name="supportModel"
          rows={2}
          defaultValue={defaults.supportModel ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Rollback plan" htmlFor={`${idPrefix}-rollback`}>
        <textarea
          id={`${idPrefix}-rollback`}
          name="rollbackPlan"
          rows={2}
          defaultValue={defaults.rollbackPlan ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField
        label="Operational constraints"
        htmlFor={`${idPrefix}-constraints`}
      >
        <textarea
          id={`${idPrefix}-constraints`}
          name="operationalConstraints"
          rows={2}
          defaultValue={defaults.operationalConstraints ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Resource notes" htmlFor={`${idPrefix}-resources`}>
        <textarea
          id={`${idPrefix}-resources`}
          name="resourceNotes"
          rows={2}
          defaultValue={defaults.resourceNotes ?? ""}
          className={fieldClassName}
        />
      </FormField>
    </>
  );
}

export function TransitionPilotButtons({
  pilotId,
  initiativeId,
  status,
  expectedVersion,
  capabilities,
}: {
  pilotId: string;
  initiativeId: string;
  status: (typeof PILOT_STATUS_ORDER)[number];
  expectedVersion: number;
  capabilities?: Caps;
}) {
  const form = useActionForm(transitionPilotAction);
  const allowed = capabilities?.canTransitionPilot !== false;
  const fromIdx = PILOT_STATUS_ORDER.indexOf(status);
  const next =
    fromIdx >= 0 && fromIdx < PILOT_STATUS_ORDER.length - 1
      ? PILOT_STATUS_ORDER[fromIdx + 1]
      : null;

  if (!next) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Pilot is complete — no further execution transitions.
      </p>
    );
  }

  const labels: Record<string, string> = {
    READY: "Mark definition ready",
    IN_PROGRESS: "Start pilot",
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
            pilotId,
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

const CRITERION_CATEGORIES = [
  "TECHNICAL",
  "BUSINESS",
  "OPERATIONAL",
  "SECURITY",
  "ARCHITECTURE",
  "USER_ADOPTION",
  "PERFORMANCE",
  "COST",
  "OTHER",
] as const;

export function PilotCriterionForm({
  pilotId,
  initiativeId,
  existing,
  capabilities,
}: {
  pilotId: string;
  initiativeId: string;
  existing?: {
    id: string;
    category: string;
    title: string;
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
  const form = useActionForm(upsertPilotCriterionAction);
  const allowed = capabilities?.canEditPilot !== false;
  const prefix = existing?.id ?? "new";
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          pilotId,
          initiativeId,
          criterionId: existing?.id,
          expectedVersion: existing?.version,
          category: String(fd.get("category") ?? "OTHER"),
          title: String(fd.get("title") ?? ""),
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
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Category" htmlFor={`${prefix}-category`}>
          <select
            id={`${prefix}-category`}
            name="category"
            className={fieldClassName}
            defaultValue={existing?.category ?? "BUSINESS"}
          >
            {CRITERION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Title" htmlFor={`${prefix}-title`}>
          <input
            id={`${prefix}-title`}
            name="title"
            required
            defaultValue={existing?.title ?? ""}
            className={fieldClassName}
          />
        </FormField>
      </div>
      <FormField label="Description" htmlFor={`${prefix}-desc`}>
        <textarea
          id={`${prefix}-desc`}
          name="description"
          required
          rows={2}
          defaultValue={existing?.description ?? ""}
          className={fieldClassName}
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
          />
        </FormField>
        <FormField label="Unit" htmlFor={`${prefix}-unit`}>
          <input
            id={`${prefix}-unit`}
            name="unit"
            defaultValue={existing?.unit ?? ""}
            className={fieldClassName}
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
          />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="required"
          defaultChecked={existing?.required ?? true}
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

export function EvaluatePilotCriterionForm({
  criterion,
  initiativeId,
  capabilities,
}: {
  initiativeId: string;
  criterion: {
    id: string;
    title: string;
    description: string;
    evaluationState: string;
    actualResult: string | null;
    evidenceReference: string | null;
    evaluationNotes: string | null;
    version: number;
  };
  capabilities?: Caps;
}) {
  const form = useActionForm(evaluatePilotCriterionAction);
  const allowed = capabilities?.canEvaluatePilot !== false;
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
      <p className="text-sm font-medium">
        {criterion.title}
        <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">
          {criterion.description}
        </span>
      </p>
      {form.ErrorAlert}
      <FormField label="Evaluation" htmlFor={`eval-${criterion.id}`}>
        <select
          id={`eval-${criterion.id}`}
          name="evaluationState"
          className={fieldClassName}
          defaultValue={criterion.evaluationState}
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
        />
      </FormField>
      <FormField label="Evidence reference" htmlFor={`evidence-${criterion.id}`}>
        <input
          id={`evidence-${criterion.id}`}
          name="evidenceReference"
          defaultValue={criterion.evidenceReference ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Notes" htmlFor={`notes-${criterion.id}`}>
        <textarea
          id={`notes-${criterion.id}`}
          name="evaluationNotes"
          rows={2}
          defaultValue={criterion.evaluationNotes ?? ""}
          className={fieldClassName}
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

export function PilotResultsForm({
  pilot,
  capabilities,
}: {
  pilot: {
    id: string;
    initiativeId: string;
    version: number;
    results: string | null;
    businessFindings: string | null;
    technicalFindings: string | null;
    operationalFindings: string | null;
    userFeedbackSummary: string | null;
    lessonsLearned: string | null;
    actualCost: unknown;
    actualStart: Date | string | null;
    actualEnd: Date | string | null;
  };
  capabilities?: Caps;
}) {
  const form = useActionForm(updatePilotResultsAction);
  const allowed = capabilities?.canEvaluatePilot !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          pilotId: pilot.id,
          initiativeId: pilot.initiativeId,
          expectedVersion: pilot.version,
          results: optionalText(fd.get("results")),
          businessFindings: optionalText(fd.get("businessFindings")),
          technicalFindings: optionalText(fd.get("technicalFindings")),
          operationalFindings: optionalText(fd.get("operationalFindings")),
          userFeedbackSummary: optionalText(fd.get("userFeedbackSummary")),
          lessonsLearned: optionalText(fd.get("lessonsLearned")),
          actualCost: optionalText(fd.get("actualCost")),
          actualStart: optionalDate(fd.get("actualStart")),
          actualEnd: optionalDate(fd.get("actualEnd")),
        });
      }}
    >
      <h3 className="font-medium">Pilot results & findings</h3>
      <p className="text-xs text-[var(--muted)]">
        Results plus business, technical, and operational findings are required
        before Pilot can be submitted for a governance decision.
      </p>
      {form.ErrorAlert}
      <FormField label="Results" htmlFor="pilot-results">
        <textarea
          id="pilot-results"
          name="results"
          rows={3}
          defaultValue={pilot.results ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Business findings" htmlFor="pilot-business">
        <textarea
          id="pilot-business"
          name="businessFindings"
          rows={2}
          defaultValue={pilot.businessFindings ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Technical findings" htmlFor="pilot-technical">
        <textarea
          id="pilot-technical"
          name="technicalFindings"
          rows={2}
          defaultValue={pilot.technicalFindings ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Operational findings" htmlFor="pilot-operational">
        <textarea
          id="pilot-operational"
          name="operationalFindings"
          rows={2}
          defaultValue={pilot.operationalFindings ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="User feedback summary" htmlFor="pilot-feedback-sum">
        <textarea
          id="pilot-feedback-sum"
          name="userFeedbackSummary"
          rows={2}
          defaultValue={pilot.userFeedbackSummary ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Lessons learned" htmlFor="pilot-lessons">
        <textarea
          id="pilot-lessons"
          name="lessonsLearned"
          rows={2}
          defaultValue={pilot.lessonsLearned ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Actual cost" htmlFor="pilot-actual-cost">
          <input
            id="pilot-actual-cost"
            name="actualCost"
            defaultValue={moneyValue(pilot.actualCost)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Actual start" htmlFor="pilot-actual-start">
          <input
            id="pilot-actual-start"
            name="actualStart"
            type="date"
            defaultValue={dateInputValue(pilot.actualStart)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Actual end" htmlFor="pilot-actual-end">
          <input
            id="pilot-actual-end"
            name="actualEnd"
            type="date"
            defaultValue={dateInputValue(pilot.actualEnd)}
            className={fieldClassName}
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

export function AddPilotFeedbackForm({
  pilotId,
  initiativeId,
  capabilities,
}: {
  pilotId: string;
  initiativeId: string;
  capabilities?: Caps;
}) {
  const form = useActionForm(addPilotFeedbackAction);
  const allowed = capabilities?.canEditPilot !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          pilotId,
          initiativeId,
          sourceType: String(fd.get("sourceType") ?? ""),
          summary: String(fd.get("summary") ?? ""),
          details: optionalText(fd.get("details")),
          sentiment: optionalText(fd.get("sentiment")),
          submittedByName: optionalText(fd.get("submittedByName")),
        });
        e.currentTarget.reset();
      }}
    >
      <h3 className="font-medium">Add feedback</h3>
      {form.ErrorAlert}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Source type" htmlFor="feedback-source">
          <input
            id="feedback-source"
            name="sourceType"
            required
            placeholder="e.g. end user, operator, stakeholder"
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Sentiment" htmlFor="feedback-sentiment">
          <select
            id="feedback-sentiment"
            name="sentiment"
            className={fieldClassName}
            defaultValue=""
          >
            <option value="">—</option>
            <option value="POSITIVE">Positive</option>
            <option value="NEUTRAL">Neutral</option>
            <option value="NEGATIVE">Negative</option>
            <option value="MIXED">Mixed</option>
          </select>
        </FormField>
      </div>
      <FormField label="Summary" htmlFor="feedback-summary">
        <textarea
          id="feedback-summary"
          name="summary"
          required
          rows={2}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Details" htmlFor="feedback-details">
        <textarea
          id="feedback-details"
          name="details"
          rows={2}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Submitted by" htmlFor="feedback-by">
        <input
          id="feedback-by"
          name="submittedByName"
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Add feedback"}
      </PrimaryButton>
    </form>
  );
}

export function SubmitPilotButton({
  initiativeId,
  disabled,
  capabilities,
}: {
  initiativeId: string;
  disabled?: boolean;
  capabilities?: Caps;
}) {
  const form = useActionForm(submitPilotForGovernanceAction);
  const allowed = capabilities?.canSubmitGovernance !== false;
  return (
    <div className="space-y-2">
      {form.ErrorAlert}
      <p className="text-sm text-[var(--muted)]">
        Submits Pilot results and evaluations for authority review before a
        scale decision.
      </p>
      <PrimaryButton
        type="button"
        disabled={disabled || !allowed || form.pending}
        title={
          !allowed
            ? NO_PERMISSION_TITLE
            : disabled
              ? "Pilot is not ready for governance"
              : undefined
        }
        onClick={() => form.submit({ initiativeId, notes: null })}
      >
        {form.pending ? "Submitting…" : "Submit Pilot for governance"}
      </PrimaryButton>
    </div>
  );
}

export function ConvertToProjectForm({
  initiativeId,
  defaultName,
  capabilities,
}: {
  initiativeId: string;
  defaultName?: string;
  capabilities?: Caps;
}) {
  const form = useActionForm(convertToProjectAction);
  const allowed = capabilities?.canConvertProject !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          initiativeId,
          name: String(fd.get("name") ?? ""),
          description: optionalText(fd.get("description")),
          ownerName: optionalText(fd.get("ownerName")),
          priority: String(fd.get("priority") ?? "MEDIUM"),
          plannedStart: optionalDate(fd.get("plannedStart")),
          plannedEnd: optionalDate(fd.get("plannedEnd")),
          estimatedCost: optionalText(fd.get("estimatedCost")),
          approvedBudget: optionalText(fd.get("approvedBudget")),
          currencyCode: String(fd.get("currencyCode") ?? "EUR") || "EUR",
          objectives: optionalText(fd.get("objectives")),
          participatingDepartmentIds: [],
        });
      }}
    >
      <h3 className="font-medium">Convert to Project</h3>
      <p className="text-xs text-[var(--muted)]">
        Requires a Scale or Conditional scale Pilot decision with blocking
        conditions closed. This is a separate authorized action — scale does not
        auto-create a project.
      </p>
      {form.ErrorAlert}
      <FormField label="Project name" htmlFor="convert-name">
        <input
          id="convert-name"
          name="name"
          required
          defaultValue={defaultName ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Description" htmlFor="convert-desc">
        <textarea
          id="convert-desc"
          name="description"
          rows={2}
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Owner" htmlFor="convert-owner">
          <input id="convert-owner" name="ownerName" className={fieldClassName} />
        </FormField>
        <FormField label="Priority" htmlFor="convert-priority">
          <select
            id="convert-priority"
            name="priority"
            className={fieldClassName}
            defaultValue="MEDIUM"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </FormField>
        <FormField label="Estimated cost" htmlFor="convert-est">
          <input id="convert-est" name="estimatedCost" className={fieldClassName} />
        </FormField>
        <FormField label="Approved budget" htmlFor="convert-budget">
          <input
            id="convert-budget"
            name="approvedBudget"
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Planned start" htmlFor="convert-start">
          <input
            id="convert-start"
            name="plannedStart"
            type="date"
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Planned end" htmlFor="convert-end">
          <input
            id="convert-end"
            name="plannedEnd"
            type="date"
            className={fieldClassName}
          />
        </FormField>
      </div>
      <FormField label="Objectives" htmlFor="convert-objectives">
        <textarea
          id="convert-objectives"
          name="objectives"
          rows={2}
          className={fieldClassName}
        />
      </FormField>
      <input type="hidden" name="currencyCode" value="EUR" />
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Converting…" : "Convert to Project"}
      </PrimaryButton>
    </form>
  );
}
