/**
 * M3D-C — Explicit approval of a promoted CURRENT plan state.
 * Does not create PiBaseline; baseline remains a separate PI_BASELINE action.
 */

import {
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
import { computeAllocationFingerprint } from "./allocation-fingerprint";
import { toHoursNumber } from "./capacity-policy";
import { piAuthScope } from "./pi-auth-scope";
import type { PiService } from "./pi-service";
import {
  invalidateValidPlanApprovals,
  type PlanApprovalInvalidationReason,
} from "./plan-approval-invalidation";
import type {
  PlanApprovalPreview,
  PlanApprovalResult,
  PlanApprovalStateLabel,
  PlanApprovalSummary,
} from "./plan-approval-types";
import { approveCurrentPlanInputSchema } from "./schemas";
import type { ScenarioSelectionService } from "./scenario-selection-service";

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

function toSummary(row: {
  id: string;
  status: string;
  currentRevisionId: string;
  currentRevisionVersion: number;
  allocationFingerprint: string;
  promotedFromRevisionId: string | null;
  approvedByPrincipalId: string;
  approvedAt: Date;
  readinessClassification: string;
  acknowledgeWarnings: boolean;
  invalidatedAt: Date | null;
  invalidatedReason: string | null;
  baseline: { id: string } | null;
}): PlanApprovalSummary {
  return {
    id: row.id,
    status: row.status as PlanApprovalSummary["status"],
    currentRevisionId: row.currentRevisionId,
    currentRevisionVersion: row.currentRevisionVersion,
    allocationFingerprint: row.allocationFingerprint,
    promotedFromRevisionId: row.promotedFromRevisionId,
    approvedByPrincipalId: row.approvedByPrincipalId,
    approvedAt: row.approvedAt.toISOString(),
    readinessClassification: row.readinessClassification,
    acknowledgeWarnings: row.acknowledgeWarnings,
    invalidatedAt: row.invalidatedAt?.toISOString() ?? null,
    invalidatedReason: row.invalidatedReason,
    baselineId: row.baseline?.id ?? null,
  };
}

export class PlanApprovalService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly piService: PiService,
    private readonly selection: ScenarioSelectionService,
  ) {}

  async getApprovalPreview(
    principal: Principal,
    piId: string,
  ): Promise<PlanApprovalPreview> {
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
    const canBaselinePerm = await this.authz.can(
      principal,
      PERMISSIONS.PI_BASELINE,
      { type: "ORGANIZATION", organizationId: pi.organizationId },
    );

    const current = await this.db.planningRevision.findFirst({
      where: { piId: pi.id, isCurrent: true, key: "CURRENT" },
    });

    const allocs = current
      ? await this.db.workAllocation.findMany({
          where: { revisionId: current.id },
        })
      : [];
    const fingerprint = current
      ? computeAllocationFingerprint(allocs)
      : null;
    let committedHours = 0;
    for (const a of allocs) {
      committedHours += toHoursNumber(a.plannedHours as never);
    }
    committedHours = Math.round(committedHours * 100) / 100;

    const readiness = current
      ? await this.selection.evaluateReadiness(principal, {
          piId: pi.id,
          revisionId: current.id,
        })
      : null;

    const [activeApprovalRow, latestApprovalRow] = await Promise.all([
      this.db.piPlanApproval.findFirst({
        where: { piId: pi.id, status: "VALID" },
        include: { baseline: { select: { id: true } } },
      }),
      this.db.piPlanApproval.findFirst({
        where: { piId: pi.id },
        orderBy: { approvedAt: "desc" },
        include: { baseline: { select: { id: true } } },
      }),
    ]);

    const activeApproval = activeApprovalRow
      ? toSummary(activeApprovalRow)
      : null;
    const latestApproval = latestApprovalRow
      ? toSummary(latestApprovalRow)
      : null;

    // Stale if VALID but fingerprint/version no longer match live CURRENT.
    if (
      activeApproval &&
      current &&
      fingerprint &&
      (activeApproval.currentRevisionVersion !== current.version ||
        activeApproval.allocationFingerprint !== fingerprint ||
        activeApproval.currentRevisionId !== current.id)
    ) {
      await this.invalidateAndAudit(
        principal,
        pi,
        "FINGERPRINT_MISMATCH",
        activeApproval.id,
      );
      activeApproval.status = "INVALIDATED";
      activeApproval.invalidatedReason = "FINGERPRINT_MISMATCH";
      activeApproval.invalidatedAt = new Date().toISOString();
    }

    const freshActive =
      activeApproval?.status === "VALID" ? activeApproval : null;

    const approveDisabledReasons: string[] = [];
    if (!canReview) {
      approveDisabledReasons.push(
        "PI review permission is required to approve.",
      );
    }
    if (pi.status === "CLOSED") {
      approveDisabledReasons.push("Closed PIs cannot be approved.");
    }
    if (!current) {
      approveDisabledReasons.push("Current plan revision is missing.");
    }
    if (!pi.lastPromotedFromRevisionId) {
      approveDisabledReasons.push(
        "Promotion provenance is required — apply a selected scenario to the current plan first.",
      );
    }
    if (readiness?.classification === "NOT_READY") {
      approveDisabledReasons.push(
        "Current plan has unresolved hard readiness blockers.",
      );
    }
    if (readiness?.classification === "UNAVAILABLE") {
      approveDisabledReasons.push("Readiness could not be evaluated.");
    }
    if (
      freshActive &&
      fingerprint &&
      freshActive.allocationFingerprint === fingerprint &&
      freshActive.currentRevisionVersion === current?.version
    ) {
      approveDisabledReasons.push(
        "Current plan is already approved for this exact state.",
      );
    }

    const requiresWarningAcknowledgement =
      readiness?.classification === "READY_WITH_WARNINGS";

    const canApprove =
      approveDisabledReasons.length === 0 &&
      (readiness?.classification === "READY" ||
        readiness?.classification === "READY_WITH_WARNINGS");

    const baselineDisabledReasons: string[] = [];
    if (!canBaselinePerm) {
      baselineDisabledReasons.push(
        "Organization-scoped PI baseline permission is required.",
      );
    }
    if (!freshActive) {
      baselineDisabledReasons.push(
        "A valid approval of the current plan is required before baselining.",
      );
    }
    if (
      freshActive &&
      current &&
      fingerprint &&
      (freshActive.currentRevisionVersion !== current.version ||
        freshActive.allocationFingerprint !== fingerprint)
    ) {
      baselineDisabledReasons.push(
        "Approval is stale — the current plan changed after approval.",
      );
    }
    const isFirst = pi.status === "REVIEW";
    const isRebaseline =
      pi.status === "BASELINED" || pi.status === "ACTIVE";
    if (!isFirst && !isRebaseline) {
      baselineDisabledReasons.push(
        "First baseline requires REVIEW status; rebaseline requires BASELINED or ACTIVE.",
      );
    }

    const canBaseline =
      baselineDisabledReasons.length === 0 && freshActive != null;

    const { stateLabel, stateMessage } = this.deriveStateLabel({
      pi,
      freshActive,
      latestApproval,
      fingerprint,
      currentVersion: current?.version ?? null,
    });

    return {
      piId: pi.id,
      piVersion: pi.version,
      piStatus: pi.status,
      currentRevision: current
        ? { id: current.id, version: current.version }
        : null,
      promotedFromRevisionId: pi.lastPromotedFromRevisionId,
      promotedAt: pi.lastPromotedAt?.toISOString() ?? null,
      allocationFingerprint: fingerprint,
      allocationCount: allocs.length,
      committedHours,
      readiness,
      activeApproval: freshActive,
      latestApproval,
      stateLabel,
      stateMessage,
      canApprove,
      canBaseline,
      requiresWarningAcknowledgement,
      approveDisabledReasons,
      baselineDisabledReasons,
      disclaimerApprove:
        "Approve current plan — does not create an immutable baseline",
      disclaimerBaseline:
        "Create immutable baseline from the exact approved current plan",
    };
  }

  async approveCurrentPlan(
    principal: Principal,
    raw: unknown,
  ): Promise<PlanApprovalResult> {
    const input = parse(approveCurrentPlanInputSchema, raw);
    const pi = await this.piService.requirePi(input.piId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.PI_REVIEW,
      piAuthScope(pi.organizationId, pi.sectionId),
    );

    if (pi.status === "CLOSED") {
      throw new AppError(
        "VALIDATION",
        "Cannot approve a closed Program Increment.",
      );
    }
    if (pi.version !== input.expectedPiVersion) {
      throw new AppError(
        "CONFLICT",
        "PI version is stale. Refresh and retry approval.",
        { details: { expected: input.expectedPiVersion, actual: pi.version } },
      );
    }
    if (!pi.lastPromotedFromRevisionId) {
      throw new AppError(
        "VALIDATION",
        "Promotion provenance is required. Apply a selected scenario to the current plan before approval.",
      );
    }

    const current = await this.piService.requireCurrentRevision(pi.id);
    if (current.version !== input.expectedCurrentRevisionVersion) {
      throw new AppError(
        "CONFLICT",
        "Current plan changed concurrently. Refresh and retry approval.",
        {
          details: {
            expected: input.expectedCurrentRevisionVersion,
            actual: current.version,
          },
        },
      );
    }

    const allocs = await this.db.workAllocation.findMany({
      where: { revisionId: current.id },
    });
    const fingerprint = computeAllocationFingerprint(allocs);

    // Idempotent replay: VALID approval already matches this exact state.
    const existingValid = await this.db.piPlanApproval.findFirst({
      where: { piId: pi.id, status: "VALID" },
      include: { baseline: { select: { id: true } } },
    });
    if (
      existingValid &&
      existingValid.currentRevisionId === current.id &&
      existingValid.currentRevisionVersion === current.version &&
      existingValid.allocationFingerprint === fingerprint
    ) {
      return {
        approvalId: existingValid.id,
        piId: pi.id,
        piVersion: pi.version,
        currentRevisionId: current.id,
        currentRevisionVersion: current.version,
        allocationFingerprint: fingerprint,
        approvedAt: existingValid.approvedAt.toISOString(),
        idempotentReplay: true,
        disclaimer:
          "Approve current plan — does not create an immutable baseline",
      };
    }

    const readiness = await this.selection.evaluateReadiness(principal, {
      piId: pi.id,
      revisionId: current.id,
    });
    this.assertReadinessAllowsApprove(readiness, input.acknowledgeWarnings);

    const readinessEvidence = {
      classification: readiness.classification,
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      metrics: readiness.metrics,
      dataQuality: readiness.dataQuality,
      evaluatedAt: readiness.evaluatedAt,
      acknowledgeWarnings: input.acknowledgeWarnings,
    };

    const now = new Date();
    try {
      const created = await this.db.$transaction(async (tx) => {
        const piLock = await tx.programIncrement.updateMany({
          where: { id: pi.id, version: input.expectedPiVersion },
          data: { version: { increment: 1 } },
        });
        if (piLock.count !== 1) {
          throw new AppError(
            "CONFLICT",
            "Concurrent PI update — approval aborted.",
          );
        }

        const lockedCurrent = await tx.planningRevision.findFirst({
          where: { piId: pi.id, isCurrent: true, key: "CURRENT" },
        });
        if (!lockedCurrent) {
          throw new AppError(
            "VALIDATION",
            "Current plan revision is missing.",
          );
        }
        if (lockedCurrent.version !== input.expectedCurrentRevisionVersion) {
          throw new AppError(
            "CONFLICT",
            "Current plan changed concurrently. Refresh and retry approval.",
          );
        }

        const lockedAllocs = await tx.workAllocation.findMany({
          where: { revisionId: lockedCurrent.id },
        });
        const lockedFingerprint = computeAllocationFingerprint(lockedAllocs);
        if (lockedFingerprint !== fingerprint) {
          throw new AppError(
            "CONFLICT",
            "Current plan allocations changed concurrently. Refresh and retry approval.",
          );
        }

        const lockedPi = await tx.programIncrement.findUniqueOrThrow({
          where: { id: pi.id },
        });
        if (!lockedPi.lastPromotedFromRevisionId) {
          throw new AppError(
            "VALIDATION",
            "Promotion provenance is required. Apply a selected scenario to the current plan before approval.",
          );
        }

        const superseded = await invalidateValidPlanApprovals(
          tx,
          pi.id,
          "SUPERSEDED",
        );

        const approval = await tx.piPlanApproval.create({
          data: {
            piId: pi.id,
            currentRevisionId: lockedCurrent.id,
            currentRevisionVersion: lockedCurrent.version,
            allocationFingerprint: lockedFingerprint,
            promotedFromRevisionId: lockedPi.lastPromotedFromRevisionId,
            approvedByPrincipalId: principal.id,
            approvedAt: now,
            readinessClassification: readiness.classification,
            readinessEvidence: readinessEvidence as Prisma.InputJsonValue,
            acknowledgeWarnings: input.acknowledgeWarnings,
            status: "VALID",
          },
        });

        return { approval, superseded, piVersion: lockedPi.version };
      });

      for (const id of created.superseded) {
        await this.audit.record({
          actorPrincipalId: principal.id,
          actionType: "pi.plan.approval_invalidated",
          subjectType: "PiPlanApproval",
          subjectId: id,
          organizationId: pi.organizationId,
          payload: {
            piId: pi.id,
            reason: "SUPERSEDED",
            replacedByApprovalId: created.approval.id,
          },
          result: "success",
        });
      }

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pi.plan.approved",
        subjectType: "PiPlanApproval",
        subjectId: created.approval.id,
        organizationId: pi.organizationId,
        payload: {
          piId: pi.id,
          approvalId: created.approval.id,
          currentRevisionId: created.approval.currentRevisionId,
          currentRevisionVersion: created.approval.currentRevisionVersion,
          allocationFingerprint: created.approval.allocationFingerprint,
          promotedFromRevisionId: created.approval.promotedFromRevisionId,
          readinessClassification: created.approval.readinessClassification,
          acknowledgeWarnings: created.approval.acknowledgeWarnings,
          approvedAt: now.toISOString(),
        },
        result: "success",
      });

      return {
        approvalId: created.approval.id,
        piId: pi.id,
        piVersion: created.piVersion,
        currentRevisionId: created.approval.currentRevisionId,
        currentRevisionVersion: created.approval.currentRevisionVersion,
        allocationFingerprint: created.approval.allocationFingerprint,
        approvedAt: now.toISOString(),
        idempotentReplay: false,
        disclaimer:
          "Approve current plan — does not create an immutable baseline",
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2025")
      ) {
        throw new AppError(
          "CONFLICT",
          "Approval failed due to a concurrent update. Refresh and retry.",
        );
      }
      throw new AppError(
        "CONFLICT",
        "Approval failed due to a concurrent update. Refresh and retry.",
        { cause: error },
      );
    }
  }

  /**
   * Validates that a VALID approval still matches live CURRENT.
   * Used by BaselineService before creating a baseline.
   */
  async assertApprovalMatchesCurrent(
    piId: string,
    expectedApprovalId: string,
    expectedCurrentRevisionVersion: number,
  ): Promise<{
    approval: {
      id: string;
      currentRevisionId: string;
      currentRevisionVersion: number;
      allocationFingerprint: string;
      status: string;
    };
    current: { id: string; version: number };
    fingerprint: string;
  }> {
    const approval = await this.db.piPlanApproval.findUnique({
      where: { id: expectedApprovalId },
    });
    if (!approval || approval.piId !== piId) {
      throw new AppError("NOT_FOUND", "Plan approval not found for this PI.");
    }
    if (approval.status === "CONSUMED" && approval) {
      // handled by caller for idempotent baseline replay
    }
    if (approval.status !== "VALID" && approval.status !== "CONSUMED") {
      throw new AppError(
        "VALIDATION",
        "Approval is no longer valid. Re-approve the current plan before baselining.",
        { details: { status: approval.status, reason: approval.invalidatedReason } },
      );
    }

    const current = await this.piService.requireCurrentRevision(piId);
    if (current.version !== expectedCurrentRevisionVersion) {
      throw new AppError(
        "CONFLICT",
        "Current plan changed after approval. Re-approve before baselining.",
        {
          details: {
            expected: expectedCurrentRevisionVersion,
            actual: current.version,
          },
        },
      );
    }
    if (approval.currentRevisionId !== current.id) {
      throw new AppError(
        "CONFLICT",
        "Approval does not bind to the current plan revision.",
      );
    }
    if (approval.currentRevisionVersion !== current.version) {
      throw new AppError(
        "CONFLICT",
        "Approval is stale — current plan version changed. Re-approve before baselining.",
      );
    }

    const allocs = await this.db.workAllocation.findMany({
      where: { revisionId: current.id },
    });
    const fingerprint = computeAllocationFingerprint(allocs);
    if (fingerprint !== approval.allocationFingerprint) {
      throw new AppError(
        "CONFLICT",
        "Approval fingerprint does not match current plan allocations. Re-approve before baselining.",
      );
    }

    return {
      approval: {
        id: approval.id,
        currentRevisionId: approval.currentRevisionId,
        currentRevisionVersion: approval.currentRevisionVersion,
        allocationFingerprint: approval.allocationFingerprint,
        status: approval.status,
      },
      current: { id: current.id, version: current.version },
      fingerprint,
    };
  }

  async invalidateForCurrentMutation(
    principal: Principal | null,
    pi: ProgramIncrement,
    reason: PlanApprovalInvalidationReason,
  ): Promise<void> {
    const ids = await invalidateValidPlanApprovals(this.db, pi.id, reason);
    for (const id of ids) {
      await this.audit.record({
        actorPrincipalId: principal?.id ?? null,
        actionType: "pi.plan.approval_invalidated",
        subjectType: "PiPlanApproval",
        subjectId: id,
        organizationId: pi.organizationId,
        payload: { piId: pi.id, reason },
        result: "success",
      });
    }
  }

  private async invalidateAndAudit(
    principal: Principal,
    pi: ProgramIncrement,
    reason: PlanApprovalInvalidationReason,
    approvalId: string,
  ) {
    await invalidateValidPlanApprovals(this.db, pi.id, reason);
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "pi.plan.approval_invalidated",
      subjectType: "PiPlanApproval",
      subjectId: approvalId,
      organizationId: pi.organizationId,
      payload: { piId: pi.id, reason },
      result: "success",
    });
  }

  private deriveStateLabel(args: {
    pi: ProgramIncrement;
    freshActive: PlanApprovalSummary | null;
    latestApproval: PlanApprovalSummary | null;
    fingerprint: string | null;
    currentVersion: number | null;
  }): { stateLabel: PlanApprovalStateLabel; stateMessage: string } {
    if (args.freshActive?.status === "VALID") {
      return {
        stateLabel: "APPROVED",
        stateMessage: "Approved current plan version",
      };
    }
    if (args.latestApproval?.status === "CONSUMED") {
      const stillMatches =
        args.fingerprint != null &&
        args.currentVersion != null &&
        args.latestApproval.allocationFingerprint === args.fingerprint &&
        args.latestApproval.currentRevisionVersion === args.currentVersion;
      if (stillMatches) {
        return {
          stateLabel: "BASELINED",
          stateMessage: "Baselined — immutable commitment",
        };
      }
    }
    if (
      args.latestApproval &&
      (args.latestApproval.status === "INVALIDATED" ||
        (args.latestApproval.status === "CONSUMED" &&
          args.fingerprint != null &&
          args.latestApproval.allocationFingerprint !== args.fingerprint))
    ) {
      return {
        stateLabel: "APPROVAL_STALE",
        stateMessage: "Approval stale — current plan changed",
      };
    }
    if (args.pi.lastPromotedFromRevisionId) {
      return {
        stateLabel: "PROMOTED_NOT_APPROVED",
        stateMessage: "Applied to current plan — not approved",
      };
    }
    return {
      stateLabel: "NO_PROMOTION",
      stateMessage: "Apply a selected scenario to the current plan before approval",
    };
  }

  private assertReadinessAllowsApprove(
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
        "Current plan is not ready for approval. Resolve blockers and retry.",
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
        "Approval has warnings that must be explicitly acknowledged.",
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
