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
  // Phase 4 — Pilot + Project + policy admin
  PILOT_CREATE: "pilot.create",
  PILOT_EDIT: "pilot.edit",
  PILOT_TRANSITION: "pilot.transition",
  PILOT_EVALUATE: "pilot.evaluate",
  PROJECT_CONVERT: "project.convert",
  PROJECT_VIEW: "project.view",
  PROJECT_EDIT: "project.edit",
  /** Explicit Project closure — not granted via Project Owner ownership (ADR-025). */
  PROJECT_CLOSE: "project.close",
  PROJECT_MANAGE_MILESTONES: "project.manage_milestones",
  PROJECT_MANAGE_WORKITEMS: "project.manage_workitems",
  GOVERNANCE_POLICY_MANAGE: "governance.policy.manage",
  // Phase 5 — PI Planning
  PI_VIEW: "pi.view",
  PI_CREATE: "pi.create",
  PI_EDIT: "pi.edit",
  PI_TRANSITION: "pi.transition",
  PI_ALLOCATE: "pi.allocate",
  PI_MANAGE_CAPACITY: "pi.manage_capacity",
  PI_MANAGE_DEPENDENCY: "pi.manage_dependency",
  PI_REVIEW: "pi.review",
  PI_BASELINE: "pi.baseline",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * System role packs (Phase 0C). Roles are permission packs — scope comes from RoleBinding.
 */
export const ROLE_KEYS = {
  PLATFORM_BOOTSTRAP_ADMIN: "platform.bootstrap_admin",
  ORGANIZATION_ADMIN: "organization.admin",
  SECTION_MANAGER: "section.manager",
  DEPARTMENT_MANAGER: "department.manager",
  TEAM_MANAGER: "team.manager",
  PORTFOLIO_MANAGER: "portfolio.manager",
  PROJECT_MANAGER: "project.manager",
  VIEWER: "organization.viewer",
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];
