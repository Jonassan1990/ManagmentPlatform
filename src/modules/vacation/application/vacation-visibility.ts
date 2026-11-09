import type { DepartmentTreeRow } from "@/modules/organization/application/department-tree";
import { descendantDepartmentIds } from "@/modules/organization/application/department-tree";

export type VacationScopeBinding = {
  scopeType: "ORGANIZATION" | "SECTION" | "DEPARTMENT" | "TEAM" | "PLATFORM";
  scopeId: string | null;
};

export type VacationVisibilityFilter = {
  organizationId: string;
  OR?: Array<
    | { requesterPrincipalId: string }
    | { sectionId: { in: string[] } }
    | { departmentId: { in: string[] } }
  >;
};

/**
 * People with vacation view only inside a section, department, or team
 * should see that slice plus their own requests — not be rejected for
 * lacking an organization-wide grant.
 */
export function vacationVisibilityFilter(input: {
  organizationId: string;
  principalId: string;
  bindings: VacationScopeBinding[];
  teamDepartmentIds: string[];
  departments: DepartmentTreeRow[];
}): VacationVisibilityFilter {
  if (input.bindings.some((binding) => binding.scopeType === "ORGANIZATION")) {
    return { organizationId: input.organizationId };
  }

  const sectionIds = unique(
    input.bindings
      .filter((binding) => binding.scopeType === "SECTION" && binding.scopeId)
      .map((binding) => binding.scopeId!),
  );
  const departmentIds = new Set(
    input.bindings
      .filter(
        (binding) => binding.scopeType === "DEPARTMENT" && binding.scopeId,
      )
      .map((binding) => binding.scopeId!),
  );
  for (const departmentId of input.teamDepartmentIds) {
    departmentIds.add(departmentId);
  }
  for (const departmentId of [...departmentIds]) {
    for (const child of descendantDepartmentIds(
      departmentId,
      input.departments,
    )) {
      departmentIds.add(child);
    }
  }

  const or: NonNullable<VacationVisibilityFilter["OR"]> = [
    { requesterPrincipalId: input.principalId },
  ];
  if (sectionIds.length > 0) or.push({ sectionId: { in: sectionIds } });
  if (departmentIds.size > 0) {
    or.push({ departmentId: { in: [...departmentIds] } });
  }
  return { organizationId: input.organizationId, OR: or };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
