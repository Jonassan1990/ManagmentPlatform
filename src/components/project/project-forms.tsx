"use client";

import { useState } from "react";
import {
  changeIssueStatusAction,
  closeProjectAction,
  createIssueAction,
  createMilestoneAction,
  createWorkItemAction,
  resolveIssueAction,
  updateBudgetAction,
  updateIssueAction,
  updateMilestoneAction,
  updateProjectAction,
  updateWorkItemAction,
} from "@/app/actions/project";
import { Alert } from "@/components/ui/alert";
import {
  FormField,
  PrimaryButton,
  fieldClassName,
  permissionTitle,
  useActionForm,
} from "@/components/ui/forms";
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

export function UpdateProjectForm({
  project,
  initiativeId,
  capabilities,
  ownerPeople = [],
}: {
  initiativeId: string;
  project: {
    id: string;
    version: number;
    name: string;
    description: string | null;
    ownerName: string | null;
    ownerResourceId?: string | null;
    status: string;
    priority: string;
    plannedStart: Date | string | null;
    plannedEnd: Date | string | null;
    objectives: string | null;
  };
  capabilities?: Caps;
  ownerPeople?: { id: string; name: string; label: string }[];
}) {
  const form = useActionForm(updateProjectAction);
  const allowed = capabilities?.canEditProject !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          projectId: project.id,
          initiativeId,
          expectedVersion: project.version,
          name: String(fd.get("name") ?? ""),
          description: optionalText(fd.get("description")),
          ownerName: optionalText(fd.get("ownerName")),
          ownerResourceId: String(fd.get("ownerResourceId") ?? "") || null,
          status: String(fd.get("status") ?? "ACTIVE"),
          priority: String(fd.get("priority") ?? "MEDIUM"),
          plannedStart: optionalDate(fd.get("plannedStart")),
          plannedEnd: optionalDate(fd.get("plannedEnd")),
          objectives: optionalText(fd.get("objectives")),
        });
      }}
    >
      <h3 className="font-medium">Project overview</h3>
      {form.ErrorAlert}
      <FormField label="Name" htmlFor="project-name">
        <input
          id="project-name"
          name="name"
          required
          defaultValue={project.name}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Description" htmlFor="project-desc">
        <textarea
          id="project-desc"
          name="description"
          rows={2}
          defaultValue={project.description ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label="Owner (person)"
          htmlFor="project-owner-resource"
          hint="Structured ownership via Resource. Login not required."
        >
          <select
            id="project-owner-resource"
            name="ownerResourceId"
            className={fieldClassName}
            defaultValue={project.ownerResourceId ?? ""}
          >
            <option value="">Use text snapshot only</option>
            {ownerPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label || p.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Owner name snapshot" htmlFor="project-owner">
          <input
            id="project-owner"
            name="ownerName"
            defaultValue={project.ownerName ?? ""}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Status" htmlFor="project-status">
          <select
            id="project-status"
            name="status"
            className={fieldClassName}
            defaultValue={
              project.status === "COMPLETED" || project.status === "CANCELLED"
                ? "ACTIVE"
                : project.status
            }
            disabled={
              project.status === "COMPLETED" || project.status === "CANCELLED"
            }
          >
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Completion and cancellation use Close project — not this field.
          </p>
        </FormField>
        <FormField label="Priority" htmlFor="project-priority">
          <select
            id="project-priority"
            name="priority"
            className={fieldClassName}
            defaultValue={project.priority}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </FormField>
        <FormField label="Planned start" htmlFor="project-start">
          <input
            id="project-start"
            name="plannedStart"
            type="date"
            defaultValue={dateInputValue(project.plannedStart)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Planned end" htmlFor="project-end">
          <input
            id="project-end"
            name="plannedEnd"
            type="date"
            defaultValue={dateInputValue(project.plannedEnd)}
            className={fieldClassName}
          />
        </FormField>
      </div>
      <FormField label="Objectives" htmlFor="project-objectives">
        <textarea
          id="project-objectives"
          name="objectives"
          rows={2}
          defaultValue={project.objectives ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Save project"}
      </PrimaryButton>
    </form>
  );
}

export function UpdateBudgetForm({
  project,
  initiativeId,
  capabilities,
}: {
  initiativeId: string;
  project: {
    id: string;
    version: number;
    estimatedCost: unknown;
    approvedBudget: unknown;
    plannedCost: unknown;
    forecastCost: unknown;
    actualCost: unknown;
    currencyCode: string;
  };
  capabilities?: Caps;
}) {
  const form = useActionForm(updateBudgetAction);
  const allowed = capabilities?.canEditProject !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          projectId: project.id,
          initiativeId,
          expectedVersion: project.version,
          estimatedCost: optionalText(fd.get("estimatedCost")),
          approvedBudget: optionalText(fd.get("approvedBudget")),
          plannedCost: optionalText(fd.get("plannedCost")),
          forecastCost: optionalText(fd.get("forecastCost")),
          actualCost: optionalText(fd.get("actualCost")),
          currencyCode: String(fd.get("currencyCode") ?? project.currencyCode),
        });
      }}
    >
      <h3 className="font-medium">Budget</h3>
      {form.ErrorAlert}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Estimated cost" htmlFor="budget-est">
          <input
            id="budget-est"
            name="estimatedCost"
            defaultValue={moneyValue(project.estimatedCost)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Approved budget" htmlFor="budget-approved">
          <input
            id="budget-approved"
            name="approvedBudget"
            defaultValue={moneyValue(project.approvedBudget)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Planned cost" htmlFor="budget-planned">
          <input
            id="budget-planned"
            name="plannedCost"
            defaultValue={moneyValue(project.plannedCost)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Forecast cost" htmlFor="budget-forecast">
          <input
            id="budget-forecast"
            name="forecastCost"
            defaultValue={moneyValue(project.forecastCost)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Actual cost" htmlFor="budget-actual">
          <input
            id="budget-actual"
            name="actualCost"
            defaultValue={moneyValue(project.actualCost)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Currency" htmlFor="budget-currency">
          <input
            id="budget-currency"
            name="currencyCode"
            defaultValue={project.currencyCode}
            maxLength={3}
            className={fieldClassName}
          />
        </FormField>
      </div>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Save budget"}
      </PrimaryButton>
    </form>
  );
}

export function CreateMilestoneForm({
  projectId,
  initiativeId,
  capabilities,
}: {
  projectId: string;
  initiativeId: string;
  capabilities?: Caps;
}) {
  const form = useActionForm(createMilestoneAction);
  const allowed = capabilities?.canManageMilestones !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          projectId,
          initiativeId,
          title: String(fd.get("title") ?? ""),
          description: optionalText(fd.get("description")),
          ownerName: optionalText(fd.get("ownerName")),
          plannedDate: optionalDate(fd.get("plannedDate")),
          actualDate: optionalDate(fd.get("actualDate")),
          status: String(fd.get("status") ?? "PLANNED"),
          criticality: fd.get("criticality") === "on",
        });
        e.currentTarget.reset();
      }}
    >
      <h3 className="font-medium">Add milestone</h3>
      {form.ErrorAlert}
      <FormField label="Title" htmlFor="ms-title">
        <input id="ms-title" name="title" required className={fieldClassName} />
      </FormField>
      <FormField label="Description" htmlFor="ms-desc">
        <textarea id="ms-desc" name="description" rows={2} className={fieldClassName} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Owner" htmlFor="ms-owner">
          <input id="ms-owner" name="ownerName" className={fieldClassName} />
        </FormField>
        <FormField label="Status" htmlFor="ms-status">
          <select id="ms-status" name="status" className={fieldClassName} defaultValue="PLANNED">
            <option value="PLANNED">Planned</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="MISSED">Missed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </FormField>
        <FormField label="Planned date" htmlFor="ms-planned">
          <input id="ms-planned" name="plannedDate" type="date" className={fieldClassName} />
        </FormField>
        <FormField label="Actual date" htmlFor="ms-actual">
          <input id="ms-actual" name="actualDate" type="date" className={fieldClassName} />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="criticality" />
        Critical milestone
      </label>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Creating…" : "Add milestone"}
      </PrimaryButton>
    </form>
  );
}

export function UpdateMilestoneForm({
  milestone,
  initiativeId,
  capabilities,
}: {
  initiativeId: string;
  milestone: {
    id: string;
    projectId: string;
    version: number;
    title: string;
    description: string | null;
    ownerName: string | null;
    plannedDate: Date | string | null;
    actualDate: Date | string | null;
    status: string;
    criticality: boolean;
  };
  capabilities?: Caps;
}) {
  const form = useActionForm(updateMilestoneAction);
  const allowed = capabilities?.canManageMilestones !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          milestoneId: milestone.id,
          projectId: milestone.projectId,
          initiativeId,
          expectedVersion: milestone.version,
          title: String(fd.get("title") ?? ""),
          description: optionalText(fd.get("description")),
          ownerName: optionalText(fd.get("ownerName")),
          plannedDate: optionalDate(fd.get("plannedDate")),
          actualDate: optionalDate(fd.get("actualDate")),
          status: String(fd.get("status") ?? "PLANNED"),
          criticality: fd.get("criticality") === "on",
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Title" htmlFor={`ms-${milestone.id}-title`}>
        <input
          id={`ms-${milestone.id}-title`}
          name="title"
          required
          defaultValue={milestone.title}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Description" htmlFor={`ms-${milestone.id}-desc`}>
        <textarea
          id={`ms-${milestone.id}-desc`}
          name="description"
          rows={2}
          defaultValue={milestone.description ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Owner" htmlFor={`ms-${milestone.id}-owner`}>
          <input
            id={`ms-${milestone.id}-owner`}
            name="ownerName"
            defaultValue={milestone.ownerName ?? ""}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Status" htmlFor={`ms-${milestone.id}-status`}>
          <select
            id={`ms-${milestone.id}-status`}
            name="status"
            className={fieldClassName}
            defaultValue={milestone.status}
          >
            <option value="PLANNED">Planned</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="MISSED">Missed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </FormField>
        <FormField label="Planned date" htmlFor={`ms-${milestone.id}-planned`}>
          <input
            id={`ms-${milestone.id}-planned`}
            name="plannedDate"
            type="date"
            defaultValue={dateInputValue(milestone.plannedDate)}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Actual date" htmlFor={`ms-${milestone.id}-actual`}>
          <input
            id={`ms-${milestone.id}-actual`}
            name="actualDate"
            type="date"
            defaultValue={dateInputValue(milestone.actualDate)}
            className={fieldClassName}
          />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="criticality"
          defaultChecked={milestone.criticality}
        />
        Critical milestone
      </label>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Update milestone"}
      </PrimaryButton>
    </form>
  );
}

export function CreateWorkItemForm({
  projectId,
  initiativeId,
  parentOptions,
  capabilities,
}: {
  projectId: string;
  initiativeId: string;
  parentOptions?: { id: string; referenceKey: string; title: string }[];
  capabilities?: Caps;
}) {
  const form = useActionForm(createWorkItemAction);
  const allowed = capabilities?.canManageWorkItems !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        const parentId = optionalText(fd.get("parentId"));
        form.submit({
          projectId,
          initiativeId,
          type: String(fd.get("type") ?? "TASK"),
          title: String(fd.get("title") ?? ""),
          description: optionalText(fd.get("description")),
          ownerName: optionalText(fd.get("ownerName")),
          status: String(fd.get("status") ?? "BACKLOG"),
          priority: String(fd.get("priority") ?? "MEDIUM"),
          estimateHours: optionalText(fd.get("estimateHours")),
          parentId: parentId || null,
        });
        e.currentTarget.reset();
      }}
    >
      <h3 className="font-medium">Add work item</h3>
      {form.ErrorAlert}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Type" htmlFor="wi-type">
          <select id="wi-type" name="type" className={fieldClassName} defaultValue="TASK">
            <option value="EPIC">Epic</option>
            <option value="FEATURE">Feature</option>
            <option value="TASK">Task</option>
          </select>
        </FormField>
        <FormField label="Title" htmlFor="wi-title">
          <input id="wi-title" name="title" required className={fieldClassName} />
        </FormField>
        <FormField label="Status" htmlFor="wi-status">
          <select id="wi-status" name="status" className={fieldClassName} defaultValue="BACKLOG">
            <option value="BACKLOG">Backlog</option>
            <option value="READY">Ready</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </FormField>
        <FormField label="Priority" htmlFor="wi-priority">
          <select id="wi-priority" name="priority" className={fieldClassName} defaultValue="MEDIUM">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </FormField>
        <FormField label="Owner" htmlFor="wi-owner">
          <input id="wi-owner" name="ownerName" className={fieldClassName} />
        </FormField>
        <FormField label="Estimate (hours)" htmlFor="wi-est">
          <input id="wi-est" name="estimateHours" className={fieldClassName} />
        </FormField>
      </div>
      {parentOptions && parentOptions.length > 0 ? (
        <FormField label="Parent" htmlFor="wi-parent">
          <select id="wi-parent" name="parentId" className={fieldClassName} defaultValue="">
            <option value="">None</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.referenceKey} · {p.title}
              </option>
            ))}
          </select>
        </FormField>
      ) : null}
      <FormField label="Description" htmlFor="wi-desc">
        <textarea id="wi-desc" name="description" rows={2} className={fieldClassName} />
      </FormField>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Creating…" : "Add work item"}
      </PrimaryButton>
    </form>
  );
}

export function UpdateWorkItemForm({
  workItem,
  initiativeId,
  parentOptions,
  capabilities,
}: {
  initiativeId: string;
  workItem: {
    id: string;
    projectId: string;
    version: number;
    title: string;
    description: string | null;
    ownerName: string | null;
    status: string;
    priority: string;
    estimateHours: unknown;
    parentId: string | null;
  };
  parentOptions?: { id: string; referenceKey: string; title: string }[];
  capabilities?: Caps;
}) {
  const form = useActionForm(updateWorkItemAction);
  const allowed = capabilities?.canManageWorkItems !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        const parentId = optionalText(fd.get("parentId"));
        form.submit({
          workItemId: workItem.id,
          projectId: workItem.projectId,
          initiativeId,
          expectedVersion: workItem.version,
          title: String(fd.get("title") ?? ""),
          description: optionalText(fd.get("description")),
          ownerName: optionalText(fd.get("ownerName")),
          status: String(fd.get("status") ?? "BACKLOG"),
          priority: String(fd.get("priority") ?? "MEDIUM"),
          estimateHours: optionalText(fd.get("estimateHours")),
          parentId: parentId || null,
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Title" htmlFor={`wi-${workItem.id}-title`}>
        <input
          id={`wi-${workItem.id}-title`}
          name="title"
          required
          defaultValue={workItem.title}
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Status" htmlFor={`wi-${workItem.id}-status`}>
          <select
            id={`wi-${workItem.id}-status`}
            name="status"
            className={fieldClassName}
            defaultValue={workItem.status}
          >
            <option value="BACKLOG">Backlog</option>
            <option value="READY">Ready</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </FormField>
        <FormField label="Priority" htmlFor={`wi-${workItem.id}-priority`}>
          <select
            id={`wi-${workItem.id}-priority`}
            name="priority"
            className={fieldClassName}
            defaultValue={workItem.priority}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </FormField>
        <FormField label="Owner" htmlFor={`wi-${workItem.id}-owner`}>
          <input
            id={`wi-${workItem.id}-owner`}
            name="ownerName"
            defaultValue={workItem.ownerName ?? ""}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Estimate (hours)" htmlFor={`wi-${workItem.id}-est`}>
          <input
            id={`wi-${workItem.id}-est`}
            name="estimateHours"
            defaultValue={moneyValue(workItem.estimateHours)}
            className={fieldClassName}
          />
        </FormField>
      </div>
      {parentOptions && parentOptions.length > 0 ? (
        <FormField label="Parent" htmlFor={`wi-${workItem.id}-parent`}>
          <select
            id={`wi-${workItem.id}-parent`}
            name="parentId"
            className={fieldClassName}
            defaultValue={workItem.parentId ?? ""}
          >
            <option value="">None</option>
            {parentOptions
              .filter((p) => p.id !== workItem.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.referenceKey} · {p.title}
                </option>
              ))}
          </select>
        </FormField>
      ) : null}
      <FormField label="Description" htmlFor={`wi-${workItem.id}-desc`}>
        <textarea
          id={`wi-${workItem.id}-desc`}
          name="description"
          rows={2}
          defaultValue={workItem.description ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Update work item"}
      </PrimaryButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Phase 1C — Issues
// ---------------------------------------------------------------------------

export function CreateIssueForm({
  projectId,
  initiativeId,
  capabilities,
  ownerPeople = [],
  relatedRisks = [],
}: {
  projectId: string;
  initiativeId: string;
  capabilities?: Caps;
  ownerPeople?: { id: string; name: string; label: string }[];
  relatedRisks?: { id: string; referenceKey: string; title: string }[];
}) {
  const form = useActionForm(createIssueAction);
  const allowed = capabilities?.canEditProject !== false;
  return (
    <form
      className="space-y-3 border-t border-[var(--line)] pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          projectId,
          initiativeId,
          title: String(fd.get("title") ?? ""),
          description: optionalText(fd.get("description")),
          severity: String(fd.get("severity") ?? "MEDIUM"),
          isBlocker: fd.get("isBlocker") === "on",
          ownerName: optionalText(fd.get("ownerName")),
          ownerResourceId: String(fd.get("ownerResourceId") ?? "") || null,
          relatedRiskId: String(fd.get("relatedRiskId") ?? "") || null,
        });
        e.currentTarget.reset();
      }}
    >
      <h3 className="font-medium">Create issue</h3>
      <p className="text-sm text-[var(--muted)]">
        An issue is a problem that has happened — distinct from a risk (uncertain
        future). Mark BLOCKER when it currently prevents delivery.
      </p>
      {form.ErrorAlert}
      <FormField label="Title" htmlFor="issue-title">
        <input
          id="issue-title"
          name="title"
          required
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Severity" htmlFor="issue-severity">
          <select
            id="issue-severity"
            name="severity"
            defaultValue="MEDIUM"
            className={fieldClassName}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </FormField>
        <FormField label="Owner" htmlFor="issue-owner">
          <select
            id="issue-owner"
            name="ownerResourceId"
            className={fieldClassName}
            defaultValue=""
          >
            <option value="">Unassigned</option>
            {ownerPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {relatedRisks.length > 0 ? (
        <FormField label="Related risk (optional)" htmlFor="issue-risk">
          <select
            id="issue-risk"
            name="relatedRiskId"
            className={fieldClassName}
            defaultValue=""
          >
            <option value="">None</option>
            {relatedRisks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.referenceKey} · {r.title}
              </option>
            ))}
          </select>
        </FormField>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isBlocker" />
        Mark as BLOCKER (currently prevents delivery)
      </label>
      <FormField label="Description" htmlFor="issue-desc">
        <textarea
          id="issue-desc"
          name="description"
          rows={2}
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Creating…" : "Create issue"}
      </PrimaryButton>
    </form>
  );
}

export function UpdateIssueForm({
  issue,
  initiativeId,
  capabilities,
  ownerPeople = [],
}: {
  initiativeId: string;
  issue: {
    id: string;
    version: number;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    isBlocker: boolean;
    ownerName: string | null;
    ownerResourceId: string | null;
    resolution: string | null;
  };
  capabilities?: Caps;
  ownerPeople?: { id: string; name: string; label: string }[];
}) {
  const updateForm = useActionForm(updateIssueAction);
  const statusForm = useActionForm(changeIssueStatusAction);
  const resolveForm = useActionForm(resolveIssueAction);
  const allowed = capabilities?.canEditProject !== false;
  const terminal = issue.status === "RESOLVED" || issue.status === "CLOSED";

  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!allowed) return;
          const fd = new FormData(e.currentTarget);
          updateForm.submit({
            issueId: issue.id,
            initiativeId,
            expectedVersion: issue.version,
            title: String(fd.get("title") ?? ""),
            description: optionalText(fd.get("description")),
            severity: String(fd.get("severity") ?? "MEDIUM"),
            isBlocker: fd.get("isBlocker") === "on",
            ownerName: optionalText(fd.get("ownerName")),
            ownerResourceId: String(fd.get("ownerResourceId") ?? "") || null,
          });
        }}
      >
        {updateForm.ErrorAlert}
        <FormField label="Title" htmlFor={`issue-${issue.id}-title`}>
          <input
            id={`issue-${issue.id}-title`}
            name="title"
            required
            defaultValue={issue.title}
            className={fieldClassName}
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Severity" htmlFor={`issue-${issue.id}-sev`}>
            <select
              id={`issue-${issue.id}-sev`}
              name="severity"
              defaultValue={issue.severity}
              className={fieldClassName}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </FormField>
          <FormField label="Owner" htmlFor={`issue-${issue.id}-owner`}>
            <select
              id={`issue-${issue.id}-owner`}
              name="ownerResourceId"
              className={fieldClassName}
              defaultValue={issue.ownerResourceId ?? ""}
            >
              <option value="">Unassigned</option>
              {ownerPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isBlocker"
            defaultChecked={issue.isBlocker}
          />
          BLOCKER (active only while status is open / in progress)
        </label>
        <FormField label="Description" htmlFor={`issue-${issue.id}-desc`}>
          <textarea
            id={`issue-${issue.id}-desc`}
            name="description"
            rows={2}
            defaultValue={issue.description ?? ""}
            className={fieldClassName}
          />
        </FormField>
        <PrimaryButton
          disabled={!allowed || updateForm.pending}
          title={permissionTitle(allowed)}
        >
          {updateForm.pending ? "Saving…" : "Update issue"}
        </PrimaryButton>
      </form>

      {!terminal ? (
        <form
          className="space-y-3 border-t border-[var(--line)] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!allowed) return;
            const fd = new FormData(e.currentTarget);
            const toStatus = String(fd.get("toStatus") ?? "IN_PROGRESS");
            if (toStatus === "RESOLVED" || toStatus === "CLOSED") {
              resolveForm.submit({
                issueId: issue.id,
                initiativeId,
                expectedVersion: issue.version,
                resolution: String(fd.get("resolution") ?? ""),
                close: toStatus === "CLOSED",
              });
            } else {
              statusForm.submit({
                issueId: issue.id,
                initiativeId,
                expectedVersion: issue.version,
                toStatus,
                resolution: optionalText(fd.get("resolution")),
              });
            }
          }}
        >
          <h4 className="text-sm font-medium">Status</h4>
          {statusForm.ErrorAlert}
          {resolveForm.ErrorAlert}
          <FormField label="Move to" htmlFor={`issue-${issue.id}-status`}>
            <select
              id={`issue-${issue.id}-status`}
              name="toStatus"
              defaultValue={
                issue.status === "OPEN" ? "IN_PROGRESS" : "RESOLVED"
              }
              className={fieldClassName}
            >
              {issue.status === "OPEN" ? (
                <option value="IN_PROGRESS">In progress</option>
              ) : null}
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </FormField>
          <FormField
            label="Resolution (required when resolving)"
            htmlFor={`issue-${issue.id}-resolution`}
          >
            <textarea
              id={`issue-${issue.id}-resolution`}
              name="resolution"
              rows={2}
              defaultValue={issue.resolution ?? ""}
              className={fieldClassName}
            />
          </FormField>
          <PrimaryButton
            disabled={!allowed || statusForm.pending || resolveForm.pending}
            title={permissionTitle(allowed)}
          >
            {statusForm.pending || resolveForm.pending
              ? "Updating…"
              : "Apply status"}
          </PrimaryButton>
        </form>
      ) : (
        <form
          className="space-y-3 border-t border-[var(--line)] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!allowed) return;
            const fd = new FormData(e.currentTarget);
            statusForm.submit({
              issueId: issue.id,
              initiativeId,
              expectedVersion: issue.version,
              toStatus: String(fd.get("toStatus") ?? "OPEN"),
            });
          }}
        >
          <h4 className="text-sm font-medium">Reopen</h4>
          {statusForm.ErrorAlert}
          <FormField label="Reopen as" htmlFor={`issue-${issue.id}-reopen`}>
            <select
              id={`issue-${issue.id}-reopen`}
              name="toStatus"
              defaultValue="OPEN"
              className={fieldClassName}
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
            </select>
          </FormField>
          <PrimaryButton
            disabled={!allowed || statusForm.pending}
            title={permissionTitle(allowed)}
          >
            {statusForm.pending ? "Reopening…" : "Reopen issue"}
          </PrimaryButton>
        </form>
      )}
    </div>
  );
}

type ReadinessCheck = {
  code: string;
  level: "hard" | "warning";
  message: string;
};

type ClosureReadinessView = {
  canClose: boolean;
  hardBlockers: ReadinessCheck[];
  warnings: ReadinessCheck[];
  counts: {
    incompleteMilestones: number;
    incompleteWorkItems: number;
    openIssues: number;
    activeBlockers: number;
    criticalOpenIssues: number;
  };
};

/**
 * Project closure panel — readiness + explicit confirmation (Phase 1D).
 */
export function CloseProjectPanel({
  project,
  initiativeId,
  readiness,
  capabilities,
}: {
  initiativeId: string;
  project: {
    id: string;
    version: number;
    name: string;
    referenceKey: string;
    status: string;
  };
  readiness: ClosureReadinessView;
  capabilities?: Caps;
}) {
  const form = useActionForm(closeProjectAction);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const allowed = capabilities?.canCloseProject === true;
  const closed =
    project.status === "COMPLETED" || project.status === "CANCELLED";

  if (closed) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-medium">Project closure</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Closure is an explicit authorized action. It does not rewrite issues,
          milestones, or work items.
        </p>
      </div>

      <div className="space-y-2 rounded-md border border-[var(--line)] p-3 text-sm">
        <p className="font-medium">Closure readiness</p>
        {readiness.hardBlockers.length === 0 &&
        readiness.warnings.length === 0 ? (
          <Alert tone="success">Ready to close</Alert>
        ) : null}
        {readiness.hardBlockers.map((b) => (
          <Alert key={b.code} tone="error">
            {b.message}
          </Alert>
        ))}
        {readiness.warnings.map((w) => (
          <Alert key={w.code} tone="warning">
            {w.message}
          </Alert>
        ))}
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setConfirmError(null);
          if (!allowed) {
            setConfirmError(
              permissionTitle(false) ??
                "You do not have permission to close this project.",
            );
            return;
          }
          if (!readiness.canClose) {
            setConfirmError("Resolve hard blockers before closing.");
            return;
          }
          const fd = new FormData(e.currentTarget);
          const outcome = String(fd.get("outcome") ?? "DELIVERED");
          const confirmed = fd.get("confirmClose") === "on";
          if (!confirmed) {
            setConfirmError(
              "Check “Confirm close” before submitting. Closure is final for this phase.",
            );
            return;
          }
          form.submit({
            projectId: project.id,
            initiativeId,
            expectedVersion: project.version,
            outcome,
            summary: optionalText(fd.get("summary")),
            lessonsLearned: optionalText(fd.get("lessonsLearned")),
            finalDeliveryNote: optionalText(fd.get("finalDeliveryNote")),
            acknowledgeWarnings: fd.get("acknowledgeWarnings") === "on",
          });
        }}
      >
        {form.ErrorAlert}
        {confirmError ? <Alert tone="error">{confirmError}</Alert> : null}
        <FormField label="Outcome" htmlFor="close-outcome">
          <select
            id="close-outcome"
            name="outcome"
            className={fieldClassName}
            defaultValue="DELIVERED"
            disabled={!allowed}
          >
            <option value="DELIVERED">Delivered</option>
            <option value="PARTIALLY_DELIVERED">Partially delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </FormField>
        <FormField label="Summary" htmlFor="close-summary">
          <textarea
            id="close-summary"
            name="summary"
            rows={3}
            className={fieldClassName}
            disabled={!allowed}
            placeholder="What was delivered or why cancelled"
          />
        </FormField>
        <FormField label="Final delivery note" htmlFor="close-delivery">
          <textarea
            id="close-delivery"
            name="finalDeliveryNote"
            rows={2}
            className={fieldClassName}
            disabled={!allowed}
          />
        </FormField>
        <FormField label="Lessons learned" htmlFor="close-lessons">
          <textarea
            id="close-lessons"
            name="lessonsLearned"
            rows={2}
            className={fieldClassName}
            disabled={!allowed}
          />
        </FormField>
        {readiness.warnings.length > 0 ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="acknowledgeWarnings"
              className="mt-1"
              disabled={!allowed}
            />
            <span>
              I acknowledge unresolved warnings and accept closing with
              incomplete work left as historical evidence.
            </span>
          </label>
        ) : null}
        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="confirmClose"
            className="mt-1"
            disabled={!allowed || !readiness.canClose}
          />
          <span>
            Confirm close of {project.referenceKey} — {project.name}. This
            action is final for Phase 1D.
          </span>
        </label>
        <PrimaryButton
          disabled={!allowed || !readiness.canClose || form.pending}
          title={
            !allowed
              ? permissionTitle(false)
              : !readiness.canClose
                ? "Resolve hard blockers before closing"
                : undefined
          }
        >
          {form.pending ? "Closing…" : "Close project"}
        </PrimaryButton>
      </form>
    </div>
  );
}

export function ClosedProjectBanner({
  closure,
  projectStatus,
}: {
  projectStatus: string;
  closure: {
    outcome: string;
    closedAt: Date | string;
    summary: string | null;
    lessonsLearned: string | null;
    finalDeliveryNote: string | null;
    closedBy: { displayName: string | null; email: string | null } | null;
  } | null;
}) {
  if (!closure && projectStatus !== "COMPLETED" && projectStatus !== "CANCELLED") {
    return null;
  }
  const closedAt = closure?.closedAt
    ? typeof closure.closedAt === "string"
      ? new Date(closure.closedAt)
      : closure.closedAt
    : null;
  const closedBy =
    closure?.closedBy?.displayName ||
    closure?.closedBy?.email ||
    "Unknown principal";

  return (
    <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
      <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
        Closed · read-only
      </p>
      <p className="text-lg font-semibold text-[var(--ink)]">
        {humanizeSafe(projectStatus)}
        {closure ? ` · ${humanizeSafe(closure.outcome)}` : ""}
      </p>
      <Alert tone="warning">
        Delivery mutations are disabled. Editable create/update controls are
        hidden. Historical work items, issues, milestones, and the closure
        record remain visible below.
      </Alert>
      {closedAt ? (
        <p className="text-sm text-[var(--muted)]">
          Closed {closedAt.toISOString().slice(0, 10)} by {closedBy}
        </p>
      ) : null}
      {closure?.summary ? (
        <p className="text-sm whitespace-pre-wrap">{closure.summary}</p>
      ) : null}
      {closure?.finalDeliveryNote ? (
        <p className="text-sm text-[var(--muted)]">
          Delivery note: {closure.finalDeliveryNote}
        </p>
      ) : null}
      {closure?.lessonsLearned ? (
        <p className="text-sm text-[var(--muted)]">
          Lessons: {closure.lessonsLearned}
        </p>
      ) : null}
    </div>
  );
}

function humanizeSafe(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
