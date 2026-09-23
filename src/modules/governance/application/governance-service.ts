import {
  GateType,
  GovernanceSubmissionStatus,
  InitiativeStage,
  Prisma,
  PrismaClient,
  type ApprovalOutcome,
} from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS, type Permission } from "@/modules/shared/permissions";
import { evaluatePreStudyReadiness } from "@/modules/initiative/application/readiness-policy";
import {
  ensureDefaultApprovalTemplates,
  getActiveTemplates,
} from "./approval-policy";
import { buildEvidenceEntriesFromSnapshot } from "./evidence-builder";
import {
  evaluatePoCReadiness,
  isAdjacentForwardPoCTransition,
  isPoCDefinitionComplete,
  POC_STATUS_ORDER,
} from "./poc-readiness-policy";
import {
  createPoCInputSchema,
  recordApprovalInputSchema,
  recordDecisionInputSchema,
  resolveDecisionConditionInputSchema,
  reviseGovernanceSubmissionInputSchema,
  submitPoCForGovernanceInputSchema,
  submitPreStudyForGovernanceInputSchema,
  transitionPoCInputSchema,
  updateCriterionEvaluationInputSchema,
  updatePoCInputSchema,
  updatePoCResultsInputSchema,
  upsertPoCCriterionInputSchema,
} from "./schemas";
import {
  buildReviewSnapshotPayload,
  type SnapshotWorkspaceData,
} from "./snapshot-builder";

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

function gateStageForType(gateType: GateType): InitiativeStage {
  return gateType === "PRE_STUDY_GATE"
    ? InitiativeStage.PRE_STUDY
    : InitiativeStage.POC;
}

function defaultDecisionQuestion(gateType: GateType): {
  question: string;
  whyNeeded: string;
} {
  if (gateType === "PRE_STUDY_GATE") {
    return {
      question: "Should this initiative proceed to a Proof of Concept?",
      whyNeeded:
        "Pre-study evidence and required authorities have been assembled for a governance decision.",
    };
  }
  return {
    question: "What is the governance outcome of this Proof of Concept?",
    whyNeeded:
      "PoC results and evaluations are ready for an authorized decision.",
  };
}

export class GovernanceService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async ensureTemplates(): Promise<void> {
    await ensureDefaultApprovalTemplates(this.db);
  }

  async submitPreStudyForGovernance(principal: Principal, raw: unknown) {
    const input = parse(submitPreStudyForGovernanceInputSchema, raw);
    const workspace = await this.loadWorkspace(input.initiativeId);
    await this.authz.assertCan(principal, PERMISSIONS.GOVERNANCE_SUBMIT, {
      type: "ORGANIZATION",
      organizationId: workspace.initiative.organizationId,
    });

    if (workspace.initiative.currentStage !== "PRE_STUDY") {
      throw new AppError(
        "VALIDATION",
        "Pre-study governance can only be submitted while the initiative is in Pre-study.",
      );
    }
    if (input.expectedInitiativeVersion != null) {
      this.assertVersion(
        workspace.initiative.version,
        input.expectedInitiativeVersion,
        "initiative",
      );
    }

    const readiness = evaluatePreStudyReadiness({
      demand: workspace.demand,
      requirements: workspace.requirements,
      assessments: workspace.assessments,
      alternatives: workspace.alternatives,
      risks: workspace.risks,
      documents: workspace.documents,
    });
    if (!readiness.ready) {
      throw new AppError(
        "VALIDATION",
        "Pre-study is not ready for governance review.",
        { details: { blockers: readiness.blockers, items: readiness.items } },
      );
    }

    return this.createSubmission({
      principal,
      workspace,
      gateType: "PRE_STUDY_GATE",
      notes: input.notes ?? null,
      previousSubmissionId: null,
    });
  }

  async submitPoCForGovernance(principal: Principal, raw: unknown) {
    const input = parse(submitPoCForGovernanceInputSchema, raw);
    const workspace = await this.loadWorkspace(input.initiativeId);
    await this.authz.assertCan(principal, PERMISSIONS.GOVERNANCE_SUBMIT, {
      type: "ORGANIZATION",
      organizationId: workspace.initiative.organizationId,
    });

    if (workspace.initiative.currentStage !== "POC" || !workspace.poc) {
      throw new AppError(
        "VALIDATION",
        "PoC governance requires an initiative in PoC stage with a PoC record.",
      );
    }

    const readiness = evaluatePoCReadiness(workspace.poc, workspace.poc.criteria);
    if (!readiness.ready) {
      throw new AppError(
        "VALIDATION",
        "PoC is not ready for governance review.",
        { details: { blockers: readiness.blockers, items: readiness.items } },
      );
    }

    return this.createSubmission({
      principal,
      workspace,
      gateType: "POC_GATE",
      notes: input.notes ?? null,
      previousSubmissionId: null,
    });
  }

  /**
   * Create a new revision after CHANGES_REQUESTED (or REJECTED outcomes).
   * Previous submission is marked SUPERSEDED; pending requests on it stay cancelled.
   */
  async reviseGovernanceSubmission(principal: Principal, raw: unknown) {
    const input = parse(reviseGovernanceSubmissionInputSchema, raw);
    const previous = await this.db.governanceSubmission.findUnique({
      where: { id: input.previousSubmissionId },
      include: {
        gate: true,
        approvalRequests: { include: { record: true } },
      },
    });
    if (!previous) {
      throw new AppError("NOT_FOUND", "Previous governance submission not found.");
    }

    const workspace = await this.loadWorkspace(previous.initiativeId);
    await this.authz.assertCan(principal, PERMISSIONS.GOVERNANCE_SUBMIT, {
      type: "ORGANIZATION",
      organizationId: workspace.initiative.organizationId,
    });

    const hasRejected = previous.approvalRequests.some(
      (r) => r.record?.outcome === "REJECTED",
    );
    const revisable =
      previous.status === "CHANGES_REQUESTED" ||
      (previous.status === "IN_REVIEW" && hasRejected);
    if (!revisable) {
      throw new AppError(
        "VALIDATION",
        "Only submissions with changes requested (or rejected approvals) can be revised.",
        { details: { status: previous.status } },
      );
    }

    if (previous.gate.gateType === "PRE_STUDY_GATE") {
      const readiness = evaluatePreStudyReadiness({
        demand: workspace.demand,
        requirements: workspace.requirements,
        assessments: workspace.assessments,
        alternatives: workspace.alternatives,
        risks: workspace.risks,
        documents: workspace.documents,
      });
      if (!readiness.ready) {
        throw new AppError(
          "VALIDATION",
          "Pre-study is not ready for governance review.",
          { details: { blockers: readiness.blockers } },
        );
      }
    } else if (workspace.poc) {
      const readiness = evaluatePoCReadiness(
        workspace.poc,
        workspace.poc.criteria,
      );
      if (!readiness.ready) {
        throw new AppError(
          "VALIDATION",
          "PoC is not ready for governance review.",
          { details: { blockers: readiness.blockers } },
        );
      }
    }

    return this.createSubmission({
      principal,
      workspace,
      gateType: previous.gate.gateType,
      notes: input.notes ?? null,
      previousSubmissionId: previous.id,
    });
  }

  /**
   * ApprovalRecord is immutable. Re-review requires a new ApprovalRequest
   * (created via a new submission revision).
   *
   * REJECTED: leave submission IN_REVIEW (outcomes on records reflect rejection);
   * remaining PENDING requests are cancelled; revise is still allowed.
   * CHANGES_REQUESTED: set submission to CHANGES_REQUESTED; cancel remaining PENDING.
   */
  async recordApproval(principal: Principal, raw: unknown) {
    const input = parse(recordApprovalInputSchema, raw);
    const request = await this.db.approvalRequest.findUnique({
      where: { id: input.approvalRequestId },
      include: {
        submission: { include: { gate: true, initiative: true } },
        record: true,
      },
    });
    if (!request) {
      throw new AppError("NOT_FOUND", "Approval request not found.");
    }
    if (request.status === "COMPLETED" || request.record) {
      throw new AppError(
        "CONFLICT",
        "This approval request is already completed. Approval records are immutable.",
      );
    }
    if (request.status === "CANCELLED") {
      throw new AppError("VALIDATION", "This approval request was cancelled.");
    }

    await this.authz.assertCan(principal, PERMISSIONS.APPROVAL_REVIEW, {
      type: "ORGANIZATION",
      organizationId: request.submission.initiative.organizationId,
    });
    await this.authz.assertCan(
      principal,
      request.requiredPermission as Permission,
      {
        type: "ORGANIZATION",
        organizationId: request.submission.initiative.organizationId,
      },
    );

    this.assertVersion(request.version, input.expectedVersion, "approval request");

    if (request.reviewSnapshotId !== request.submission.reviewSnapshotId) {
      throw new AppError(
        "STALE_VERSION",
        "Approval request snapshot does not match the current submission snapshot.",
      );
    }

    const outcome = input.outcome as ApprovalOutcome;

    const result = await this.db.$transaction(async (tx) => {
      const updatedRequest = await tx.approvalRequest.update({
        where: { id: request.id, version: input.expectedVersion, status: "PENDING" },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      const record = await tx.approvalRecord.create({
        data: {
          approvalRequestId: updatedRequest.id,
          approverPrincipalId: principal.id,
          outcome,
          comment: input.comment ?? null,
          conditionsText: input.conditionsText ?? null,
          reviewSnapshotId: request.reviewSnapshotId,
        },
      });

      if (outcome === "CHANGES_REQUESTED") {
        await tx.approvalRequest.updateMany({
          where: {
            submissionId: request.submissionId,
            status: "PENDING",
            id: { not: request.id },
          },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
        await tx.governanceSubmission.update({
          where: { id: request.submissionId },
          data: {
            status: "CHANGES_REQUESTED",
            version: { increment: 1 },
          },
        });
      } else if (outcome === "REJECTED") {
        await tx.approvalRequest.updateMany({
          where: {
            submissionId: request.submissionId,
            status: "PENDING",
            id: { not: request.id },
          },
          data: { status: "CANCELLED", completedAt: new Date() },
        });
        // Keep IN_REVIEW; rejection is visible via ApprovalRecord outcomes.
        await tx.governanceSubmission.update({
          where: { id: request.submissionId },
          data: { version: { increment: 1 } },
        });
      } else {
        // APPROVED — check if all required requests are approved
        const siblings = await tx.approvalRequest.findMany({
          where: { submissionId: request.submissionId },
          include: { record: true },
        });
        const outstanding = siblings.filter(
          (s) =>
            s.id !== request.id &&
            s.status === "PENDING",
        );
        const allRequiredApproved =
          outstanding.length === 0 &&
          siblings
            .filter((s) => s.id === request.id || s.status === "COMPLETED")
            .every(
              (s) =>
                s.id === request.id
                  ? outcome === "APPROVED"
                  : s.record?.outcome === "APPROVED",
            );

        if (allRequiredApproved) {
          await tx.governanceSubmission.update({
            where: { id: request.submissionId },
            data: {
              status: "APPROVALS_COMPLETE",
              version: { increment: 1 },
            },
          });
        } else {
          await tx.governanceSubmission.update({
            where: { id: request.submissionId },
            data: { version: { increment: 1 } },
          });
        }
      }

      return { request: updatedRequest, record };
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "governance.approval.recorded",
      subjectType: "ApprovalRecord",
      subjectId: result.record.id,
      organizationId: request.submission.initiative.organizationId,
      payload: {
        approvalRequestId: request.id,
        submissionId: request.submissionId,
        outcome,
      },
      result: "success",
    });

    return result;
  }

  async getDecisionPackageView(principal: Principal, submissionId: string) {
    const submission = await this.db.governanceSubmission.findUnique({
      where: { id: submissionId },
      include: {
        initiative: true,
        gate: true,
        reviewSnapshot: true,
        evidencePackage: { include: { entries: { orderBy: { sortOrder: "asc" } } } },
        approvalRequests: {
          include: { record: true },
          orderBy: { requestedAt: "asc" },
        },
        decisionPackage: true,
        decisionRecord: { include: { conditions: true } },
      },
    });
    if (!submission) {
      throw new AppError("NOT_FOUND", "Governance submission not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.GOVERNANCE_VIEW, {
      type: "ORGANIZATION",
      organizationId: submission.initiative.organizationId,
    });
    return submission;
  }

  async recordDecision(principal: Principal, raw: unknown) {
    const input = parse(recordDecisionInputSchema, raw);
    const submission = await this.db.governanceSubmission.findUnique({
      where: { id: input.submissionId },
      include: {
        initiative: true,
        gate: true,
        decisionPackage: true,
        evidencePackage: true,
        decisionRecord: true,
      },
    });
    if (!submission) {
      throw new AppError("NOT_FOUND", "Governance submission not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.DECISION_MAKE, {
      type: "ORGANIZATION",
      organizationId: submission.initiative.organizationId,
    });

    if (submission.status !== "APPROVALS_COMPLETE") {
      throw new AppError(
        "VALIDATION",
        "Decision can only be recorded when all required approvals are complete.",
        { details: { status: submission.status } },
      );
    }
    if (submission.decisionRecord) {
      throw new AppError(
        "CONFLICT",
        "A decision has already been recorded for this submission.",
      );
    }
    if (!submission.decisionPackage || !submission.evidencePackage) {
      throw new AppError(
        "VALIDATION",
        "Decision package or evidence package is missing.",
      );
    }
    this.assertVersion(
      submission.decisionPackage.version,
      input.expectedPackageVersion,
      "decision package",
    );

    if (input.outcome === "CONDITIONAL_GO" && input.conditions.length === 0) {
      throw new AppError(
        "VALIDATION",
        "CONDITIONAL_GO requires at least one condition.",
      );
    }

    const decision = await this.db.$transaction(async (tx) => {
      const referenceKey = await this.allocateDecisionReference(
        tx,
        submission.initiativeId,
      );

      const optionsConsidered: Prisma.InputJsonValue = [
        { key: "GO", label: "Go" },
        { key: "CONDITIONAL_GO", label: "Conditional go" },
        { key: "NO_GO", label: "No-go" },
        { key: "HOLD", label: "Hold" },
      ];

      // Recommendation on DecisionPackage is informational only —
      // never auto-copied into DecisionRecord.outcome.
      const recommendationText =
        input.recommendationText ??
        submission.decisionPackage!.recommendationText;

      const record = await tx.decisionRecord.create({
        data: {
          referenceKey,
          gateId: submission.gateId,
          submissionId: submission.id,
          decisionPackageId: submission.decisionPackage!.id,
          initiativeId: submission.initiativeId,
          question: submission.decisionPackage!.question,
          optionsConsidered,
          recommendationText,
          outcome: input.outcome,
          rationale: input.rationale,
          decisionMakerPrincipalId: principal.id,
          reviewSnapshotId: submission.reviewSnapshotId,
          evidencePackageId: submission.evidencePackage!.id,
          conditions:
            input.outcome === "CONDITIONAL_GO"
              ? {
                  create: input.conditions.map((c) => ({
                    description: c.description,
                    ownerName: c.ownerName ?? null,
                    dueDate: c.dueDate ?? null,
                    requiredBeforeProgression: c.requiredBeforeProgression,
                    status: "OPEN",
                  })),
                }
              : undefined,
        },
        include: { conditions: true },
      });

      await tx.governanceSubmission.update({
        where: { id: submission.id },
        data: {
          status: "DECISION_RECORDED",
          version: { increment: 1 },
        },
      });

      await tx.governanceGate.update({
        where: { id: submission.gateId },
        data: {
          status: "DECIDED",
          version: { increment: 1 },
        },
      });

      if (input.outcome === "NO_GO") {
        await tx.initiative.update({
          where: { id: submission.initiativeId },
          data: {
            status: "CANCELLED",
            version: { increment: 1 },
          },
        });
      } else if (input.outcome === "HOLD") {
        await tx.initiative.update({
          where: { id: submission.initiativeId },
          data: {
            status: "ON_HOLD",
            version: { increment: 1 },
          },
        });
      }

      // Optionally refresh recommendation text on package (not the outcome)
      if (input.recommendationText != null) {
        await tx.decisionPackage.update({
          where: {
            id: submission.decisionPackage!.id,
            version: input.expectedPackageVersion,
          },
          data: {
            recommendationText: input.recommendationText,
            version: { increment: 1 },
          },
        });
      }

      return record;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "governance.decision.recorded",
      subjectType: "DecisionRecord",
      subjectId: decision.id,
      organizationId: submission.initiative.organizationId,
      payload: {
        referenceKey: decision.referenceKey,
        outcome: decision.outcome,
        submissionId: submission.id,
        gateType: submission.gate.gateType,
      },
      result: "success",
    });

    return decision;
  }

  async resolveDecisionCondition(principal: Principal, raw: unknown) {
    const input = parse(resolveDecisionConditionInputSchema, raw);
    const condition = await this.db.decisionCondition.findUnique({
      where: { id: input.conditionId },
      include: { decision: { include: { initiative: true } } },
    });
    if (!condition) {
      throw new AppError("NOT_FOUND", "Decision condition not found.");
    }
    await this.authz.assertCan(
      principal,
      PERMISSIONS.DECISION_CONDITION_RESOLVE,
      {
        type: "ORGANIZATION",
        organizationId: condition.decision.initiative.organizationId,
      },
    );
    this.assertVersion(condition.version, input.expectedVersion, "condition");
    if (condition.status !== "OPEN") {
      throw new AppError(
        "VALIDATION",
        "Only open conditions can be resolved or waived.",
      );
    }

    try {
      const updated = await this.db.decisionCondition.update({
        where: { id: condition.id, version: input.expectedVersion },
        data: {
          status: input.status,
          resolutionNote: input.resolutionNote,
          resolvedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "governance.decision.condition.resolved",
        subjectType: "DecisionCondition",
        subjectId: updated.id,
        organizationId: condition.decision.initiative.organizationId,
        payload: { status: updated.status },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "condition");
    }
  }

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
      type: "ORGANIZATION",
      organizationId: initiative.organizationId,
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

    const created = await this.db.$transaction(async (tx) => {
      const poc = await tx.poC.create({
        data: {
          initiativeId: initiative.id,
          title: input.title,
          objective: input.objective,
          hypothesis: input.hypothesis,
          scope: input.scope,
          outOfScope: input.outOfScope ?? null,
          ownerName: input.ownerName ?? null,
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
      payload: { initiativeId: initiative.id, title: created.title },
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
      type: "ORGANIZATION",
      organizationId: poc.initiative.organizationId,
    });
    this.assertVersion(poc.version, input.expectedVersion, "poc");

    try {
      const updated = await this.db.poC.update({
        where: { id: poc.id, version: input.expectedVersion },
        data: {
          title: input.title,
          objective: input.objective,
          hypothesis: input.hypothesis,
          scope: input.scope,
          outOfScope: input.outOfScope ?? null,
          ownerName: input.ownerName ?? null,
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
        payload: { version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "poc");
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
      type: "ORGANIZATION",
      organizationId: poc.initiative.organizationId,
    });
    this.assertVersion(poc.version, input.expectedVersion, "poc");

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
      this.rethrowStale(error, "poc");
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
      type: "ORGANIZATION",
      organizationId: poc.initiative.organizationId,
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
      this.assertVersion(existing.version, input.expectedVersion, "criterion");
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
        this.rethrowStale(error, "criterion");
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
      type: "ORGANIZATION",
      organizationId: criterion.poc.initiative.organizationId,
    });
    this.assertVersion(criterion.version, input.expectedVersion, "criterion");

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
      this.rethrowStale(error, "criterion");
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
      type: "ORGANIZATION",
      organizationId: poc.initiative.organizationId,
    });
    this.assertVersion(poc.version, input.expectedVersion, "poc");

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
      this.rethrowStale(error, "poc");
    }
  }

  async listMyApprovals(principal: Principal) {
    await this.authz.ensureBootstrapBinding(principal.id);
    await this.ensureTemplates();

    const bindings = await this.db.roleBinding.findMany({
      where: { principalId: principal.id, effectiveTo: null },
      include: { roleDefinition: true },
    });
    const permissions = new Set(
      bindings.flatMap((b) => b.roleDefinition.permissions),
    );
    if (!permissions.has(PERMISSIONS.APPROVAL_REVIEW)) {
      return [];
    }

    const orgIds = await this.accessibleOrganizationIds(
      principal,
      PERMISSIONS.APPROVAL_REVIEW,
    );
    if (orgIds.length === 0) return [];

    const requests = await this.db.approvalRequest.findMany({
      where: {
        status: "PENDING",
        submission: {
          status: { in: ["IN_REVIEW", "SUBMITTED"] },
          initiative: { organizationId: { in: orgIds } },
        },
      },
      include: {
        submission: {
          include: {
            initiative: true,
            gate: true,
          },
        },
      },
      orderBy: { requestedAt: "asc" },
    });

    return requests.filter((r) => permissions.has(r.requiredPermission));
  }

  async listMyDecisions(principal: Principal) {
    await this.authz.ensureBootstrapBinding(principal.id);
    const orgIds = await this.accessibleOrganizationIds(
      principal,
      PERMISSIONS.DECISION_MAKE,
    );
    if (orgIds.length === 0) return [];

    // Approvals complete and no outstanding change-request blocking state
    return this.db.governanceSubmission.findMany({
      where: {
        status: "APPROVALS_COMPLETE",
        initiative: { organizationId: { in: orgIds } },
      },
      include: {
        initiative: true,
        gate: true,
        decisionPackage: true,
        approvalRequests: { include: { record: true } },
      },
      orderBy: { submittedAt: "asc" },
    });
  }

  async getGateWorkspace(principal: Principal, initiativeId: string) {
    const initiative = await this.db.initiative.findUnique({
      where: { id: initiativeId },
      include: {
        governanceGates: {
          include: {
            submissions: {
              include: {
                reviewSnapshot: true,
                evidencePackage: {
                  include: { entries: { orderBy: { sortOrder: "asc" } } },
                },
                approvalRequests: {
                  include: { record: true },
                  orderBy: { requestedAt: "asc" },
                },
                decisionPackage: true,
                decisionRecord: { include: { conditions: true } },
              },
              orderBy: { revision: "desc" },
            },
            decisions: { include: { conditions: true } },
          },
        },
        decisions: { include: { conditions: true }, orderBy: { decidedAt: "desc" } },
        poc: { include: { criteria: { orderBy: { sortOrder: "asc" } } } },
        preStudy: {
          include: {
            assessments: true,
            alternatives: true,
          },
        },
        demand: true,
        requirements: true,
        risks: true,
      },
    });
    if (!initiative || initiative.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Initiative not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.GOVERNANCE_VIEW, {
      type: "ORGANIZATION",
      organizationId: initiative.organizationId,
    });

    const pocReadiness = initiative.poc
      ? evaluatePoCReadiness(initiative.poc, initiative.poc.criteria)
      : null;

    return { initiative, pocReadiness };
  }

  /** Helpers used by initiative overview metrics. */
  computeOverviewGovernanceMetrics(
    initiatives: Array<{
      currentStage: string;
      governanceSubmissions?: Array<{ status: GovernanceSubmissionStatus }>;
      decisions?: Array<{
        conditions?: Array<{
          status: string;
          requiredBeforeProgression: boolean;
        }>;
      }>;
      poc?: {
        status: string;
        results: string | null;
        findings: string | null;
        criteria?: Array<{ required: boolean; evaluationState: string }>;
      } | null;
    }>,
  ) {
    let waitingForApproval = 0;
    let waitingForDecision = 0;
    let changesRequested = 0;
    let activePocs = 0;
    let pocsReadyForDecision = 0;
    let outstandingConditions = 0;

    for (const init of initiatives) {
      const submissions = init.governanceSubmissions ?? [];
      if (submissions.some((s) => s.status === "IN_REVIEW" || s.status === "SUBMITTED")) {
        waitingForApproval += 1;
      }
      if (submissions.some((s) => s.status === "APPROVALS_COMPLETE")) {
        waitingForDecision += 1;
      }
      if (submissions.some((s) => s.status === "CHANGES_REQUESTED")) {
        changesRequested += 1;
      }
      if (init.poc && init.poc.status !== "COMPLETED") {
        activePocs += 1;
      }
      if (init.poc) {
        const ready = evaluatePoCReadiness(
          {
            status: init.poc.status as never,
            results: init.poc.results,
            findings: init.poc.findings,
          },
          (init.poc.criteria ?? []).map((c) => ({
            required: c.required,
            evaluationState: c.evaluationState as never,
          })),
        );
        if (ready.ready) pocsReadyForDecision += 1;
      }
      for (const decision of init.decisions ?? []) {
        outstandingConditions += (decision.conditions ?? []).filter(
          (c) => c.requiredBeforeProgression && c.status === "OPEN",
        ).length;
      }
    }

    return {
      waitingForApproval,
      waitingForDecision,
      changesRequested,
      activePocs,
      pocsReadyForDecision,
      outstandingConditions,
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async createSubmission(args: {
    principal: Principal;
    workspace: SnapshotWorkspaceData;
    gateType: GateType;
    notes: string | null;
    previousSubmissionId: string | null;
  }) {
    await this.ensureTemplates();
    const { principal, workspace, gateType, notes, previousSubmissionId } = args;
    const templates = await getActiveTemplates(this.db, gateType);
    if (templates.length === 0) {
      throw new AppError(
        "VALIDATION",
        "No active approval requirement templates for this gate.",
      );
    }

    const created = await this.db.$transaction(async (tx) => {
      const gate = await tx.governanceGate.upsert({
        where: {
          initiativeId_gateType: {
            initiativeId: workspace.initiative.id,
            gateType,
          },
        },
        create: {
          initiativeId: workspace.initiative.id,
          gateType,
          stage: gateStageForType(gateType),
          status: "IN_PROGRESS",
        },
        update: {
          status: "IN_PROGRESS",
          version: { increment: 1 },
        },
      });

      const last = await tx.governanceSubmission.findFirst({
        where: { gateId: gate.id },
        orderBy: { revision: "desc" },
      });
      const revision = (last?.revision ?? 0) + 1;

      if (previousSubmissionId) {
        await tx.governanceSubmission.update({
          where: { id: previousSubmissionId },
          data: {
            status: "SUPERSEDED",
            version: { increment: 1 },
          },
        });
      }

      const payload = buildReviewSnapshotPayload(workspace, gateType, revision);
      const snapshot = await tx.reviewSnapshot.create({
        data: {
          initiativeId: workspace.initiative.id,
          gateType,
          revision,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      const submission = await tx.governanceSubmission.create({
        data: {
          gateId: gate.id,
          initiativeId: workspace.initiative.id,
          revision,
          status: "IN_REVIEW",
          submittedByPrincipalId: principal.id,
          reviewSnapshotId: snapshot.id,
          previousSubmissionId,
          notes,
        },
      });

      if (previousSubmissionId) {
        await tx.governanceSubmission.update({
          where: { id: previousSubmissionId },
          data: { supersededBySubmissionId: submission.id },
        });
      }

      const evidenceEntries = buildEvidenceEntriesFromSnapshot(payload);
      const evidencePackage = await tx.evidencePackage.create({
        data: {
          submissionId: submission.id,
          gateId: gate.id,
          entries: {
            create: evidenceEntries.map((e) => ({
              kind: e.kind,
              requirementLevel: e.requirementLevel,
              label: e.label,
              present: e.present,
              referenceType: e.referenceType ?? null,
              referenceId: e.referenceId ?? null,
              snapshotBinding: e.snapshotBinding ?? undefined,
              sortOrder: e.sortOrder,
            })),
          },
        },
        include: { entries: true },
      });

      await tx.approvalRequest.createMany({
        data: templates.map((t) => ({
          submissionId: submission.id,
          requirementTemplateId: t.id,
          authorityKey: t.authorityKey,
          requiredPermission: t.requiredPermission,
          label: t.label,
          status: "PENDING" as const,
          reviewSnapshotId: snapshot.id,
        })),
      });

      const { question, whyNeeded } = defaultDecisionQuestion(gateType);
      const recommended = workspace.alternatives.find((a) => a.isRecommended);
      const decisionPackage = await tx.decisionPackage.create({
        data: {
          submissionId: submission.id,
          gateId: gate.id,
          initiativeId: workspace.initiative.id,
          question,
          whyNeeded,
          recommendationText: recommended
            ? `Recommended alternative: ${recommended.title}`
            : null,
          recommendationAlternativeId: recommended?.id ?? null,
        },
      });

      const approvalRequests = await tx.approvalRequest.findMany({
        where: { submissionId: submission.id },
        orderBy: { requestedAt: "asc" },
      });

      return {
        submission,
        snapshot,
        evidencePackage,
        decisionPackage,
        approvalRequests,
        gate,
      };
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "governance.submission.created",
      subjectType: "GovernanceSubmission",
      subjectId: created.submission.id,
      organizationId: workspace.initiative.organizationId,
      payload: {
        gateType,
        revision: created.submission.revision,
        previousSubmissionId,
      },
      result: "success",
    });

    return created;
  }

  private async loadWorkspace(
    initiativeId: string,
  ): Promise<SnapshotWorkspaceData> {
    const initiative = await this.db.initiative.findUnique({
      where: { id: initiativeId },
      include: {
        demand: true,
        requirements: true,
        preStudy: {
          include: {
            assessments: true,
            alternatives: true,
          },
        },
        risks: true,
        documents: { include: { versions: true } },
        poc: { include: { criteria: { orderBy: { sortOrder: "asc" } } } },
      },
    });
    if (!initiative || initiative.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Initiative not found.");
    }
    return {
      initiative,
      demand: initiative.demand,
      requirements: initiative.requirements,
      assessments: initiative.preStudy?.assessments ?? [],
      alternatives: initiative.preStudy?.alternatives ?? [],
      risks: initiative.risks,
      documents: initiative.documents,
      poc: initiative.poc,
    };
  }

  private async allocateDecisionReference(
    tx: Prisma.TransactionClient,
    initiativeId: string,
  ): Promise<string> {
    const existing = await tx.decisionRecord.findMany({
      where: { initiativeId },
      select: { referenceKey: true },
    });
    let max = 0;
    for (const row of existing) {
      const match = /^DEC-(\d+)$/.exec(row.referenceKey);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `DEC-${String(max + 1).padStart(4, "0")}`;
  }

  private async accessibleOrganizationIds(
    principal: Principal,
    permission: Permission,
  ): Promise<string[]> {
    const bindings = await this.db.roleBinding.findMany({
      where: { principalId: principal.id, effectiveTo: null },
      include: { roleDefinition: true },
    });
    const canAll = bindings.some(
      (b) =>
        b.scopeType === "PLATFORM" &&
        b.roleDefinition.permissions.includes(permission),
    );
    if (canAll) {
      const orgs = await this.db.organization.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      return orgs.map((o) => o.id);
    }
    return [
      ...new Set(
        bindings
          .filter(
            (b) =>
              b.organizationId &&
              b.roleDefinition.permissions.includes(permission),
          )
          .map((b) => b.organizationId!),
      ),
    ];
  }

  private assertVersion(
    current: number,
    expected: number,
    entity: string,
  ): void {
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
}
