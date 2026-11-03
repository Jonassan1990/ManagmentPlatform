import { PrismaClient, ScopeType } from "@prisma/client";
import {
  ancestorDepartmentIds,
  isAncestorDepartment,
} from "@/modules/organization/application/department-tree";
import type { AuthScope } from "../domain/types";

/**
 * Phase 0C (ADR-022) — hierarchical AuthScope matching.
 *
 * Rules:
 * - PLATFORM bindings satisfy PLATFORM requests only (no universal wildcard).
 * - Child scopes never satisfy ancestor requests (TEAM ≠ ORGANIZATION).
 * - Ancestor bindings may satisfy descendant requests when DB hierarchy confirms containment.
 * - Nested departments: a DEPARTMENT binding on a parent satisfies child department requests.
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
      if (bindingScopeType === ScopeType.DEPARTMENT && bindingScopeId) {
        // Parent department manager may act on child departments (INF → INFB).
        return departmentIsUnderParent(
          db,
          requested.departmentId,
          bindingScopeId,
          requested.organizationId,
        );
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
        const direct = await teamBelongsToDepartment(
          db,
          requested.teamId,
          bindingScopeId,
          requested.organizationId,
        );
        if (direct) return true;
        // Team under a child department of the binding department.
        return teamBelongsUnderDepartmentTree(
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

async function loadSectionDepartmentTree(
  db: PrismaClient,
  organizationId: string,
  sectionId: string,
) {
  return db.department.findMany({
    where: {
      sectionId,
      status: "ACTIVE",
      section: { organizationId },
    },
    select: { id: true, sectionId: true, parentDepartmentId: true },
  });
}

/** True when `departmentId` is `parentDepartmentId` or nested under it. */
async function departmentIsUnderParent(
  db: PrismaClient,
  departmentId: string,
  parentDepartmentId: string,
  organizationId: string,
): Promise<boolean> {
  const department = await db.department.findUnique({
    where: { id: departmentId },
    select: {
      sectionId: true,
      section: { select: { organizationId: true } },
    },
  });
  if (
    !department ||
    department.section.organizationId !== organizationId
  ) {
    return false;
  }
  const rows = await loadSectionDepartmentTree(
    db,
    organizationId,
    department.sectionId,
  );
  return isAncestorDepartment(departmentId, parentDepartmentId, rows);
}

async function teamBelongsUnderDepartmentTree(
  db: PrismaClient,
  teamId: string,
  parentDepartmentId: string,
  organizationId: string,
): Promise<boolean> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: {
      departmentId: true,
      department: {
        select: {
          sectionId: true,
          section: { select: { organizationId: true } },
        },
      },
    },
  });
  if (!team || team.department.section.organizationId !== organizationId) {
    return false;
  }
  if (team.departmentId === parentDepartmentId) return true;
  const rows = await loadSectionDepartmentTree(
    db,
    organizationId,
    team.department.sectionId,
  );
  return isAncestorDepartment(team.departmentId, parentDepartmentId, rows);
}

/**
 * VIEW-only: child department binding may read an ancestor department
 * (INFB manager may open INF initiatives/projects with details).
 */
export async function departmentAncestorViewMatchesAsync(
  db: PrismaClient,
  bindingDepartmentId: string,
  requestedDepartmentId: string,
  organizationId: string,
): Promise<boolean> {
  if (bindingDepartmentId === requestedDepartmentId) return true;
  const department = await db.department.findUnique({
    where: { id: bindingDepartmentId },
    select: {
      sectionId: true,
      section: { select: { organizationId: true } },
    },
  });
  if (!department || department.section.organizationId !== organizationId) {
    return false;
  }
  const rows = await loadSectionDepartmentTree(
    db,
    organizationId,
    department.sectionId,
  );
  return ancestorDepartmentIds(bindingDepartmentId, rows).includes(
    requestedDepartmentId,
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
