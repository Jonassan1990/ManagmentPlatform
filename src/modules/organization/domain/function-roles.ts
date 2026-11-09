/**
 * Job-role catalog. Person records, onboarding drafts, and demo users
 * take their role names from this list.
 */

export type FunctionRole = {
  key: string;
  label: FunctionRoleLabel;
};

export const FUNCTION_ROLE_LABELS = [
  "Senior Manager",
  "Manager",
  "Product Manager",
  "Product Owner",
  "Technical Product Owner",
  "Scrum Master",
  "Project Manager",
  "IT Program & Project Manager",
  "Enterprise Architect",
  "Business Architect",
  "Solution Architect",
  "Lead Solution Architect",
  "Infrastructure Architect",
  "Integration Architect",
  "System Architect",
  "Software Architect",
  "ERP Solution Architect",
  "SAP Architect",
  "Developer",
  "Software Developer",
  "Integration Developer",
  "Front End Developer",
  "DevOps",
  "IT Developer",
  "Business IT Solution Developer",
  "Tester",
  "Test Engineer",
  "IT Business Analyst",
  "System Analyst",
  "Business IT Analyst",
  "ERP Functional Analyst",
  "SAP Analyst",
  "Requirements Analyst",
  "Data Engineer",
  "Data Scientist",
  "Infrastructure Engineer",
  "Infrastructure Specialist",
  "Network Technician",
  "IT Technician",
  "IT Support Specialist",
  "IT Service Manager",
  "Service Delivery Manager",
  "Service Manager",
  "IT Security Specialist",
  "IT Security Coordinator",
  "IAM Specialist",
  "Information Manager",
  "Information Risk and Compliance Officer",
  "Portfolio Manager",
  "Business Relationship Manager",
  "Contract Manager",
  "Software Asset Manager",
  "System Responsible",
  "Tech Lead",
  "Technical Lead",
  "IT Consultant",
] as const;

export type FunctionRoleLabel = (typeof FUNCTION_ROLE_LABELS)[number];

export function functionRoleKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const FUNCTION_ROLES: FunctionRole[] = FUNCTION_ROLE_LABELS.map(
  (label) => ({
    key: functionRoleKey(label),
    label,
  }),
);

const FUNCTION_ROLE_LABEL_SET = new Set<string>(FUNCTION_ROLE_LABELS);

export function isFunctionRoleLabel(value: string): value is FunctionRoleLabel {
  return FUNCTION_ROLE_LABEL_SET.has(value);
}

/** Catalog options, plus a stored label that predates the catalog. */
export function functionRoleSelectOptions(
  current: string | null | undefined,
): string[] {
  const labels: string[] = [...FUNCTION_ROLE_LABELS];
  const extra = current?.trim();
  if (extra && !FUNCTION_ROLE_LABEL_SET.has(extra)) labels.unshift(extra);
  return labels;
}

export function functionRoleAt(index: number): FunctionRoleLabel {
  const label = FUNCTION_ROLE_LABELS[index % FUNCTION_ROLE_LABELS.length];
  if (!label) return FUNCTION_ROLE_LABELS[0];
  return label;
}
