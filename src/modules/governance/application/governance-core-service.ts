/**
 * Governance Core — gates, submissions, snapshots, approvals, decisions, policy.
 * Phase 1B extraction from the former GovernanceService god-class.
 */

import {
  GateType,
  GovernanceSubmissionStatus,
  Prisma,
  PrismaClient,
  type ApprovalOutcome,
} from "@prisma/client";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import type { Principal } from "@/modules/identity-access/domain/types";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS, type Permission } from "@/modules/shared/permissions";
import { evaluatePreStudyReadiness } from "@/modules/initiative/application/readiness-policy";
import {
  ensureDefaultApprovalTemplates,
  getActivePolicyVersion,
  getActiveTemplates,
} from "./approval-policy";
import { buildEvidenceEntriesFromSnapshot } from "./evidence-builder";
import { evaluatePoCReadiness } from "./poc-readiness-policy";
import { evaluatePilotGovernanceReadiness } from "./pilot-readiness-policy";
import {
  recordApprovalInputSchema,
  recordDecisionInputSchema,
  resolveDecisionConditionInputSchema,
  reviseGovernanceSubmissionInputSchema,
  submitPilotForGovernanceInputSchema,
  submitPoCForGovernanceInputSchema,
  submitPreStudyForGovernanceInputSchema,
  updateApprovalTemplateInputSchema,
} from "./schemas";
import {
  buildReviewSnapshotPayload,
  type SnapshotWorkspaceData,
} from "./snapshot-builder";
import {
  allowedOutcomesForGate,
  assertVersion,
  defaultDecisionQuestion,
  gateStageForType,
  optionsConsideredForGate,
  parse,
  rethrowStale,
} from "./governance-utils";

export class GovernanceCoreService {
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
      type: "DEPARTMENT",
      organizationId: workspace.initiative.organizationId,
      departmentId: workspace.initiative.departmentId,
    });

    if (workspace.initiative.currentStage !== "PRE_STUDY") {
      throw new AppError(
        "VALIDATION",
        "Pre-study governance can only be submitted while the initiative is in Pre-study.",
      );
    }
    if (input.expectedInitiativeVersion != null) {
      assertVersion(
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
      type: "DEPARTMENT",
      organizationId: workspace.initiative.organizationId,
      departmentId: workspace.initiative.departmentId,
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

  async submitPilotForGovernance(principal: Principal, raw: unknown) {
    const input = parse(submitPilotForGovernanceInputSchema, raw);
    const workspace = await this.loadWorkspace(input.initiativeId);
    await this.authz.assertCan(principal, PERMISSIONS.GOVERNANCE_SUBMIT, {
      type: "DEPARTMENT",
      organizationId: workspace.initiative.organizationId,
      departmentId: workspace.initiative.departmentId,
    });

    if (workspace.initiative.currentStage !== "PILOT" || !workspace.pilot) {
      throw new AppError(
        "VALIDATION",
        "Pilot governance requires an initiative in Pilot stage with a Pilot record.",
      );
    }

    const readiness = evaluatePilotGovernanceReadiness(
      workspace.pilot,
      workspace.pilot.criteria,
    );
    if (!readiness.ready) {
      throw new AppError(
        "VALIDATION",
        "Pilot is not ready for governance review.",
        { details: { blockers: readiness.blockers, items: readiness.items } },
      );
    }

    return this.createSubmission({
      principal,
      workspace,
      gateType: "PILOT_GATE",
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
      type: "DEPARTMENT",
      organizationId: workspace.initiative.organizationId,
      departmentId: workspace.initiative.departmentId,
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
    } else if (previous.gate.gateType === "POC_GATE") {
      if (!workspace.poc) {
        throw new AppError("VALIDATION", "PoC is missing for this gate revision.");
      }
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
    } else if (previous.gate.gateType === "PILOT_GATE") {
      if (!workspace.pilot) {
        throw new AppError(
          "VALIDATION",
          "Pilot is missing for this gate revision.",
        );
      }
      const readiness = evaluatePilotGovernanceReadiness(
        workspace.pilot,
        workspace.pilot.criteria,
      );
      if (!readiness.ready) {
        throw new AppError(
          "VALIDATION",
          "Pilot is not ready for governance review.",
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

    assertVersion(request.version, input.expectedVersion, "approval request");

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
    assertVersion(
      submission.decisionPackage.version,
      input.expectedPackageVersion,
      "decision package",
    );

    const allowed = allowedOutcomesForGate(submission.gate.gateType);
    if (!allowed.includes(input.outcome)) {
      throw new AppError(
        "VALIDATION",
        `Outcome ${input.outcome} is not allowed for ${submission.gate.gateType}.`,
        { details: { allowed } },
      );
    }

    if (
      (input.outcome === "CONDITIONAL_GO" ||
        input.outcome === "CONDITIONAL_SCALE") &&
      input.conditions.length === 0
    ) {
      throw new AppError(
        "VALIDATION",
        `${input.outcome} requires at least one condition.`,
      );
    }

    if (input.outcome === "EXTEND_PILOT" && !input.extension) {
      throw new AppError(
        "VALIDATION",
        "EXTEND_PILOT requires extension.newPlannedEnd and extension.reason.",
      );
    }

    const decision = await this.db.$transaction(async (tx) => {
      const referenceKey = await this.allocateDecisionReference(
        tx,
        submission.initiativeId,
      );

      const optionsConsidered = optionsConsideredForGate(
        submission.gate.gateType,
      );

      // Recommendation on DecisionPackage is informational only —
      // never auto-copied into DecisionRecord.outcome.
      const recommendationText =
        input.recommendationText ??
        submission.decisionPackage!.recommendationText;

      const needsConditions =
        input.outcome === "CONDITIONAL_GO" ||
        input.outcome === "CONDITIONAL_SCALE";

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
          conditions: needsConditions
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

      // Side effects — PoC GO does NOT auto-create Pilot; Pilot SCALE does NOT
      // auto-create Project (convertToProject is a separate authorized action).
      if (input.outcome === "NO_GO" || input.outcome === "STOP") {
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
      } else if (
        input.outcome === "SCALE" ||
        input.outcome === "CONDITIONAL_SCALE"
      ) {
        await tx.initiative.update({
          where: { id: submission.initiativeId },
          data: {
            status: "ACTIVE",
            version: { increment: 1 },
          },
        });
      } else if (input.outcome === "EXTEND_PILOT") {
        const pilot = await tx.pilot.findUnique({
          where: { initiativeId: submission.initiativeId },
        });
        if (!pilot) {
          throw new AppError(
            "VALIDATION",
            "EXTEND_PILOT requires an existing Pilot record.",
          );
        }
        const extension = input.extension!;
        await tx.pilotExtension.create({
          data: {
            pilotId: pilot.id,
            decisionId: record.id,
            previousPlannedEnd: pilot.plannedEnd,
            newPlannedEnd: extension.newPlannedEnd,
            reason: extension.reason,
          },
        });
        await tx.pilot.update({
          where: { id: pilot.id },
          data: {
            plannedEnd: extension.newPlannedEnd,
            version: { increment: 1 },
          },
        });
        // Stage stays PILOT; evaluations and criteria history are retained.
        await tx.initiative.update({
          where: { id: submission.initiativeId },
          data: {
            status: "ACTIVE",
            currentStage: "PILOT",
            version: { increment: 1 },
          },
        });
      }

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
    assertVersion(condition.version, input.expectedVersion, "condition");
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
      rethrowStale(error, "condition");
    }
  }

  async listApprovalTemplates(principal: Principal, gateType?: GateType) {
    await this.authz.ensureBootstrapBinding(principal.id);
    await this.ensureTemplates();
    // Listing requires governance view in some org — use policy manage or view
    const orgs = await this.accessibleOrganizationIds(
      principal,
      PERMISSIONS.GOVERNANCE_VIEW,
    );
    if (orgs.length === 0) {
      // Still allow bootstrap admin with policy manage via platform scope
      const canManage = await this.authz.can(
        principal,
        PERMISSIONS.GOVERNANCE_POLICY_MANAGE,
        { type: "PLATFORM" },
      );
      if (!canManage) {
        throw new AppError("FORBIDDEN", "Missing permission to list templates.");
      }
    }

    return this.db.approvalRequirementTemplate.findMany({
      where: {
        ...(gateType ? { gateType } : {}),
        supersededAt: null,
      },
      orderBy: [{ gateType: "asc" }, { sortOrder: "asc" }],
    });
  }

  /**
   * Admin update versions templates: supersede old row, create new with
   * policyVersion+1 for that gateType+authorityKey. Historical submissions
   * retain authority via ApprovalRequest snapshots at submit time.
   */
  async updateApprovalTemplate(principal: Principal, raw: unknown) {
    const input = parse(updateApprovalTemplateInputSchema, raw);
    const existing = await this.db.approvalRequirementTemplate.findUnique({
      where: { id: input.id },
    });
    if (!existing || existing.supersededAt) {
      throw new AppError("NOT_FOUND", "Approval requirement template not found.");
    }

    // Policy manage is platform/org admin — assert via first accessible org or platform
    const orgs = await this.accessibleOrganizationIds(
      principal,
      PERMISSIONS.GOVERNANCE_POLICY_MANAGE,
    );
    if (orgs.length === 0) {
      await this.authz.assertCan(principal, PERMISSIONS.GOVERNANCE_POLICY_MANAGE, {
        type: "PLATFORM",
      });
    } else {
      await this.authz.assertCan(principal, PERMISSIONS.GOVERNANCE_POLICY_MANAGE, {
        type: "ORGANIZATION",
        organizationId: orgs[0]!,
      });
    }

    const maxForKey = await this.db.approvalRequirementTemplate.findFirst({
      where: {
        gateType: existing.gateType,
        authorityKey: input.authorityKey,
      },
      orderBy: { policyVersion: "desc" },
    });
    const nextVersion = (maxForKey?.policyVersion ?? existing.policyVersion) + 1;

    const result = await this.db.$transaction(async (tx) => {
      await tx.approvalRequirementTemplate.update({
        where: { id: existing.id },
        data: {
          active: false,
          supersededAt: new Date(),
        },
      });

      return tx.approvalRequirementTemplate.create({
        data: {
          gateType: existing.gateType,
          authorityKey: input.authorityKey,
          requiredPermission: input.requiredPermission,
          label: input.label,
          required: input.required,
          sortOrder: input.sortOrder,
          conditionNote: input.conditionNote ?? null,
          active: input.active,
          policyVersion: nextVersion,
        },
      });
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "governance.policy.template.updated",
      subjectType: "ApprovalRequirementTemplate",
      subjectId: result.id,
      organizationId: orgs[0] ?? null,
      payload: {
        supersededId: existing.id,
        gateType: result.gateType,
        authorityKey: result.authorityKey,
        policyVersion: result.policyVersion,
      },
      result: "success",
    });

    return result;
  }

  async getPrincipalCapabilities(
    principal: Principal,
    organizationId: string,
  ) {
    return resolveCapabilities(this.authz, principal, organizationId);
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
        pilot: {
          include: {
            criteria: { orderBy: { sortOrder: "asc" } },
            feedbackEntries: { orderBy: { submittedAt: "desc" } },
            extensions: { orderBy: { createdAt: "asc" } },
          },
        },
        project: true,
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
      type: "DEPARTMENT",
      organizationId: initiative.organizationId,
      departmentId: initiative.departmentId,
    });

    const pocReadiness = initiative.poc
      ? evaluatePoCReadiness(initiative.poc, initiative.poc.criteria)
      : null;
    const pilotReadiness = initiative.pilot
      ? evaluatePilotGovernanceReadiness(
          initiative.pilot,
          initiative.pilot.criteria,
        )
      : null;

    return { initiative, pocReadiness, pilotReadiness };
  }

  /** Helpers used by initiative overview metrics. */
  computeOverviewGovernanceMetrics(
    initiatives: Array<{
      currentStage: string;
      governanceSubmissions?: Array<{
        status: GovernanceSubmissionStatus;
        gate?: { gateType: string } | null;
      }>;
      decisions?: Array<{
        outcome?: string;
        gate?: { gateType: string } | null;
        conditions?: Array<{
          status: string;
          requiredBeforeProgression: boolean;
        }>;
      }>;
      risks?: Array<{ status: string; impact: string }>;
      poc?: {
        status: string;
        results: string | null;
        findings: string | null;
        criteria?: Array<{ required: boolean; evaluationState: string }>;
      } | null;
      pilot?: {
        status: string;
        results: string | null;
        businessFindings: string | null;
        technicalFindings: string | null;
        operationalFindings: string | null;
        criteria?: Array<{ required: boolean; evaluationState: string }>;
      } | null;
      project?: {
        status: string;
        milestones?: Array<{ status: string; plannedDate: Date | null }>;
      } | null;
    }>,
  ) {
    let waitingForApproval = 0;
    let waitingForDecision = 0;
    let changesRequested = 0;
    let activePocs = 0;
    let pocsReadyForDecision = 0;
    let outstandingConditions = 0;
    let activePilots = 0;
    let pilotsReadyForDecision = 0;
    let scaleDecisionsWaiting = 0;
    let projects = 0;
    let projectsAtRisk = 0;
    let outstandingScaleConditions = 0;
    let upcomingMilestones = 0;

    const now = new Date();
    const soon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

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
      if (
        submissions.some(
          (s) =>
            s.status === "APPROVALS_COMPLETE" &&
            s.gate?.gateType === "PILOT_GATE",
        )
      ) {
        scaleDecisionsWaiting += 1;
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
      if (init.pilot && init.pilot.status !== "COMPLETED") {
        activePilots += 1;
      }
      if (init.pilot) {
        const ready = evaluatePilotGovernanceReadiness(
          {
            status: init.pilot.status as never,
            results: init.pilot.results,
            businessFindings: init.pilot.businessFindings,
            technicalFindings: init.pilot.technicalFindings,
            operationalFindings: init.pilot.operationalFindings,
          },
          (init.pilot.criteria ?? []).map((c) => ({
            required: c.required,
            evaluationState: c.evaluationState as never,
          })),
        );
        if (ready.ready) pilotsReadyForDecision += 1;
      }
      if (init.project) {
        projects += 1;
        const highRisks = (init.risks ?? []).filter(
          (r) =>
            (r.status === "OPEN" || r.status === "MITIGATING") &&
            r.impact === "HIGH",
        );
        const missed = (init.project.milestones ?? []).filter(
          (m) => m.status === "MISSED",
        );
        if (highRisks.length > 0 || missed.length > 0) {
          projectsAtRisk += 1;
        }
        upcomingMilestones += (init.project.milestones ?? []).filter(
          (m) =>
            m.status === "PLANNED" &&
            m.plannedDate &&
            m.plannedDate >= now &&
            m.plannedDate <= soon,
        ).length;
      }
      for (const decision of init.decisions ?? []) {
        const open = (decision.conditions ?? []).filter(
          (c) => c.requiredBeforeProgression && c.status === "OPEN",
        );
        outstandingConditions += open.length;
        if (
          decision.gate?.gateType === "PILOT_GATE" &&
          (decision.outcome === "CONDITIONAL_SCALE" ||
            decision.outcome === "SCALE")
        ) {
          outstandingScaleConditions += open.length;
        }
      }
    }

    return {
      waitingForApproval,
      waitingForDecision,
      changesRequested,
      activePocs,
      pocsReadyForDecision,
      outstandingConditions,
      activePilots,
      pilotsReadyForDecision,
      scaleDecisionsWaiting,
      projects,
      projectsAtRisk,
      outstandingScaleConditions,
      upcomingMilestones,
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
    const policyVersion = await getActivePolicyVersion(this.db, gateType);

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

      // ApprovalRequest copies authority fields from templates at create time —
      // historical binding is the request snapshot, not live template rows.
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
          policyVersion,
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
        pilot: { include: { criteria: { orderBy: { sortOrder: "asc" } } } },
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
      pilot: initiative.pilot,
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
}
