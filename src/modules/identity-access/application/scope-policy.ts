import { PrismaClient, ScopeType } from "@prisma/client";
import type { AuthScope } from "../domain/types";

/**
 * Phase 0C (ADR-022) — hierarchical AuthScope matching.
 *
 * Rules:
 * - PLATFORM bindings satisfy PLATFORM requests only (no universal wildcard).
 * - Child scopes never satisfy ancestor requests (TEAM ≠ ORGANIZATION).
 * - Ancestor bindings may satisfy descendant requests when DB hierarchy confirms containment.
 */
export async function scopeMatchesAsync(
  db: PrismaClient,
  bindingScopeType: ScopeType,
  bindingOrgId: string | null,
  bindingScopeId: string | null,
  requested: AuthScope,
): Promise<boolean> {
  if (bindingScopeType === ScopeType.PLATFORM) {
    return requested.type === "PLATFORM";
  }

  if (requested.type === "PLATFORM") {
    return false;
  }

  if (!bindingOrgId || bindingOrgId !== requested.organizationId) {
    return false;
  }

  switch (requested.type) {
    case "ORGANIZATION":
      return bindingScopeType === ScopeType.ORGANIZATION;

    case "SECTION": {
      if (bindingScopeType === ScopeType.ORGANIZATION) return true;
      return (
        bindingScopeType === ScopeType.SECTION &&
        bindingScopeId === requested.sectionId
      );
    }

    case "DEPARTMENT": {
      if (bindingScopeType === ScopeType.ORGANIZATION) return true;
      if (
        bindingScopeType === ScopeType.DEPARTMENT &&
        bindingScopeId === requested.departmentId
      ) {
        return true;
      }
      if (bindingScopeType === ScopeType.SECTION && bindingScopeId) {
        return departmentBelongsToSection(
          db,
          requested.departmentId,
          bindingScopeId,
          requested.organizationId,
        );
      }
      return false;
    }

    case "TEAM": {
      if (bindingScopeType === ScopeType.ORGANIZATION) return true;
      if (
        bindingScopeType === ScopeType.TEAM &&
        bindingScopeId === requested.teamId
      ) {
        return true;
      }
      if (bindingScopeType === ScopeType.DEPARTMENT && bindingScopeId) {
        return teamBelongsToDepartment(
          db,
          requested.teamId,
          bindingScopeId,
          requested.organizationId,
        );
      }
      if (bindingScopeType === ScopeType.SECTION && bindingScopeId) {
        return teamBelongsToSection(
          db,
          requested.teamId,
          bindingScopeId,
          requested.organizationId,
        );
      }
      return false;
    }

    default:
      return false;
  }
}

async function departmentBelongsToSection(
  db: PrismaClient,
  departmentId: string,
  sectionId: string,
  organizationId: string,
): Promise<boolean> {
  const department = await db.department.findUnique({
    where: { id: departmentId },
    select: {
      sectionId: true,
      section: { select: { organizationId: true } },
    },
  });
  return (
    !!department &&
    department.sectionId === sectionId &&
    department.section.organizationId === organizationId
  );
}

async function teamBelongsToDepartment(
  db: PrismaClient,
  teamId: string,
  departmentId: string,
  organizationId: string,
): Promise<boolean> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: {
      departmentId: true,
      department: {
        select: { section: { select: { organizationId: true } } },
      },
    },
  });
  return (
    !!team &&
    team.departmentId === departmentId &&
    team.department.section.organizationId === organizationId
  );
}

async function teamBelongsToSection(
  db: PrismaClient,
  teamId: string,
  sectionId: string,
  organizationId: string,
): Promise<boolean> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: {
      department: {
        select: {
          sectionId: true,
          section: { select: { organizationId: true } },
        },
      },
    },
  });
  return (
    !!team &&
    team.department.sectionId === sectionId &&
    team.department.section.organizationId === organizationId
  );
}
