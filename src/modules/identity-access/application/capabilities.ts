import type { AuthorizationService } from "./authorization-service";
import type { Principal } from "../domain/types";
import { PERMISSIONS } from "@/modules/shared/permissions";

/**
 * UI capability flags derived from authorization — never hardcoded identities.
 */
export type PrincipalCapabilities = {
  canViewGovernance: boolean;
  canSubmitGovernance: boolean;
  canReviewApprovals: boolean;
  canMakeDecisions: boolean;
  canResolveConditions: boolean;
  canCreatePoC: boolean;
  canEditPoC: boolean;
  canTransitionPoC: boolean;
  canEvaluatePoC: boolean;
  canCreatePilot: boolean;
  canEditPilot: boolean;
  canTransitionPilot: boolean;
  canEvaluatePilot: boolean;
  canConvertProject: boolean;
  canViewProject: boolean;
  canEditProject: boolean;
  canManageMilestones: boolean;
  canManageWorkItems: boolean;
  canManageGovernancePolicy: boolean;
};

export async function resolveCapabilities(
  authz: AuthorizationService,
  principal: Principal,
  organizationId: string,
): Promise<PrincipalCapabilities> {
  const scope = { type: "ORGANIZATION" as const, organizationId };
  const check = (permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) =>
    authz.can(principal, permission, scope);

  const [
    canViewGovernance,
    canSubmitGovernance,
    canReviewApprovals,
    canMakeDecisions,
    canResolveConditions,
    canCreatePoC,
    canEditPoC,
    canTransitionPoC,
    canEvaluatePoC,
    canCreatePilot,
    canEditPilot,
    canTransitionPilot,
    canEvaluatePilot,
    canConvertProject,
    canViewProject,
    canEditProject,
    canManageMilestones,
    canManageWorkItems,
    canManageGovernancePolicy,
  ] = await Promise.all([
    check(PERMISSIONS.GOVERNANCE_VIEW),
    check(PERMISSIONS.GOVERNANCE_SUBMIT),
    check(PERMISSIONS.APPROVAL_REVIEW),
    check(PERMISSIONS.DECISION_MAKE),
    check(PERMISSIONS.DECISION_CONDITION_RESOLVE),
    check(PERMISSIONS.POC_CREATE),
    check(PERMISSIONS.POC_EDIT),
    check(PERMISSIONS.POC_TRANSITION),
    check(PERMISSIONS.POC_EVALUATE),
    check(PERMISSIONS.PILOT_CREATE),
    check(PERMISSIONS.PILOT_EDIT),
    check(PERMISSIONS.PILOT_TRANSITION),
    check(PERMISSIONS.PILOT_EVALUATE),
    check(PERMISSIONS.PROJECT_CONVERT),
    check(PERMISSIONS.PROJECT_VIEW),
    check(PERMISSIONS.PROJECT_EDIT),
    check(PERMISSIONS.PROJECT_MANAGE_MILESTONES),
    check(PERMISSIONS.PROJECT_MANAGE_WORKITEMS),
    check(PERMISSIONS.GOVERNANCE_POLICY_MANAGE),
  ]);

  return {
    canViewGovernance,
    canSubmitGovernance,
    canReviewApprovals,
    canMakeDecisions,
    canResolveConditions,
    canCreatePoC,
    canEditPoC,
    canTransitionPoC,
    canEvaluatePoC,
    canCreatePilot,
    canEditPilot,
    canTransitionPilot,
    canEvaluatePilot,
    canConvertProject,
    canViewProject,
    canEditProject,
    canManageMilestones,
    canManageWorkItems,
    canManageGovernancePolicy,
  };
}
