import {
  AssessmentArea,
  EntityStatus,
  InitiativeStage,
  Prisma,
  PrismaClient,
  RequirementRelationType,
} from "@prisma/client";
import { ZodError } from "zod";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { GovernanceService } from "@/modules/governance/application/governance-service";
import { evaluatePoCReadiness } from "@/modules/governance/application/poc-readiness-policy";
import { AppError } from "@/modules/shared/errors";
import { PERMISSIONS } from "@/modules/shared/permissions";
import { buildAttentionItems } from "./attention";
import {
  canAdvanceFromDemand,
  canAdvanceFromRequirements,
  evaluatePreStudyReadiness,
} from "./readiness-policy";
import {
  addAcceptanceCriterionInputSchema,
  advanceLifecycleInputSchema,
  createAlternativeInputSchema,
  createDocumentInputSchema,
  createInitiativeInputSchema,
  createRequirementInputSchema,
  createRequirementRelationInputSchema,
  createRiskInputSchema,
  updateAlternativeInputSchema,
  updateDemandInputSchema,
  updateInitiativeInputSchema,
  updateRequirementInputSchema,
  updateRiskInputSchema,
  upsertAssessmentInputSchema,
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

const initiativeInclude = {
  department: { include: { section: true } },
  demand: true,
  requirements: {
    include: { acceptanceCriteria: { orderBy: { sortOrder: "asc" as const } } },
    orderBy: { referenceKey: "asc" as const },
  },
  preStudy: {
    include: {
      assessments: { orderBy: { area: "asc" as const } },
      alternatives: { orderBy: { createdAt: "asc" as const } },
    },
  },
  risks: { orderBy: { referenceKey: "asc" as const } },
  documents: {
    include: { versions: { orderBy: { createdAt: "desc" as const } } },
    orderBy: { title: "asc" as const },
  },
  lifecycleTransitions: { orderBy: { occurredAt: "asc" as const } },
  governanceGates: {
    include: {
      submissions: {
        include: {
          approvalRequests: true,
          decisionPackage: true,
          decisionRecord: { include: { conditions: true } },
        },
        orderBy: { revision: "desc" as const },
      },
    },
  },
  governanceSubmissions: {
    include: {
      approvalRequests: { include: { record: true } },
      decisionRecord: { include: { conditions: true } },
    },
    orderBy: { revision: "desc" as const },
  },
  decisions: {
    include: { conditions: true },
    orderBy: { decidedAt: "desc" as const },
  },
  poc: {
    include: { criteria: { orderBy: { sortOrder: "asc" as const } } },
  },
} satisfies Prisma.InitiativeInclude;

export class InitiativeService {
  constructor(
    private readonly db: PrismaClient,
    private readonly authz: AuthorizationService,
    private readonly audit: AuditService,
    private readonly governance?: GovernanceService,
  ) {}

  async createInitiative(principal: Principal, raw: unknown) {
    const input = parse(createInitiativeInputSchema, raw);
    await this.assertDepartmentInOrganization(
      input.departmentId,
      input.organizationId,
    );
    await this.authz.assertCan(principal, PERMISSIONS.INITIATIVE_CREATE, {
      type: "ORGANIZATION",
      organizationId: input.organizationId,
    });

    const created = await this.db.$transaction(async (tx) => {
      const referenceKey = await this.allocateReference(tx, input.organizationId);
      const initiative = await tx.initiative.create({
        data: {
          organizationId: input.organizationId,
          departmentId: input.departmentId,
          referenceKey,
          title: input.title,
          requesterName: input.requesterName,
          requesterContact: input.requesterContact ?? null,
          businessOwnerName: input.businessOwnerName,
          businessOwnerContact: input.businessOwnerContact ?? null,
          currentStage: InitiativeStage.DEMAND,
          demand: {
            create: {
              problemOpportunity: input.problemOpportunity || "",
              reasonForRequest: input.reasonForRequest || "",
              expectedValue: input.expectedValue || "",
              affectedAreas: input.affectedAreas || "",
              urgency: input.urgency,
              strategicAlignment: input.strategicAlignment || "",
              initialImpact: input.initialImpact || "",
              notes: input.notes ?? null,
            },
          },
        },
      });
      return initiative;
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "initiative.created",
      subjectType: "Initiative",
      subjectId: created.id,
      organizationId: created.organizationId,
      payload: {
        referenceKey: created.referenceKey,
        title: created.title,
        departmentId: created.departmentId,
      },
      result: "success",
    });
    return created;
  }

  async updateInitiative(principal: Principal, raw: unknown) {
    const input = parse(updateInitiativeInputSchema, raw);
    const existing = await this.requireInitiative(input.id);
    await this.authz.assertCan(principal, PERMISSIONS.INITIATIVE_EDIT, {
      type: "ORGANIZATION",
      organizationId: existing.organizationId,
    });
    this.assertVersion(existing.version, input.expectedVersion, "initiative");

    try {
      const updated = await this.db.initiative.update({
        where: { id: input.id, version: input.expectedVersion },
        data: {
          title: input.title,
          requesterName: input.requesterName,
          requesterContact: input.requesterContact ?? null,
          businessOwnerName: input.businessOwnerName,
          businessOwnerContact: input.businessOwnerContact ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "initiative.updated",
        subjectType: "Initiative",
        subjectId: updated.id,
        organizationId: updated.organizationId,
        payload: { title: updated.title, version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "initiative");
    }
  }

  async updateDemand(principal: Principal, raw: unknown) {
    const input = parse(updateDemandInputSchema, raw);
    const initiative = await this.requireInitiative(input.initiativeId);
    await this.authz.assertCan(principal, PERMISSIONS.INITIATIVE_MANAGE_DEMAND, {
      type: "ORGANIZATION",
      organizationId: initiative.organizationId,
    });
    const demand = await this.db.demand.findUnique({
      where: { initiativeId: input.initiativeId },
    });
    if (!demand) throw new AppError("NOT_FOUND", "Demand not found.");
    this.assertVersion(demand.version, input.expectedVersion, "demand");

    try {
      const updated = await this.db.demand.update({
        where: { initiativeId: input.initiativeId, version: input.expectedVersion },
        data: {
          problemOpportunity: input.problemOpportunity,
          reasonForRequest: input.reasonForRequest,
          expectedValue: input.expectedValue,
          affectedAreas: input.affectedAreas,
          urgency: input.urgency,
          strategicAlignment: input.strategicAlignment,
          initialImpact: input.initialImpact,
          notes: input.notes ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "demand.updated",
        subjectType: "Demand",
        subjectId: updated.id,
        organizationId: initiative.organizationId,
        payload: { initiativeId: initiative.id, version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "demand");
    }
  }

  async advanceLifecycle(principal: Principal, raw: unknown) {
    const input = parse(advanceLifecycleInputSchema, raw);
    const initiative = await this.requireInitiative(input.initiativeId);
    await this.authz.assertCan(principal, PERMISSIONS.INITIATIVE_ADVANCE, {
      type: "ORGANIZATION",
      organizationId: initiative.organizationId,
    });
    this.assertVersion(initiative.version, input.expectedVersion, "initiative");

    const fromStage = initiative.currentStage;
    const toStage = input.toStage as InitiativeStage;

    if (fromStage === toStage) {
      throw new AppError("VALIDATION", "Initiative is already at that stage.");
    }

    // Only allow DEMAND→REQUIREMENTS and REQUIREMENTS→PRE_STUDY.
    // PRE_STUDY→POC is performed via GovernanceService.createPoC after a GO/CONDITIONAL_GO decision.
    const allowed =
      (fromStage === "DEMAND" && toStage === "REQUIREMENTS") ||
      (fromStage === "REQUIREMENTS" && toStage === "PRE_STUDY");
    if (!allowed) {
      throw new AppError(
        "VALIDATION",
        `Invalid lifecycle transition from ${fromStage} to ${toStage}. PoC advancement uses governance createPoC, not advanceLifecycle.`,
      );
    }

    if (fromStage === "DEMAND" && toStage === "REQUIREMENTS") {
      const demand = await this.db.demand.findUnique({
        where: { initiativeId: initiative.id },
      });
      const check = canAdvanceFromDemand(demand);
      if (!check.ok) {
        throw new AppError(
          "VALIDATION",
          "Cannot advance to Requirements: demand is incomplete.",
          { details: { reasons: check.reasons } },
        );
      }
    }

    if (fromStage === "REQUIREMENTS" && toStage === "PRE_STUDY") {
      const requirements = await this.db.requirement.findMany({
        where: { initiativeId: initiative.id },
      });
      const check = canAdvanceFromRequirements(requirements);
      if (!check.ok) {
        throw new AppError(
          "VALIDATION",
          "Cannot advance to Pre-study: requirements are not ready.",
          { details: { reasons: check.reasons } },
        );
      }
    }

    try {
      const updated = await this.db.$transaction(async (tx) => {
        const next = await tx.initiative.update({
          where: { id: initiative.id, version: input.expectedVersion },
          data: {
            currentStage: toStage,
            version: { increment: 1 },
          },
        });
        await tx.lifecycleTransition.create({
          data: {
            initiativeId: initiative.id,
            fromStage,
            toStage,
            actorPrincipalId: principal.id,
            comment: input.comment ?? null,
          },
        });
        if (toStage === "PRE_STUDY") {
          await tx.preStudy.upsert({
            where: { initiativeId: initiative.id },
            create: { initiativeId: initiative.id },
            update: {},
          });
        }
        return next;
      });

      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "initiative.lifecycle.transitioned",
        subjectType: "Initiative",
        subjectId: initiative.id,
        organizationId: initiative.organizationId,
        payload: {
          fromStage,
          toStage,
          comment: input.comment ?? null,
          version: updated.version,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "initiative");
    }
  }

  async createRequirement(principal: Principal, raw: unknown) {
    const input = parse(createRequirementInputSchema, raw);
    const initiative = await this.requireInitiative(input.initiativeId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.INITIATIVE_MANAGE_REQUIREMENTS,
      { type: "ORGANIZATION", organizationId: initiative.organizationId },
    );

    const created = await this.db.$transaction(async (tx) => {
      const referenceKey = await this.allocateRequirementReference(
        tx,
        initiative.id,
      );
      return tx.requirement.create({
        data: {
          initiativeId: initiative.id,
          referenceKey,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          ownerName: input.ownerName ?? null,
          source: input.source ?? null,
          status: input.status,
          acceptanceCriteria: {
            create: input.acceptanceCriteria.map((description, index) => ({
              description,
              sortOrder: index,
            })),
          },
        },
        include: { acceptanceCriteria: true },
      });
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "requirement.created",
      subjectType: "Requirement",
      subjectId: created.id,
      organizationId: initiative.organizationId,
      payload: {
        referenceKey: created.referenceKey,
        title: created.title,
        status: created.status,
      },
      result: "success",
    });
    return created;
  }

  async updateRequirement(principal: Principal, raw: unknown) {
    const input = parse(updateRequirementInputSchema, raw);
    const existing = await this.db.requirement.findUnique({
      where: { id: input.id },
      include: { initiative: true },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Requirement not found.");
    await this.authz.assertCan(
      principal,
      PERMISSIONS.INITIATIVE_MANAGE_REQUIREMENTS,
      {
        type: "ORGANIZATION",
        organizationId: existing.initiative.organizationId,
      },
    );
    this.assertVersion(existing.version, input.expectedVersion, "requirement");

    try {
      const updated = await this.db.requirement.update({
        where: { id: input.id, version: input.expectedVersion },
        data: {
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          ownerName: input.ownerName ?? null,
          source: input.source ?? null,
          status: input.status,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "requirement.updated",
        subjectType: "Requirement",
        subjectId: updated.id,
        organizationId: existing.initiative.organizationId,
        payload: {
          status: updated.status,
          version: updated.version,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "requirement");
    }
  }

  async addAcceptanceCriterion(principal: Principal, raw: unknown) {
    const input = parse(addAcceptanceCriterionInputSchema, raw);
    const requirement = await this.db.requirement.findUnique({
      where: { id: input.requirementId },
      include: { initiative: true, acceptanceCriteria: true },
    });
    if (!requirement) throw new AppError("NOT_FOUND", "Requirement not found.");
    await this.authz.assertCan(
      principal,
      PERMISSIONS.INITIATIVE_MANAGE_REQUIREMENTS,
      {
        type: "ORGANIZATION",
        organizationId: requirement.initiative.organizationId,
      },
    );

    const criterion = await this.db.acceptanceCriterion.create({
      data: {
        requirementId: requirement.id,
        description: input.description,
        sortOrder: requirement.acceptanceCriteria.length,
      },
    });
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "requirement.acceptance_criterion.created",
      subjectType: "AcceptanceCriterion",
      subjectId: criterion.id,
      organizationId: requirement.initiative.organizationId,
      payload: { requirementId: requirement.id },
      result: "success",
    });
    return criterion;
  }

  async createRequirementRelation(principal: Principal, raw: unknown) {
    const input = parse(createRequirementRelationInputSchema, raw);
    if (input.fromRequirementId === input.toRequirementId) {
      throw new AppError(
        "VALIDATION",
        "A requirement cannot relate to itself.",
      );
    }

    const [from, to] = await Promise.all([
      this.db.requirement.findUnique({
        where: { id: input.fromRequirementId },
        include: { initiative: true },
      }),
      this.db.requirement.findUnique({
        where: { id: input.toRequirementId },
        include: { initiative: true },
      }),
    ]);
    if (!from || !to) {
      throw new AppError("NOT_FOUND", "Requirement not found.");
    }
    if (from.initiativeId !== to.initiativeId) {
      throw new AppError(
        "VALIDATION",
        "Requirements must belong to the same initiative.",
      );
    }
    await this.authz.assertCan(
      principal,
      PERMISSIONS.INITIATIVE_MANAGE_REQUIREMENTS,
      {
        type: "ORGANIZATION",
        organizationId: from.initiative.organizationId,
      },
    );

    try {
      const relation = await this.db.requirementRelation.create({
        data: {
          fromRequirementId: from.id,
          toRequirementId: to.id,
          relationType: input.relationType as RequirementRelationType,
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "requirement.relation.created",
        subjectType: "RequirementRelation",
        subjectId: relation.id,
        organizationId: from.initiative.organizationId,
        payload: {
          fromRequirementId: from.id,
          toRequirementId: to.id,
          relationType: relation.relationType,
        },
        result: "success",
      });
      return relation;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          "CONFLICT",
          "This requirement relationship already exists.",
        );
      }
      throw error;
    }
  }

  async upsertAssessment(principal: Principal, raw: unknown) {
    const input = parse(upsertAssessmentInputSchema, raw);
    const initiative = await this.requireInitiative(input.initiativeId);
    if (initiative.currentStage !== "PRE_STUDY") {
      throw new AppError(
        "VALIDATION",
        "Assessments can only be managed in the Pre-study stage.",
      );
    }
    await this.authz.assertCan(
      principal,
      PERMISSIONS.INITIATIVE_MANAGE_PRESTUDY,
      { type: "ORGANIZATION", organizationId: initiative.organizationId },
    );

    const preStudy = await this.db.preStudy.upsert({
      where: { initiativeId: initiative.id },
      create: { initiativeId: initiative.id },
      update: {},
    });

    const existing = await this.db.preStudyAssessment.findUnique({
      where: {
        preStudyId_area: {
          preStudyId: preStudy.id,
          area: input.area as AssessmentArea,
        },
      },
    });

    if (existing && input.expectedVersion != null) {
      this.assertVersion(
        existing.version,
        input.expectedVersion,
        "assessment",
      );
    }

    const assessment = existing
      ? await this.db.preStudyAssessment.update({
          where: {
            id: existing.id,
            ...(input.expectedVersion != null
              ? { version: input.expectedVersion }
              : {}),
          },
          data: {
            ownerName: input.ownerName ?? null,
            status: input.status,
            summary: input.summary ?? null,
            findings: input.findings ?? null,
            conclusion: input.conclusion ?? null,
            version: { increment: 1 },
          },
        })
      : await this.db.preStudyAssessment.create({
          data: {
            preStudyId: preStudy.id,
            area: input.area as AssessmentArea,
            ownerName: input.ownerName ?? null,
            status: input.status,
            summary: input.summary ?? null,
            findings: input.findings ?? null,
            conclusion: input.conclusion ?? null,
          },
        });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "prestudy.assessment.upserted",
      subjectType: "PreStudyAssessment",
      subjectId: assessment.id,
      organizationId: initiative.organizationId,
      payload: {
        area: assessment.area,
        status: assessment.status,
        version: assessment.version,
      },
      result: "success",
    });
    return assessment;
  }

  async createAlternative(principal: Principal, raw: unknown) {
    const input = parse(createAlternativeInputSchema, raw);
    const initiative = await this.requireInitiative(input.initiativeId);
    await this.authz.assertCan(
      principal,
      PERMISSIONS.INITIATIVE_MANAGE_PRESTUDY,
      { type: "ORGANIZATION", organizationId: initiative.organizationId },
    );
    const preStudy = await this.db.preStudy.upsert({
      where: { initiativeId: initiative.id },
      create: { initiativeId: initiative.id },
      update: {},
    });

    const alternative = await this.db.solutionAlternative.create({
      data: {
        preStudyId: preStudy.id,
        title: input.title,
        description: input.description,
        benefits: input.benefits ?? null,
        drawbacks: input.drawbacks ?? null,
        estimatedCost: input.estimatedCost ?? null,
        estimatedDuration: input.estimatedDuration ?? null,
        riskUncertainty: input.riskUncertainty ?? null,
        notes: input.notes ?? null,
        isRecommended: input.isRecommended,
      },
    });
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "prestudy.alternative.created",
      subjectType: "SolutionAlternative",
      subjectId: alternative.id,
      organizationId: initiative.organizationId,
      payload: {
        title: alternative.title,
        isRecommended: alternative.isRecommended,
      },
      result: "success",
    });
    return alternative;
  }

  async updateAlternative(principal: Principal, raw: unknown) {
    const input = parse(updateAlternativeInputSchema, raw);
    const existing = await this.db.solutionAlternative.findUnique({
      where: { id: input.id },
      include: { preStudy: { include: { initiative: true } } },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Alternative not found.");
    await this.authz.assertCan(
      principal,
      PERMISSIONS.INITIATIVE_MANAGE_PRESTUDY,
      {
        type: "ORGANIZATION",
        organizationId: existing.preStudy.initiative.organizationId,
      },
    );
    this.assertVersion(existing.version, input.expectedVersion, "alternative");

    try {
      const updated = await this.db.solutionAlternative.update({
        where: { id: input.id, version: input.expectedVersion },
        data: {
          title: input.title,
          description: input.description,
          benefits: input.benefits ?? null,
          drawbacks: input.drawbacks ?? null,
          estimatedCost: input.estimatedCost ?? null,
          estimatedDuration: input.estimatedDuration ?? null,
          riskUncertainty: input.riskUncertainty ?? null,
          notes: input.notes ?? null,
          isRecommended: input.isRecommended,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "prestudy.alternative.updated",
        subjectType: "SolutionAlternative",
        subjectId: updated.id,
        organizationId: existing.preStudy.initiative.organizationId,
        payload: {
          isRecommended: updated.isRecommended,
          version: updated.version,
        },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "alternative");
    }
  }

  async createRisk(principal: Principal, raw: unknown) {
    const input = parse(createRiskInputSchema, raw);
    const initiative = await this.requireInitiative(input.initiativeId);
    await this.authz.assertCan(principal, PERMISSIONS.INITIATIVE_MANAGE_RISK, {
      type: "ORGANIZATION",
      organizationId: initiative.organizationId,
    });

    const risk = await this.db.$transaction(async (tx) => {
      const referenceKey = await this.allocateRiskReference(tx, initiative.id);
      return tx.risk.create({
        data: {
          initiativeId: initiative.id,
          referenceKey,
          title: input.title,
          description: input.description,
          ownerName: input.ownerName ?? null,
          probability: input.probability,
          impact: input.impact,
          status: input.status,
          mitigation: input.mitigation ?? null,
        },
      });
    });
    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "risk.created",
      subjectType: "Risk",
      subjectId: risk.id,
      organizationId: initiative.organizationId,
      payload: { referenceKey: risk.referenceKey, title: risk.title },
      result: "success",
    });
    return risk;
  }

  async updateRisk(principal: Principal, raw: unknown) {
    const input = parse(updateRiskInputSchema, raw);
    const existing = await this.db.risk.findUnique({
      where: { id: input.id },
      include: { initiative: true },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Risk not found.");
    await this.authz.assertCan(principal, PERMISSIONS.INITIATIVE_MANAGE_RISK, {
      type: "ORGANIZATION",
      organizationId: existing.initiative.organizationId,
    });
    this.assertVersion(existing.version, input.expectedVersion, "risk");

    try {
      const updated = await this.db.risk.update({
        where: { id: input.id, version: input.expectedVersion },
        data: {
          title: input.title,
          description: input.description,
          ownerName: input.ownerName ?? null,
          probability: input.probability,
          impact: input.impact,
          status: input.status,
          mitigation: input.mitigation ?? null,
          version: { increment: 1 },
        },
      });
      await this.audit.record({
        actorPrincipalId: principal.id,
        actionType: "risk.updated",
        subjectType: "Risk",
        subjectId: updated.id,
        organizationId: existing.initiative.organizationId,
        payload: { status: updated.status, version: updated.version },
        result: "success",
      });
      return updated;
    } catch (error) {
      this.rethrowStale(error, "risk");
    }
  }

  async createDocumentMetadata(principal: Principal, raw: unknown) {
    const input = parse(createDocumentInputSchema, raw);
    const initiative = await this.requireInitiative(input.initiativeId);
    await this.authz.assertCan(principal, PERMISSIONS.INITIATIVE_EDIT, {
      type: "ORGANIZATION",
      organizationId: initiative.organizationId,
    });

    const document = await this.db.managedDocument.create({
      data: {
        initiativeId: initiative.id,
        title: input.title,
        category: input.category,
        ownerName: input.ownerName ?? null,
        stage: input.stage ?? null,
        assessmentArea: input.assessmentArea ?? null,
        versions: {
          create: {
            versionLabel: input.versionLabel,
            changeSummary: input.changeSummary ?? null,
            storagePointer: null,
            lifecycleStatus: "DRAFT",
          },
        },
      },
      include: { versions: true },
    });

    await this.audit.record({
      actorPrincipalId: principal.id,
      actionType: "document.metadata.created",
      subjectType: "ManagedDocument",
      subjectId: document.id,
      organizationId: initiative.organizationId,
      payload: {
        title: document.title,
        category: document.category,
        binaryUpload: "deferred",
      },
      result: "success",
    });
    return document;
  }

  async listInitiatives(
    principal: Principal,
    filters?: { organizationId?: string; stage?: InitiativeStage },
  ) {
    // Prefer org-scoped listing when organizationId provided
    if (filters?.organizationId) {
      await this.authz.assertCan(principal, PERMISSIONS.INITIATIVE_VIEW, {
        type: "ORGANIZATION",
        organizationId: filters.organizationId,
      });
    } else {
      // Ensure principal can at least bootstrap/list via any binding
      await this.authz.ensureBootstrapBinding(principal.id);
    }

    const orgs = await this.accessibleOrganizationIds(principal);
    if (orgs.length === 0) return [];

    const initiatives = await this.db.initiative.findMany({
      where: {
        organizationId: filters?.organizationId
          ? filters.organizationId
          : { in: orgs },
        status: { not: "ARCHIVED" },
        ...(filters?.stage ? { currentStage: filters.stage } : {}),
      },
      include: {
        department: true,
        demand: true,
        requirements: true,
        preStudy: { include: { assessments: true, alternatives: true } },
        risks: true,
        documents: true,
        governanceSubmissions: {
          include: {
            approvalRequests: { include: { record: true } },
          },
        },
        decisions: { include: { conditions: true } },
        poc: { include: { criteria: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return initiatives.map((initiative) => {
      const pendingApprovalRequests = initiative.governanceSubmissions.flatMap(
        (s) => s.approvalRequests.filter((r) => r.status === "PENDING"),
      );
      const attention = buildAttentionItems({
        initiative,
        demand: initiative.demand,
        requirements: initiative.requirements,
        assessments: initiative.preStudy?.assessments ?? [],
        alternatives: initiative.preStudy?.alternatives ?? [],
        risks: initiative.risks,
        documents: initiative.documents,
        governanceSubmissions: initiative.governanceSubmissions,
        pendingApprovalRequests,
        decisions: initiative.decisions,
        poc: initiative.poc,
      });
      const readiness =
        initiative.currentStage === "PRE_STUDY"
          ? evaluatePreStudyReadiness({
              demand: initiative.demand,
              requirements: initiative.requirements,
              assessments: initiative.preStudy?.assessments ?? [],
              alternatives: initiative.preStudy?.alternatives ?? [],
              risks: initiative.risks,
              documents: initiative.documents,
            })
          : null;
      const pocReadiness = initiative.poc
        ? evaluatePoCReadiness(initiative.poc, initiative.poc.criteria)
        : null;
      return {
        ...initiative,
        attentionCount: attention.length,
        attention,
        readiness,
        pocReadiness,
      };
    });
  }

  async getInitiativeWorkspace(principal: Principal, id: string) {
    const initiative = await this.db.initiative.findUnique({
      where: { id },
      include: {
        ...initiativeInclude,
        requirements: {
          include: {
            acceptanceCriteria: { orderBy: { sortOrder: "asc" } },
            relationsFrom: true,
            relationsTo: true,
          },
          orderBy: { referenceKey: "asc" },
        },
      },
    });
    if (!initiative || initiative.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Initiative not found.");
    }
    await this.authz.assertCan(principal, PERMISSIONS.INITIATIVE_VIEW, {
      type: "ORGANIZATION",
      organizationId: initiative.organizationId,
    });

    const attention = buildAttentionItems({
      initiative,
      demand: initiative.demand,
      requirements: initiative.requirements,
      assessments: initiative.preStudy?.assessments ?? [],
      alternatives: initiative.preStudy?.alternatives ?? [],
      risks: initiative.risks,
      documents: initiative.documents,
      governanceSubmissions: initiative.governanceSubmissions,
      pendingApprovalRequests: initiative.governanceSubmissions.flatMap((s) =>
        s.approvalRequests.filter((r) => r.status === "PENDING"),
      ),
      decisions: initiative.decisions,
      poc: initiative.poc,
    });
    const readiness =
      initiative.currentStage === "PRE_STUDY"
        ? evaluatePreStudyReadiness({
            demand: initiative.demand,
            requirements: initiative.requirements,
            assessments: initiative.preStudy?.assessments ?? [],
            alternatives: initiative.preStudy?.alternatives ?? [],
            risks: initiative.risks,
            documents: initiative.documents,
          })
        : null;
    const pocReadiness = initiative.poc
      ? evaluatePoCReadiness(initiative.poc, initiative.poc.criteria)
      : null;

    return { initiative, attention, readiness, pocReadiness };
  }

  async getOverviewMetrics(principal: Principal) {
    await this.authz.ensureBootstrapBinding(principal.id);
    const orgs = await this.accessibleOrganizationIds(principal);
    if (orgs.length === 0) {
      return {
        activeInitiatives: 0,
        demand: 0,
        requirements: 0,
        preStudy: 0,
        poc: 0,
        needsAttention: 0,
        readyForGovernance: 0,
        waitingForApproval: 0,
        waitingForDecision: 0,
        changesRequested: 0,
        activePocs: 0,
        pocsReadyForDecision: 0,
        outstandingConditions: 0,
      };
    }

    const listed = await this.listInitiatives(principal);
    const governanceMetrics = this.governance
      ? this.governance.computeOverviewGovernanceMetrics(listed)
      : {
          waitingForApproval: 0,
          waitingForDecision: 0,
          changesRequested: 0,
          activePocs: 0,
          pocsReadyForDecision: 0,
          outstandingConditions: 0,
        };

    return {
      activeInitiatives: listed.length,
      demand: listed.filter((i) => i.currentStage === "DEMAND").length,
      requirements: listed.filter((i) => i.currentStage === "REQUIREMENTS")
        .length,
      preStudy: listed.filter((i) => i.currentStage === "PRE_STUDY").length,
      poc: listed.filter((i) => i.currentStage === "POC").length,
      needsAttention: listed.filter((i) => i.attentionCount > 0).length,
      readyForGovernance: listed.filter((i) => i.readiness?.ready).length,
      ...governanceMetrics,
    };
  }

  private async allocateReference(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<string> {
    await tx.initiativeReferenceCounter.upsert({
      where: { organizationId },
      create: { organizationId, nextValue: 1 },
      update: {},
    });
    const updated = await tx.initiativeReferenceCounter.update({
      where: { organizationId },
      data: { nextValue: { increment: 1 } },
    });
    const allocated = updated.nextValue - 1;
    return `INIT-${String(allocated).padStart(4, "0")}`;
  }

  /**
   * Concurrency-safe REQ-### allocator.
   * On first use, seeds nextValue from max existing numeric suffix + 1
   * so previously allocated references are never reused.
   */
  private async allocateRequirementReference(
    tx: Prisma.TransactionClient,
    initiativeId: string,
  ): Promise<string> {
    const existing = await tx.requirement.findMany({
      where: { initiativeId },
      select: { referenceKey: true },
    });
    let max = 0;
    for (const row of existing) {
      const match = /^REQ-(\d+)$/.exec(row.referenceKey);
      if (match) max = Math.max(max, Number(match[1]));
    }
    // INSERT … ON CONFLICT avoids aborting the surrounding transaction on races.
    await tx.$executeRaw`
      INSERT INTO requirement_reference_counters ("initiativeId", "nextValue")
      VALUES (${initiativeId}::uuid, ${max + 1})
      ON CONFLICT ("initiativeId") DO NOTHING
    `;
    const updated = await tx.requirementReferenceCounter.update({
      where: { initiativeId },
      data: { nextValue: { increment: 1 } },
    });
    return `REQ-${String(updated.nextValue - 1).padStart(3, "0")}`;
  }

  /**
   * Concurrency-safe RSK-### allocator.
   * On first use, seeds nextValue from max existing numeric suffix + 1.
   */
  private async allocateRiskReference(
    tx: Prisma.TransactionClient,
    initiativeId: string,
  ): Promise<string> {
    const existing = await tx.risk.findMany({
      where: { initiativeId },
      select: { referenceKey: true },
    });
    let max = 0;
    for (const row of existing) {
      const match = /^RSK-(\d+)$/.exec(row.referenceKey);
      if (match) max = Math.max(max, Number(match[1]));
    }
    await tx.$executeRaw`
      INSERT INTO risk_reference_counters ("initiativeId", "nextValue")
      VALUES (${initiativeId}::uuid, ${max + 1})
      ON CONFLICT ("initiativeId") DO NOTHING
    `;
    const updated = await tx.riskReferenceCounter.update({
      where: { initiativeId },
      data: { nextValue: { increment: 1 } },
    });
    return `RSK-${String(updated.nextValue - 1).padStart(3, "0")}`;
  }

  private async assertDepartmentInOrganization(
    departmentId: string,
    organizationId: string,
  ) {
    const department = await this.db.department.findUnique({
      where: { id: departmentId },
      include: { section: true },
    });
    if (!department || department.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Department not found.");
    }
    if (department.section.organizationId !== organizationId) {
      throw new AppError(
        "VALIDATION",
        "Department does not belong to the selected organization.",
      );
    }
    const org = await this.db.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org || org.status === EntityStatus.ARCHIVED) {
      throw new AppError("NOT_FOUND", "Organization not found.");
    }
  }

  private async requireInitiative(id: string) {
    const initiative = await this.db.initiative.findUnique({ where: { id } });
    if (!initiative || initiative.status === "ARCHIVED") {
      throw new AppError("NOT_FOUND", "Initiative not found.");
    }
    return initiative;
  }

  private async accessibleOrganizationIds(
    principal: Principal,
  ): Promise<string[]> {
    const bindings = await this.db.roleBinding.findMany({
      where: { principalId: principal.id, effectiveTo: null },
      include: { roleDefinition: true },
    });
    const canAll = bindings.some(
      (b) =>
        b.scopeType === "PLATFORM" &&
        b.roleDefinition.permissions.includes(PERMISSIONS.INITIATIVE_VIEW),
    );
    if (canAll) {
      const orgs = await this.db.organization.findMany({
        where: { status: EntityStatus.ACTIVE },
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
              b.roleDefinition.permissions.includes(PERMISSIONS.INITIATIVE_VIEW),
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
