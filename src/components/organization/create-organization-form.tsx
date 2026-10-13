"use client";

import { useRouter } from "next/navigation";
import { createOrganizationAction } from "@/app/actions/organization";
import {
  FormField,
  PrimaryButton,
  fieldClassName,
  useActionForm,
} from "@/components/ui/forms";

export function CreateOrganizationForm({
  redirectToOrg = true,
  parents = [],
}: {
  redirectToOrg?: boolean;
  parents?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const form = useActionForm(createOrganizationAction, (data) => {
    const org = data as { id: string };
    if (redirectToOrg) {
      router.push(`/organization/${org.id}`);
    }
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        const parent = String(fd.get("parentOrganizationId") ?? "");
        form.submit({
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? "") || null,
          parentOrganizationId: parent || null,
        });
      }}
    >
      {form.ErrorAlert}
      <FormField label="Organization name" htmlFor="name">
        <input
          id="name"
          name="name"
          required
          maxLength={200}
          className={fieldClassName}
          placeholder="Q, QD, QM, QC"
        />
      </FormField>
      <FormField
        label="Inside organization"
        htmlFor="parentOrganizationId"
        hint="Leave empty for the main organization, such as Q. Choose Q when creating QD, QM, or QC."
      >
        <select id="parentOrganizationId" name="parentOrganizationId" className={fieldClassName} defaultValue="">
          <option value="">Top level</option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Description"
        htmlFor="description"
        hint="Optional. Keep it short and meaningful for managers."
      >
        <textarea
          id="description"
          name="description"
          maxLength={2000}
          rows={3}
          className={fieldClassName}
        />
      </FormField>
      <PrimaryButton disabled={form.pending}>
        {form.pending ? "Creating…" : "Create organization"}
      </PrimaryButton>
    </form>
  );
}
