import { PrismaClient } from "@prisma/client";
import { PERMISSIONS, type Permission } from "@/modules/shared/permissions";
import type { Principal } from "../domain/types";

/**
 * Narrow ownership-based authorization (Phase 0C / ADR-022).
 * Only these permissions may be granted via Resource ownership + Principal link.
 * Governance / role / PI baseline authority are never implied by ownership.
 */
export const OWNERSHIP_GRANTABLE_PERMISSIONS = new Set<Permission>([
  PERMISSIONS.INITIATIVE_VIEW,
  PERMISSIONS.INITIATIVE_EDIT,
  PERMISSIONS.PROJECT_VIEW,
  PERMISSIONS.PROJECT_EDIT,
]);

export type OwnershipRelationship =
  | { kind: "INITIATIVE_BUSINESS_OWNER"; initiativeId: string }
  | { kind: "PROJECT_OWNER"; projectId: string };

/**
 * Returns true when the Principal is linked to a Resource that owns the subject
 * and the permission is in the narrow ownership allow-list.
 */
export async function ownershipGrantsPermission(
  db: PrismaClient,
  principal: Principal,
  permission: Permission,
  relationship: OwnershipRelationship,
): Promise<boolean> {
  if (!OWNERSHIP_GRANTABLE_PERMISSIONS.has(permission)) {
    return false;
  }

  const linked = await db.resource.findFirst({
    where: {
      linkedPrincipalId: principal.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!linked) return false;

  if (relationship.kind === "INITIATIVE_BUSINESS_OWNER") {
    if (
      permission !== PERMISSIONS.INITIATIVE_EDIT &&
      permission !== PERMISSIONS.INITIATIVE_VIEW
    ) {
      return false;
    }
    const initiative = await db.initiative.findUnique({
      where: { id: relationship.initiativeId },
      select: { businessOwnerResourceId: true },
    });
    return initiative?.businessOwnerResourceId === linked.id;
  }

  if (relationship.kind === "PROJECT_OWNER") {
    if (
      permission !== PERMISSIONS.PROJECT_EDIT &&
      permission !== PERMISSIONS.PROJECT_VIEW
    ) {
      return false;
    }
    const project = await db.project.findUnique({
      where: { id: relationship.projectId },
      select: { ownerResourceId: true },
    });
    return project?.ownerResourceId === linked.id;
  }

  return false;
}
