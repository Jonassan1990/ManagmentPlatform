import type { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import type { Permission } from "@/modules/shared/permissions";

/** True when any listed organization has an active binding that includes the permission. */
export async function hasPermissionInAnyOrganization(
  authz: AuthorizationService,
  principal: Principal,
  permission: Permission,
  organizationIds: string[],
): Promise<boolean> {
  if (organizationIds.length === 0) return false;
  const results = await Promise.all(
    organizationIds.map((organizationId) =>
      authz.hasPermissionInOrganization(principal, permission, organizationId),
    ),
  );
  return results.some(Boolean);
}
