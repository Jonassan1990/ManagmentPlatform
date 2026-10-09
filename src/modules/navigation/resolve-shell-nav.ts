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
  };

  let preferredOrgId = organizationIds[0]!;
  let policyOrgId: string | null = null;
  let accessOrgId: string | null = null;

  for (const organizationId of organizationIds) {
    const scope = { type: "ORGANIZATION" as const, organizationId };
    const check = (p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) =>
      authz.can(principal, p, scope);

    const [
      approvals,
      decisions,
      policy,
      access,
      piView,
      piCreate,
      initView,
      initCreate,
    ] = await Promise.all([
      check(PERMISSIONS.APPROVAL_REVIEW),
      check(PERMISSIONS.DECISION_MAKE),
      check(PERMISSIONS.GOVERNANCE_POLICY_MANAGE),
      check(PERMISSIONS.ROLE_MANAGE),
      check(PERMISSIONS.PI_VIEW),
      check(PERMISSIONS.PI_CREATE),
      check(PERMISSIONS.INITIATIVE_VIEW),
      check(PERMISSIONS.INITIATIVE_CREATE),
    ]);

    if (approvals) flags.canViewApprovals = true;
    if (decisions) flags.canViewDecisions = true;
    if (policy) {
      flags.canManageGovernancePolicy = true;
      policyOrgId ??= organizationId;
    }
    if (access) {
      flags.canManageAccess = true;
      accessOrgId ??= organizationId;
    }
    if (piView) flags.canViewPi = true;
    if (piCreate) flags.canCreatePi = true;
    if (initView) flags.canViewInitiatives = true;
    if (initCreate) flags.canCreateInitiative = true;
  }

  // Prefer an org that can open org-scoped admin destinations.
  preferredOrgId = accessOrgId ?? policyOrgId ?? preferredOrgId;

  return {
    organizationId: preferredOrgId,
    capabilities: flags,
  };
}
