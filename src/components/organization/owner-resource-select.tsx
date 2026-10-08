"use client";

import { FormField, fieldClassName } from "@/components/ui/forms";

export type OwnerPersonOption = {
  id: string;
  name: string;
  label: string;
  teamName?: string | null;
  departmentName?: string | null;
};

/**
 * Phase 0B — select a PERSON Resource as business owner.
 * Does not expose technical IDs in the visible label.
 */
export function OwnerResourceSelect({
  id,
  name = "ownerResourceId",
  label,
  hint,
  people,
  defaultValue,
  allowEmpty = true,
  emptyLabel = "No structured owner (use text snapshot)",
  required = false,
}: {
  id: string;
  name?: string;
  label: string;
  hint?: string;
  people: OwnerPersonOption[];
  defaultValue?: string | null;
  allowEmpty?: boolean;
  emptyLabel?: string;
  required?: boolean;
}) {
  return (
    <FormField label={label} htmlFor={id} hint={hint}>
      <select
        id={id}
        name={name}
        className={fieldClassName}
        defaultValue={defaultValue ?? ""}
        required={required}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label || p.name}
          </option>
        ))}
      </select>
    </FormField>
  );
}
