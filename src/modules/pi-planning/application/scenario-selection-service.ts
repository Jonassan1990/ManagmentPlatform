/**
 * M3D-A — Select / clear preferred scenario + readiness evaluation.
 * Selection writes only PI.selectedRevisionId + revision selection markers/status.
 * Never mutates WorkAllocation or PiBaseline payloads.
 */

import {
  PlanningRevisionStatus,
  type PrismaClient,
  type ProgramIncrement,
  type PlanningRevision,
} from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { CAPACITY_THRESHOLDS, toHoursNumber } from "./capacity-policy";
import type { CapacityService } from "./capacity-service";
import type { DerivedConflict } from "./conflict-engine";
import { piAuthScope } from "./pi-auth-scope";
import type { PiService } from "./pi-service";
import type { PlanningService } from "./planning-service";
import {
  clearScenarioSelectionInputSchema,
  evaluateScenarioReadinessInputSchema,
  selectScenarioInputSchema,
} from "./schemas";
import type {
  ScenarioReadinessClassification,
  ScenarioReadinessIssue,
  ScenarioReadinessMetrics,
  ScenarioReadinessResult,
  ScenarioSelectionHistoryEntry,
  ScenarioSelectionRef,
  ScenarioSelectionState,
  SharedInputFreshness,
} from "./scenario-selection-types";

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

const ELIGIBLE_STATUSES: PlanningRevisionStatus[] = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "SELECTED",
];

function toSelectionRef(r: PlanningRevision): ScenarioSelectionRef {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    status: r.status,
    isCurrent: r.isCurrent,
    version: r.version,
    selectedAt: r.selectedAt?.toISOString() ?? null,
    selectedByPrincipalId: r.selectedByPrincipalId,
    createdAt: r.createdAt.toISOString(),
  };
}

export class ScenarioSelectionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly piService: PiService,
    private readonly capacity: CapacityService,
    private readonly planning: PlanningService,
  ) {}

  async getSelectionState(
    principal: Principal,
    piId: string,
  ): Promise<ScenarioSelectionState> {
    const pi = await this.piService.requirePi(piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_VIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );

    let selected: PlanningRevision | null = null;
    if (pi.selectedRevisionId) {
      selected = await this.db.planningRevision.findUnique({
        where: { id: pi.selectedRevisionId },
      });
      if (selected && selected.piId !== pi.id) {
        selected = null;
      }
    }

    return {
      piId: pi.id,
      piVersion: pi.version,
      selectedRevision: selected ? toSelectionRef(selected) : null,
      selectionDisclaimer: "Selected for review — not approved",
    };
  }

  async listSelectionHistory(
    principal: Principal,
    piId: string,
  ): Promise<ScenarioSelectionHistoryEntry[]> {
    const pi = await this.piService.requirePi(piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_VIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );

    const events = await this.db.auditEvent.findMany({
      where: {
        organizationId: pi.organizationId,
        subjectId: piId,
        actionType: {
          in: [
            "pi.scenario.selected",
            "pi.scenario.selection_changed",
            "pi.scenario.selection_cleared",
          ],
        },
      },
      orderBy: { occurredAt: "desc" },
      take: 50,
    });

    return events.map((e) => ({
      id: e.id,
      actionType: e.actionType,
      actorPrincipalId: e.actorPrincipalId,
      createdAt: e.occurredAt.toISOString(),
      payload: e.payload,
    }));
  }

  async selectScenario(principal: Principal, raw: unknown) {
    const input = parse(selectScenarioInputSchema, raw);
    const pi = await this.piService.requirePi(input.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_REVIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );
    this.assertPiAllowsSelection(pi);
    if (pi.version !== input.expectedPiVersion) {
      throw new AppError(
        "CONFLICT",
        "PI version is stale. Refresh and retry selection.",
        { details: { expected: input.expectedPiVersion, actual: pi.version } },
      );
    }

    const revision = await this.db.planningRevision.findUnique({
      where: { id: input.revisionId },
    });
    if (!revision || revision.piId !== pi.id) {
      throw new AppError(
        "NOT_FOUND",
        "Scenario not found on this Program Increment.",
      );
    }
    if (revision.isCurrent || revision.key === "CURRENT") {
      throw new AppError(
        "VALIDATION",
        "The current plan cannot be selected as an alternative scenario.",
      );
    }
    if (revision.status === "ARCHIVED" || revision.archivedAt) {
      throw new AppError(
        "VALIDATION",
        "Archived scenarios cannot be selected.",
      );
    }
    if (!ELIGIBLE_STATUSES.includes(revision.status)) {
      throw new AppError(
        "VALIDATION",
        `Scenario status ${revision.status} is not eligible for selection.`,
      );
    }
    if (revision.version !== input.expectedRevisionVersion) {
      throw new AppError(
        "CONFLICT",
        "Scenario version is stale. Refresh and retry selection.",
        {
          details: {
            expected: input.expectedRevisionVersion,
            actual: revision.version,
          },
        },
      );
    }

    const previousId = pi.selectedRevisionId;
    const now = new Date();

    try {
      const result = await this.db.$transaction(async (tx) => {
        const piLock = await tx.programIncrement.updateMany({
          where: { id: pi.id, version: input.expectedPiVersion },
          data: { version: { increment: 1 } },
        });
        if (piLock.count !== 1) {
          throw new AppError(
            "CONFLICT",
            "Concurrent PI update — selection aborted.",
          );
        }

        if (previousId && previousId !== revision.id) {
          const previous = await tx.planningRevision.findUnique({
            where: { id: previousId },
          });
          if (previous && previous.piId === pi.id) {
            const restore =
              previous.statusBeforeSelection ??
              (previous.status === "SELECTED"
                ? PlanningRevisionStatus.DRAFT
                : previous.status);
            await tx.planningRevision.update({
              where: { id: previous.id },
              data: {
                status:
                  restore === "SELECTED"
                    ? PlanningRevisionStatus.DRAFT
                    : restore,
                selectedAt: null,
                selectedByPrincipalId: null,
                statusBeforeSelection: null,
                version: { increment: 1 },
              },
            });
          }
        }

        const priorStatus =
          revision.status === "SELECTED"
            ? (revision.statusBeforeSelection ??
              PlanningRevisionStatus.DRAFT)
            : revision.status;

        const updatedRevision = await tx.planningRevision.update({
          where: { id: revision.id, version: input.expectedRevisionVersion },
          data: {
            status: PlanningRevisionStatus.SELECTED,
            statusBeforeSelection: priorStatus,
            selectedAt: now,
            selectedByPrincipalId: principal.id,
            version: { increment: 1 },
          },
        });

        const updatedPi = await tx.programIncrement.update({
          where: { id: pi.id },
          data: { selectedRevisionId: revision.id },
        });

        return { updatedPi, updatedRevision, previousId };
      });

      const actionType =
        previousId && previousId !== revision.id
          ? "pi.scenario.selection_changed"
          : "pi.scenario.selected";

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType,
        subjectType: "ProgramIncrement",
        subjectId: pi.id,
        organizationId: pi.organizationId,
        payload: {
          piId: pi.id,
          oldRevisionId: previousId,
          newRevisionId: revision.id,
          selectedAt: now.toISOString(),
          piVersion: result.updatedPi.version,
        },
        result: "success",
      });

      return {
        piId: pi.id,
        piVersion: result.updatedPi.version,
        selectedRevision: toSelectionRef(result.updatedRevision),
        selectionDisclaimer: "Selected for review — not approved" as const,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "CONFLICT",
        "Selection failed due to a concurrent update. Refresh and retry.",
        { cause: error },
      );
    }
  }

  async clearSelection(principal: Principal, raw: unknown) {
    const input = parse(clearScenarioSelectionInputSchema, raw);
    const pi = await this.piService.requirePi(input.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_REVIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );
    this.assertPiAllowsSelection(pi);
    if (pi.version !== input.expectedPiVersion) {
      throw new AppError(
        "CONFLICT",
        "PI version is stale. Refresh and retry.",
        { details: { expected: input.expectedPiVersion, actual: pi.version } },
      );
    }

    const previousId = pi.selectedRevisionId;
    if (!previousId) {
      return {
        piId: pi.id,
        piVersion: pi.version,
        selectedRevision: null,
        selectionDisclaimer: "Selected for review — not approved" as const,
      };
    }

    try {
      const result = await this.db.$transaction(async (tx) => {
        const piLock = await tx.programIncrement.updateMany({
          where: { id: pi.id, version: input.expectedPiVersion },
          data: {
            selectedRevisionId: null,
            version: { increment: 1 },
          },
        });
        if (piLock.count !== 1) {
          throw new AppError(
            "CONFLICT",
            "Concurrent PI update — clear selection aborted.",
          );
        }

        const previous = await tx.planningRevision.findUnique({
          where: { id: previousId },
        });
        if (previous && previous.piId === pi.id) {
          const restore =
            previous.statusBeforeSelection ?? PlanningRevisionStatus.DRAFT;
          await tx.planningRevision.update({
            where: { id: previous.id },
            data: {
              status:
                restore === "SELECTED"
                  ? PlanningRevisionStatus.DRAFT
                  : restore,
              selectedAt: null,
              selectedByPrincipalId: null,
              statusBeforeSelection: null,
              version: { increment: 1 },
            },
          });
        }

        const updatedPi = await tx.programIncrement.findUniqueOrThrow({
          where: { id: pi.id },
        });
        return updatedPi;
      });

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.scenario.selection_cleared",
        subjectType: "ProgramIncrement",
        subjectId: pi.id,
        organizationId: pi.organizationId,
        payload: {
          piId: pi.id,
          oldRevisionId: previousId,
          newRevisionId: null,
          clearedAt: new Date().toISOString(),
          piVersion: result.version,
        },
        result: "success",
      });

      return {
        piId: pi.id,
        piVersion: result.version,
        selectedRevision: null,
        selectionDisclaimer: "Selected for review — not approved" as const,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "CONFLICT",
        "Clear selection failed due to a concurrent update.",
        { cause: error },
      );
    }
  }

  async evaluateReadiness(
    principal: Principal,
    raw: unknown,
  ): Promise<ScenarioReadinessResult> {
    const input = parse(evaluateScenarioReadinessInputSchema, raw);
    const pi = await this.piService.requirePi(input.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_VIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );

    const revisionId = input.revisionId ?? pi.selectedRevisionId;
    if (!revisionId) {
      return {
        piId: pi.id,
        revision: null,
        classification: "UNAVAILABLE",
        metrics: null,
        blockers: [
          {
            code: "NO_SCENARIO",
            severity: "blocker",
            message: "No scenario selected or specified for readiness.",
          },
        ],
        warnings: [],
        conflicts: [],
        dataQuality: { missingCapacityInputs: false, notes: [] },
        freshness: null,
        evaluatedAt: new Date().toISOString(),
      };
    }

    const revision = await this.db.planningRevision.findUnique({
      where: { id: revisionId },
    });
    if (!revision || revision.piId !== pi.id) {
      return {
        piId: pi.id,
        revision: null,
        classification: "UNAVAILABLE",
        metrics: null,
        blockers: [
          {
            code: "REVISION_NOT_FOUND",
            severity: "blocker",
            message: "Scenario is not available on this PI.",
          },
        ],
        warnings: [],
        conflicts: [],
        dataQuality: { missingCapacityInputs: false, notes: [] },
        freshness: null,
        evaluatedAt: new Date().toISOString(),
      };
    }

    const [capacityViews, conflicts, freshness] = await Promise.all([
      this.capacity.computeCapacityViews(pi.id, revision.id),
      this.planning.deriveConflictsForPi(pi.id, revision.id),
      this.assessSharedInputFreshness(pi, revision),
    ]);

    const metrics = this.rollupMetrics(capacityViews.teams, conflicts);
    const blockers: ScenarioReadinessIssue[] = [];
    const warnings: ScenarioReadinessIssue[] = [];

    const iterations = await this.db.piIteration.count({
      where: { piId: pi.id },
    });
    const teams = await this.db.piParticipatingTeam.count({
      where: { piId: pi.id },
    });
    if (iterations === 0) {
      blockers.push({
        code: "NO_ITERATIONS",
        severity: "blocker",
        message: "PI has no iterations — capacity cannot be planned.",
      });
    }
    if (teams === 0) {
      blockers.push({
        code: "NO_TEAMS",
        severity: "blocker",
        message: "PI has no participating teams.",
      });
    }

    for (const c of conflicts) {
      if (c.severity === "BLOCKER") {
        blockers.push({
          code: c.type,
          severity: "blocker",
          message: c.message,
        });
      } else if (c.severity === "WARNING") {
        warnings.push({
          code: c.type,
          severity: "warning",
          message: c.message,
        });
      }
    }

    if (metrics.overloadedTeamCount > 0) {
      // Overloads already emit conflicts; ensure classification sees them.
      if (!blockers.some((b) => b.code === "TEAM_OVERLOAD")) {
        blockers.push({
          code: "OVERLOADED_TEAMS",
          severity: "blocker",
          message: `${metrics.overloadedTeamCount} overloaded team×iteration slot(s).`,
        });
      }
    }

    const missingCapacityInputs = capacityViews.teams.every(
      (t) => toHoursNumber(t.effectiveCapacityHours) === 0,
    );
    const dataNotes: string[] = [];
    if (missingCapacityInputs) {
      warnings.push({
        code: "MISSING_CAPACITY_INPUTS",
        severity: "warning",
        message:
          "No effective capacity hours derived — check weekly capacity, membership, and availability.",
      });
      dataNotes.push(
        "Available hours are zero across all team slots; do not treat as intentional zero load without verifying inputs.",
      );
    }

    for (const signal of freshness.signals) {
      warnings.push({
        code: signal.code,
        severity: "warning",
        message: signal.message,
      });
    }

    const classification = this.classify(blockers, warnings, metrics);

    return {
      piId: pi.id,
      revision: toSelectionRef(revision),
      classification,
      metrics,
      blockers,
      warnings,
      conflicts,
      dataQuality: {
        missingCapacityInputs,
        notes: dataNotes,
      },
      freshness,
      evaluatedAt: new Date().toISOString(),
    };
  }

  private classify(
    blockers: ScenarioReadinessIssue[],
    warnings: ScenarioReadinessIssue[],
    metrics: ScenarioReadinessMetrics,
  ): ScenarioReadinessClassification {
    if (blockers.length > 0 || metrics.blockerConflictCount > 0) {
      return "NOT_READY";
    }
    if (warnings.length > 0 || metrics.warningConflictCount > 0) {
      return "READY_WITH_WARNINGS";
    }
    return "READY";
  }

  private rollupMetrics(
    teams: Array<{
      effectiveCapacityHours: unknown;
      plannedLoadHours: unknown;
      band?: string;
      overloaded?: boolean;
    }>,
    conflicts: DerivedConflict[],
  ): ScenarioReadinessMetrics {
    let availableHours = 0;
    let committedHours = 0;
    let overloadedTeamCount = 0;
    for (const t of teams) {
      availableHours += toHoursNumber(t.effectiveCapacityHours as never);
      committedHours += toHoursNumber(t.plannedLoadHours as never);
      if (t.overloaded || t.band === "overload") overloadedTeamCount += 1;
    }
    const remainingHours = availableHours - committedHours;
    const utilization =
      availableHours > 0
        ? committedHours / availableHours
        : committedHours > 0
          ? null
          : null;
    const utilizationPercent =
      utilization != null && Number.isFinite(utilization)
        ? Math.round(utilization * 1000) / 10
        : null;

    return {
      availableHours,
      committedHours,
      remainingHours,
      utilization,
      utilizationPercent,
      overloadedTeamCount,
      conflictCount: conflicts.length,
      blockerConflictCount: conflicts.filter((c) => c.severity === "BLOCKER")
        .length,
      warningConflictCount: conflicts.filter((c) => c.severity === "WARNING")
        .length,
    };
  }

  /**
   * Proven freshness checks only — see docs/PI-SCENARIO-SELECTION-READINESS.md.
   */
  private async assessSharedInputFreshness(
    pi: ProgramIncrement,
    revision: PlanningRevision,
  ): Promise<SharedInputFreshness> {
    const baselineAt = revision.createdAt;
    const signals: SharedInputFreshness["signals"] = [];
    const notes = [
      "Freshness compares live shared inputs to scenario createdAt (and selectedAt when set).",
      "PiParticipatingTeam/Department rows have createdAt only — membership roster changes after create are not fully reconstructable without audit.",
      "Dependency graph changes are not versioned historically in M3D-A.",
    ];

    const teamIds = (
      await this.db.piParticipatingTeam.findMany({
        where: { piId: pi.id },
        select: { teamId: true },
      })
    ).map((t) => t.teamId);

    if (teamIds.length > 0) {
      const staleMembership = await this.db.resourceMembership.findFirst({
        where: {
          teamId: { in: teamIds },
          updatedAt: { gt: baselineAt },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (staleMembership) {
        signals.push({
          code: "MEMBERSHIP_CHANGED_SINCE_CREATE",
          message:
            "One or more resource memberships for participating teams changed after this scenario was created.",
          detectedAt: staleMembership.updatedAt.toISOString(),
        });
      }

      const membershipResourceIds = (
        await this.db.resourceMembership.findMany({
          where: { teamId: { in: teamIds } },
          select: { resourceId: true },
          distinct: ["resourceId"],
        })
      ).map((m) => m.resourceId);

      if (membershipResourceIds.length > 0) {
        const staleResource = await this.db.resource.findFirst({
          where: {
            id: { in: membershipResourceIds },
            updatedAt: { gt: baselineAt },
          },
          orderBy: { updatedAt: "desc" },
        });
        if (staleResource) {
          signals.push({
            code: "RESOURCE_CAPACITY_CHANGED_SINCE_CREATE",
            message:
              "A participating resource record (e.g. weekly capacity) changed after scenario creation.",
            detectedAt: staleResource.updatedAt.toISOString(),
          });
        }
      }

      const iterationIds = (
        await this.db.piIteration.findMany({
          where: { piId: pi.id },
          select: { id: true },
        })
      ).map((i) => i.id);

      if (iterationIds.length > 0 && membershipResourceIds.length > 0) {
        const staleAvail = await this.db.resourceAvailability.findFirst({
          where: {
            iterationId: { in: iterationIds },
            resourceId: { in: membershipResourceIds },
            updatedAt: { gt: baselineAt },
          },
          orderBy: { updatedAt: "desc" },
        });
        if (staleAvail) {
          signals.push({
            code: "AVAILABILITY_CHANGED_SINCE_CREATE",
            message:
              "ResourceAvailability for a PI iteration changed after scenario creation.",
            detectedAt: staleAvail.updatedAt.toISOString(),
          });
        }
      }

      const staleIteration = await this.db.piIteration.findFirst({
        where: {
          piId: pi.id,
          updatedAt: { gt: baselineAt },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (staleIteration) {
        signals.push({
          code: "ITERATION_CHANGED_SINCE_CREATE",
          message:
            "An iteration date or metadata changed after scenario creation.",
          detectedAt: staleIteration.updatedAt.toISOString(),
        });
      }
    }

    // Near-capacity soft warning threshold documented for readiness consumers.
    void CAPACITY_THRESHOLDS;

    return {
      baselineAt: baselineAt.toISOString(),
      signals,
      notes,
    };
  }

  private assertPiAllowsSelection(pi: ProgramIncrement) {
    if (pi.status === "CLOSED") {
      throw new AppError(
        "VALIDATION",
        "Cannot change scenario selection on a closed PI.",
      );
    }
  }

  /** Called from ScenarioService.archiveScenario to drop selection if needed. */
  async clearSelectionIfArchiving(
    piId: string,
    revisionId: string,
    actorId: string | null,
  ) {
    const pi = await this.db.programIncrement.findUnique({
      where: { id: piId },
    });
    if (!pi || pi.selectedRevisionId !== revisionId) return;

    await this.db.$transaction(async (tx) => {
      await tx.programIncrement.update({
        where: { id: piId },
        data: {
          selectedRevisionId: null,
          version: { increment: 1 },
        },
      });
    });

    if (actorId) {
      await this.audit.record({
        actorPrincipalId: actorId,
        actionType: "pi.scenario.selection_cleared",
        subjectType: "ProgramIncrement",
        subjectId: piId,
        organizationId: pi.organizationId,
        payload: {
          piId,
          oldRevisionId: revisionId,
          newRevisionId: null,
          reason: "scenario_archived",
        },
        result: "success",
      });
    }
  }
}
