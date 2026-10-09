/**
 * Portfolio visibility — Phase 0C scope enforcement for read aggregation.
 *
 * Rules:
 * - Organization-wide aggregates require an ORGANIZATION-scoped binding that
 *   includes INITIATIVE_VIEW or PROJECT_VIEW for the target organization.
 * - PLATFORM bindings do not wildcard into ORGANIZATION aggregates (ADR-022).
 * - DEPARTMENT / SECTION / TEAM bindings only expose descendant departments.
 * - Ownership of a single initiative never expands portfolio visibility.
 */

import { PrismaClient, ScopeType } from "@prisma/client";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS, type Permission } from "@/modules/shared/permissions";
import type { PortfolioQueryScopeApplied } from "../domain/types";

const VIEW_PERMISSIONS: Permission[] = [
  PERMISSIONS.INITIATIVE_VIEW,
  PERMISSIONS.PROJECT_VIEW,
];

export type PortfolioVisibility = {
  organizationId: string;
  /** null ⇒ all departments in the organization are visible. */
  departmentIds: string[] | null;
  applied: PortfolioQueryScopeApplied;
};

function bindingHasView(permissions: string[]): boolean {
  return VIEW_PERMISSIONS.some((p) => permissions.includes(p));
}

export async function resolvePortfolioVisibility(
  db: PrismaClient,
  principal: Principal,
  organizationId: string,
  departmentIdFilter?: string,
): Promise<PortfolioVisibility> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, status: true },
  });
  if (!org || org.status !== "ACTIVE") {
    throw new AppError("NOT_FOUND", "Organization not found.");
  }

  const now = new Date();
  const bindings = await db.roleBinding.findMany({
    where: {
      principalId: principal.id,
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    include: { roleDefinition: true },
  });

  const relevant = bindings.filter(
    (b) =>
      bindingHasView(b.roleDefinition.permissions) &&
      (b.scopeType === ScopeType.ORGANIZATION ||
        b.scopeType === ScopeType.SECTION ||
        b.scopeType === ScopeType.DEPARTMENT ||
        b.scopeType === ScopeType.TEAM) &&
      b.organizationId === organizationId,
  );

  if (relevant.length === 0) {
    throw new AppError(
      "FORBIDDEN",
      "Missing portfolio view permission for this organization.",
      { details: { organizationId } },
    );
  }

  const orgWide = relevant.some((b) => b.scopeType === ScopeType.ORGANIZATION);

  let departmentIds: string[] | null = null;

  if (!orgWide) {
    const allowed = new Set<string>();

    const sectionIds = relevant
      .filter((b) => b.scopeType === ScopeType.SECTION && b.scopeId)
      .map((b) => b.scopeId!);
    if (sectionIds.length > 0) {
      const depts = await db.department.findMany({
        where: { sectionId: { in: sectionIds }, status: "ACTIVE" },
        select: { id: true },
      });
      for (const d of depts) allowed.add(d.id);
    }

    for (const b of relevant) {
      if (b.scopeType === ScopeType.DEPARTMENT && b.scopeId) {
        allowed.add(b.scopeId);
      }
    }

    const teamIds = relevant
      .filter((b) => b.scopeType === ScopeType.TEAM && b.scopeId)
      .map((b) => b.scopeId!);
    if (teamIds.length > 0) {
      const teams = await db.team.findMany({
        where: { id: { in: teamIds }, status: "ACTIVE" },
        select: { departmentId: true },
      });
      for (const t of teams) allowed.add(t.departmentId);
    }

    if (allowed.size === 0) {
      throw new AppError(
        "FORBIDDEN",
        "No department scope is visible for portfolio aggregation.",
        { details: { organizationId } },
      );
    }
    departmentIds = [...allowed];
  }

  if (departmentIdFilter) {
    const dept = await db.department.findUnique({
      where: { id: departmentIdFilter },
      select: {
        id: true,
        status: true,
        section: { select: { organizationId: true } },
      },
    });
    if (
      !dept ||
      dept.status !== "ACTIVE" ||
      dept.section.organizationId !== organizationId
    ) {
      throw new AppError("NOT_FOUND", "Department not found in organization.");
    }
    if (departmentIds !== null && !departmentIds.includes(departmentIdFilter)) {
      throw new AppError(
        "FORBIDDEN",
        "Missing portfolio view permission for this department.",
        { details: { organizationId, departmentId: departmentIdFilter } },
      );
    }
    // Explicit filter narrows even org-wide principals.
    departmentIds = [departmentIdFilter];
  }

  const applied: PortfolioQueryScopeApplied =
    departmentIds === null
      ? { mode: "organization", organizationId }
      : {
          mode: "departments",
          organizationId,
          departmentIds,
        };

  return { organizationId, departmentIds, applied };
}
