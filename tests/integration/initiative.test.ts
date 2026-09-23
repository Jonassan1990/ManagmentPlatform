import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { InitiativeService } from "@/modules/initiative/application/initiative-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { AppError } from "@/modules/shared/errors";
import { REQUIRED_ASSESSMENT_AREAS } from "@/modules/initiative/application/readiness-policy";
import { resetEnvCacheForTests } from "@/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public";
process.env.ALLOW_DEV_AUTH = "false";
resetEnvCacheForTests();

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const organization = new OrganizationService(db, authz, audit);
const initiative = new InitiativeService(db, authz, audit);

function principal(id = randomUUID()): Principal {
  return { id, displayName: "Test", source: "test" };
}

async function resetDb() {
  await db.auditEvent.deleteMany();
  // Phase 5 PI Planning — FK-safe order (before project work items / org)
  await db.workAllocation.deleteMany();
  await db.resourceAvailability.deleteMany();
  await db.planningDependency.deleteMany();
  await db.piBaseline.deleteMany();
  await db.planningRevision.deleteMany();
  await db.piParticipatingTeam.deleteMany();
  await db.piParticipatingDepartment.deleteMany();
  await db.piIteration.deleteMany();
  await db.programIncrement.deleteMany();
  await db.piReferenceCounter.deleteMany();
  // Phase 4 Pilot / Project — children before parents (FK Restrict edges)
  await db.pilotFeedback.deleteMany();
  await db.pilotCriterion.deleteMany();
  await db.pilotExtension.deleteMany();
  await db.pilot.deleteMany();
  await db.projectWorkItem.deleteMany();
  await db.projectMilestone.deleteMany();
  await db.projectParticipatingDepartment.deleteMany();
  await db.project.deleteMany();
  await db.projectReferenceCounter.deleteMany();
  // Phase 3 governance / PoC — children before parents (FK Restrict edges)
  await db.approvalRecord.deleteMany();
  await db.approvalRequest.deleteMany();
  await db.evidenceEntry.deleteMany();
  await db.decisionCondition.deleteMany();
  await db.decisionRecord.deleteMany();
  await db.evidencePackage.deleteMany();
  await db.decisionPackage.deleteMany();
  await db.governanceSubmission.deleteMany();
  await db.reviewSnapshot.deleteMany();
  await db.governanceGate.deleteMany();
  await db.approvalRequirementTemplate.deleteMany();
  await db.poCSuccessCriterion.deleteMany();
  await db.poC.deleteMany();
  await db.requirementReferenceCounter.deleteMany();
  await db.riskReferenceCounter.deleteMany();
  // Phase 2 initiative children
  await db.documentVersion.deleteMany();
  await db.managedDocument.deleteMany();
  await db.requirementRelation.deleteMany();
  await db.acceptanceCriterion.deleteMany();
  await db.requirement.deleteMany();
  await db.solutionAlternative.deleteMany();
  await db.preStudyAssessment.deleteMany();
  await db.preStudy.deleteMany();
  await db.risk.deleteMany();
  await db.lifecycleTransition.deleteMany();
  await db.demand.deleteMany();
  await db.initiative.deleteMany();
  await db.initiativeReferenceCounter.deleteMany();
  await db.roleBinding.deleteMany();
  await db.resourceMembership.deleteMany();
  await db.resource.deleteMany();
  await db.team.deleteMany();
  await db.department.deleteMany();
  await db.section.deleteMany();
  await db.organization.deleteMany();
  await db.principal.deleteMany();
  await db.roleDefinition.deleteMany();
}

async function seedOrg(actor: Principal) {
  await db.principal.create({ data: { id: actor.id, displayName: "Actor" } });
  const org = await organization.createOrganization(actor, { name: "Org P2" });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section",
  });
  const department = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept",
  });
  return { org, department };
}

beforeAll(async () => {
  await db.$connect();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("initiative phase 2 integration", () => {
  it("creates initiative with demand and concurrency-safe reference", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Need A",
      requesterName: "Requester",
      businessOwnerName: "Owner",
    });
    expect(created.referenceKey).toBe("INIT-0001");
    expect(created.currentStage).toBe("DEMAND");

    const second = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Need B",
      requesterName: "Requester",
      businessOwnerName: "Owner",
    });
    expect(second.referenceKey).toBe("INIT-0002");
  });

  it("rejects invalid department/org relationship", async () => {
    const actor = principal();
    const { org } = await seedOrg(actor);
    await expect(
      initiative.createInitiative(actor, {
        organizationId: org.id,
        departmentId: randomUUID(),
        title: "Bad",
        requesterName: "R",
        businessOwnerName: "O",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects unauthorized create", async () => {
    const owner = principal();
    const stranger = principal();
    const { org, department } = await seedOrg(owner);
    await db.principal.create({ data: { id: stranger.id } });
    await expect(
      initiative.createInitiative(stranger, {
        organizationId: org.id,
        departmentId: department.id,
        title: "Nope",
        requesterName: "R",
        businessOwnerName: "O",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects stale initiative update", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Versioned",
      requesterName: "R",
      businessOwnerName: "O",
    });
    await initiative.updateInitiative(actor, {
      id: created.id,
      title: "Versioned 2",
      requesterName: "R",
      businessOwnerName: "O",
      expectedVersion: created.version,
    });
    await expect(
      initiative.updateInitiative(actor, {
        id: created.id,
        title: "Stale",
        requesterName: "R",
        businessOwnerName: "O",
        expectedVersion: created.version,
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
  });

  it("enforces lifecycle Demand→Requirements→Pre-study with history/audit", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Lifecycle",
      requesterName: "R",
      businessOwnerName: "O",
    });

    // Incomplete demand blocks
    await expect(
      initiative.advanceLifecycle(actor, {
        initiativeId: created.id,
        toStage: "REQUIREMENTS",
        expectedVersion: created.version,
      }),
    ).rejects.toBeInstanceOf(AppError);

    const demand = await db.demand.findUniqueOrThrow({
      where: { initiativeId: created.id },
    });
    await initiative.updateDemand(actor, {
      initiativeId: created.id,
      expectedVersion: demand.version,
      problemOpportunity: "P",
      reasonForRequest: "R",
      expectedValue: "V",
      affectedAreas: "A",
      urgency: "HIGH",
      strategicAlignment: "S",
      initialImpact: "I",
    });

    const afterDemand = await db.initiative.findUniqueOrThrow({
      where: { id: created.id },
    });
    const toReq = await initiative.advanceLifecycle(actor, {
      initiativeId: created.id,
      toStage: "REQUIREMENTS",
      expectedVersion: afterDemand.version,
      comment: "Demand complete",
    });
    expect(toReq.currentStage).toBe("REQUIREMENTS");

    // Invalid jump
    await expect(
      initiative.advanceLifecycle(actor, {
        initiativeId: created.id,
        toStage: "REQUIREMENTS",
        expectedVersion: toReq.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    // Requirements incomplete blocks pre-study
    await expect(
      initiative.advanceLifecycle(actor, {
        initiativeId: created.id,
        toStage: "PRE_STUDY",
        expectedVersion: toReq.version,
      }),
    ).rejects.toBeInstanceOf(AppError);

    const req = await initiative.createRequirement(actor, {
      initiativeId: created.id,
      title: "Need login",
      description: "Users can authenticate",
      category: "FUNCTIONAL",
      priority: "MUST",
      status: "ACCEPTED",
      acceptanceCriteria: ["User can sign in"],
    });
    expect(req.referenceKey).toBe("REQ-001");

    await initiative.addAcceptanceCriterion(actor, {
      requirementId: req.id,
      description: "Session expires securely",
    });

    const req2 = await initiative.createRequirement(actor, {
      initiativeId: created.id,
      title: "Audit trail",
      description: "Actions are auditable",
      category: "COMPLIANCE",
      priority: "SHOULD",
      status: "ACCEPTED",
      acceptanceCriteria: [],
    });

    await initiative.createRequirementRelation(actor, {
      fromRequirementId: req.id,
      toRequirementId: req2.id,
      relationType: "RELATED_TO",
    });

    await expect(
      initiative.createRequirementRelation(actor, {
        fromRequirementId: req.id,
        toRequirementId: req.id,
        relationType: "RELATED_TO",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await expect(
      initiative.createRequirementRelation(actor, {
        fromRequirementId: req.id,
        toRequirementId: req2.id,
        relationType: "RELATED_TO",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const latest = await db.initiative.findUniqueOrThrow({
      where: { id: created.id },
    });
    const toPre = await initiative.advanceLifecycle(actor, {
      initiativeId: created.id,
      toStage: "PRE_STUDY",
      expectedVersion: latest.version,
    });
    expect(toPre.currentStage).toBe("PRE_STUDY");

    const transitions = await db.lifecycleTransition.findMany({
      where: { initiativeId: created.id },
    });
    expect(transitions).toHaveLength(2);

    const audits = await db.auditEvent.findMany({
      where: {
        subjectId: created.id,
        actionType: "initiative.lifecycle.transitioned",
      },
    });
    expect(audits.length).toBeGreaterThanOrEqual(2);

    // Cross-initiative relation rejected
    const other = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Other",
      requesterName: "R",
      businessOwnerName: "O",
    });
    // move other through enough to create requirement
    const otherDemand = await db.demand.findUniqueOrThrow({
      where: { initiativeId: other.id },
    });
    await initiative.updateDemand(actor, {
      initiativeId: other.id,
      expectedVersion: otherDemand.version,
      problemOpportunity: "P",
      reasonForRequest: "R",
      expectedValue: "V",
      affectedAreas: "A",
      urgency: "LOW",
      strategicAlignment: "S",
      initialImpact: "I",
    });
    const otherInit = await db.initiative.findUniqueOrThrow({
      where: { id: other.id },
    });
    await initiative.advanceLifecycle(actor, {
      initiativeId: other.id,
      toStage: "REQUIREMENTS",
      expectedVersion: otherInit.version,
    });
    const otherReq = await initiative.createRequirement(actor, {
      initiativeId: other.id,
      title: "X",
      description: "Y",
      category: "OTHER",
      status: "ACCEPTED",
      acceptanceCriteria: [],
    });
    await expect(
      initiative.createRequirementRelation(actor, {
        fromRequirementId: req.id,
        toRequirementId: otherReq.id,
        relationType: "RELATED_TO",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("computes readiness and attention from real state", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Ready flow",
      requesterName: "R",
      businessOwnerName: "O",
      problemOpportunity: "P",
      reasonForRequest: "R",
      expectedValue: "V",
      affectedAreas: "A",
      urgency: "MEDIUM",
      strategicAlignment: "S",
      initialImpact: "I",
    });
    // demand already filled via create optional fields — still need versions
    const demand = await db.demand.findUniqueOrThrow({
      where: { initiativeId: created.id },
    });
    // ensure complete with update using current version
    await initiative.updateDemand(actor, {
      initiativeId: created.id,
      expectedVersion: demand.version,
      problemOpportunity: "P",
      reasonForRequest: "R",
      expectedValue: "V",
      affectedAreas: "A",
      urgency: "MEDIUM",
      strategicAlignment: "S",
      initialImpact: "I",
    });
    let current = await db.initiative.findUniqueOrThrow({
      where: { id: created.id },
    });
    current = await initiative.advanceLifecycle(actor, {
      initiativeId: created.id,
      toStage: "REQUIREMENTS",
      expectedVersion: current.version,
    });
    await initiative.createRequirement(actor, {
      initiativeId: created.id,
      title: "Req",
      description: "Desc",
      category: "BUSINESS",
      status: "ACCEPTED",
      acceptanceCriteria: ["Done"],
    });
    current = await db.initiative.findUniqueOrThrow({
      where: { id: created.id },
    });
    await initiative.advanceLifecycle(actor, {
      initiativeId: created.id,
      toStage: "PRE_STUDY",
      expectedVersion: current.version,
    });

    let workspace = await initiative.getInitiativeWorkspace(actor, created.id);
    expect(workspace.readiness?.ready).toBe(false);
    expect(
      workspace.attention.some((a) => a.key.startsWith("assessment-incomplete")),
    ).toBe(true);

    for (const area of REQUIRED_ASSESSMENT_AREAS) {
      await initiative.upsertAssessment(actor, {
        initiativeId: created.id,
        area,
        status: "COMPLETE",
        summary: "ok",
        findings: "ok",
        conclusion: "ok",
        ownerName: "Analyst",
      });
    }
    await initiative.createAlternative(actor, {
      initiativeId: created.id,
      title: "Reuse existing",
      description: "Use current platform capability",
      isRecommended: true,
    });
    await initiative.createRisk(actor, {
      initiativeId: created.id,
      title: "Adoption risk",
      description: "Users may resist change",
      probability: "MEDIUM",
      impact: "HIGH",
    });

    workspace = await initiative.getInitiativeWorkspace(actor, created.id);
    expect(workspace.readiness?.ready).toBe(true);
    expect(
      workspace.attention.filter((a) => a.severity === "blocker"),
    ).toHaveLength(0);
  });
});
