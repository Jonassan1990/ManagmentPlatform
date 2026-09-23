"use client";

import {
  createMilestoneAction,
  createWorkItemAction,
  updateBudgetAction,
  updateMilestoneAction,
  updateProjectAction,
  updateWorkItemAction,
} from "@/app/actions/project";
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
}: {
  initiativeId: string;
  project: {
    id: string;
    version: number;
    name: string;
    description: string | null;
    ownerName: string | null;
    status: string;
    priority: string;
    plannedStart: Date | string | null;
    plannedEnd: Date | string | null;
    objectives: string | null;
  };
  capabilities?: Caps;
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
        <FormField label="Owner" htmlFor="project-owner">
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
            defaultValue={project.status}
          >
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ARCHIVED">Archived</option>
          </select>
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
