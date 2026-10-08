import { EntityStatus, PrismaClient, ResourceType } from "@prisma/client";
import { AppError } from "@/modules/shared/errors";

/**
 * Phase 0B (ADR-021) — reusable business-owner Resource validation.
 * Capacity math does not use these helpers. Principal≠Resource remains intact.
 */
export type EligibleOwnerResource = {
  id: string;
  name: string;
  organizationId: string;
  type: ResourceType;
  status: EntityStatus;
};

export async function assertEligibleBusinessOwner(
  db: PrismaClient,
  params: {
    resourceId: string;
    organizationId: string;
    /** Label for error messages, e.g. "business owner". */
    roleLabel?: string;
  },
): Promise<EligibleOwnerResource> {
  const role = params.roleLabel ?? "owner";
  const resource = await db.resource.findUnique({
    where: { id: params.resourceId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      type: true,
      status: true,
    },
  });

  if (!resource || resource.status === EntityStatus.ARCHIVED) {
    throw new AppError("NOT_FOUND", `Owner resource for ${role} was not found.`);
  }
  if (resource.organizationId !== params.organizationId) {
    throw new AppError(
      "VALIDATION",
      `Owner resource for ${role} must belong to the same organization.`,
      {
        details: {
          resourceId: resource.id,
          resourceOrganizationId: resource.organizationId,
          expectedOrganizationId: params.organizationId,
        },
      },
    );
  }
  if (resource.type !== ResourceType.PERSON) {
    throw new AppError(
      "VALIDATION",
      `Only PERSON resources can be business ${role}s. OTHER capacity resources are not eligible.`,
    );
  }
  if (resource.status !== EntityStatus.ACTIVE) {
    throw new AppError(
      "VALIDATION",
      `Owner resource for ${role} must be ACTIVE.`,
    );
  }
  return resource;
}

/** Resolve optional owner: null/undefined clears; string validates. */
export async function resolveOptionalBusinessOwner(
  db: PrismaClient,
  params: {
    resourceId: string | null | undefined;
    organizationId: string;
    roleLabel?: string;
  },
): Promise<EligibleOwnerResource | null> {
  if (params.resourceId == null || params.resourceId === "") {
    return null;
  }
  return assertEligibleBusinessOwner(db, {
    resourceId: params.resourceId,
    organizationId: params.organizationId,
    roleLabel: params.roleLabel,
  });
}

/** Prefer Resource.name when FK present; else snapshot text. */
export function displayOwnerName(
  resourceName: string | null | undefined,
  snapshotName: string | null | undefined,
): string | null {
  const fromResource = resourceName?.trim();
  if (fromResource) return fromResource;
  const fromSnapshot = snapshotName?.trim();
  return fromSnapshot || null;
}
