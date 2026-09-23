"use client";

import { updateApprovalTemplateAction } from "@/app/actions/policy";
import {
  FormField,
  PrimaryButton,
  fieldClassName,
  permissionTitle,
  useActionForm,
} from "@/components/ui/forms";
import type { PrincipalCapabilities } from "@/modules/identity-access/application/capabilities";

type Caps = Partial<PrincipalCapabilities>;

export function UpdateApprovalTemplateForm({
  template,
  organizationId,
  capabilities,
}: {
  organizationId: string;
  template: {
    id: string;
    gateType: string;
    authorityKey: string;
    requiredPermission: string;
    label: string;
    required: boolean;
    active: boolean;
    sortOrder: number;
    conditionNote: string | null;
    policyVersion: number;
  };
  capabilities?: Caps;
}) {
  const form = useActionForm(updateApprovalTemplateAction);
  const allowed = capabilities?.canManageGovernancePolicy !== false;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed) return;
        const fd = new FormData(e.currentTarget);
        form.submit({
          id: template.id,
          organizationId,
          active: fd.get("active") === "on",
          required: fd.get("required") === "on",
          authorityKey: String(fd.get("authorityKey") ?? ""),
          requiredPermission: String(fd.get("requiredPermission") ?? ""),
          label: String(fd.get("label") ?? ""),
          sortOrder: Number(fd.get("sortOrder") ?? 0),
          conditionNote: String(fd.get("conditionNote") ?? "").trim() || null,
        });
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{template.label}</h3>
          <p className="text-xs text-[var(--muted)]">
            {template.gateType.replaceAll("_", " ")} · policy v
            {template.policyVersion} · {template.authorityKey}
          </p>
        </div>
      </div>
      {form.ErrorAlert}
      <FormField label="Label" htmlFor={`tpl-${template.id}-label`}>
        <input
          id={`tpl-${template.id}-label`}
          name="label"
          required
          defaultValue={template.label}
          className={fieldClassName}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Authority key" htmlFor={`tpl-${template.id}-auth`}>
          <input
            id={`tpl-${template.id}-auth`}
            name="authorityKey"
            required
            defaultValue={template.authorityKey}
            className={fieldClassName}
          />
        </FormField>
        <FormField
          label="Required permission"
          htmlFor={`tpl-${template.id}-perm`}
        >
          <input
            id={`tpl-${template.id}-perm`}
            name="requiredPermission"
            required
            defaultValue={template.requiredPermission}
            className={fieldClassName}
          />
        </FormField>
        <FormField label="Sort order" htmlFor={`tpl-${template.id}-sort`}>
          <input
            id={`tpl-${template.id}-sort`}
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={template.sortOrder}
            className={fieldClassName}
          />
        </FormField>
      </div>
      <FormField label="Condition note" htmlFor={`tpl-${template.id}-note`}>
        <textarea
          id={`tpl-${template.id}-note`}
          name="conditionNote"
          rows={2}
          defaultValue={template.conditionNote ?? ""}
          className={fieldClassName}
        />
      </FormField>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={template.active} />
          Enabled
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="required"
            defaultChecked={template.required}
          />
          Required
        </label>
      </div>
      <PrimaryButton
        disabled={!allowed || form.pending}
        title={permissionTitle(allowed)}
      >
        {form.pending ? "Saving…" : "Save template (new version)"}
      </PrimaryButton>
    </form>
  );
}
