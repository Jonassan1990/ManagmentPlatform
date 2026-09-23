import { Prisma, PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import {
  effectiveResourceCapacity,
  toHoursNumber,
  utilization,
  utilizationBand,
} from "./capacity-policy";
import type { PiService } from "./pi-service";
import { setResourceAvailabilityInputSchema } from "./schemas";

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

function toDecimal(value: string | null | undefined): Prisma.Decimal | null {
  if (value == null || value === "") return null;
  return new Prisma.Decimal(value);
}

export type TeamIterationCapacityView = {
  teamId: string;
  teamName: string;
  departmentId: string;
  iterationId: string;
  effectiveCapacityHours: number;
  plannedLoadHours: number;
  utilization: number | null;
  band: ReturnType<typeof utilizationBand>;
};

export type ResourceIterationCapacityView = {
  resourceId: string;
  resourceName: string;
  teamId: string;
  iterationId: string;
  allocationPercent: number;
  effectiveCapacityHours: number;
  plannedLoadHours: number;
  utilization: number | null;
  band: ReturnType<typeof utilizationBand>;
};

export class CapacityService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly piService: PiService,
  ) {}

  async setResourceAvailability(principal: Principal, raw: unknown) {
    const input = parse(setResourceAvailabilityInputSchema, raw);
    const iteration = await this.db.piIteration.findUnique({
      where: { id: input.iterationId },
      include: { pi: true },
    });
    if (!iteration) throw new AppError("NOT_FOUND", "Iteration not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PI_MANAGE_CAPACITY, {
      type: "ORGANIZATION",
      organizationId: iteration.pi.organizationId,
    });

    const resource = await this.db.resource.findUnique({
      where: { id: input.resourceId },
    });
    if (
      !resource ||
      resource.organizationId !== iteration.pi.organizationId
    ) {
      throw new AppError("NOT_FOUND", "Resource not found in this organization.");
    }

    const existing = await this.db.resourceAvailability.findUnique({
      where: {
        resourceId_iterationId: {
          resourceId: input.resourceId,
          iterationId: input.iterationId,
        },
      },
    });

    if (existing) {
      if (
        input.expectedVersion != null &&
        existing.version !== input.expectedVersion
      ) {
        throw new AppError(
          "STALE_VERSION",
          "This availability row was changed by someone else. Refresh and try again.",
          { details: { currentVersion: existing.version } },
        );
      }
      try {
        const updated = await this.db.resourceAvailability.update({
          where: {
            id: existing.id,
            ...(input.expectedVersion != null
              ? { version: input.expectedVersion }
              : {}),
          },
          data: {
            availableHours: toDecimal(input.availableHours),
            reductionHours:
              toDecimal(input.reductionHours) ?? new Prisma.Decimal(0),
            notes: input.notes ?? null,
            version: { increment: 1 },
          },
        });
        await this.audit.record({
          actorPrincipalId: principal.id,
          actionType: "pi.capacity.availability.updated",
          subjectType: "ResourceAvailability",
          subjectId: updated.id,
          organizationId: iteration.pi.organizationId,
          payload: {
            resourceId: input.resourceId,
            iterationId: input.iterationId,
          },
          result: "success",
        });
        return updated;
      } catch (error) {
        this.rethrowStale(error);
      }
    }

    const created = await this.db.resourceAvailability.create({
      data: {
        resourceId: input.resourceId,
        iterationId: input.iterationId,
        availableHours: toDecimal(input.availableHours),
        reductionHours:
          toDecimal(input.reductionHours) ?? new Prisma.Decimal(0),
        notes: input.notes ?? null,
      },
    });
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "pi.capacity.availability.created",
      subjectType: "ResourceAvailability",
      subjectId: created.id,
      organizationId: iteration.pi.organizationId,
      payload: {
        resourceId: input.resourceId,
        iterationId: input.iterationId,
      },
      result: "success",
    });
    return created;
  }

  async getCapacityViews(principal: Principal, piId: string) {
    const pi = await this.piService.requirePi(piId);
    await this.authz.assertCan(principal, PERMISSIONS.PI_VIEW, {
      type: "ORGANIZATION",
      organizationId: pi.organizationId,
    });
    return this.computeCapacityViews(piId);
  }

  async computeCapacityViews(piId: string): Promise<{
    teams: TeamIterationCapacityView[];
    resources: ResourceIterationCapacityView[];
  }> {
    const revision = await this.piService.requireCurrentRevision(piId);
    const iterations = await this.db.piIteration.findMany({
      where: { piId },
      orderBy: { sequence: "asc" },
    });
    const participatingTeams = await this.db.piParticipatingTeam.findMany({
      where: { piId },
      include: { team: true },
    });
    const teamIds = participatingTeams.map((t) => t.teamId);

    const memberships =
      teamIds.length === 0
        ? []
        : await this.db.resourceMembership.findMany({
            where: { teamId: { in: teamIds }, effectiveTo: null },
            include: { resource: true, team: true },
          });

    const availabilities = await this.db.resourceAvailability.findMany({
      where: { iterationId: { in: iterations.map((i) => i.id) } },
    });
    const availKey = (resourceId: string, iterationId: string) =>
      `${resourceId}:${iterationId}`;
    const availMap = new Map(
      availabilities.map(
        (a) => [availKey(a.resourceId, a.iterationId), a] as const,
      ),
    );

    const allocations = await this.db.workAllocation.findMany({
      where: { revisionId: revision.id },
    });

    const teams: TeamIterationCapacityView[] = [];
    const resources: ResourceIterationCapacityView[] = [];

    for (const iteration of iterations) {
      for (const pt of participatingTeams) {
        const teamMemberships = memberships.filter(
          (m) => m.teamId === pt.teamId,
        );
        let teamCapacityHours = 0;
        for (const m of teamMemberships) {
          const avail = availMap.get(availKey(m.resourceId, iteration.id));
          const hours = effectiveResourceCapacity({
            capacityHoursPerWeek: m.resource.capacityHoursPerWeek,
            allocationPercent: m.allocationPercent,
            startDate: iteration.startDate,
            endDate: iteration.endDate,
            availableHoursOverride: avail?.availableHours,
            reductionHours: avail?.reductionHours,
          });
          teamCapacityHours += hours;

          const resourceLoad = allocations
            .filter(
              (a) =>
                a.iterationId === iteration.id &&
                a.resourceId === m.resourceId,
            )
            .reduce((s, a) => s + toHoursNumber(a.plannedHours), 0);

          const util = utilization(resourceLoad, hours);
          resources.push({
            resourceId: m.resourceId,
            resourceName: m.resource.name,
            teamId: pt.teamId,
            iterationId: iteration.id,
            allocationPercent: toHoursNumber(m.allocationPercent),
            effectiveCapacityHours: hours,
            plannedLoadHours: resourceLoad,
            utilization: util,
            band: utilizationBand(util),
          });
        }

        const teamLoad = allocations
          .filter(
            (a) => a.iterationId === iteration.id && a.teamId === pt.teamId,
          )
          .reduce((s, a) => s + toHoursNumber(a.plannedHours), 0);
        const util = utilization(teamLoad, teamCapacityHours);
        teams.push({
          teamId: pt.teamId,
          teamName: pt.team.name,
          departmentId: pt.departmentId,
          iterationId: iteration.id,
          effectiveCapacityHours: teamCapacityHours,
          plannedLoadHours: teamLoad,
          utilization: util,
          band: utilizationBand(util),
        });
      }
    }

    return { teams, resources };
  }

  private rethrowStale(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new AppError(
        "STALE_VERSION",
        "This availability row was changed by someone else. Refresh and try again.",
      );
    }
    throw error;
  }
}
