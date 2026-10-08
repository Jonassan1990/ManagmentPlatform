/**
 * Pilot operational lifecycle (Phase 1B Experimentation boundary).
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
  evaluatePilotStartReadiness,
  isAdjacentForwardPilotTransition,
  isPilotDefinitionComplete,
  PILOT_STATUS_ORDER,
} from "./pilot-readiness-policy";
import {
  addPilotFeedbackInputSchema,
  createPilotInputSchema,
  evaluatePilotCriterionInputSchema,
  transitionPilotInputSchema,
  updatePilotInputSchema,
  updatePilotResultsInputSchema,
  upsertPilotCriterionInputSchema,
} from "./schemas";
import { assertVersion, parse, rethrowStale, toDecimal } from "./governance-utils";

export class PilotService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async createPilot(principal: Principal, raw: unknown) {
    const input = parse(createPilotInputSchema, raw);
    const initiative = await this.db.initiative.findUnique({
      where: { id: input.initiativeId },
      include: {
        decisions: {
          include: { conditions: true, gate: true },
          orderBy: { decidedAt: "desc" },
        },
        pilot: true,
        governanceGates: {
          where: { gateType: "POC_GATE" },
          include: {
            submissions: {
              where: { status: "DECISION_RECORDED" },
              include: { decisionRecord: { include: { conditions: true } } },
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
    await this.authz.assertCan(principal, PERMISSIONS.PILOT_CREATE, {
      type: "DEPARTMENT",
      organizationId: initiative.organizationId,
      departmentId: initiative.departmentId,
    });

    if (initiative.pilot) {
      throw new AppError(
        "CONFLICT",
        "A Pilot already exists for this initiative.",
      );
    }

    const latestPoCDecision =
      initiative.governanceGates[0]?.submissions[0]?.decisionRecord ??
      initiative.decisions.find(
        (d) =>
          d.gate?.gateType === "POC_GATE" &&
          (d.outcome === "GO" || d.outcome === "CONDITIONAL_GO"),
      );

    if (
      !latestPoCDecision ||
      (latestPoCDecision.outcome !== "GO" &&
        latestPoCDecision.outcome !== "CONDITIONAL_GO")
    ) {
      throw new AppError(
        "VALIDATION",
        "Pilot can only be created after a GO or CONDITIONAL_GO PoC gate decision.",
      );
    }

    const decisionWithConditions =
      initiative.decisions.find((d) => d.id === latestPoCDecision.id) ??
      (await this.db.decisionRecord.findUnique({
        where: { id: latestPoCDecision.id },
        include: { conditions: true },
      }));

    const openBlocking = (decisionWithConditions?.conditions ?? []).filter(
      (c) => c.requiredBeforeProgression && c.status === "OPEN",
    );
    if (openBlocking.length > 0) {
      throw new AppError(
        "VALIDATION",
        "Blocking decision conditions must be resolved before creating a Pilot.",
        { details: { openConditionIds: openBlocking.map((c) => c.id) } },
      );
    }

    if (initiative.currentStage !== "POC") {
      throw new AppError(
        "VALIDATION",
        "Pilot creation advances from PoC; initiative is not in PoC stage.",
      );
    }

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: initiative.organizationId,
      roleLabel: "Pilot owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    const created = await this.db.$transaction(async (tx) => {
      const pilot = await tx.pilot.create({
        data: {
          initiativeId: initiative.id,
          objective: input.objective,
          scope: input.scope,
          outOfScope: input.outOfScope ?? null,
          ownerName,
          ownerResourceId: owner?.id ?? null,
          siteOrArea: input.siteOrArea ?? null,
          targetUsers: input.targetUsers ?? null,
          plannedStart: input.plannedStart ?? null,
          plannedEnd: input.plannedEnd ?? null,
          estimatedCost: toDecimal(input.estimatedCost),
          currencyCode: (input.currencyCode ?? "EUR").toUpperCase(),
          resourceNotes: input.resourceNotes ?? null,
          environment: input.environment ?? null,
          operationalConstraints: input.operationalConstraints ?? null,
          supportModel: input.supportModel ?? null,
          rollbackPlan: input.rollbackPlan ?? null,
          status: "DRAFT",
        },
      });

      await tx.initiative.update({
        where: { id: initiative.id },
        data: {
          currentStage: "PILOT",
          status: initiative.status === "ON_HOLD" ? "ACTIVE" : initiative.status,
          version: { increment: 1 },
        },
      });

      await tx.lifecycleTransition.create({
        data: {
          initiativeId: initiative.id,
          fromStage: "POC",
          toStage: "PILOT",
          actorPrincipalId: principal.id,
          comment: "Advanced via Pilot creation after PoC governance decision",
        },
      });

      return pilot;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "pilot.created",
      subjectType: "Pilot",
      subjectId: created.id,
      organizationId: initiative.organizationId,
      payload: {
        initiativeId: initiative.id,
        ownerResourceId: created.ownerResourceId,
        ownerName: created.ownerName,
      },
      result: "success",
    });

    return created;
  }

  async updatePilot(principal: Principal, raw: unknown) {
    const input = parse(updatePilotInputSchema, raw);
    const pilot = await this.db.pilot.findUnique({
      where: { id: input.pilotId },
      include: { initiative: true },
    });
    if (!pilot) throw new AppError("NOT_FOUND", "Pilot not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PILOT_EDIT, {
      type: "DEPARTMENT",
      organizationId: pilot.initiative.organizationId,
      departmentId: pilot.initiative.departmentId,
    });
    assertVersion(pilot.version, input.expectedVersion, "pilot");

    const owner = await resolveOptionalBusinessOwner(this.db, {
      resourceId: input.ownerResourceId,
      organizationId: pilot.initiative.organizationId,
      roleLabel: "Pilot owner",
    });
    const ownerName = owner?.name ?? input.ownerName ?? null;

    try {
      const updated = await this.db.pilot.update({
        where: { id: pilot.id, version: input.expectedVersion },
        data: {
          objective: input.objective,
          scope: input.scope,
          outOfScope: input.outOfScope ?? null,
          ownerName,
          ownerResourceId: owner?.id ?? null,
          siteOrArea: input.siteOrArea ?? null,
          targetUsers: input.targetUsers ?? null,
          plannedStart: input.plannedStart ?? null,
          plannedEnd: input.plannedEnd ?? null,
          estimatedCost: toDecimal(input.estimatedCost),
          currencyCode: (input.currencyCode ?? "EUR").toUpperCase(),
          resourceNotes: input.resourceNotes ?? null,
          environment: input.environment ?? null,
          operationalConstraints: input.operationalConstraints ?? null,
          supportModel: input.supportModel ?? null,
          rollbackPlan: input.rollbackPlan ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pilot.updated",
        subjectType: "Pilot",
        subjectId: updated.id,
        organizationId: pilot.initiative.organizationId,
        payload: {
          version: updated.version,
          oldOwnerResourceId: pilot.ownerResourceId,
          newOwnerResourceId: updated.ownerResourceId,
          oldOwnerName: pilot.ownerName,
          newOwnerName: updated.ownerName,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      rethrowStale(error, "pilot");
    }
  }

  async transitionPilot(principal: Principal, raw: unknown) {
    const input = parse(transitionPilotInputSchema, raw);
    const pilot = await this.db.pilot.findUnique({
      where: { id: input.pilotId },
      include: { initiative: true, criteria: true },
    });
    if (!pilot) throw new AppError("NOT_FOUND", "Pilot not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PILOT_TRANSITION, {
      type: "DEPARTMENT",
      organizationId: pilot.initiative.organizationId,
      departmentId: pilot.initiative.departmentId,
    });
    assertVersion(pilot.version, input.expectedVersion, "pilot");

    const from = pilot.status;
    const to = input.toStatus;
    if (!PILOT_STATUS_ORDER.includes(from) || !PILOT_STATUS_ORDER.includes(to)) {
      throw new AppError("VALIDATION", "Invalid Pilot status.");
    }
    if (!isAdjacentForwardPilotTransition(from, to)) {
      throw new AppError(
        "VALIDATION",
        `Pilot status may only advance to the next adjacent state (from ${from} to ${to} is not allowed).`,
      );
    }

    if (to === "READY") {
      const check = isPilotDefinitionComplete(pilot, pilot.criteria);
      if (!check.ok) {
        throw new AppError(
          "VALIDATION",
          "Pilot definition is incomplete for READY.",
          { details: { reasons: check.reasons } },
        );
      }
    }

    if (to === "IN_PROGRESS") {
      const start = evaluatePilotStartReadiness(pilot, pilot.criteria);
      if (!start.ready) {
        throw new AppError(
          "VALIDATION",
          "Pilot is not ready to start.",
          { details: { blockers: start.blockers } },
        );
      }
    }

    try {
      const updated = await this.db.pilot.update({
        where: { id: pilot.id, version: input.expectedVersion },
        data: {
          status: to,
          ...(to === "IN_PROGRESS" && !pilot.actualStart
            ? { actualStart: new Date() }
            : {}),
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pilot.transitioned",
        subjectType: "Pilot",
        subjectId: updated.id,
        organizationId: pilot.initiative.organizationId,
        payload: { from, to, version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      rethrowStale(error, "pilot");
    }
  }

  async upsertPilotCriterion(principal: Principal, raw: unknown) {
    const input = parse(upsertPilotCriterionInputSchema, raw);
    const pilot = await this.db.pilot.findUnique({
      where: { id: input.pilotId },
      include: { initiative: true },
    });
    if (!pilot) throw new AppError("NOT_FOUND", "Pilot not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PILOT_EDIT, {
      type: "DEPARTMENT",
      organizationId: pilot.initiative.organizationId,
      departmentId: pilot.initiative.departmentId,
    });

    if (input.criterionId) {
      const existing = await this.db.pilotCriterion.findUnique({
        where: { id: input.criterionId },
      });
      if (!existing || existing.pilotId !== pilot.id) {
        throw new AppError("NOT_FOUND", "Pilot criterion not found.");
      }
      if (input.expectedVersion == null) {
        throw new AppError(
          "VALIDATION",
          "expectedVersion is required to update a criterion.",
        );
      }
      assertVersion(existing.version, input.expectedVersion, "criterion");
      try {
        const updated = await this.db.pilotCriterion.update({
          where: { id: existing.id, version: input.expectedVersion },
          data: {
            category: input.category,
            title: input.title,
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
          actionType: "pilot.criterion.updated",
          subjectType: "PilotCriterion",
          subjectId: updated.id,
          organizationId: pilot.initiative.organizationId,
          payload: { version: updated.version },
          result: "success",
        });
        return updated;
      } catch (error) {
        rethrowStale(error, "criterion");
      }
    }

    const created = await this.db.pilotCriterion.create({
      data: {
        pilotId: pilot.id,
        category: input.category,
        title: input.title,
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
      actionType: "pilot.criterion.created",
      subjectType: "PilotCriterion",
      subjectId: created.id,
      organizationId: pilot.initiative.organizationId,
      payload: { pilotId: pilot.id },
      result: "success",
    });
    return created;
  }

  async evaluatePilotCriterion(principal: Principal, raw: unknown) {
    const input = parse(evaluatePilotCriterionInputSchema, raw);
    const criterion = await this.db.pilotCriterion.findUnique({
      where: { id: input.criterionId },
      include: { pilot: { include: { initiative: true } } },
    });
    if (!criterion) throw new AppError("NOT_FOUND", "Pilot criterion not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PILOT_EVALUATE, {
      type: "DEPARTMENT",
      organizationId: criterion.pilot.initiative.organizationId,
      departmentId: criterion.pilot.initiative.departmentId,
    });
    assertVersion(criterion.version, input.expectedVersion, "criterion");

    try {
      const updated = await this.db.pilotCriterion.update({
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
        actionType: "pilot.criterion.evaluated",
        subjectType: "PilotCriterion",
        subjectId: updated.id,
        organizationId: criterion.pilot.initiative.organizationId,
        payload: { evaluationState: updated.evaluationState },
        result: "success",
      });
      return updated;
    } catch (error) {
      rethrowStale(error, "criterion");
    }
  }

  async updatePilotResults(principal: Principal, raw: unknown) {
    const input = parse(updatePilotResultsInputSchema, raw);
    const pilot = await this.db.pilot.findUnique({
      where: { id: input.pilotId },
      include: { initiative: true },
    });
    if (!pilot) throw new AppError("NOT_FOUND", "Pilot not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PILOT_EVALUATE, {
      type: "DEPARTMENT",
      organizationId: pilot.initiative.organizationId,
      departmentId: pilot.initiative.departmentId,
    });
    assertVersion(pilot.version, input.expectedVersion, "pilot");

    try {
      const updated = await this.db.pilot.update({
        where: { id: pilot.id, version: input.expectedVersion },
        data: {
          results: input.results ?? null,
          businessFindings: input.businessFindings ?? null,
          technicalFindings: input.technicalFindings ?? null,
          operationalFindings: input.operationalFindings ?? null,
          userFeedbackSummary: input.userFeedbackSummary ?? null,
          lessonsLearned: input.lessonsLearned ?? null,
          actualCost: toDecimal(input.actualCost),
          actualStart: input.actualStart ?? null,
          actualEnd: input.actualEnd ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "pilot.results.updated",
        subjectType: "Pilot",
        subjectId: updated.id,
        organizationId: pilot.initiative.organizationId,
        payload: { version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      rethrowStale(error, "pilot");
    }
  }

  async addPilotFeedback(principal: Principal, raw: unknown) {
    const input = parse(addPilotFeedbackInputSchema, raw);
    const pilot = await this.db.pilot.findUnique({
      where: { id: input.pilotId },
      include: { initiative: true },
    });
    if (!pilot) throw new AppError("NOT_FOUND", "Pilot not found.");
    await this.authz.assertCan(principal, PERMISSIONS.PILOT_EVALUATE, {
      type: "DEPARTMENT",
      organizationId: pilot.initiative.organizationId,
      departmentId: pilot.initiative.departmentId,
    });

    const created = await this.db.pilotFeedback.create({
      data: {
        pilotId: pilot.id,
        sourceType: input.sourceType,
        summary: input.summary,
        details: input.details ?? null,
        sentiment: input.sentiment ?? null,
        submittedByName: input.submittedByName ?? null,
        submittedAt: input.submittedAt ?? new Date(),
      },
    });
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "pilot.feedback.added",
      subjectType: "PilotFeedback",
      subjectId: created.id,
      organizationId: pilot.initiative.organizationId,
      payload: { pilotId: pilot.id, sourceType: created.sourceType },
      result: "success",
    });
    return created;
  }

  /**
   * Idempotent project conversion after SCALE / CONDITIONAL_SCALE.
   * UNIQUE initiativeId prevents duplicates (CONFLICT if already converted).
   */
}
