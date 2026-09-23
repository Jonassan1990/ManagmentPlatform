export const PERMISSIONS = {
  ORG_STRUCTURE_READ: "org.structure.read",
  ORG_STRUCTURE_MANAGE: "org.structure.manage",
  PLATFORM_BOOTSTRAP: "platform.bootstrap",
  AUDIT_READ: "audit.read",
  ROLE_MANAGE: "role.manage",
  // Phase 2 — Initiative
  INITIATIVE_VIEW: "initiative.view",
  INITIATIVE_CREATE: "initiative.create",
  INITIATIVE_EDIT: "initiative.edit",
  INITIATIVE_MANAGE_DEMAND: "initiative.manage_demand",
  INITIATIVE_MANAGE_REQUIREMENTS: "initiative.manage_requirements",
  INITIATIVE_MANAGE_PRESTUDY: "initiative.manage_prestudy",
  INITIATIVE_MANAGE_RISK: "initiative.manage_risk",
  INITIATIVE_ADVANCE: "initiative.advance",
  // Phase 3 — Governance + Approvals + Decisions + PoC
  GOVERNANCE_VIEW: "governance.view",
  GOVERNANCE_SUBMIT: "governance.submit",
  APPROVAL_REVIEW: "approval.review",
  DECISION_MAKE: "decision.make",
  DECISION_CONDITION_RESOLVE: "decision.condition.resolve",
  POC_CREATE: "poc.create",
  POC_EDIT: "poc.edit",
  POC_TRANSITION: "poc.transition",
  POC_EVALUATE: "poc.evaluate",
  APPROVAL_AUTHORITY_BUSINESS: "approval.authority.business",
  APPROVAL_AUTHORITY_ARCHITECTURE: "approval.authority.architecture",
  APPROVAL_AUTHORITY_SECURITY: "approval.authority.security",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_KEYS = {
  PLATFORM_BOOTSTRAP_ADMIN: "platform.bootstrap_admin",
  ORGANIZATION_ADMIN: "organization.admin",
} as const;
