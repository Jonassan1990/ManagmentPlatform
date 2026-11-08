import type { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import type { ShellNavCapabilities } from "@/modules/navigation/types";
import { PERMISSIONS } from "@/modules/shared/permissions";

export type ShellNavContext = {
  capabilities: ShellNavCapabilities;
  organizationId: string | null;
};

/**
 * Resolve shell navigation visibility by OR-ing permissions across
 * organizations the principal can list. Does not grant access — only
 * decides whether a nav destination is offered.
 *
 * Uses organization-local RoleBinding permission presence (any scope depth)
 * so Section/Department/Team managers still see Initiatives / PI destinations
 * they are authorized to open at their scope. Server assertCan remains authoritative.
 */
export async function resolveShellNavContext(
  authz: AuthorizationService,
  principal: Principal,
  organizationIds: string[],
): Promise<ShellNavContext> {
  if (organizationIds.length === 0) {
    return {
      organizationId: null,
      capabilities: {
        canViewApprovals: false,
        canViewDecisions: false,
        canManageGovernancePolicy: false,
        canManageAccess: false,
        canViewPi: false,
        canCreatePi: false,
        canViewInitiatives: false,
        canCreateInitiative: false,
        canViewVacation: false,
        canReviewVacation: false,
      },
    };
  }

  const flags = {
    canViewApprovals: false,
    canViewDecisions: false,
    canManageGovernancePolicy: false,
    canManageAccess: false,
    canViewPi: false,
    canCreatePi: false,
    canViewInitiatives: false,
    canCreateInitiative: false,
    canViewVacation: false,
    canReviewVacation: false,
  };

  let preferredOrgId = organizationIds[0]!;
  let policyOrgId: string | null = null;
  let accessOrgId: string | null = null;

  for (const organizationId of organizationIds) {
    const check = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) =>
      authz.hasPermissionInOrganization(principal, p, organizationId);

    // Access / governance-policy pages require ORGANIZATION-scoped grants.
    // hasPermissionInOrganization is true for section/dept bindings too, which
    // previously showed sidebar links that then soft-404'd on the page assertCan.
    const [accessOrgScoped, policyOrgScoped] = await Promise.all([
      authz.can(principal, PERMISSIONS.ROLE_MANAGE, {
        type: "ORGANIZATION",
        organizationId,
      }),
      authz.can(principal, PERMISSIONS.GOVERNANCE_POLICY_MANAGE, {
        type: "ORGANIZATION",
        organizationId,
      }),
    ]);

    const [
      approvals,
      decisions,
      piView,
      piCreate,
      initView,
      initCreate,
      vacationView,
      vacationReview,
    ] = await Promise.all([
      check(PERMISSIONS.APPROVAL_REVIEW),
      check(PERMISSIONS.DECISION_MAKE),
      check(PERMISSIONS.PI_VIEW),
      check(PERMISSIONS.PI_CREATE),
      check(PERMISSIONS.INITIATIVE_VIEW),
      check(PERMISSIONS.INITIATIVE_CREATE),
      check(PERMISSIONS.VACATION_VIEW),
      check(PERMISSIONS.VACATION_REVIEW),
    ]);

    if (approvals) flags.canViewApprovals = true;
    if (decisions) flags.canViewDecisions = true;
    if (policyOrgScoped) {
      flags.canManageGovernancePolicy = true;
      policyOrgId ??= organizationId;
    }
    if (accessOrgScoped) {
      flags.canManageAccess = true;
      accessOrgId ??= organizationId;
    }
    if (piView) flags.canViewPi = true;
    if (piCreate) flags.canCreatePi = true;
    if (initView) flags.canViewInitiatives = true;
    if (initCreate) flags.canCreateInitiative = true;
    if (vacationView) flags.canViewVacation = true;
    if (vacationReview) flags.canReviewVacation = true;
  }

  // Prefer an org that can open org-scoped admin destinations.
  preferredOrgId = accessOrgId ?? policyOrgId ?? preferredOrgId;

  return {
    organizationId: preferredOrgId,
    capabilities: flags,
  };
}
