import {
  EntityStatus,
  Prisma,
  PrismaClient,
  ResourceType,
  VacationAuditAction,
  VacationPlanKind,
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
  setVacationPlanMarkSchema,
  vacationCoverQuerySchema,
  vacationPlanQuerySchema,
  vacationYearQuerySchema,
} from "./schemas";
import { selectClosestApprovers } from "./vacation-approvers";
import { vacationVisibilityFilter } from "./vacation-visibility";
import {
  formatDateOnly,
  monthBounds,
  yearBounds,
} from "./working-days";
import {
  departmentDayCover,
  departmentRoleCoverage,
  visibleDepartmentIds,
  type RoleCoverageGap,
} from "./vacation-coverage";
import type { VacationPlanKindName } from "./vacation-plan";
import { planCellKind } from "./vacation-plan";
import {
  resolveVacationDuration,
  workingDaysInsideRange,
  type ResolvedVacationDuration,
} from "./vacation-duration";

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

    const amount = resolveVacationDuration(parsed);
    const placement = await this.resolvePlacement(
      principal.id,
      parsed.organizationId,
    );

    const created = await this.db.$transaction(async (tx) => {
      const row = await tx.vacationRequest.create({
        data: {
          organizationId: parsed.organizationId,
          requesterPrincipalId: principal.id,
          requesterResourceId: placement.resourceId,
          departmentId: placement.departmentId,
          sectionId: placement.sectionId,
          startDate: amount.start,
          endDate: amount.end,
          durationKind: amount.durationKind,
          dayPart: amount.dayPart,
          hours: new Prisma.Decimal(amount.hours),
          workingDays: new Prisma.Decimal(amount.workingDays),
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
        payload: durationPayload(amount, row.reason),
      });
      return row;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "vacation.created",
      subjectType: "VacationRequest",
      subjectId: created.id,
      organizationId: created.organizationId,
      payload: durationPayload(amount, created.reason),
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

    const amount = resolveVacationDuration(parsed);

    const updated = await this.db.$transaction(async (tx) => {
      const row = await tx.vacationRequest.update({
        where: { id: existing.id, version: existing.version },
        data: {
          startDate: amount.start,
          endDate: amount.end,
          durationKind: amount.durationKind,
          dayPart: amount.dayPart,
          hours: new Prisma.Decimal(amount.hours),
          workingDays: new Prisma.Decimal(amount.workingDays),
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
        payload: durationPayload(amount, row.reason),
      });
      return row;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "vacation.resubmitted",
      subjectType: "VacationRequest",
      subjectId: updated.id,
      organizationId: updated.organizationId,
      payload: durationPayload(amount, updated.reason),
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
        ...presentAmounts(row),
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
        ...presentAmounts(row),
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
        ...presentAmounts(row),
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
        durationKind: row.durationKind,
        dayPart: row.dayPart,
        hours: amountNumber(row.hours),
        workingDays: amountNumber(row.workingDays) ?? 0,
        status: row.status,
      })),
      coverage: await this.roleCoverage(parsed.organizationId, visibility, start, end),
    };
  }

  async listRoleCover(principal: Principal, input: unknown) {
    const parsed = vacationCoverQuerySchema.parse(input);
    const visibility = await this.visibilityWhere(
      principal,
      parsed.organizationId,
    );
    const { start, end } = monthBounds(parsed.year, parsed.month - 1);
    const facts = await this.coverFacts(
      parsed.organizationId,
      visibility,
      start,
      end,
    );
    const departments = [
      ...new Map(
        facts.people.map((person) => [
          person.departmentId,
          { id: person.departmentId, name: person.departmentName },
        ]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const departmentId = departments.some(
      (department) => department.id === parsed.departmentId,
    )
      ? parsed.departmentId
      : undefined;
    const people = departmentId
      ? facts.people.filter((person) => person.departmentId === departmentId)
      : facts.people;
    const rangeStart = formatDateOnly(start);
    const rangeEnd = formatDateOnly(end);
    return {
      year: parsed.year,
      month: parsed.month,
      rangeStart,
      rangeEnd,
      departmentId: departmentId ?? null,
      departments,
      coverage: departmentRoleCoverage({
        people,
        absences: facts.absences,
        rangeStart,
        rangeEnd,
      }),
      days: departmentDayCover({
        people,
        absences: facts.absences,
        rangeStart,
        rangeEnd,
      }),
    };
  }

  async listVacationPlan(principal: Principal, input: unknown) {
    const parsed = vacationPlanQuerySchema.parse(input);
    const visibility = await this.visibilityWhere(principal, parsed.organizationId);
    const { start, end } = monthBounds(parsed.year, parsed.month - 1);
    const facts = await this.coverFacts(parsed.organizationId, visibility, start, end);
    const departments = [
      ...new Map(
        facts.people.map((person) => [
          person.departmentId,
          { id: person.departmentId, name: person.departmentName },
        ]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));
    const department =
      departments.find((row) => row.id === parsed.departmentId) ?? departments[0] ?? null;
    const people = department
      ? facts.people.filter((person) => person.departmentId === department.id)
      : [];
    const principalIds = people.map((person) => person.principalId);
    const rangeStart = formatDateOnly(start);
    const rangeEnd = formatDateOnly(end);
    const marks =
      department && principalIds.length
        ? await this.db.vacationPlanMark.findMany({
            where: {
              departmentId: department.id,
              principalId: { in: principalIds },
              date: { gte: start, lte: end },
            },
          })
        : [];
    const markByKey = new Map(
      marks.map((mark) => [
        `${mark.principalId}:${formatDateOnly(mark.date)}`,
        mark.kind as VacationPlanKindName,
      ]),
    );
    const canEditAll = await this.authz.hasPermissionInOrganization(
      principal,
      PERMISSIONS.VACATION_REVIEW,
      parsed.organizationId,
    );
    const days = eachDate(rangeStart, rangeEnd);
    return {
      year: parsed.year,
      month: parsed.month,
      departmentId: department?.id ?? null,
      departmentName: department?.name ?? null,
      departments,
      canEditAll,
      people: people
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((person) => ({
          principalId: person.principalId,
          name: person.displayName,
          role: person.role,
          editable: canEditAll || person.principalId === principal.id,
          days: days.map((date) => {
            const weekend = isWeekend(date);
            const mark = markByKey.get(`${person.principalId}:${date}`) ?? null;
            const request = weekend
              ? null
              : requestOnDate(person.principalId, department?.id ?? "", date, facts.absences);
            return {
              date,
              weekend,
              kind: weekend ? null : planCellKind({ mark, request }),
              fromRequest: !mark && request !== null,
            };
          }),
        })),
    };
  }

  async setVacationPlanMark(principal: Principal, input: unknown) {
    const parsed = setVacationPlanMarkSchema.parse(input);
    const plan = await this.listVacationPlan(principal, {
      organizationId: parsed.organizationId,
      departmentId: parsed.departmentId,
      year: Number(parsed.date.slice(0, 4)),
      month: Number(parsed.date.slice(5, 7)),
    });
    if (plan.departmentId !== parsed.departmentId) {
      throw new AppError("FORBIDDEN", "That department is not in your vacation plan");
    }
    const person = plan.people.find((row) => row.principalId === parsed.principalId);
    if (!person?.editable) {
      throw new AppError("FORBIDDEN", "You cannot change this person's plan");
    }
    if (isWeekend(parsed.date)) {
      throw new AppError("VALIDATION", "Mark a weekday");
    }
    const date = new Date(`${parsed.date}T00:00:00.000Z`);
    if (parsed.kind === null) {
      await this.db.vacationPlanMark.deleteMany({
        where: { principalId: parsed.principalId, date },
      });
    } else {
      await this.db.vacationPlanMark.upsert({
        where: { principalId_date: { principalId: parsed.principalId, date } },
        create: {
          organizationId: parsed.organizationId,
          departmentId: parsed.departmentId,
          principalId: parsed.principalId,
          date,
          kind: parsed.kind as VacationPlanKind,
          createdByPrincipalId: principal.id,
        },
        update: {
          kind: parsed.kind as VacationPlanKind,
          departmentId: parsed.departmentId,
          organizationId: parsed.organizationId,
        },
      });
    }
    return { ok: true as const };
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
          durationKind: ResolvedVacationDuration["durationKind"];
          dayPart: ResolvedVacationDuration["dayPart"];
          hours: number | null;
          workingDays: number;
          reason: string | null;
        }>;
      }
    >();

    for (const row of rows) {
      const workingDays = amountNumber(row.workingDays) ?? 0;
      const daysInYear = workingDaysInsideRange(
        {
          durationKind: row.durationKind,
          startDate: row.startDate,
          endDate: row.endDate,
          workingDays,
        },
        start,
        end,
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
        durationKind: row.durationKind,
        dayPart: row.dayPart,
        hours: amountNumber(row.hours),
        workingDays,
        reason: row.reason,
      });
      byUser.set(row.requesterPrincipalId, bucket);
    }

    return {
      year: parsed.year,
      users: [...byUser.values()].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
      coverage: await this.roleCoverage(
        parsed.organizationId,
        visibility,
        start,
        end,
      ),
    };
  }

  private async roleCoverage(
    organizationId: string,
    visibility: Awaited<ReturnType<VacationService["visibilityWhere"]>>,
    start: Date,
    end: Date,
  ): Promise<RoleCoverageGap[]> {
    const facts = await this.coverFacts(organizationId, visibility, start, end);
    return departmentRoleCoverage({
      people: facts.people,
      absences: facts.absences,
      rangeStart: formatDateOnly(start),
      rangeEnd: formatDateOnly(end),
    });
  }

  private async coverFacts(
    organizationId: string,
    visibility: Awaited<ReturnType<VacationService["visibilityWhere"]>>,
    start: Date,
    end: Date,
  ) {
    const now = new Date();
    const [resources, departments, absences] = await Promise.all([
      this.db.resource.findMany({
        where: {
          organizationId,
          type: ResourceType.PERSON,
          status: EntityStatus.ACTIVE,
          functionRole: { not: null },
          linkedPrincipalId: { not: null },
        },
        select: {
          name: true,
          functionRole: true,
          linkedPrincipalId: true,
          memberships: {
            where: {
              effectiveFrom: { lte: now },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
            },
            select: {
              isPrimary: true,
              team: {
                select: {
                  department: { select: { id: true, name: true, sectionId: true } },
                },
              },
            },
          },
        },
      }),
      this.db.department.findMany({
        where: { section: { organizationId } },
        select: { id: true, sectionId: true },
      }),
      this.db.vacationRequest.findMany({
        where: {
          ...visibility,
          status: {
            in: [
              VacationRequestStatus.APPROVED,
              VacationRequestStatus.SUBMITTED,
              VacationRequestStatus.CHANGES_REQUESTED,
            ],
          },
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: {
          requesterPrincipalId: true,
          departmentId: true,
          startDate: true,
          endDate: true,
          durationKind: true,
          dayPart: true,
          hours: true,
          status: true,
        },
      }),
    ]);

    const allowed = visibleDepartmentIds(visibility, departments);
    const people = [];
    for (const resource of resources) {
      const role = resource.functionRole?.trim();
      const principalId = resource.linkedPrincipalId;
      if (!role || !principalId) continue;
      const membership =
        resource.memberships.find((row) => row.isPrimary) ??
        resource.memberships[0];
      const department = membership?.team.department;
      if (!department) continue;
      if (allowed && !allowed.has(department.id)) continue;
      people.push({
        principalId,
        displayName: resource.name,
        departmentId: department.id,
        departmentName: department.name,
        role,
      });
    }

    return {
      people,
      absences: absences.flatMap((row) => {
        if (
          row.status !== "APPROVED" &&
          row.status !== "SUBMITTED" &&
          row.status !== "CHANGES_REQUESTED"
        ) {
          return [];
        }
        if (
          row.durationKind !== "FULL_DAYS" &&
          row.durationKind !== "HALF_DAY" &&
          row.durationKind !== "HOURS"
        ) {
          return [];
        }
        return [
          {
            principalId: row.requesterPrincipalId,
            departmentId: row.departmentId,
            startDate: formatDateOnly(row.startDate),
            endDate: formatDateOnly(row.endDate),
            durationKind: row.durationKind,
            dayPart: row.dayPart,
            hours: amountNumber(row.hours),
            status: row.status,
          },
        ];
      }),
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
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      throw new AppError("NOT_FOUND", "Vacation request not found");
    }
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

function eachDate(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`).getTime();
  while (cursor.getTime() <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function requestOnDate(
  principalId: string,
  departmentId: string,
  date: string,
  absences: Array<{
    principalId: string;
    departmentId: string | null;
    startDate: string;
    endDate: string;
    durationKind: "FULL_DAYS" | "HALF_DAY" | "HOURS";
  }>,
): "FULL_DAYS" | "HALF_DAY" | "HOURS" | null {
  let partial: "HALF_DAY" | "HOURS" | null = null;
  for (const absence of absences) {
    if (absence.principalId !== principalId) continue;
    if (absence.departmentId && absence.departmentId !== departmentId) continue;
    if (date < absence.startDate || date > absence.endDate) continue;
    if (absence.durationKind === "FULL_DAYS") return "FULL_DAYS";
    partial = absence.durationKind;
  }
  return partial;
}

function amountNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function presentAmounts<
  T extends {
    workingDays: Prisma.Decimal | number;
    hours: Prisma.Decimal | number | null;
  },
>(row: T) {
  return {
    ...row,
    workingDays: amountNumber(row.workingDays) ?? 0,
    hours: amountNumber(row.hours),
  };
}

function durationPayload(
  amount: ResolvedVacationDuration,
  reason: string | null,
) {
  return {
    durationKind: amount.durationKind,
    dayPart: amount.dayPart,
    hours: amount.hours,
    workingDays: amount.workingDays,
    startDate: formatDateOnly(amount.start),
    endDate: formatDateOnly(amount.end),
    reason,
  };
}
