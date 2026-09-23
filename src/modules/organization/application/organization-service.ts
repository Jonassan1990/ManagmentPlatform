import {
  EntityStatus,
  Prisma,
  PrismaClient,
  ResourceType,
} from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import {
  archiveEntityInputSchema,
  assignMembershipInputSchema,
  createDepartmentInputSchema,
  createOrganizationInputSchema,
  createResourceInputSchema,
  createSectionInputSchema,
  createTeamInputSchema,
  updateDepartmentInputSchema,
  updateOrganizationInputSchema,
  updateResourceInputSchema,
  updateSectionInputSchema,
  updateTeamInputSchema,
} from "./schemas";

function fromZod(error: ZodError): AppError {
  return new AppError("VALIDATION", "Validation failed", {
    details: error.flatten(),
  });
}

function parse<T>(
  schema: { parse: (data: unknown) => T },
  data: unknown,
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) throw fromZod(error);
    throw error;
  }
}

export class OrganizationService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async listOrganizations(principal: Principal) {
    await this.authz.ensureBootstrapBinding(principal.id);
    // Read: any principal with platform bootstrap or any org binding can list orgs they can access.
    const bindings = await this.db.roleBinding.findMany({
      where: { principalId: principal.id, effectiveTo: null },
      include: { roleDefinition: true },
    });

    const canReadAll = bindings.some(
      (b) =>
        b.scopeType === "PLATFORM" &&
        b.roleDefinition.permissions.includes(PERMISSIONS.ORG_STRUCTURE_READ),
    );

    if (canReadAll) {
      return this.db.organization.findMany({
        where: { status: EntityStatus.ACTIVE },
        orderBy: { name: "asc" },
      });
    }

    const orgIds = bindings
      .filter(
        (b) =>
          b.organizationId &&
          b.roleDefinition.permissions.includes(PERMISSIONS.ORG_STRUCTURE_READ),
      )
      .map((b) => b.organizationId!) ;

    if (orgIds.length === 0) {
      // Empty state: still return [] so first-run UI can offer setup if bootstrap applies.
      const orgCount = await this.db.organization.count();
      if (orgCount === 0) {
        await this.authz.assertCan(principal, PERMISSIONS.PLATFORM_BOOTSTRAP, {
          type: "PLATFORM",
        });
        return [];
      }
      throw new AppError("FORBIDDEN", "No organization read access.");
    }

    return this.db.organization.findMany({
      where: { id: { in: orgIds }, status: EntityStatus.ACTIVE },
      orderBy: { name: "asc" },
    });
  }

  async getOrganization(principal: Principal, id: string) {
    const org = await this.db.organization.findUnique({ where: { id } });
    if (!org || org.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Organization not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_READ, {
      type: "ORGANIZATION",
      organizationId: org.id,
    });
    return org;
  }

  async createOrganization(principal: Principal, raw: unknown) {
    const input = parse(createOrganizationInputSchema, raw);
    const orgCount = await this.db.organization.count();
    if (orgCount === 0) {
      await this.authz.ensureBootstrapBinding(principal.id);
      await this.authz.assertCan(principal, PERMISSIONS.PLATFORM_BOOTSTRAP, {
        type: "PLATFORM",
      });
    } else {
      await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
        type: "PLATFORM",
      });
    }

    const org = await this.db.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: input.name,
          description: input.description ?? null,
        },
      });
      return created;
    });

    await this.authz.grantOrganizationAdmin(principal.id, org.id);
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "organization.created",
      subjectType: "Organization",
      subjectId: org.id,
      organizationId: org.id,
      payload: { name: org.name },
      result: "success",
    });
    return org;
  }

  async updateOrganization(principal: Principal, raw: unknown) {
    const input = parse(updateOrganizationInputSchema, raw);
    const existing = await this.db.organization.findUnique({
      where: { id: input.id },
    });
    if (!existing || existing.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Organization not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: existing.id,
    });
    if (existing.version !== input.expectedVersion) {
      throw new AppError(
        "STALE_VERSION",
        "This organization was changed by someone else. Refresh and try again.",
        { details: { currentVersion: existing.version } },
      );
    }

    try {
      const updated = await this.db.organization.update({
        where: { id: input.id, version: input.expectedVersion },
        data: {
          name: input.name,
          description: input.description ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "organization.updated",
        subjectType: "Organization",
        subjectId: updated.id,
        organizationId: updated.id,
        payload: {
          name: updated.name,
          version: updated.version,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new AppError(
          "STALE_VERSION",
          "This organization was changed by someone else. Refresh and try again.",
        );
      }
      throw error;
    }
  }

  async archiveOrganization(principal: Principal, raw: unknown) {
    const input = parse(archiveEntityInputSchema, raw);
    const existing = await this.db.organization.findUnique({
      where: { id: input.id },
    });
    if (!existing || existing.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Organization not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: existing.id,
    });
    if (existing.version !== input.expectedVersion) {
      throw new AppError(
        "STALE_VERSION",
        "This organization was changed by someone else. Refresh and try again.",
      );
    }
    const updated = await this.db.organization.update({
      where: { id: input.id, version: input.expectedVersion },
      data: { status: EntityStatus.ARCHIVED, version: { increment: 1 } },
    });
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "organization.archived",
      subjectType: "Organization",
      subjectId: updated.id,
      organizationId: updated.id,
      payload: { version: updated.version },
      result: "success",
    });
    return updated;
  }

  async createSection(principal: Principal, raw: unknown) {
    const input = parse(createSectionInputSchema, raw);
    const org = await this.requireActiveOrganization(input.organizationId);
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: org.id,
    });

    try {
      const section = await this.db.section.create({
        data: {
          organizationId: org.id,
          name: input.name,
          description: input.description ?? null,
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "section.created",
        subjectType: "Section",
        subjectId: section.id,
        organizationId: org.id,
        payload: { name: section.name },
        result: "success",
      });
      return section;
    } catch (error) {
      this.rethrowUnique(error, "A section with this name already exists in the organization.");
    }
  }

  async updateSection(principal: Principal, raw: unknown) {
    const input = parse(updateSectionInputSchema, raw);
    const existing = await this.db.section.findUnique({ where: { id: input.id } });
    if (!existing || existing.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Section not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: existing.organizationId,
    });
    if (existing.version !== input.expectedVersion) {
      throw new AppError(
        "STALE_VERSION",
        "This section was changed by someone else. Refresh and try again.",
      );
    }
    try {
      const updated = await this.db.section.update({
        where: { id: input.id, version: input.expectedVersion },
        data: {
          name: input.name,
          description: input.description ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "section.updated",
        subjectType: "Section",
        subjectId: updated.id,
        organizationId: updated.organizationId,
        payload: { name: updated.name, version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowUnique(error, "A section with this name already exists in the organization.");
      this.rethrowStale(error, "section");
    }
  }

  async listSections(principal: Principal, organizationId: string) {
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_READ, {
      type: "ORGANIZATION",
      organizationId,
    });
    return this.db.section.findMany({
      where: { organizationId, status: EntityStatus.ACTIVE },
      orderBy: { name: "asc" },
    });
  }

  async getSection(principal: Principal, id: string) {
    const section = await this.db.section.findUnique({ where: { id } });
    if (!section || section.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Section not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_READ, {
      type: "ORGANIZATION",
      organizationId: section.organizationId,
    });
    return section;
  }

  async createDepartment(principal: Principal, raw: unknown) {
    const input = parse(createDepartmentInputSchema, raw);
    const section = await this.db.section.findUnique({
      where: { id: input.sectionId },
    });
    if (!section || section.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Section not found.");
    }
    await this.requireActiveOrganization(section.organizationId);
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: section.organizationId,
    });
    try {
      const department = await this.db.department.create({
        data: {
          sectionId: section.id,
          name: input.name,
          description: input.description ?? null,
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "department.created",
        subjectType: "Department",
        subjectId: department.id,
        organizationId: section.organizationId,
        payload: { name: department.name, sectionId: section.id },
        result: "success",
      });
      return department;
    } catch (error) {
      this.rethrowUnique(error, "A department with this name already exists in the section.");
    }
  }

  async updateDepartment(principal: Principal, raw: unknown) {
    const input = parse(updateDepartmentInputSchema, raw);
    const existing = await this.db.department.findUnique({
      where: { id: input.id },
      include: { section: true },
    });
    if (!existing || existing.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Department not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: existing.section.organizationId,
    });
    if (existing.version !== input.expectedVersion) {
      throw new AppError(
        "STALE_VERSION",
        "This department was changed by someone else. Refresh and try again.",
      );
    }
    try {
      const updated = await this.db.department.update({
        where: { id: input.id, version: input.expectedVersion },
        data: {
          name: input.name,
          description: input.description ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "department.updated",
        subjectType: "Department",
        subjectId: updated.id,
        organizationId: existing.section.organizationId,
        payload: { name: updated.name, version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowUnique(error, "A department with this name already exists in the section.");
      this.rethrowStale(error, "department");
    }
  }

  async listDepartments(principal: Principal, sectionId: string) {
    const section = await this.getSection(principal, sectionId);
    return this.db.department.findMany({
      where: { sectionId: section.id, status: EntityStatus.ACTIVE },
      orderBy: { name: "asc" },
    });
  }

  async getDepartment(principal: Principal, id: string) {
    const department = await this.db.department.findUnique({
      where: { id },
      include: { section: true },
    });
    if (!department || department.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Department not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_READ, {
      type: "ORGANIZATION",
      organizationId: department.section.organizationId,
    });
    return department;
  }

  async createTeam(principal: Principal, raw: unknown) {
    const input = parse(createTeamInputSchema, raw);
    const department = await this.db.department.findUnique({
      where: { id: input.departmentId },
      include: { section: true },
    });
    if (!department || department.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Department not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: department.section.organizationId,
    });
    try {
      const team = await this.db.team.create({
        data: {
          departmentId: department.id,
          name: input.name,
          description: input.description ?? null,
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "team.created",
        subjectType: "Team",
        subjectId: team.id,
        organizationId: department.section.organizationId,
        payload: { name: team.name, departmentId: department.id },
        result: "success",
      });
      return team;
    } catch (error) {
      this.rethrowUnique(error, "A team with this name already exists in the department.");
    }
  }

  async updateTeam(principal: Principal, raw: unknown) {
    const input = parse(updateTeamInputSchema, raw);
    const existing = await this.db.team.findUnique({
      where: { id: input.id },
      include: { department: { include: { section: true } } },
    });
    if (!existing || existing.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Team not found.");
    }
    const organizationId = existing.department.section.organizationId;
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId,
    });
    if (existing.version !== input.expectedVersion) {
      throw new AppError(
        "STALE_VERSION",
        "This team was changed by someone else. Refresh and try again.",
      );
    }
    try {
      const updated = await this.db.team.update({
        where: { id: input.id, version: input.expectedVersion },
        data: {
          name: input.name,
          description: input.description ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "team.updated",
        subjectType: "Team",
        subjectId: updated.id,
        organizationId,
        payload: { name: updated.name, version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowUnique(error, "A team with this name already exists in the department.");
      this.rethrowStale(error, "team");
    }
  }

  async listTeams(principal: Principal, departmentId: string) {
    const department = await this.getDepartment(principal, departmentId);
    return this.db.team.findMany({
      where: { departmentId: department.id, status: EntityStatus.ACTIVE },
      orderBy: { name: "asc" },
    });
  }

  async getTeam(principal: Principal, id: string) {
    const team = await this.db.team.findUnique({
      where: { id },
      include: { department: { include: { section: true } } },
    });
    if (!team || team.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Team not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_READ, {
      type: "ORGANIZATION",
      organizationId: team.department.section.organizationId,
    });
    return team;
  }

  async createResource(principal: Principal, raw: unknown) {
    const input = parse(createResourceInputSchema, raw);
    await this.requireActiveOrganization(input.organizationId);
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: input.organizationId,
    });

    if (input.primaryTeamId) {
      const team = await this.db.team.findUnique({
        where: { id: input.primaryTeamId },
        include: { department: { include: { section: true } } },
      });
      if (!team || team.status === EntityStatus.ARCHIVED) {
        throw new AppError("NOT_FOUND", "Team not found.");
      }
      if (team.department.section.organizationId !== input.organizationId) {
        throw new AppError(
          "VALIDATION",
          "Team does not belong to the same organization as the resource.",
        );
      }
    }

    try {
      const resource = await this.db.$transaction(async (tx) => {
        const created = await tx.resource.create({
          data: {
            organizationId: input.organizationId,
            name: input.name,
            referenceCode: input.referenceCode ?? null,
            type: input.type as ResourceType,
            functionRole: input.functionRole ?? null,
            skillsJson: input.skills,
            capacityHoursPerWeek:
              input.capacityHoursPerWeek == null
                ? null
                : new Prisma.Decimal(input.capacityHoursPerWeek),
          },
        });
        if (input.primaryTeamId) {
          await tx.resourceMembership.create({
            data: {
              resourceId: created.id,
              teamId: input.primaryTeamId,
              isPrimary: true,
            },
          });
        }
        return created;
      });

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "resource.created",
        subjectType: "Resource",
        subjectId: resource.id,
        organizationId: input.organizationId,
        payload: {
          name: resource.name,
          type: resource.type,
          primaryTeamId: input.primaryTeamId ?? null,
        },
        result: "success",
      });
      return resource;
    } catch (error) {
      this.rethrowUnique(
        error,
        "A resource with this reference code already exists in the organization.",
      );
    }
  }

  async updateResource(principal: Principal, raw: unknown) {
    const input = parse(updateResourceInputSchema, raw);
    const existing = await this.db.resource.findUnique({ where: { id: input.id } });
    if (!existing || existing.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Resource not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: existing.organizationId,
    });
    if (existing.version !== input.expectedVersion) {
      throw new AppError(
        "STALE_VERSION",
        "This resource was changed by someone else. Refresh and try again.",
      );
    }
    try {
      const updated = await this.db.resource.update({
        where: { id: input.id, version: input.expectedVersion },
        data: {
          name: input.name,
          referenceCode: input.referenceCode ?? null,
          type: input.type as ResourceType,
          functionRole: input.functionRole ?? null,
          skillsJson: input.skills,
          capacityHoursPerWeek:
            input.capacityHoursPerWeek == null
              ? null
              : new Prisma.Decimal(input.capacityHoursPerWeek),
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "resource.updated",
        subjectType: "Resource",
        subjectId: updated.id,
        organizationId: updated.organizationId,
        payload: { name: updated.name, version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowUnique(
        error,
        "A resource with this reference code already exists in the organization.",
      );
      this.rethrowStale(error, "resource");
    }
  }

  async assignMembership(principal: Principal, raw: unknown) {
    const input = parse(assignMembershipInputSchema, raw);
    const resource = await this.db.resource.findUnique({
      where: { id: input.resourceId },
    });
    if (!resource || resource.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Resource not found.");
    }
    const team = await this.db.team.findUnique({
      where: { id: input.teamId },
      include: { department: { include: { section: true } } },
    });
    if (!team || team.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Team not found.");
    }
    if (team.department.section.organizationId !== resource.organizationId) {
      throw new AppError(
        "VALIDATION",
        "Cannot assign a resource to a team in a different organization.",
      );
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
      type: "ORGANIZATION",
      organizationId: resource.organizationId,
    });

    const membership = await this.db.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.resourceMembership.updateMany({
          where: { resourceId: resource.id, effectiveTo: null },
          data: { isPrimary: false },
        });
      }
      const existingActive = await tx.resourceMembership.findFirst({
        where: {
          resourceId: resource.id,
          teamId: team.id,
          effectiveTo: null,
        },
      });
      if (existingActive) {
        return tx.resourceMembership.update({
          where: { id: existingActive.id },
          data: { isPrimary: input.isPrimary },
        });
      }
      return tx.resourceMembership.create({
        data: {
          resourceId: resource.id,
          teamId: team.id,
          isPrimary: input.isPrimary,
        },
      });
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "resource.membership.assigned",
      subjectType: "ResourceMembership",
      subjectId: membership.id,
      organizationId: resource.organizationId,
      payload: {
        resourceId: resource.id,
        teamId: team.id,
        isPrimary: membership.isPrimary,
      },
      result: "success",
    });
    return membership;
  }

  async listResources(principal: Principal, organizationId: string) {
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_READ, {
      type: "ORGANIZATION",
      organizationId,
    });
    return this.db.resource.findMany({
      where: { organizationId, status: EntityStatus.ACTIVE },
      include: {
        memberships: {
          where: { effectiveTo: null },
          include: { team: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async getResource(principal: Principal, id: string) {
    const resource = await this.db.resource.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { effectiveTo: null },
          include: { team: true },
        },
      },
    });
    if (!resource || resource.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Resource not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_READ, {
      type: "ORGANIZATION",
      organizationId: resource.organizationId,
    });
    return resource;
  }

  async getHierarchy(principal: Principal, organizationId: string) {
    await this.authz.assertCan(principal, PERMISSIONS.ORG_STRUCTURE_READ, {
      type: "ORGANIZATION",
      organizationId,
    });
    return this.db.organization.findUnique({
      where: { id: organizationId },
      include: {
        sections: {
          where: { status: EntityStatus.ACTIVE },
          orderBy: { name: "asc" },
          include: {
            departments: {
              where: { status: EntityStatus.ACTIVE },
              orderBy: { name: "asc" },
              include: {
                teams: {
                  where: { status: EntityStatus.ACTIVE },
                  orderBy: { name: "asc" },
                },
              },
            },
          },
        },
        resources: {
          where: { status: EntityStatus.ACTIVE },
          orderBy: { name: "asc" },
          include: {
            memberships: {
              where: { effectiveTo: null },
              include: { team: true },
            },
          },
        },
      },
    });
  }

  private async requireActiveOrganization(id: string) {
    const org = await this.db.organization.findUnique({ where: { id } });
    if (!org || org.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Organization not found.");
    }
    return org;
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("CONFLICT", message, { details: error.meta });
    }
    throw error;
  }

  private rethrowStale(error: unknown, entity: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new AppError(
        "STALE_VERSION",
        `This ${entity} was changed by someone else. Refresh and try again.`,
      );
    }
    throw error;
  }
}
