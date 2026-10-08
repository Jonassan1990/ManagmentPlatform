/**
 * PoC operational lifecycle (Phase 1B Experimentation boundary).
 * Governance submission/decision remain on GovernanceCoreService.
 */

import { PrismaClient } from "@prisma/client";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { resolveOptionalBusinessOwner } from "@/modules/organization/application/ownership-policy";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import {
  isAdjacentForwardPoCTransition,
  isPoCDefinitionComplete,
  POC_STATUS_ORDER,
} from "./poc-readiness-policy";
import {
  createPoCInputSchema,
  transitionPoCInputSchema,
  updateCriterionEvaluationInputSchema,
  updatePoCInputSchema,
  updatePoCResultsInputSchema,
  upsertPoCCriterionInputSchema,
} from "./schemas";
import { assertVersion, parse, rethrowStale } from "./governance-utils";

export class PoCService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async createPoC(principal: Principal, raw: unknown) {
    const input = parse(createPoCInputSchema, raw);
    const initiative = await this.db.initiative.findUnique({
      where: { id: input.initiativeId },
      include: {
        decisions: {
          include: { conditions: true },
          orderBy: { decidedAt: "desc" },
        },
        poc: true,
        governanceGates: {
          where: { gateType: "PRE_STUDY_GATE" },
          include: {
            submissions: {
              where: { status: "DECISION_RECORDED" },
              include: { decisionRecord: true },
              orderBy: { revision: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!initiative || initiative.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Initiative not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.POC_CREATE, {
      type: "DEPARTMENT",
      organizationId: initiative.organizationId,
      departmentId: initiative.departmentId,
    });

    if (initiative.poc) {
      throw new AppError("CONFLICT", "A PoC already exists for this initiative.");
    }

    const latestPreStudyDecision =
      initiative.governanceGates[0]?.submissions[0]?.decisionRecord ??
      initiative.decisions.find(
        (d) => d.outcome === "GO" || d.outcome === "CONDITIONAL_GO",
      );

    if (
      !latestPreStudyDecision ||
      (latestPreStudyDecision.outcome !== "GO" &&
        latestPreStudyDecision.outcome !== "CONDITIONAL_GO")
    ) {
      throw new AppError(
        "VALIDATION",
        "PoC can only be created after a GO or CONDITIONAL_GO pre-study decision.",
      );
    }

    const decisionWithConditions =
      initiative.decisions.find((d) => d.id === latestPreStudyDecision.id) ??
      (await this.db.decisionRecord.findUnique({
        where: { id: latestPreStudyDecision.id },
        include: { conditions: true },
      }));

    const openBlocking = (decisionWithConditions?.conditions ?? []).filter(
      (c) => c.requiredBeforeProgression && c.status === "OPEN",
    );
    if (openBlocking.length > 0) {
      throw new AppError(
        "VALIDATION",
        "Blocking decision conditions must be resolved before creating a PoC.",
        { details: { openConditionIds: openBlocking.map((c) => c.id) } },
      );
    }

    if (initiative.currentStage !== "PRE_STUDY") {
      throw new AppError(
        "VALIDATION",
        "PoC creation advances from Pre-study; initiative is not in Pre-study.",
      );
    }

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: initiative.organizationId,
      roleLabel: "PoC owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    const created = await this.db.$transaction(async (tx) => {
      const poc = await tx.poC.create({
        data: {
          initiativeId: initiative.id,
          title: input.title,
          objective: input.objective,
          hypothesis: input.hypothesis,
          scope: input.scope,
          outOfScope: input.outOfScope ?? null,
          ownerName,
          ownerResourceId: owner?.id ?? null,
          plannedStart: input.plannedStart ?? null,
          plannedEnd: input.plannedEnd ?? null,
          estimatedCost: input.estimatedCost ?? null,
          resourceNotes: input.resourceNotes ?? null,
          technicalConstraints: input.technicalConstraints ?? null,
          dependencyNotes: input.dependencyNotes ?? null,
          status: "DRAFT",
        },
      });

      await tx.initiative.update({
        where: { id: initiative.id },
        data: {
          currentStage: "POC",
          status: initiative.status === "ON_HOLD" ? "ACTIVE" : initiative.status,
          version: { increment: 1 },
        },
      });

      await tx.lifecycleTransition.create({
        data: {
          initiativeId: initiative.id,
          fromStage: "PRE_STUDY",
          toStage: "POC",
          actorPrincipalId: principal.id,
          comment: "Advanced via PoC creation after governance decision",
        },
      });

      return poc;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "poc.created",
      subjectType: "PoC",
      subjectId: created.id,
      organizationId: initiative.organizationId,
      payload: {
        initiativeId: initiative.id,
        title: created.title,
        ownerResourceId: created.ownerResourceId,
        ownerName: created.ownerName,
      },
      result: "success",
    });

    return created;
  }

  async updatePoC(principal: Principal, raw: unknown) {
    const input = parse(updatePoCInputSchema, raw);
    const poc = await this.db.poC.findUnique({
      where: { id: input.pocId },
      include: { initiative: true },
    });
    if (!poc) throw new AppError("NOT_FOUND", "PoC not found.");
    await this.authz.assertCan(principal, PERMISSIONS.POC_EDIT, {
      type: "DEPARTMENT",
      organizationId: poc.initiative.organizationId,
      departmentId: poc.initiative.departmentId,
    });
    assertVersion(poc.version, input.expectedVersion, "poc");

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: poc.initiative.organizationId,
      roleLabel: "PoC owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    try {
      const updated = await this.db.poC.update({
        where: { id: poc.id, version: input.expectedVersion },
        data: {
          title: input.title,
          objective: input.objective,
          hypothesis: input.hypothesis,
          scope: input.scope,
          outOfScope: input.outOfScope ?? null,
          ownerName,
          ownerResourceId: owner?.id ?? null,
          plannedStart: input.plannedStart ?? null,
          plannedEnd: input.plannedEnd ?? null,
          estimatedCost: input.estimatedCost ?? null,
          resourceNotes: input.resourceNotes ?? null,
          technicalConstraints: input.technicalConstraints ?? null,
          dependencyNotes: input.dependencyNotes ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "poc.updated",
        subjectType: "PoC",
        subjectId: updated.id,
        organizationId: poc.initiative.organizationId,
        payload: {
          version: updated.version,
          oldOwnerResourceId: poc.ownerResourceId,
          newOwnerResourceId: updated.ownerResourceId,
          oldOwnerName: poc.ownerName,
          newOwnerName: updated.ownerName,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      rethrowStale(error, "poc");
    }
  }

  async transitionPoC(principal: Principal, raw: unknown) {
    const input = parse(transitionPoCInputSchema, raw);
    const poc = await this.db.poC.findUnique({
      where: { id: input.pocId },
      include: { initiative: true, criteria: true },
    });
    if (!poc) throw new AppError("NOT_FOUND", "PoC not found.");
    await this.authz.assertCan(principal, PERMISSIONS.POC_TRANSITION, {
      type: "DEPARTMENT",
      organizationId: poc.initiative.organizationId,
      departmentId: poc.initiative.departmentId,
    });
    assertVersion(poc.version, input.expectedVersion, "poc");

    const from = poc.status;
    const to = input.toStatus;
    if (!POC_STATUS_ORDER.includes(from) || !POC_STATUS_ORDER.includes(to)) {
      throw new AppError("VALIDATION", "Invalid PoC status.");
    }
    if (!isAdjacentForwardPoCTransition(from, to)) {
      throw new AppError(
        "VALIDATION",
        `PoC status may only advance to the next adjacent state (from ${from} to ${to} is not allowed).`,
      );
    }

    if (to === "READY") {
      const check = isPoCDefinitionComplete(poc, poc.criteria);
      if (!check.ok) {
        throw new AppError(
          "VALIDATION",
          "PoC definition is incomplete for READY.",
          { details: { reasons: check.reasons } },
        );
      }
    }

    try {
      const updated = await this.db.poC.update({
        where: { id: poc.id, version: input.expectedVersion },
        data: { status: to, version: { increment: 1 } },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "poc.transitioned",
        subjectType: "PoC",
        subjectId: updated.id,
        organizationId: poc.initiative.organizationId,
        payload: { from, to, version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      rethrowStale(error, "poc");
    }
  }

  async upsertPoCCriterion(principal: Principal, raw: unknown) {
    const input = parse(upsertPoCCriterionInputSchema, raw);
    const poc = await this.db.poC.findUnique({
      where: { id: input.pocId },
      include: { initiative: true },
    });
    if (!poc) throw new AppError("NOT_FOUND", "PoC not found.");
    await this.authz.assertCan(principal, PERMISSIONS.POC_EDIT, {
      type: "DEPARTMENT",
      organizationId: poc.initiative.organizationId,
      departmentId: poc.initiative.departmentId,
    });

    if (input.criterionId) {
      const existing = await this.db.poCSuccessCriterion.findUnique({
        where: { id: input.criterionId },
      });
      if (!existing || existing.pocId !== poc.id) {
        throw new AppError("NOT_FOUND", "PoC criterion not found.");
      }
      if (input.expectedVersion == null) {
        throw new AppError("VALIDATION", "expectedVersion is required to update a criterion.");
      }
      assertVersion(existing.version, input.expectedVersion, "criterion");
      try {
        const updated = await this.db.poCSuccessCriterion.update({
          where: { id: existing.id, version: input.expectedVersion },
          data: {
            description: input.description,
            measurementMethod: input.measurementMethod,
            target: input.target,
            unit: input.unit ?? null,
            required: input.required,
            sortOrder: input.sortOrder,
            version: { increment: 1 },
          },
        });
        await this.audit.record({
          actorPrincipalId: principal.id,
          actionType: "poc.criterion.updated",
          subjectType: "PoCSuccessCriterion",
          subjectId: updated.id,
          organizationId: poc.initiative.organizationId,
          payload: { version: updated.version },
          result: "success",
        });
        return updated;
      } catch (error) {
        rethrowStale(error, "criterion");
      }
    }

    const created = await this.db.poCSuccessCriterion.create({
      data: {
        pocId: poc.id,
        description: input.description,
        measurementMethod: input.measurementMethod,
        target: input.target,
        unit: input.unit ?? null,
        required: input.required,
        sortOrder: input.sortOrder,
      },
    });
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "poc.criterion.created",
      subjectType: "PoCSuccessCriterion",
      subjectId: created.id,
      organizationId: poc.initiative.organizationId,
      payload: { pocId: poc.id },
      result: "success",
    });
    return created;
  }

  async updateCriterionEvaluation(principal: Principal, raw: unknown) {
    const input = parse(updateCriterionEvaluationInputSchema, raw);
    const criterion = await this.db.poCSuccessCriterion.findUnique({
      where: { id: input.criterionId },
      include: { poc: { include: { initiative: true } } },
    });
    if (!criterion) throw new AppError("NOT_FOUND", "PoC criterion not found.");
    await this.authz.assertCan(principal, PERMISSIONS.POC_EVALUATE, {
      type: "DEPARTMENT",
      organizationId: criterion.poc.initiative.organizationId,
      departmentId: criterion.poc.initiative.departmentId,
    });
    assertVersion(criterion.version, input.expectedVersion, "criterion");

    try {
      const updated = await this.db.poCSuccessCriterion.update({
        where: { id: criterion.id, version: input.expectedVersion },
        data: {
          evaluationState: input.evaluationState,
          actualResult: input.actualResult ?? null,
          evidenceReference: input.evidenceReference ?? null,
          evaluationNotes: input.evaluationNotes ?? null,
          evaluatedAt:
            input.evaluationState === "NOT_EVALUATED" ? null : new Date(),
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "poc.criterion.evaluated",
        subjectType: "PoCSuccessCriterion",
        subjectId: updated.id,
        organizationId: criterion.poc.initiative.organizationId,
        payload: { evaluationState: updated.evaluationState },
        result: "success",
      });
      return updated;
    } catch (error) {
      rethrowStale(error, "criterion");
    }
  }

  async updatePoCResults(principal: Principal, raw: unknown) {
    const input = parse(updatePoCResultsInputSchema, raw);
    const poc = await this.db.poC.findUnique({
      where: { id: input.pocId },
      include: { initiative: true },
    });
    if (!poc) throw new AppError("NOT_FOUND", "PoC not found.");
    await this.authz.assertCan(principal, PERMISSIONS.POC_EVALUATE, {
      type: "DEPARTMENT",
      organizationId: poc.initiative.organizationId,
      departmentId: poc.initiative.departmentId,
    });
    assertVersion(poc.version, input.expectedVersion, "poc");

    try {
      const updated = await this.db.poC.update({
        where: { id: poc.id, version: input.expectedVersion },
        data: {
          results: input.results ?? null,
          findings: input.findings ?? null,
          lessonsLearned: input.lessonsLearned ?? null,
          actualCost: input.actualCost ?? null,
          actualStart: input.actualStart ?? null,
          actualEnd: input.actualEnd ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "poc.results.updated",
        subjectType: "PoC",
        subjectId: updated.id,
        organizationId: poc.initiative.organizationId,
        payload: { version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      rethrowStale(error, "poc");
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 4 — Pilot
  // ---------------------------------------------------------------------------

  /**
   * Create Pilot after POC_GATE GO/CONDITIONAL_GO with blocking conditions resolved.
   * Stage advances POC → PILOT. PoC GO does not auto-create Pilot.
   */
}
