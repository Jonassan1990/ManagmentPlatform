import {
  PiStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import {
  createIterationInputSchema,
  createPiInputSchema,
  setParticipatingDepartmentsInputSchema,
  setParticipatingTeamsInputSchema,
  transitionPiInputSchema,
  updateIterationInputSchema,
  updatePiInputSchema,
} from "./schemas";

function fromZod(error: ZodError): AppError {
  return new AppError("VALIDATION", "Validation failed", {
    details: error.flatten(),
  });
}

function parse<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) throw fromZod(error);
    throw error;
  }
}

/** Adjacent-forward + allowed back-edits for planning review. */
const PI_TRANSITIONS: Record<PiStatus, PiStatus[]> = {
  DRAFT: ["PLANNING"],
  PLANNING: ["REVIEW"],
  REVIEW: ["PLANNING", "BASELINED"],
  BASELINED: ["ACTIVE", "REVIEW"],
  ACTIVE: ["CLOSED"],
  CLOSED: [],
};

const piInclude = {
  section: true,
  iterations: { orderBy: { sequence: "asc" as const } },
  participatingDepartments: { include: { department: true } },
  participatingTeams: { include: { team: true } },
  revisions: { orderBy: { createdAt: "asc" as const } },
  baselines: { orderBy: { versionNumber: "desc" as const } },
} satisfies Prisma.ProgramIncrementInclude;

export class PiService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async listProgramIncrements(principal: Principal, organizationId: string) {
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, {
      type: "ORGANIZATION",
      organizationId,
    });
    return this.db.programIncrement.findMany({
      where: { organizationId },
      include: {
        iterations: { orderBy: { sequence: "asc" } },
        revisions: { where: { isCurrent: true } },
      },
      orderBy: { startDate: "desc" },
    });
  }

  async getProgramIncrement(principal: Principal, piId: string) {
    const pi = await this.db.programIncrement.findUnique({
      where: { id: piId },
      include: piInclude,
    });
    if (!pi) throw new AppError("NOT_FOUND", "Program Increment not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
    return pi;
  }

  /**
   * createPI → allocates PI-####, creates CURRENT PlanningRevision.
   */
  async createProgramIncrement(principal: Principal, raw: unknown) {
    const input = parse(createPiInputSchema, raw);
    await this.authz.assertCan(principal, PERMISSIONS.PI_CREATE, {
      type: "ORGANIZATION",
      organizationId: input.organizationId,
    });

    if (input.sectionId) {
      const section = await this.db.section.findUnique({
        where: { id: input.sectionId },
      });
      if (!section || section.organizationId !== input.organizationId) {
        throw new AppError("VALIDATION", "Section is not in this organization.");
      }
    }

    const created = await this.db.$transaction(async (tx) => {
      const referenceKey = await this.allocatePiReference(
        tx,
        input.organizationId,
      );
      const pi = await tx.programIncrement.create({
        data: {
          organizationId: input.organizationId,
          sectionId: input.sectionId ?? null,
          referenceKey,
          name: input.name,
          description: input.description ?? null,
          startDate: input.startDate,
          endDate: input.endDate,
          planningOwnerName: input.planningOwnerName ?? null,
          status: PiStatus.DRAFT,
          revisions: {
            create: {
              key: "CURRENT",
              label: "Current plan",
              isCurrent: true,
            },
          },
        },
        include: piInclude,
      });
      return pi;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "pi.created",
      subjectType: "ProgramIncrement",
      subjectId: created.id,
      organizationId: created.organizationId,
      payload: { referenceKey: created.referenceKey, name: created.name },
      result: "success",
    });
    return created;
  }

  async updateProgramIncrement(principal: Principal, raw: unknown) {
    const input = parse(updatePiInputSchema, raw);
    const pi = await this.requirePi(input.piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_EDIT, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
    this.assertVersion(pi.version, input.expectedVersion, "program increment");
    if (pi.status === "CLOSED") {
      throw new AppError("VALIDATION", "Closed PIs cannot be edited.");
    }

    try {
      const updated = await this.db.programIncrement.update({
        where: { id: pi.id, version: input.expectedVersion },
        data: {
          name: input.name,
          description: input.description ?? null,
          startDate: input.startDate,
          endDate: input.endDate,
          planningOwnerName: input.planningOwnerName ?? null,
          sectionId: input.sectionId ?? null,
          version: { increment: 1 },
        },
        include: piInclude,
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.updated",
        subjectType: "ProgramIncrement",
        subjectId: updated.id,
        organizationId: updated.organizationId,
        payload: { version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "program increment");
    }
  }

  async createIteration(principal: Principal, raw: unknown) {
    const input = parse(createIterationInputSchema, raw);
    const pi = await this.requirePi(input.piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_EDIT, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
    this.assertDatesWithinPi(pi, input.startDate, input.endDate);
    await this.assertNoIterationOverlap(
      pi.id,
      input.startDate,
      input.endDate,
      null,
    );

    const referenceKey = await this.allocateIterationReference(pi.id);
    try {
      const created = await this.db.piIteration.create({
        data: {
          piId: pi.id,
          referenceKey,
          name: input.name,
          sequence: input.sequence,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.iteration.created",
        subjectType: "PiIteration",
        subjectId: created.id,
        organizationId: pi.organizationId,
        payload: { referenceKey, sequence: created.sequence },
        result: "success",
      });
      return created;
    } catch (error) {
      this.rethrowUnique(error, "Iteration sequence or reference already exists.");
    }
  }

  async updateIteration(principal: Principal, raw: unknown) {
    const input = parse(updateIterationInputSchema, raw);
    const iteration = await this.db.piIteration.findUnique({
      where: { id: input.iterationId },
      include: { pi: true },
    });
    if (!iteration) throw new AppError("NOT_FOUND", "Iteration not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PI_EDIT, {
      type: "ORGANIZATION",
      organizationId: iteration.pi.organizationId,
    });
    this.assertVersion(iteration.version, input.expectedVersion, "iteration");
    this.assertDatesWithinPi(iteration.pi, input.startDate, input.endDate);
    await this.assertNoIterationOverlap(
      iteration.piId,
      input.startDate,
      input.endDate,
      iteration.id,
    );

    try {
      const updated = await this.db.piIteration.update({
        where: { id: iteration.id, version: input.expectedVersion },
        data: {
          name: input.name,
          sequence: input.sequence,
          startDate: input.startDate,
          endDate: input.endDate,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.iteration.updated",
        subjectType: "PiIteration",
        subjectId: updated.id,
        organizationId: iteration.pi.organizationId,
        payload: { version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "iteration");
    }
  }

  async setParticipatingDepartments(principal: Principal, raw: unknown) {
    const input = parse(setParticipatingDepartmentsInputSchema, raw);
    const pi = await this.requirePi(input.piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_EDIT, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });

    const deptIds = input.departments.map((d) => d.departmentId);
    if (deptIds.length > 0) {
      const depts = await this.db.department.findMany({
        where: { id: { in: deptIds } },
        include: { section: true },
      });
      if (depts.length !== deptIds.length) {
        throw new AppError("VALIDATION", "One or more departments not found.");
      }
      for (const d of depts) {
        if (d.section.organizationId !== pi.organizationId) {
          throw new AppError(
            "VALIDATION",
            "Department is not in this organization.",
          );
        }
      }
    }

    await this.db.$transaction(async (tx) => {
      await tx.piParticipatingDepartment.deleteMany({ where: { piId: pi.id } });
      if (input.departments.length > 0) {
        await tx.piParticipatingDepartment.createMany({
          data: input.departments.map((d) => ({
            piId: pi.id,
            departmentId: d.departmentId,
            planningOwnerName: d.planningOwnerName ?? null,
          })),
        });
      }
      // Drop teams whose department is no longer participating.
      if (deptIds.length === 0) {
        await tx.piParticipatingTeam.deleteMany({ where: { piId: pi.id } });
      } else {
        await tx.piParticipatingTeam.deleteMany({
          where: { piId: pi.id, departmentId: { notIn: deptIds } },
        });
      }
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "pi.participation.departments.set",
      subjectType: "ProgramIncrement",
      subjectId: pi.id,
      organizationId: pi.organizationId,
      payload: { departmentIds: deptIds },
      result: "success",
    });
    return this.getProgramIncrement(principal, pi.id);
  }

  async setParticipatingTeams(principal: Principal, raw: unknown) {
    const input = parse(setParticipatingTeamsInputSchema, raw);
    const pi = await this.requirePi(input.piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_EDIT, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });

    const participatingDepts = await this.db.piParticipatingDepartment.findMany({
      where: { piId: pi.id },
    });
    const allowedDeptIds = new Set(
      participatingDepts.map((d) => d.departmentId),
    );

    for (const t of input.teams) {
      if (!allowedDeptIds.has(t.departmentId)) {
        throw new AppError(
          "VALIDATION",
          "Team department must be a participating department.",
        );
      }
      const team = await this.db.team.findUnique({ where: { id: t.teamId } });
      if (!team || team.departmentId !== t.departmentId) {
        throw new AppError(
          "VALIDATION",
          "Team does not belong to the given department.",
        );
      }
    }

    await this.db.$transaction(async (tx) => {
      await tx.piParticipatingTeam.deleteMany({ where: { piId: pi.id } });
      if (input.teams.length > 0) {
        await tx.piParticipatingTeam.createMany({
          data: input.teams.map((t) => ({
            piId: pi.id,
            teamId: t.teamId,
            departmentId: t.departmentId,
          })),
        });
      }
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "pi.participation.teams.set",
      subjectType: "ProgramIncrement",
      subjectId: pi.id,
      organizationId: pi.organizationId,
      payload: { teamIds: input.teams.map((t) => t.teamId) },
      result: "success",
    });
    return this.getProgramIncrement(principal, pi.id);
  }

  /**
   * Transitions: DRAFT→PLANNING→REVIEW→BASELINED→ACTIVE→CLOSED (adjacent).
   * Also REVIEW↔PLANNING for edits; BASELINED→REVIEW for re-planning.
   * First baseline (via BaselineService) sets BASELINED from REVIEW.
   */
  async transitionStatus(principal: Principal, raw: unknown) {
    const input = parse(transitionPiInputSchema, raw);
    const pi = await this.requirePi(input.piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_TRANSITION, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
    this.assertVersion(pi.version, input.expectedVersion, "program increment");

    const allowed = PI_TRANSITIONS[pi.status] ?? [];
    if (!allowed.includes(input.toStatus as PiStatus)) {
      throw new AppError(
        "VALIDATION",
        `Cannot transition from ${pi.status} to ${input.toStatus}.`,
      );
    }

    if (input.toStatus === "BASELINED") {
      throw new AppError(
        "VALIDATION",
        "Use createBaseline to move into BASELINED (first baseline from REVIEW).",
      );
    }

    try {
      const updated = await this.db.programIncrement.update({
        where: { id: pi.id, version: input.expectedVersion },
        data: {
          status: input.toStatus as PiStatus,
          version: { increment: 1 },
        },
        include: piInclude,
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.transitioned",
        subjectType: "ProgramIncrement",
        subjectId: updated.id,
        organizationId: updated.organizationId,
        payload: {
          from: pi.status,
          to: updated.status,
          comment: input.comment ?? null,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "program increment");
    }
  }

  async requirePi(piId: string) {
    const pi = await this.db.programIncrement.findUnique({ where: { id: piId } });
    if (!pi) throw new AppError("NOT_FOUND", "Program Increment not found.");
    return pi;
  }

  async requireCurrentRevision(piId: string) {
    const revision = await this.db.planningRevision.findFirst({
      where: { piId, key: "CURRENT", isCurrent: true },
    });
    if (!revision) {
      throw new AppError(
        "CONFLICT",
        "CURRENT planning revision is missing for this PI.",
      );
    }
    return revision;
  }

  private assertDatesWithinPi(
    pi: { startDate: Date; endDate: Date },
    start: Date,
    end: Date,
  ) {
    if (start < pi.startDate || end > pi.endDate) {
      throw new AppError(
        "VALIDATION",
        "Iteration dates must fall within the Program Increment date range.",
      );
    }
  }

  private async assertNoIterationOverlap(
    piId: string,
    start: Date,
    end: Date,
    excludeId: string | null,
  ) {
    const others = await this.db.piIteration.findMany({
      where: {
        piId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    for (const other of others) {
      // Overlap if ranges intersect (inclusive).
      if (start <= other.endDate && end >= other.startDate) {
        throw new AppError(
          "VALIDATION",
          `Iteration dates overlap with ${other.referenceKey} (${other.name}).`,
        );
      }
    }
  }

  private async allocatePiReference(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<string> {
    await tx.piReferenceCounter.upsert({
      where: { organizationId },
      create: { organizationId, nextValue: 1 },
      update: {},
    });
    const updated = await tx.piReferenceCounter.update({
      where: { organizationId },
      data: { nextValue: { increment: 1 } },
    });
    return `PI-${String(updated.nextValue - 1).padStart(4, "0")}`;
  }

  private async allocateIterationReference(piId: string): Promise<string> {
    const existing = await this.db.piIteration.findMany({
      where: { piId },
      select: { referenceKey: true },
    });
    let max = 0;
    for (const row of existing) {
      const match = /^IT-(\d+)$/.exec(row.referenceKey);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `IT-${String(max + 1).padStart(3, "0")}`;
  }

  private assertVersion(current: number, expected: number, entity: string) {
    if (current !== expected) {
      throw new AppError(
        "STALE_VERSION",
        `This ${entity} was changed by someone else. Refresh and try again.`,
        { details: { currentVersion: current } },
      );
    }
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

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("CONFLICT", message, { details: error.meta });
    }
    throw error;
  }
}
