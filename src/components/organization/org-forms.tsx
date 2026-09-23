"use client";

import {
  createDepartmentAction,
  createResourceAction,
  createSectionAction,
  createTeamAction,
  updateDepartmentAction,
  updateOrganizationAction,
  updateResourceAction,
  updateSectionAction,
  updateTeamAction,
  assignMembershipAction,
} from "@/app/actions/organization";
import {
  FormField,
  PrimaryButton,
  fieldClassName,
  useActionForm,
} from "@/components/ui/forms";

export function EditOrganizationForm({
  id,
  name,
  description,
  version,
}: {
  id: string;
  name: string;
  description: string | null;
  version: number;
}) {
  const form = useActionForm(updateOrganizationAction);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          id,
          expectedVersion: version,
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? "") || null,
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Name" htmlFor="org-name">
        <input
          id="org-name"
          name="name"
          defaultValue={name}
          required
          maxLength={200}
          className={fieldClassName}
        />
      </FormField>
      <FormField label="Description" htmlFor="org-description">
        <textarea
          id="org-description"
          name="description"
          defaultValue={description ?? ""}
          maxLength={2000}
          rows={3}
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Saving…" : "Save changes"}
      </PrimaryButton>
    </form>
  );
}

export function CreateSectionForm({ organizationId }: { organizationId: string }) {
  const form = useActionForm(createSectionAction);
  return (
    <EntityCreateForm
      title="Add section"
      form={form}
      onSubmit={(fd) =>
        form.submit({
          organizationId,
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? "") || null,
        })
      }
    />
  );
}

export function EditSectionForm(props: {
  id: string;
  name: string;
  description: string | null;
  version: number;
}) {
  const form = useActionForm(updateSectionAction);
  return (
    <EntityEditForm
      {...props}
      form={form}
      onSubmit={(fd) =>
        form.submit({
          id: props.id,
          expectedVersion: props.version,
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? "") || null,
        })
      }
    />
  );
}

export function CreateDepartmentForm({ sectionId }: { sectionId: string }) {
  const form = useActionForm(createDepartmentAction);
  return (
    <EntityCreateForm
      title="Add department"
      form={form}
      onSubmit={(fd) =>
        form.submit({
          sectionId,
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? "") || null,
        })
      }
    />
  );
}

export function EditDepartmentForm(props: {
  id: string;
  name: string;
  description: string | null;
  version: number;
}) {
  const form = useActionForm(updateDepartmentAction);
  return (
    <EntityEditForm
      {...props}
      form={form}
      onSubmit={(fd) =>
        form.submit({
          id: props.id,
          expectedVersion: props.version,
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? "") || null,
        })
      }
    />
  );
}

export function CreateTeamForm({ departmentId }: { departmentId: string }) {
  const form = useActionForm(createTeamAction);
  return (
    <EntityCreateForm
      title="Add team"
      form={form}
      onSubmit={(fd) =>
        form.submit({
          departmentId,
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? "") || null,
        })
      }
    />
  );
}

export function EditTeamForm(props: {
  id: string;
  name: string;
  description: string | null;
  version: number;
}) {
  const form = useActionForm(updateTeamAction);
  return (
    <EntityEditForm
      {...props}
      form={form}
      onSubmit={(fd) =>
        form.submit({
          id: props.id,
          expectedVersion: props.version,
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? "") || null,
        })
      }
    />
  );
}

export function CreateResourceForm({
  organizationId,
  teams,
}: {
  organizationId: string;
  teams: { id: string; name: string }[];
}) {
  const form = useActionForm(createResourceAction);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const skillsRaw = String(fd.get("skills") ?? "");
        const skills = skillsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const capacity = String(fd.get("capacityHoursPerWeek") ?? "");
        form.submit({
          organizationId,
          name: String(fd.get("name") ?? ""),
          referenceCode: String(fd.get("referenceCode") ?? "") || null,
          type: String(fd.get("type") ?? "PERSON"),
          functionRole: String(fd.get("functionRole") ?? "") || null,
          skills,
          capacityHoursPerWeek: capacity ? Number(capacity) : null,
          primaryTeamId: String(fd.get("primaryTeamId") ?? "") || null,
        });
      }}
    >
      <h3 className="font-medium">Add resource</h3>
      {form.ErrorAlert}
      <FormField label="Name" htmlFor="resource-name">
        <input id="resource-name" name="name" required maxLength={200} className={fieldClassName} />
      </FormField>
      <FormField label="Reference code" htmlFor="resource-ref" hint="Optional stable business reference.">
        <input id="resource-ref" name="referenceCode" maxLength={100} className={fieldClassName} />
      </FormField>
      <FormField label="Type" htmlFor="resource-type" hint="Resources are not user accounts. PERSON or OTHER.">
        <select id="resource-type" name="type" className={fieldClassName} defaultValue="PERSON">
          <option value="PERSON">Person</option>
          <option value="OTHER">Other</option>
        </select>
      </FormField>
      <FormField label="Function / role label" htmlFor="resource-function">
        <input id="resource-function" name="functionRole" maxLength={200} className={fieldClassName} />
      </FormField>
      <FormField label="Skills" htmlFor="resource-skills" hint="Comma-separated. Extensible later.">
        <input id="resource-skills" name="skills" className={fieldClassName} placeholder="e.g. architecture, integration" />
      </FormField>
      <FormField label="Capacity hours / week" htmlFor="resource-capacity">
        <input id="resource-capacity" name="capacityHoursPerWeek" type="number" min={0} max={168} step="0.5" className={fieldClassName} />
      </FormField>
      <FormField label="Primary team" htmlFor="resource-team" hint="Optional. Membership is explicit and can support multiple teams later.">
        <select id="resource-team" name="primaryTeamId" className={fieldClassName} defaultValue="">
          <option value="">No team yet</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Creating…" : "Create resource"}
      </PrimaryButton>
    </form>
  );
}

export function EditResourceForm(props: {
  id: string;
  name: string;
  referenceCode: string | null;
  type: "PERSON" | "OTHER";
  functionRole: string | null;
  skills: string[];
  capacityHoursPerWeek: number | null;
  version: number;
}) {
  const form = useActionForm(updateResourceAction);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const skillsRaw = String(fd.get("skills") ?? "");
        const skills = skillsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const capacity = String(fd.get("capacityHoursPerWeek") ?? "");
        form.submit({
          id: props.id,
          expectedVersion: props.version,
          name: String(fd.get("name") ?? ""),
          referenceCode: String(fd.get("referenceCode") ?? "") || null,
          type: String(fd.get("type") ?? "PERSON"),
          functionRole: String(fd.get("functionRole") ?? "") || null,
          skills,
          capacityHoursPerWeek: capacity ? Number(capacity) : null,
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Name" htmlFor="edit-resource-name">
        <input id="edit-resource-name" name="name" defaultValue={props.name} required className={fieldClassName} />
      </FormField>
      <FormField label="Reference code" htmlFor="edit-resource-ref">
        <input id="edit-resource-ref" name="referenceCode" defaultValue={props.referenceCode ?? ""} className={fieldClassName} />
      </FormField>
      <FormField label="Type" htmlFor="edit-resource-type">
        <select id="edit-resource-type" name="type" defaultValue={props.type} className={fieldClassName}>
          <option value="PERSON">Person</option>
          <option value="OTHER">Other</option>
        </select>
      </FormField>
      <FormField label="Function / role label" htmlFor="edit-resource-function">
        <input id="edit-resource-function" name="functionRole" defaultValue={props.functionRole ?? ""} className={fieldClassName} />
      </FormField>
      <FormField label="Skills" htmlFor="edit-resource-skills">
        <input id="edit-resource-skills" name="skills" defaultValue={props.skills.join(", ")} className={fieldClassName} />
      </FormField>
      <FormField label="Capacity hours / week" htmlFor="edit-resource-capacity">
        <input
          id="edit-resource-capacity"
          name="capacityHoursPerWeek"
          type="number"
          min={0}
          max={168}
          step="0.5"
          defaultValue={props.capacityHoursPerWeek ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Saving…" : "Save resource"}
      </PrimaryButton>
    </form>
  );
}

export function AssignMembershipForm({
  resourceId,
  teams,
}: {
  resourceId: string;
  teams: { id: string; name: string }[];
}) {
  const form = useActionForm(assignMembershipAction);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        form.submit({
          resourceId,
          teamId: String(fd.get("teamId") ?? ""),
          isPrimary: fd.get("isPrimary") === "on",
        });
      }}
    >
      <h3 className="font-medium">Assign team membership</h3>
      {form.ErrorAlert}
      <FormField label="Team" htmlFor="membership-team">
        <select id="membership-team" name="teamId" required className={fieldClassName} defaultValue="">
          <option value="" disabled>
            Select a team
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPrimary" />
        Primary membership
      </label>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Saving…" : "Assign membership"}
      </PrimaryButton>
    </form>
  );
}

function EntityCreateForm({
  title,
  form,
  onSubmit,
}: {
  title: string;
  form: ReturnType<typeof useActionForm>;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <h3 className="font-medium">{title}</h3>
      {form.ErrorAlert}
      <FormField label="Name" htmlFor={`${title}-name`}>
        <input id={`${title}-name`} name="name" required maxLength={200} className={fieldClassName} />
      </FormField>
      <FormField label="Description" htmlFor={`${title}-description`}>
        <textarea id={`${title}-description`} name="description" rows={2} maxLength={2000} className={fieldClassName} />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Creating…" : "Create"}
      </PrimaryButton>
    </form>
  );
}

function EntityEditForm({
  name,
  description,
  form,
  onSubmit,
}: {
  id: string;
  name: string;
  description: string | null;
  version: number;
  form: ReturnType<typeof useActionForm>;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      {form.ErrorAlert}
      <FormField label="Name" htmlFor="edit-name">
        <input id="edit-name" name="name" defaultValue={name} required maxLength={200} className={fieldClassName} />
      </FormField>
      <FormField label="Description" htmlFor="edit-description">
        <textarea
          id="edit-description"
          name="description"
          defaultValue={description ?? ""}
          rows={2}
          maxLength={2000}
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Saving…" : "Save changes"}
      </PrimaryButton>
    </form>
  );
}
