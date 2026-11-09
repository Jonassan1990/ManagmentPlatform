import {
  Prisma,
  PrismaClient,
  VacationAuditAction,
  VacationRequestStatus,
} from "@prisma/client";
import type { AuditService } from "@/modules/audit/application/audit-service";
import type { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { scopeMatchesAsync } from "@/modules/identity-access/application/scope-policy";
import type { Principal } from "@/modules/identity-access/domain/types";
import { ancestorDepartmentIds } from "@/modules/organization/application/department-tree";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import {
  cancelVacationRequestSchema,
  createVacationRequestSchema,
  reviewVacationRequestSchema,
  updateVacationRequestSchema,
  vacationCalendarQuerySchema,
  vacationYearQuerySchema,
} from "./schemas";
import { selectClosestApprovers } from "./vacation-approvers";
import { vacationVisibilityFilter } from "./vacation-visibility";
import {
  countWorkingDays,
  formatDateOnly,
  monthBounds,
  toUtcDateOnly,
  yearBounds,
} from "./working-days";

type Placement = {
  organizationId: string;
  sectionId: string | null;
  departmentId: string | null;
  resourceId: string | null;
};

export class VacationService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async createRequest(principal: Principal, input: unknown) {
    await this.authz.ensureSystemRoles();
    const parsed = createVacationRequestSchema.parse(input);
    const canRequest = await this.authz.hasPermissionInOrganization(
      principal,
      PERMISSIONS.VACATION_REQUEST,
      parsed.organizationId,
    );
    if (!canRequest) {
      throw new AppError(
        "FORBIDDEN",
        "Missing permission 'vacation.request' for this organization.",
      );
    }

    const start = toUtcDateOnly(parsed.startDate as Date | string);
    const end = toUtcDateOnly(parsed.endDate as Date | string);
    if (end.getTime() < start.getTime()) {
      throw new AppError("VALIDATION", "End date must be on or after start date");
    }

    const placement = await this.resolvePlacement(
      principal.id,
      parsed.organizationId,
    );
    const workingDays = countWorkingDays(start, end);

    const created = await this.db.$transaction(async (tx) => {
      const row = await tx.vacationRequest.create({
        data: {
          organizationId: parsed.organizationId,
          requesterPrincipalId: principal.id,
          requesterResourceId: placement.resourceId,
          departmentId: placement.departmentId,
          sectionId: placement.sectionId,
          startDate: start,
          endDate: end,
          workingDays,
          reason: parsed.reason?.trim() || null,
          status: VacationRequestStatus.SUBMITTED,
        },
      });
      await this.writeAudit(tx, {
        vacationRequestId: row.id,
        actorPrincipalId: principal.id,
        action: VacationAuditAction.CREATED,
        fromStatus: null,
        toStatus: VacationRequestStatus.SUBMITTED,
        comment: null,
        payload: {
          startDate: formatDateOnly(start),
          endDate: formatDateOnly(end),
          workingDays,
          reason: row.reason,
        },
      });
      return row;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "vacation.created",
      subjectType: "VacationRequest",
      subjectId: created.id,
      organizationId: created.organizationId,
      payload: {
        startDate: formatDateOnly(start),
        endDate: formatDateOnly(end),
        workingDays,
      },
      result: "success",
    });

    return created;
  }

  async updateAndResubmit(principal: Principal, input: unknown) {
    const parsed = updateVacationRequestSchema.parse(input);
    const existing = await this.requireRequest(parsed.requestId);
    if (existing.requesterPrincipalId !== principal.id) {
      throw new AppError("FORBIDDEN", "Only the requester can update this vacation");
    }
    if (existing.status !== VacationRequestStatus.CHANGES_REQUESTED) {
      throw new AppError(
        "CONFLICT",
        "Only requests marked for changes can be edited and resubmitted",
      );
    }
    if (existing.version !== parsed.expectedVersion) {
      throw new AppError("STALE_VERSION", "Vacation request was updated by someone else");
    }

    const start = toUtcDateOnly(parsed.startDate as Date | string);
    const end = toUtcDateOnly(parsed.endDate as Date | string);
    if (end.getTime() < start.getTime()) {
      throw new AppError("VALIDATION", "End date must be on or after start date");
    }
    const workingDays = countWorkingDays(start, end);

    const updated = await this.db.$transaction(async (tx) => {
      const row = await tx.vacationRequest.update({
        where: { id: existing.id, version: existing.version },
        data: {
          startDate: start,
          endDate: end,
          workingDays,
          reason: parsed.reason?.trim() || null,
          status: VacationRequestStatus.SUBMITTED,
          managerComment: null,
          reviewedByPrincipalId: null,
          reviewedAt: null,
          version: { increment: 1 },
        },
      });
      await this.writeAudit(tx, {
        vacationRequestId: row.id,
        actorPrincipalId: principal.id,
        action: VacationAuditAction.RESUBMITTED,
        fromStatus: VacationRequestStatus.CHANGES_REQUESTED,
        toStatus: VacationRequestStatus.SUBMITTED,
        comment: null,
        payload: {
          startDate: formatDateOnly(start),
          endDate: formatDateOnly(end),
          workingDays,
        },
      });
      return row;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "vacation.resubmitted",
      subjectType: "VacationRequest",
      subjectId: updated.id,
      organizationId: updated.organizationId,
      payload: { workingDays },
      result: "success",
    });

    return updated;
  }

  async cancelRequest(principal: Principal, input: unknown) {
    const parsed = cancelVacationRequestSchema.parse(input);
    const existing = await this.requireRequest(parsed.requestId);
    if (existing.requesterPrincipalId !== principal.id) {
      throw new AppError("FORBIDDEN", "Only the requester can cancel this vacation");
    }
    if (
      existing.status !== VacationRequestStatus.SUBMITTED &&
      existing.status !== VacationRequestStatus.CHANGES_REQUESTED
    ) {
      throw new AppError("CONFLICT", "Only open requests can be cancelled");
    }
    if (existing.version !== parsed.expectedVersion) {
      throw new AppError("STALE_VERSION", "Vacation request was updated by someone else");
    }

    const updated = await this.db.$transaction(async (tx) => {
      const row = await tx.vacationRequest.update({
        where: { id: existing.id, version: existing.version },
        data: {
          status: VacationRequestStatus.CANCELLED,
          version: { increment: 1 },
        },
      });
      await this.writeAudit(tx, {
        vacationRequestId: row.id,
        actorPrincipalId: principal.id,
        action: VacationAuditAction.CANCELLED,
        fromStatus: existing.status,
        toStatus: VacationRequestStatus.CANCELLED,
        comment: parsed.comment?.trim() || null,
        payload: {},
      });
      return row;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "vacation.cancelled",
      subjectType: "VacationRequest",
      subjectId: updated.id,
      organizationId: updated.organizationId,
      payload: {},
      result: "success",
    });

    return updated;
  }

  async reviewRequest(principal: Principal, input: unknown) {
    await this.authz.ensureSystemRoles();
    const parsed = reviewVacationRequestSchema.parse(input);
    const existing = await this.requireRequest(parsed.requestId);

    if (existing.requesterPrincipalId === principal.id) {
      throw new AppError("FORBIDDEN", "You cannot review your own vacation request");
    }
    if (
      existing.status !== VacationRequestStatus.SUBMITTED &&
      existing.status !== VacationRequestStatus.CHANGES_REQUESTED
    ) {
      throw new AppError("CONFLICT", "This vacation request is not awaiting review");
    }
    if (existing.version !== parsed.expectedVersion) {
      throw new AppError("STALE_VERSION", "Vacation request was updated by someone else");
    }

    await this.assertCanReview(principal, existing);

    if (
      (parsed.decision === "REJECT" || parsed.decision === "REQUEST_CHANGES") &&
      !parsed.comment?.trim()
    ) {
      throw new AppError(
        "VALIDATION",
        "A comment is required when rejecting or asking for changes",
      );
    }

    const nextStatus =
      parsed.decision === "APPROVE"
        ? VacationRequestStatus.APPROVED
        : parsed.decision === "REJECT"
          ? VacationRequestStatus.REJECTED
          : VacationRequestStatus.CHANGES_REQUESTED;

    const auditAction =
      parsed.decision === "APPROVE"
        ? VacationAuditAction.APPROVED
        : parsed.decision === "REJECT"
          ? VacationAuditAction.REJECTED
          : VacationAuditAction.CHANGES_REQUESTED;

    const updated = await this.db.$transaction(async (tx) => {
      const row = await tx.vacationRequest.update({
        where: { id: existing.id, version: existing.version },
        data: {
          status: nextStatus,
          managerComment: parsed.comment?.trim() || null,
          reviewedByPrincipalId: principal.id,
          reviewedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await this.writeAudit(tx, {
        vacationRequestId: row.id,
        actorPrincipalId: principal.id,
        action: auditAction,
        fromStatus: existing.status,
        toStatus: nextStatus,
        comment: parsed.comment?.trim() || null,
        payload: { decision: parsed.decision },
      });
      return row;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: `vacation.${parsed.decision.toLowerCase()}`,
      subjectType: "VacationRequest",
      subjectId: updated.id,
      organizationId: updated.organizationId,
      payload: { decision: parsed.decision },
      result: "success",
    });

    return updated;
  }

  async listMine(principal: Principal) {
    const rows = await this.db.vacationRequest.findMany({
      where: { requesterPrincipalId: principal.id },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        approvers: await this.approversFor(row),
      })),
    );
  }

  async listInbox(principal: Principal) {
    await this.authz.ensureSystemRoles();
    const pending = await this.db.vacationRequest.findMany({
      where: {
        status: {
          in: [
            VacationRequestStatus.SUBMITTED,
            VacationRequestStatus.CHANGES_REQUESTED,
          ],
        },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const visible = [];
    for (const row of pending) {
      if (row.requesterPrincipalId === principal.id) continue;
      if (await this.canReview(principal, row)) {
        visible.push(row);
      }
    }

    const principalIds = [...new Set(visible.map((r) => r.requesterPrincipalId))];
    const principals = principalIds.length
      ? await this.db.principal.findMany({
          where: { id: { in: principalIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const nameById = new Map(principals.map((p) => [p.id, p.displayName]));

    return Promise.all(
      visible.map(async (row) => ({
        ...row,
        requesterDisplayName: nameById.get(row.requesterPrincipalId) ?? "Unknown",
        approvers: await this.approversFor(row),
      })),
    );
  }

  async getRequest(principal: Principal, requestId: string) {
    const row = await this.requireRequest(requestId);
    const isOwner = row.requesterPrincipalId === principal.id;
    const canReview = await this.canReview(principal, row);
    let canView = false;
    if (!isOwner && !canReview) {
      try {
        const visibility = await this.visibilityWhere(
          principal,
          row.organizationId,
        );
        const visible = await this.db.vacationRequest.findFirst({
          where: { id: row.id, ...visibility },
          select: { id: true },
        });
        canView = Boolean(visible);
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "FORBIDDEN") {
          throw error;
        }
      }
    }

    if (!isOwner && !canReview && !canView) {
      throw new AppError("FORBIDDEN", "Not allowed to view this vacation request");
    }

    const audits = await this.db.vacationRequestAudit.findMany({
      where: { vacationRequestId: row.id },
      orderBy: { createdAt: "asc" },
    });

    const actorIds = [
      row.requesterPrincipalId,
      row.reviewedByPrincipalId,
      ...audits.map((a) => a.actorPrincipalId),
    ].filter((id): id is string => Boolean(id));
    const principals = actorIds.length
      ? await this.db.principal.findMany({
          where: { id: { in: [...new Set(actorIds)] } },
          select: { id: true, displayName: true },
        })
      : [];
    const nameById = new Map(principals.map((p) => [p.id, p.displayName]));
    const [approvers, placement] = await Promise.all([
      this.approversFor(row),
      this.placementLabel(row),
    ]);

    return {
      request: {
        ...row,
        requesterDisplayName: nameById.get(row.requesterPrincipalId) ?? "Unknown",
        reviewerDisplayName: row.reviewedByPrincipalId
          ? (nameById.get(row.reviewedByPrincipalId) ?? "Unknown")
          : null,
        approvers,
        placement,
      },
      audits: audits.map((a) => ({
        ...a,
        actorDisplayName: a.actorPrincipalId
          ? (nameById.get(a.actorPrincipalId) ?? "Unknown")
          : "System",
      })),
      capabilities: {
        isOwner,
        canReview,
        canCancel:
          isOwner &&
          (row.status === VacationRequestStatus.SUBMITTED ||
            row.status === VacationRequestStatus.CHANGES_REQUESTED),
        canEditResubmit:
          isOwner && row.status === VacationRequestStatus.CHANGES_REQUESTED,
      },
    };
  }

  async listCalendar(principal: Principal, input: unknown) {
    const parsed = vacationCalendarQuerySchema.parse(input);
    const visibility = await this.visibilityWhere(
      principal,
      parsed.organizationId,
    );

    const { start, end } = monthBounds(parsed.year, parsed.month - 1);
    const rows = await this.db.vacationRequest.findMany({
      where: {
        ...visibility,
        status: VacationRequestStatus.APPROVED,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      orderBy: { startDate: "asc" },
    });

    const principalIds = [...new Set(rows.map((r) => r.requesterPrincipalId))];
    const principals = principalIds.length
      ? await this.db.principal.findMany({
          where: { id: { in: principalIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const nameById = new Map(principals.map((p) => [p.id, p.displayName]));

    return {
      year: parsed.year,
      month: parsed.month,
      rangeStart: formatDateOnly(start),
      rangeEnd: formatDateOnly(end),
      entries: rows.map((row) => ({
        id: row.id,
        requesterPrincipalId: row.requesterPrincipalId,
        requesterDisplayName: nameById.get(row.requesterPrincipalId) ?? "Unknown",
        startDate: formatDateOnly(row.startDate),
        endDate: formatDateOnly(row.endDate),
        workingDays: row.workingDays,
        status: row.status,
      })),
    };
  }

  async listYearSummary(principal: Principal, input: unknown) {
    const parsed = vacationYearQuerySchema.parse(input);
    const visibility = await this.visibilityWhere(
      principal,
      parsed.organizationId,
    );

    const { start, end } = yearBounds(parsed.year);
    const rows = await this.db.vacationRequest.findMany({
      where: {
        ...visibility,
        status: VacationRequestStatus.APPROVED,
        startDate: { lte: end },
        endDate: { gte: start },
        ...(parsed.principalId
          ? { requesterPrincipalId: parsed.principalId }
          : {}),
      },
      orderBy: [{ requesterPrincipalId: "asc" }, { startDate: "asc" }],
    });

    const principalIds = [...new Set(rows.map((r) => r.requesterPrincipalId))];
    const principals = principalIds.length
      ? await this.db.principal.findMany({
          where: { id: { in: principalIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const nameById = new Map(principals.map((p) => [p.id, p.displayName]));

    const byUser = new Map<
      string,
      {
        principalId: string;
        displayName: string;
        totalWorkingDays: number;
        requests: Array<{
          id: string;
          startDate: string;
          endDate: string;
          workingDays: number;
          reason: string | null;
        }>;
      }
    >();

    for (const row of rows) {
      const daysInYear = countWorkingDays(
        row.startDate < start ? start : row.startDate,
        row.endDate > end ? end : row.endDate,
      );
      const bucket = byUser.get(row.requesterPrincipalId) ?? {
        principalId: row.requesterPrincipalId,
        displayName: nameById.get(row.requesterPrincipalId) ?? "Unknown",
        totalWorkingDays: 0,
        requests: [],
      };
      bucket.totalWorkingDays += daysInYear;
      bucket.requests.push({
        id: row.id,
        startDate: formatDateOnly(row.startDate),
        endDate: formatDateOnly(row.endDate),
        workingDays: row.workingDays,
        reason: row.reason,
      });
      byUser.set(row.requesterPrincipalId, bucket);
    }

    return {
      year: parsed.year,
      users: [...byUser.values()].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    };
  }

  private async visibilityWhere(principal: Principal, organizationId: string) {
    const allowed = await this.authz.hasPermissionInOrganization(
      principal,
      PERMISSIONS.VACATION_VIEW,
      organizationId,
    );
    if (!allowed) {
      throw new AppError(
        "FORBIDDEN",
        "Missing permission 'vacation.view' for this organization.",
      );
    }

    const now = new Date();
    const bindings = await this.db.roleBinding.findMany({
      where: {
        principalId: principal.id,
        organizationId,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        roleDefinition: { permissions: { has: PERMISSIONS.VACATION_VIEW } },
      },
      select: { scopeType: true, scopeId: true },
    });
    const teamIds = bindings
      .filter((binding) => binding.scopeType === "TEAM" && binding.scopeId)
      .map((binding) => binding.scopeId!);
    const teams = teamIds.length
      ? await this.db.team.findMany({
          where: { id: { in: teamIds } },
          select: { departmentId: true },
        })
      : [];
    const needsDepartments = bindings.some(
      (binding) =>
        binding.scopeType === "DEPARTMENT" || binding.scopeType === "TEAM",
    );
    const departments = needsDepartments
      ? await this.db.department.findMany({
          where: { section: { organizationId } },
          select: { id: true, sectionId: true, parentDepartmentId: true },
        })
      : [];

    return vacationVisibilityFilter({
      organizationId,
      principalId: principal.id,
      bindings,
      teamDepartmentIds: teams.map((team) => team.departmentId),
      departments,
    });
  }

  private async approversFor(row: {
    organizationId: string;
    requesterPrincipalId: string;
    departmentId: string | null;
    sectionId: string | null;
  }) {
    const now = new Date();
    const [bindings, departments] = await Promise.all([
      this.db.roleBinding.findMany({
        where: {
          organizationId: row.organizationId,
          principalId: { not: row.requesterPrincipalId },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          roleDefinition: { permissions: { has: PERMISSIONS.VACATION_REVIEW } },
        },
        select: {
          principalId: true,
          scopeType: true,
          scopeId: true,
          organizationId: true,
          roleDefinition: { select: { name: true } },
          principal: { select: { displayName: true } },
        },
      }),
      this.db.department.findMany({
        where: { section: { organizationId: row.organizationId } },
        select: { id: true, sectionId: true, parentDepartmentId: true },
      }),
    ]);

    const requested = row.departmentId
      ? {
          type: "DEPARTMENT" as const,
          organizationId: row.organizationId,
          departmentId: row.departmentId,
        }
      : row.sectionId
        ? {
            type: "SECTION" as const,
            organizationId: row.organizationId,
            sectionId: row.sectionId,
          }
        : {
            type: "ORGANIZATION" as const,
            organizationId: row.organizationId,
          };

    const candidates = [];
    for (const binding of bindings) {
      const matches = await scopeMatchesAsync(
        this.db,
        binding.scopeType,
        binding.organizationId,
        binding.scopeId,
        requested,
      );
      if (!matches) continue;
      candidates.push({
        principalId: binding.principalId,
        displayName: binding.principal.displayName?.trim() || "Unknown",
        roleName: binding.roleDefinition.name,
        scopeType: binding.scopeType,
        scopeId: binding.scopeId,
      });
    }

    return selectClosestApprovers({
      departmentId: row.departmentId,
      sectionId: row.sectionId,
      parentDepartmentIds: row.departmentId
        ? ancestorDepartmentIds(row.departmentId, departments)
        : [],
      candidates,
    });
  }

  private async placementLabel(row: {
    organizationId: string;
    departmentId: string | null;
    sectionId: string | null;
  }) {
    if (row.departmentId) {
      const department = await this.db.department.findUnique({
        where: { id: row.departmentId },
        select: { name: true, section: { select: { name: true } } },
      });
      if (!department) return null;
      return `${department.section.name} / ${department.name}`;
    }
    if (row.sectionId) {
      const section = await this.db.section.findUnique({
        where: { id: row.sectionId },
        select: { name: true },
      });
      return section?.name ?? null;
    }
    return null;
  }

  private async requireRequest(id: string) {
    const row = await this.db.vacationRequest.findUnique({ where: { id } });
    if (!row) throw new AppError("NOT_FOUND", "Vacation request not found");
    return row;
  }

  private async resolvePlacement(
    principalId: string,
    organizationId: string,
  ): Promise<Placement> {
    const resource = await this.db.resource.findFirst({
      where: {
        linkedPrincipalId: principalId,
        organizationId,
        status: "ACTIVE",
      },
      include: {
        memberships: {
          where: { isPrimary: true },
          take: 1,
          include: {
            team: {
              include: {
                department: {
                  include: { section: true },
                },
              },
            },
          },
        },
      },
    });

    const membership = resource?.memberships[0];
    if (!membership) {
      return {
        organizationId,
        sectionId: null,
        departmentId: null,
        resourceId: resource?.id ?? null,
      };
    }

    return {
      organizationId,
      sectionId: membership.team.department.sectionId,
      departmentId: membership.team.departmentId,
      resourceId: resource.id,
    };
  }

  private async canReview(
    principal: Principal,
    request: {
      organizationId: string;
      sectionId: string | null;
      departmentId: string | null;
    },
  ): Promise<boolean> {
    if (request.departmentId) {
      if (
        await this.authz.can(principal, PERMISSIONS.VACATION_REVIEW, {
          type: "DEPARTMENT",
          organizationId: request.organizationId,
          departmentId: request.departmentId,
        })
      ) {
        return true;
      }
    }
    if (request.sectionId) {
      if (
        await this.authz.can(principal, PERMISSIONS.VACATION_REVIEW, {
          type: "SECTION",
          organizationId: request.organizationId,
          sectionId: request.sectionId,
        })
      ) {
        return true;
      }
    }
    return this.authz.can(principal, PERMISSIONS.VACATION_REVIEW, {
      type: "ORGANIZATION",
      organizationId: request.organizationId,
    });
  }

  private async assertCanReview(
    principal: Principal,
    request: {
      organizationId: string;
      sectionId: string | null;
      departmentId: string | null;
    },
  ) {
    if (await this.canReview(principal, request)) return;
    throw new AppError(
      "FORBIDDEN",
      "You do not have manager permission to review this vacation request",
    );
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    input: {
      vacationRequestId: string;
      actorPrincipalId: string | null;
      action: VacationAuditAction;
      fromStatus: VacationRequestStatus | null;
      toStatus: VacationRequestStatus | null;
      comment: string | null;
      payload: Prisma.InputJsonValue;
    },
  ) {
    await tx.vacationRequestAudit.create({
      data: {
        vacationRequestId: input.vacationRequestId,
        actorPrincipalId: input.actorPrincipalId,
        action: input.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        comment: input.comment,
        payload: input.payload,
      },
    });
  }
}
