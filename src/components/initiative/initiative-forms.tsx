"use client";

import { useRouter } from "next/navigation";
import {
  advanceLifecycleAction,
  createAlternativeAction,
  createDocumentAction,
  createInitiativeAction,
  createRequirementAction,
  createRequirementRelationAction,
  createRiskAction,
  updateDemandAction,
  upsertAssessmentAction,
  addAcceptanceCriterionAction,
  updateRequirementAction,
} from "@/app/actions/initiative";
import {
  FormField,
  PrimaryButton,
  fieldClassName,
  useActionForm,
} from "@/components/ui/forms";

export function CreateInitiativeForm({
  organizations,
}: {
  organizations: {
    id: string;
    name: string;
    departments: { id: string; name: string; sectionName: string }[];
  }[];
}) {
  const router = useRouter();
  const form = useActionForm(createInitiativeAction, (data) => {
    const created = data as { id: string };
    router.push(`/initiatives/${created.id}`);
  });

  const org = organizations[0];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          organizationId: String(fd.get("organizationId") ?? ""),
          departmentId: String(fd.get("departmentId") ?? ""),
          title: String(fd.get("title") ?? ""),
          requesterName: String(fd.get("requesterName") ?? ""),
          requesterContact: String(fd.get("requesterContact") ?? "") || null,
          businessOwnerName: String(fd.get("businessOwnerName") ?? ""),
          businessOwnerContact:
            String(fd.get("businessOwnerContact") ?? "") || null,
          problemOpportunity: String(fd.get("problemOpportunity") ?? ""),
          reasonForRequest: String(fd.get("reasonForRequest") ?? ""),
          expectedValue: String(fd.get("expectedValue") ?? ""),
          affectedAreas: String(fd.get("affectedAreas") ?? ""),
          urgency: String(fd.get("urgency") ?? "MEDIUM"),
          strategicAlignment: String(fd.get("strategicAlignment") ?? ""),
          initialImpact: String(fd.get("initialImpact") ?? ""),
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Organization" htmlFor="organizationId">
        <select
          id="organizationId"
          name="organizationId"
          required
          className={fieldClassName}
          defaultValue={org?.id}
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Owning department" htmlFor="departmentId">
        <select id="departmentId" name="departmentId" required className={fieldClassName} defaultValue="">
          <option value="" disabled>
            Select department
          </option>
          {organizations.flatMap((o) =>
            o.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {o.name} / {d.sectionName} / {d.name}
              </option>
            )),
          )}
        </select>
      </FormField>
      <FormField label="Title" htmlFor="title">
        <input id="title" name="title" required maxLength={300} className={fieldClassName} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Requester" htmlFor="requesterName" hint="Business person reference — not a login account.">
          <input id="requesterName" name="requesterName" required className={fieldClassName} />
        </FormField>
        <FormField label="Requester contact" htmlFor="requesterContact">
          <input id="requesterContact" name="requesterContact" className={fieldClassName} />
        </FormField>
        <FormField label="Business owner" htmlFor="businessOwnerName">
          <input id="businessOwnerName" name="businessOwnerName" required className={fieldClassName} />
        </FormField>
        <FormField label="Business owner contact" htmlFor="businessOwnerContact">
          <input id="businessOwnerContact" name="businessOwnerContact" className={fieldClassName} />
        </FormField>
      </div>
      <FormField label="Problem / opportunity" htmlFor="problemOpportunity">
        <textarea id="problemOpportunity" name="problemOpportunity" rows={2} className={fieldClassName} />
      </FormField>
      <FormField label="Reason for request" htmlFor="reasonForRequest">
        <textarea id="reasonForRequest" name="reasonForRequest" rows={2} className={fieldClassName} />
      </FormField>
      <FormField label="Expected value" htmlFor="expectedValue">
        <textarea id="expectedValue" name="expectedValue" rows={2} className={fieldClassName} />
      </FormField>
      <FormField label="Affected areas / users" htmlFor="affectedAreas">
        <input id="affectedAreas" name="affectedAreas" className={fieldClassName} />
      </FormField>
      <FormField label="Urgency" htmlFor="urgency">
        <select id="urgency" name="urgency" className={fieldClassName} defaultValue="MEDIUM">
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </FormField>
      <FormField label="Strategic alignment" htmlFor="strategicAlignment">
        <textarea id="strategicAlignment" name="strategicAlignment" rows={2} className={fieldClassName} />
      </FormField>
      <FormField label="Initial impact" htmlFor="initialImpact">
        <textarea id="initialImpact" name="initialImpact" rows={2} className={fieldClassName} />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Creating…" : "Create initiative"}
      </PrimaryButton>
    </form>
  );
}

export function DemandForm({
  initiativeId,
  demand,
}: {
  initiativeId: string;
  demand: {
    problemOpportunity: string;
    reasonForRequest: string;
    expectedValue: string;
    affectedAreas: string;
    urgency: string;
    strategicAlignment: string;
    initialImpact: string;
    notes: string | null;
    version: number;
  };
}) {
  const form = useActionForm(updateDemandAction);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          initiativeId,
          expectedVersion: demand.version,
          problemOpportunity: String(fd.get("problemOpportunity") ?? ""),
          reasonForRequest: String(fd.get("reasonForRequest") ?? ""),
          expectedValue: String(fd.get("expectedValue") ?? ""),
          affectedAreas: String(fd.get("affectedAreas") ?? ""),
          urgency: String(fd.get("urgency") ?? "MEDIUM"),
          strategicAlignment: String(fd.get("strategicAlignment") ?? ""),
          initialImpact: String(fd.get("initialImpact") ?? ""),
          notes: String(fd.get("notes") ?? "") || null,
        });
      }}
    >
      {form.ErrorAlert}
      {(
        [
          ["problemOpportunity", "Problem / opportunity", demand.problemOpportunity],
          ["reasonForRequest", "Reason for request", demand.reasonForRequest],
          ["expectedValue", "Expected value", demand.expectedValue],
          ["affectedAreas", "Affected areas / users", demand.affectedAreas],
          ["strategicAlignment", "Strategic alignment", demand.strategicAlignment],
          ["initialImpact", "Initial impact", demand.initialImpact],
        ] as const
      ).map(([name, label, value]) => (
        <FormField key={name} label={label} htmlFor={name}>
          <textarea
            id={name}
            name={name}
            required
            rows={2}
            defaultValue={value}
            className={fieldClassName}
          />
        </FormField>
      ))}
      <FormField label="Urgency" htmlFor="urgency">
        <select id="urgency" name="urgency" defaultValue={demand.urgency} className={fieldClassName}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </FormField>
      <FormField label="Notes" htmlFor="notes">
        <textarea id="notes" name="notes" rows={2} defaultValue={demand.notes ?? ""} className={fieldClassName} />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Saving…" : "Save demand"}
      </PrimaryButton>
    </form>
  );
}

export function AdvanceLifecycleButton({
  initiativeId,
  expectedVersion,
  toStage,
  label,
}: {
  initiativeId: string;
  expectedVersion: number;
  toStage: "REQUIREMENTS" | "PRE_STUDY";
  label: string;
}) {
  const form = useActionForm(advanceLifecycleAction);
  return (
    <div className="space-y-2">
      {form.ErrorAlert}
      <PrimaryButton
        type="button"
        disabled={form.pending}
        onClick={() =>
          form.submit({
            initiativeId,
            toStage,
            expectedVersion,
            comment: null,
          })
        }
      >
        {form.pending ? "Advancing…" : label}
      </PrimaryButton>
    </div>
  );
}

export function CreateRequirementForm({ initiativeId }: { initiativeId: string }) {
  const form = useActionForm(createRequirementAction);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const criteria = String(fd.get("acceptanceCriteria") ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        form.submit({
          initiativeId,
          title: String(fd.get("title") ?? ""),
          description: String(fd.get("description") ?? ""),
          category: String(fd.get("category") ?? "BUSINESS"),
          priority: String(fd.get("priority") ?? "SHOULD"),
          ownerName: String(fd.get("ownerName") ?? "") || null,
          source: String(fd.get("source") ?? "") || null,
          status: String(fd.get("status") ?? "DRAFT"),
          acceptanceCriteria: criteria,
        });
        e.currentTarget.reset();
      }}
    >
      <h3 className="font-medium">Add requirement</h3>
      {form.ErrorAlert}
      <FormField label="Title" htmlFor="req-title">
        <input id="req-title" name="title" required className={fieldClassName} />
      </FormField>
      <FormField label="Description" htmlFor="req-description">
        <textarea id="req-description" name="description" required rows={3} className={fieldClassName} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Category" htmlFor="req-category">
          <select id="req-category" name="category" className={fieldClassName} defaultValue="BUSINESS">
            {[
              ["BUSINESS", "Business"],
              ["FUNCTIONAL", "Functional"],
              ["NON_FUNCTIONAL", "Non-functional"],
              ["ARCHITECTURE", "Architecture"],
              ["SECURITY", "Security"],
              ["INTEGRATION", "Integration"],
              ["DATA", "Data"],
              ["COMPLIANCE", "Compliance"],
              ["OTHER", "Other"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Priority" htmlFor="req-priority">
          <select id="req-priority" name="priority" className={fieldClassName} defaultValue="SHOULD">
            <option value="MUST">Must</option>
            <option value="SHOULD">Should</option>
            <option value="COULD">Could</option>
            <option value="WONT">Won&apos;t</option>
          </select>
        </FormField>
        <FormField label="Status" htmlFor="req-status">
          <select id="req-status" name="status" className={fieldClassName} defaultValue="DRAFT">
            <option value="DRAFT">Draft</option>
            <option value="PROPOSED">Proposed</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="DEFERRED">Deferred</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </FormField>
      </div>
      <FormField label="Owner" htmlFor="req-owner">
        <input id="req-owner" name="ownerName" className={fieldClassName} />
      </FormField>
      <FormField label="Source" htmlFor="req-source">
        <input id="req-source" name="source" className={fieldClassName} />
      </FormField>
      <FormField
        label="Acceptance criteria"
        htmlFor="req-ac"
        hint="One criterion per line."
      >
        <textarea id="req-ac" name="acceptanceCriteria" rows={3} className={fieldClassName} />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Creating…" : "Create requirement"}
      </PrimaryButton>
    </form>
  );
}

export function UpdateRequirementStatusForm({
  id,
  title,
  description,
  category,
  priority,
  ownerName,
  source,
  status,
  version,
}: {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  ownerName: string | null;
  source: string | null;
  status: string;
  version: number;
}) {
  const form = useActionForm(updateRequirementAction);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          id,
          title,
          description,
          category,
          priority,
          ownerName,
          source,
          status: String(fd.get("status") ?? status),
          expectedVersion: version,
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Status" htmlFor={`status-${id}`}>
        <select id={`status-${id}`} name="status" defaultValue={status} className={fieldClassName}>
          <option value="DRAFT">Draft</option>
          <option value="PROPOSED">Proposed</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="DEFERRED">Deferred</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </FormField>
      <PrimaryButton disabled={form.pending}>Update</PrimaryButton>
    </form>
  );
}

export function AddCriterionForm({ requirementId }: { requirementId: string }) {
  const form = useActionForm(addAcceptanceCriterionAction);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          requirementId,
          description: String(fd.get("description") ?? ""),
        });
        e.currentTarget.reset();
      }}
    >
      <input
        name="description"
        required
        placeholder="Add acceptance criterion"
        className={fieldClassName}
      />
      <PrimaryButton disabled={form.pending}>Add</PrimaryButton>
    </form>
  );
}

export function CreateRelationForm({
  requirements,
}: {
  requirements: { id: string; referenceKey: string; title: string }[];
}) {
  const form = useActionForm(createRequirementRelationAction);
  if (requirements.length < 2) return null;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          fromRequirementId: String(fd.get("fromRequirementId") ?? ""),
          toRequirementId: String(fd.get("toRequirementId") ?? ""),
          relationType: String(fd.get("relationType") ?? "RELATED_TO"),
        });
      }}
    >
      <h3 className="font-medium">Add relationship</h3>
      {form.ErrorAlert}
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="fromRequirementId" required className={fieldClassName} defaultValue="">
          <option value="" disabled>
            From
          </option>
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.referenceKey} — {r.title}
            </option>
          ))}
        </select>
        <select name="relationType" className={fieldClassName} defaultValue="RELATED_TO">
          <option value="DEPENDS_ON">Depends on</option>
          <option value="RELATED_TO">Related to</option>
          <option value="REFINES">Refines</option>
          <option value="CONFLICTS_WITH">Conflicts with</option>
        </select>
        <select name="toRequirementId" required className={fieldClassName} defaultValue="">
          <option value="" disabled>
            To
          </option>
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.referenceKey} — {r.title}
            </option>
          ))}
        </select>
      </div>
      <PrimaryButton disabled={form.pending}>Create relationship</PrimaryButton>
    </form>
  );
}

export function AssessmentForm({
  initiativeId,
  area,
  existing,
}: {
  initiativeId: string;
  area: string;
  existing?: {
    ownerName: string | null;
    status: string;
    summary: string | null;
    findings: string | null;
    conclusion: string | null;
    version: number;
  };
}) {
  const form = useActionForm(upsertAssessmentAction);
  return (
    <form
      className="space-y-3 border-t border-[var(--line)] pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          initiativeId,
          area,
          ownerName: String(fd.get("ownerName") ?? "") || null,
          status: String(fd.get("status") ?? "NOT_STARTED"),
          summary: String(fd.get("summary") ?? "") || null,
          findings: String(fd.get("findings") ?? "") || null,
          conclusion: String(fd.get("conclusion") ?? "") || null,
          expectedVersion: existing?.version,
        });
      }}
    >
      {form.ErrorAlert}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Owner" htmlFor={`${area}-owner`}>
          <input
            id={`${area}-owner`}
            name="ownerName"
            defaultValue={existing?.ownerName ?? ""}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Status" htmlFor={`${area}-status`}>
          <select
            id={`${area}-status`}
            name="status"
            defaultValue={existing?.status ?? "NOT_STARTED"}
            className={fieldClassName}
          >
            <option value="NOT_STARTED">Not started</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETE">Complete</option>
          </select>
        </FormField>
      </div>
      <FormField label="Summary" htmlFor={`${area}-summary`}>
        <textarea
          id={`${area}-summary`}
          name="summary"
          rows={2}
          defaultValue={existing?.summary ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Findings" htmlFor={`${area}-findings`}>
        <textarea
          id={`${area}-findings`}
          name="findings"
          rows={2}
          defaultValue={existing?.findings ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Conclusion" htmlFor={`${area}-conclusion`}>
        <textarea
          id={`${area}-conclusion`}
          name="conclusion"
          rows={2}
          defaultValue={existing?.conclusion ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Saving…" : "Save assessment"}
      </PrimaryButton>
    </form>
  );
}

export function CreateAlternativeForm({ initiativeId }: { initiativeId: string }) {
  const form = useActionForm(createAlternativeAction);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          initiativeId,
          title: String(fd.get("title") ?? ""),
          description: String(fd.get("description") ?? ""),
          benefits: String(fd.get("benefits") ?? "") || null,
          drawbacks: String(fd.get("drawbacks") ?? "") || null,
          estimatedCost: String(fd.get("estimatedCost") ?? "") || null,
          estimatedDuration: String(fd.get("estimatedDuration") ?? "") || null,
          riskUncertainty: String(fd.get("riskUncertainty") ?? "") || null,
          notes: String(fd.get("notes") ?? "") || null,
          isRecommended: fd.get("isRecommended") === "on",
        });
        e.currentTarget.reset();
      }}
    >
      <h3 className="font-medium">Add solution alternative</h3>
      <p className="text-xs text-[var(--muted)]">
        Alternatives are user-defined. A recommendation is not a governance decision.
      </p>
      {form.ErrorAlert}
      <FormField label="Title" htmlFor="alt-title">
        <input id="alt-title" name="title" required className={fieldClassName} />
      </FormField>
      <FormField label="Description" htmlFor="alt-description">
        <textarea id="alt-description" name="description" required rows={2} className={fieldClassName} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Benefits" htmlFor="alt-benefits">
          <textarea id="alt-benefits" name="benefits" rows={2} className={fieldClassName} />
        </FormField>
        <FormField label="Drawbacks" htmlFor="alt-drawbacks">
          <textarea id="alt-drawbacks" name="drawbacks" rows={2} className={fieldClassName} />
        </FormField>
        <FormField label="Estimated cost" htmlFor="alt-cost">
          <input id="alt-cost" name="estimatedCost" className={fieldClassName} />
        </FormField>
        <FormField label="Estimated duration" htmlFor="alt-duration">
          <input id="alt-duration" name="estimatedDuration" className={fieldClassName} />
        </FormField>
      </div>
      <FormField label="Risk / uncertainty" htmlFor="alt-risk">
        <textarea id="alt-risk" name="riskUncertainty" rows={2} className={fieldClassName} />
      </FormField>
      <FormField label="Notes" htmlFor="alt-notes">
        <textarea id="alt-notes" name="notes" rows={2} className={fieldClassName} />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isRecommended" />
        Mark as recommendation (not a decision)
      </label>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Creating…" : "Add alternative"}
      </PrimaryButton>
    </form>
  );
}

export function CreateRiskForm({ initiativeId }: { initiativeId: string }) {
  const form = useActionForm(createRiskAction);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          initiativeId,
          title: String(fd.get("title") ?? ""),
          description: String(fd.get("description") ?? ""),
          ownerName: String(fd.get("ownerName") ?? "") || null,
          probability: String(fd.get("probability") ?? "MEDIUM"),
          impact: String(fd.get("impact") ?? "MEDIUM"),
          status: String(fd.get("status") ?? "OPEN"),
          mitigation: String(fd.get("mitigation") ?? "") || null,
        });
        e.currentTarget.reset();
      }}
    >
      <h3 className="font-medium">Add risk</h3>
      {form.ErrorAlert}
      <FormField label="Title" htmlFor="risk-title">
        <input id="risk-title" name="title" required className={fieldClassName} />
      </FormField>
      <FormField label="Description" htmlFor="risk-description">
        <textarea id="risk-description" name="description" required rows={2} className={fieldClassName} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Probability" htmlFor="risk-prob">
          <select id="risk-prob" name="probability" className={fieldClassName} defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </FormField>
        <FormField label="Impact" htmlFor="risk-impact">
          <select id="risk-impact" name="impact" className={fieldClassName} defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </FormField>
        <FormField label="Status" htmlFor="risk-status">
          <select id="risk-status" name="status" className={fieldClassName} defaultValue="OPEN">
            <option value="OPEN">Open</option>
            <option value="MITIGATING">Mitigating</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="CLOSED">Closed</option>
          </select>
        </FormField>
      </div>
      <FormField label="Owner" htmlFor="risk-owner">
        <input id="risk-owner" name="ownerName" className={fieldClassName} />
      </FormField>
      <FormField label="Mitigation" htmlFor="risk-mitigation">
        <textarea id="risk-mitigation" name="mitigation" rows={2} className={fieldClassName} />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Creating…" : "Add risk"}
      </PrimaryButton>
    </form>
  );
}

export function CreateDocumentForm({ initiativeId }: { initiativeId: string }) {
  const form = useActionForm(createDocumentAction);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          initiativeId,
          title: String(fd.get("title") ?? ""),
          category: String(fd.get("category") ?? ""),
          ownerName: String(fd.get("ownerName") ?? "") || null,
          stage: String(fd.get("stage") ?? "") || null,
          versionLabel: String(fd.get("versionLabel") ?? "0.1"),
          changeSummary: String(fd.get("changeSummary") ?? "") || null,
        });
        e.currentTarget.reset();
      }}
    >
      <h3 className="font-medium">Register document metadata</h3>
      <p className="text-xs text-[var(--muted)]">
        Binary file upload is deferred. This registers metadata and version only — no fake files.
      </p>
      {form.ErrorAlert}
      <FormField label="Title" htmlFor="doc-title">
        <input id="doc-title" name="title" required className={fieldClassName} />
      </FormField>
      <FormField label="Category" htmlFor="doc-category">
        <input id="doc-category" name="category" required placeholder="e.g. Pre-study" className={fieldClassName} />
      </FormField>
      <FormField label="Owner" htmlFor="doc-owner">
        <input id="doc-owner" name="ownerName" className={fieldClassName} />
      </FormField>
      <FormField label="Lifecycle stage" htmlFor="doc-stage">
        <select id="doc-stage" name="stage" className={fieldClassName} defaultValue="">
          <option value="">Unspecified</option>
          <option value="DEMAND">Demand</option>
          <option value="REQUIREMENTS">Requirements</option>
          <option value="PRE_STUDY">Pre-study</option>
        </select>
      </FormField>
      <FormField label="Version label" htmlFor="doc-version">
        <input id="doc-version" name="versionLabel" defaultValue="0.1" className={fieldClassName} />
      </FormField>
      <FormField label="Change summary" htmlFor="doc-summary">
        <textarea id="doc-summary" name="changeSummary" rows={2} className={fieldClassName} />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Saving…" : "Register document"}
      </PrimaryButton>
    </form>
  );
}
