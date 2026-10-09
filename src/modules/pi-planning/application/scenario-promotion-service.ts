/**
 * M3D-B — Atomic promote of selected scenario allocations into CURRENT.
 *
 * Strategy: allocate-replace on the existing CURRENT PlanningRevision row.
 * Does not mark APPROVED/BASELINED; does not create PiBaseline.
 * Selection ≠ approval; baseline remains a separate PI_BASELINE action.
 */

import { randomUUID } from "crypto";
import {
  PlanningRevisionStatus,
  Prisma,
  type PrismaClient,
  type ProgramIncrement,
} from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { toHoursNumber } from "./capacity-policy";
import { piAuthScope } from "./pi-auth-scope";
import type { PiService } from "./pi-service";
import { promoteSelectedScenarioInputSchema } from "./schemas";
import type { ScenarioSelectionService } from "./scenario-selection-service";
import type { ScenarioSelectionRef } from "./scenario-selection-types";
import type {
  PromotionAllocationSummary,
  ScenarioPromotionPreview,
  ScenarioPromotionResult,
} from "./scenario-promotion-types";

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

function toSelectionRef(r: {
  id: string;
  key: string;
  label: string | null;
  status: string;
  isCurrent: boolean;
  version: number;
  selectedAt: Date | null;
  selectedByPrincipalId: string | null;
  createdAt: Date;
}): ScenarioSelectionRef {
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

function summarizeAllocations(
  rows: Array<{ workItemId: string; plannedHours: Prisma.Decimal | unknown }>,
): PromotionAllocationSummary {
  let total = 0;
  const workItemIds: string[] = [];
  for (const row of rows) {
    total += toHoursNumber(row.plannedHours as never);
    workItemIds.push(row.workItemId);
  }
  return {
    allocationCount: rows.length,
    totalCommittedHours: Math.round(total * 100) / 100,
    workItemIds,
  };
}

function allocationFingerprint(
  rows: Array<{
    workItemId: string;
    iterationId: string;
    teamId: string;
    resourceId: string | null;
    plannedHours: Prisma.Decimal | unknown;
    notes: string | null;
  }>,
): string {
  const normalized = [...rows]
    .map((a) => ({
      workItemId: a.workItemId,
      iterationId: a.iterationId,
      teamId: a.teamId,
      resourceId: a.resourceId,
      plannedHours: String(a.plannedHours),
      notes: a.notes ?? null,
    }))
    .sort((a, b) => a.workItemId.localeCompare(b.workItemId));
  return JSON.stringify(normalized);
}

export class ScenarioPromotionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly piService: PiService,
    private readonly selection: ScenarioSelectionService,
  ) {}

  async getPromotionPreview(
    principal: Principal,
    piId: string,
  ): Promise<ScenarioPromotionPreview> {
    const pi = await this.piService.requirePi(piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_VIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );

    const canReview = await this.authz.can(
      principal,
      PERMISSIONS.PI_REVIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );

    const current = await this.db.planningRevision.findFirst({
      where: { piId: pi.id, isCurrent: true, key: "CURRENT" },
    });

    let selected = null as Awaited<
      ReturnType<typeof this.db.planningRevision.findUnique>
    >;
    if (pi.selectedRevisionId) {
      selected = await this.db.planningRevision.findUnique({
        where: { id: pi.selectedRevisionId },
      });
      if (selected && selected.piId !== pi.id) selected = null;
    }

    const [currentAllocs, selectedAllocs, readiness] = await Promise.all([
      current
        ? this.db.workAllocation.findMany({ where: { revisionId: current.id } })
        : Promise.resolve([]),
      selected
        ? this.db.workAllocation.findMany({
            where: { revisionId: selected.id },
          })
        : Promise.resolve([]),
      selected
        ? this.selection.evaluateReadiness(principal, {
            piId: pi.id,
            revisionId: selected.id,
          })
        : Promise.resolve(null),
    ]);

    const disabledReasons: string[] = [];
    if (!canReview) {
      disabledReasons.push("PI review permission is required to promote.");
    }
    if (pi.status === "CLOSED") {
      disabledReasons.push("Closed PIs cannot be promoted into.");
    }
    if (!selected) {
      disabledReasons.push("Exactly one scenario must be selected for review.");
    }
    if (!current) {
      disabledReasons.push("CURRENT planning revision is missing.");
    }
    if (selected?.archivedAt || selected?.status === "ARCHIVED") {
      disabledReasons.push("Selected scenario is archived.");
    }
    if (selected?.isCurrent || selected?.key === "CURRENT") {
      disabledReasons.push("CURRENT cannot be promoted onto itself.");
    }
    if (readiness?.classification === "NOT_READY") {
      disabledReasons.push(
        "Selected scenario has unresolved hard readiness blockers.",
      );
    }
    if (readiness?.classification === "UNAVAILABLE") {
      disabledReasons.push("Readiness could not be evaluated.");
    }

    const requiresWarningAcknowledgement =
      readiness?.classification === "READY_WITH_WARNINGS";

    const canPromote =
      disabledReasons.length === 0 &&
      (readiness?.classification === "READY" ||
        readiness?.classification === "READY_WITH_WARNINGS");

    return {
      piId: pi.id,
      piVersion: pi.version,
      piStatus: pi.status,
      selectedRevision: selected ? toSelectionRef(selected) : null,
      currentRevision: current
        ? { id: current.id, key: current.key, version: current.version }
        : null,
      readiness,
      currentAllocations: summarizeAllocations(currentAllocs),
      selectedAllocations: summarizeAllocations(selectedAllocs),
      canPromote,
      requiresWarningAcknowledgement,
      disabledReasons,
      promotionDisclaimer:
        "Changes the authoritative plan — does not create an approved baseline",
    };
  }

  async promoteSelectedScenario(
    principal: Principal,
    raw: unknown,
  ): Promise<ScenarioPromotionResult> {
    const input = parse(promoteSelectedScenarioInputSchema, raw);
    const pi = await this.piService.requirePi(input.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_REVIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );
    this.assertPiEligible(pi);

    if (pi.version !== input.expectedPiVersion) {
      throw new AppError(
        "CONFLICT",
        "PI version is stale. Refresh and retry promotion.",
        { details: { expected: input.expectedPiVersion, actual: pi.version } },
      );
    }

    // Idempotent replay: already promoted this scenario with matching CURRENT content.
    const idempotent = await this.tryIdempotentReplay(pi, input);
    if (idempotent) return idempotent;

    if (!pi.selectedRevisionId) {
      throw new AppError(
        "VALIDATION",
        "No scenario is selected. Select a scenario for review before promoting.",
      );
    }
    if (pi.selectedRevisionId !== input.expectedSelectedRevisionId) {
      throw new AppError(
        "CONFLICT",
        "Selection changed between review and promotion. Refresh and retry.",
        {
          details: {
            expected: input.expectedSelectedRevisionId,
            actual: pi.selectedRevisionId,
          },
        },
      );
    }

    // Fresh readiness — never trust selection-time evaluation alone.
    const readiness = await this.selection.evaluateReadiness(principal, {
      piId: pi.id,
      revisionId: pi.selectedRevisionId,
    });
    this.assertReadinessAllowsPromote(readiness, input.acknowledgeWarnings);

    const sourceBefore = await this.db.planningRevision.findUnique({
      where: { id: pi.selectedRevisionId },
    });
    if (!sourceBefore || sourceBefore.piId !== pi.id) {
      throw new AppError(
        "NOT_FOUND",
        "Selected scenario is not available on this Program Increment.",
      );
    }
    this.assertSourceEligible(sourceBefore);
    if (sourceBefore.version !== input.expectedSelectedRevisionVersion) {
      throw new AppError(
        "CONFLICT",
        "Selected scenario version is stale. Refresh and retry promotion.",
        {
          details: {
            expected: input.expectedSelectedRevisionVersion,
            actual: sourceBefore.version,
          },
        },
      );
    }

    const currentBefore = await this.piService.requireCurrentRevision(pi.id);
    if (currentBefore.version !== input.expectedCurrentRevisionVersion) {
      throw new AppError(
        "CONFLICT",
        "CURRENT plan changed concurrently. Refresh and retry promotion.",
        {
          details: {
            expected: input.expectedCurrentRevisionVersion,
            actual: currentBefore.version,
          },
        },
      );
    }

    const previousCurrentVersion = currentBefore.version;
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
            "Concurrent PI update — promotion aborted.",
          );
        }

        const lockedPi = await tx.programIncrement.findUniqueOrThrow({
          where: { id: pi.id },
        });
        if (lockedPi.selectedRevisionId !== input.expectedSelectedRevisionId) {
          throw new AppError(
            "CONFLICT",
            "Selection changed between review and promotion. Refresh and retry.",
          );
        }

        const source = await tx.planningRevision.findUnique({
          where: { id: input.expectedSelectedRevisionId },
        });
        if (!source || source.piId !== pi.id) {
          throw new AppError(
            "NOT_FOUND",
            "Selected scenario is not available on this Program Increment.",
          );
        }
        this.assertSourceEligible(source);
        if (source.version !== input.expectedSelectedRevisionVersion) {
          throw new AppError(
            "CONFLICT",
            "Selected scenario version is stale. Refresh and retry promotion.",
          );
        }

        const current = await tx.planningRevision.findFirst({
          where: { piId: pi.id, isCurrent: true, key: "CURRENT" },
        });
        if (!current) {
          throw new AppError(
            "VALIDATION",
            "CURRENT planning revision is missing.",
          );
        }
        if (current.version !== input.expectedCurrentRevisionVersion) {
          throw new AppError(
            "CONFLICT",
            "CURRENT plan changed concurrently. Refresh and retry promotion.",
          );
        }

        const sourceAllocations = await tx.workAllocation.findMany({
          where: { revisionId: source.id },
        });

        await tx.workAllocation.deleteMany({
          where: { revisionId: current.id },
        });

        if (sourceAllocations.length > 0) {
          await tx.workAllocation.createMany({
            data: sourceAllocations.map((a) => ({
              id: randomUUID(),
              revisionId: current.id,
              workItemId: a.workItemId,
              iterationId: a.iterationId,
              teamId: a.teamId,
              resourceId: a.resourceId,
              plannedHours: a.plannedHours,
              notes: a.notes,
              version: 1,
            })),
          });
        }

        const updatedCurrent = await tx.planningRevision.update({
          where: {
            id: current.id,
            version: input.expectedCurrentRevisionVersion,
          },
          data: { version: { increment: 1 } },
        });

        const updatedSource = await tx.planningRevision.update({
          where: {
            id: source.id,
            version: input.expectedSelectedRevisionVersion,
          },
          data: {
            status: PlanningRevisionStatus.PROMOTED,
            selectedAt: null,
            selectedByPrincipalId: null,
            statusBeforeSelection: null,
            version: { increment: 1 },
          },
        });

        const updatedPi = await tx.programIncrement.update({
          where: { id: pi.id },
          data: {
            selectedRevisionId: null,
            lastPromotedFromRevisionId: source.id,
            lastPromotedAt: now,
            lastPromotedByPrincipalId: principal.id,
          },
        });

        const summary = summarizeAllocations(sourceAllocations);
        return {
          updatedPi,
          updatedCurrent,
          updatedSource,
          summary,
        };
      });

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.scenario.promoted",
        subjectType: "ProgramIncrement",
        subjectId: pi.id,
        organizationId: pi.organizationId,
        payload: {
          piId: pi.id,
          sourceRevisionId: result.updatedSource.id,
          sourceRevisionKey: result.updatedSource.key,
          currentRevisionId: result.updatedCurrent.id,
          previousCurrentVersion,
          newCurrentVersion: result.updatedCurrent.version,
          piVersion: result.updatedPi.version,
          allocationCount: result.summary.allocationCount,
          totalCommittedHours: result.summary.totalCommittedHours,
          promotedAt: now.toISOString(),
          acknowledgeWarnings: input.acknowledgeWarnings,
        },
        result: "success",
      });

      return {
        piId: pi.id,
        piVersion: result.updatedPi.version,
        currentRevisionId: result.updatedCurrent.id,
        currentRevisionVersion: result.updatedCurrent.version,
        sourceRevisionId: result.updatedSource.id,
        sourceRevisionVersion: result.updatedSource.version,
        previousCurrentVersion,
        allocationCount: result.summary.allocationCount,
        totalCommittedHours: result.summary.totalCommittedHours,
        promotedAt: now.toISOString(),
        idempotentReplay: false,
        promotionDisclaimer:
          "Changes the authoritative plan — does not create an approved baseline",
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new AppError(
          "CONFLICT",
          "Promotion failed due to a concurrent update. Refresh and retry.",
        );
      }
      throw new AppError(
        "CONFLICT",
        "Promotion failed due to a concurrent update. Refresh and retry.",
        { cause: error },
      );
    }
  }

  /**
   * Safe replay when a client retries after a successful promote with refreshed
   * versions that still identify the same already-applied promotion.
   */
  private async tryIdempotentReplay(
    pi: ProgramIncrement,
    input: {
      expectedPiVersion: number;
      expectedSelectedRevisionId: string;
      expectedSelectedRevisionVersion: number;
      expectedCurrentRevisionVersion: number;
    },
  ): Promise<ScenarioPromotionResult | null> {
    if (pi.selectedRevisionId != null) return null;
    if (pi.lastPromotedFromRevisionId !== input.expectedSelectedRevisionId) {
      return null;
    }
    if (pi.version !== input.expectedPiVersion) return null;

    const source = await this.db.planningRevision.findUnique({
      where: { id: input.expectedSelectedRevisionId },
    });
    const current = await this.db.planningRevision.findFirst({
      where: { piId: pi.id, isCurrent: true, key: "CURRENT" },
    });
    if (!source || !current) return null;
    if (source.status !== "PROMOTED") return null;
    if (source.version !== input.expectedSelectedRevisionVersion) return null;
    if (current.version !== input.expectedCurrentRevisionVersion) return null;

    const [sourceAllocs, currentAllocs] = await Promise.all([
      this.db.workAllocation.findMany({ where: { revisionId: source.id } }),
      this.db.workAllocation.findMany({ where: { revisionId: current.id } }),
    ]);
    if (
      allocationFingerprint(sourceAllocs) !==
      allocationFingerprint(currentAllocs)
    ) {
      return null;
    }

    const summary = summarizeAllocations(currentAllocs);
    return {
      piId: pi.id,
      piVersion: pi.version,
      currentRevisionId: current.id,
      currentRevisionVersion: current.version,
      sourceRevisionId: source.id,
      sourceRevisionVersion: source.version,
      previousCurrentVersion: current.version,
      allocationCount: summary.allocationCount,
      totalCommittedHours: summary.totalCommittedHours,
      promotedAt: (pi.lastPromotedAt ?? new Date()).toISOString(),
      idempotentReplay: true,
      promotionDisclaimer:
        "Changes the authoritative plan — does not create an approved baseline",
    };
  }

  private assertPiEligible(pi: ProgramIncrement) {
    if (pi.status === "CLOSED") {
      throw new AppError(
        "VALIDATION",
        "Cannot promote a scenario into a closed Program Increment.",
      );
    }
  }

  private assertSourceEligible(source: {
    isCurrent: boolean;
    key: string;
    status: string;
    archivedAt: Date | null;
  }) {
    if (source.isCurrent || source.key === "CURRENT") {
      throw new AppError(
        "VALIDATION",
        "CURRENT cannot be promoted onto itself.",
      );
    }
    if (source.status === "ARCHIVED" || source.archivedAt) {
      throw new AppError(
        "VALIDATION",
        "Archived scenarios cannot be promoted.",
      );
    }
    if (source.status === "PROMOTED") {
      throw new AppError(
        "VALIDATION",
        "Scenario was already promoted. Select a different scenario to promote again.",
      );
    }
    if (
      source.status !== "SELECTED" &&
      source.status !== "DRAFT" &&
      source.status !== "READY_FOR_REVIEW"
    ) {
      throw new AppError(
        "VALIDATION",
        `Scenario status ${source.status} is not eligible for promotion.`,
      );
    }
  }

  private assertReadinessAllowsPromote(
    readiness: Awaited<
      ReturnType<ScenarioSelectionService["evaluateReadiness"]>
    >,
    acknowledgeWarnings: boolean,
  ) {
    if (
      readiness.classification === "NOT_READY" ||
      readiness.classification === "UNAVAILABLE"
    ) {
      throw new AppError(
        "VALIDATION",
        "Selected scenario is not ready for promotion. Resolve blockers and retry.",
        {
          details: {
            classification: readiness.classification,
            blockers: readiness.blockers,
          },
        },
      );
    }
    if (
      readiness.classification === "READY_WITH_WARNINGS" &&
      !acknowledgeWarnings
    ) {
      throw new AppError(
        "VALIDATION",
        "Promotion has warnings that must be explicitly acknowledged.",
        {
          details: {
            classification: readiness.classification,
            warnings: readiness.warnings,
          },
        },
      );
    }
  }
}
