import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { GovernanceService } from "@/modules/governance/application/governance-service";
import { evaluatePoCReadiness } from "@/modules/governance/application/poc-readiness-policy";
import { InitiativeService } from "@/modules/initiative/application/initiative-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { REQUIRED_ASSESSMENT_AREAS } from "@/modules/initiative/application/readiness-policy";
import { AppError } from "@/modules/shared/errors";
import { resetEnvCacheForTests } from "@/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public";
process.env.DIRECT_URL =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL;
process.env.ALLOW_DEV_AUTH = "false";
resetEnvCacheForTests();

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const organization = new OrganizationService(db, authz, audit);
const governance = new GovernanceService(db, authz, audit);
const initiative = new InitiativeService(db, authz, audit, governance);

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
  // Phase 3 governance / PoC
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
  await db.bootstrapConsumption.deleteMany();
  await db.externalIdentity.deleteMany();
  await db.principal.deleteMany();
  await db.roleDefinition.deleteMany();
}

async function seedOrg(actor: Principal) {
  await db.principal.create({ data: { id: actor.id, displayName: "Actor" } });
  const org = await organization.createOrganization(actor, { name: "Org P3" });
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

async function makeReadyPreStudy(actor: Principal, orgId: string, deptId: string) {
  let created = await initiative.createInitiative(actor, {
    organizationId: orgId,
    departmentId: deptId,
    title: "Governance ready",
    requesterName: "Requester",
    businessOwnerName: "Owner",
  });
  const demand = await db.demand.findUniqueOrThrow({
    where: { initiativeId: created.id },
  });
  await initiative.updateDemand(actor, {
    initiativeId: created.id,
    expectedVersion: demand.version,
    problemOpportunity: "Fragmented planning",
    reasonForRequest: "Need structured governance",
    expectedValue: "Faster decisions",
    affectedAreas: "All departments",
    urgency: "HIGH",
    strategicAlignment: "Portfolio clarity",
    initialImpact: "Medium operational change",
  });
  created = await db.initiative.findUniqueOrThrow({ where: { id: created.id } });
  created = await initiative.advanceLifecycle(actor, {
    initiativeId: created.id,
    toStage: "REQUIREMENTS",
    expectedVersion: created.version,
  });
  await initiative.createRequirement(actor, {
    initiativeId: created.id,
    title: "Capture demand",
    description: "Structured demand",
    category: "BUSINESS",
    status: "ACCEPTED",
    acceptanceCriteria: ["Form complete"],
  });
  created = await db.initiative.findUniqueOrThrow({ where: { id: created.id } });
  created = await initiative.advanceLifecycle(actor, {
    initiativeId: created.id,
    toStage: "PRE_STUDY",
    expectedVersion: created.version,
  });
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
    title: "Extend current tooling",
    description: "Improve existing process",
    isRecommended: true,
  });
  await initiative.createRisk(actor, {
    initiativeId: created.id,
    title: "Adoption risk",
    description: "Users may resist",
  });
  return db.initiative.findUniqueOrThrow({ where: { id: created.id } });
}

async function approveAllPending(actor: Principal, submissionId: string) {
  const requests = await db.approvalRequest.findMany({
    where: { submissionId, status: "PENDING" },
    orderBy: { authorityKey: "asc" },
  });
  for (const request of requests) {
    await governance.recordApproval(actor, {
      approvalRequestId: request.id,
      outcome: "APPROVED",
      comment: "ok",
      expectedVersion: request.version,
    });
  }
}

async function submitPreStudy(actor: Principal, initiativeId: string) {
  await governance.ensureTemplates();
  const bundle = await governance.submitPreStudyForGovernance(actor, {
    initiativeId,
  });
  return bundle.submission;
}

async function submitAndApprove(actor: Principal, initiativeId: string) {
  const submission = await submitPreStudy(actor, initiativeId);
  await approveAllPending(actor, submission.id);
  return db.governanceSubmission.findUniqueOrThrow({
    where: { id: submission.id },
    include: { decisionPackage: true, approvalRequests: { include: { record: true } } },
  });
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

describe("GOVERNANCE", () => {
  it("cannot submit when not ready", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    let created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Not ready",
      requesterName: "R",
      businessOwnerName: "O",
    });
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
      urgency: "LOW",
      strategicAlignment: "S",
      initialImpact: "I",
    });
    created = await db.initiative.findUniqueOrThrow({ where: { id: created.id } });
    created = await initiative.advanceLifecycle(actor, {
      initiativeId: created.id,
      toStage: "REQUIREMENTS",
      expectedVersion: created.version,
    });
    await initiative.createRequirement(actor, {
      initiativeId: created.id,
      title: "Req",
      description: "Desc",
      category: "BUSINESS",
      status: "ACCEPTED",
      acceptanceCriteria: [],
    });
    created = await db.initiative.findUniqueOrThrow({ where: { id: created.id } });
    await initiative.advanceLifecycle(actor, {
      initiativeId: created.id,
      toStage: "PRE_STUDY",
      expectedVersion: created.version,
    });

    await governance.ensureTemplates();
    await expect(
      governance.submitPreStudyForGovernance(actor, {
        initiativeId: created.id,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      details: expect.objectContaining({
        blockers: expect.any(Array),
      }),
    });
  });

  it("can submit when ready → snapshot + evidence + approval requests", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitPreStudy(actor, ready.id);

    expect(submission.status).toBe("IN_REVIEW");
    expect(submission.reviewSnapshotId).toBeTruthy();
    const evidence = await db.evidencePackage.findUnique({
      where: { submissionId: submission.id },
      include: { entries: true },
    });
    expect(evidence?.entries.length).toBeGreaterThan(0);
    const requests = await db.approvalRequest.findMany({
      where: { submissionId: submission.id },
    });
    expect(requests.length).toBeGreaterThanOrEqual(3);
    expect(requests.every((r) => r.status === "PENDING")).toBe(true);
  });

  it("revise after CHANGES_REQUESTED preserves old snapshot", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const first = await submitPreStudy(actor, ready.id);
    const firstSnapId = first.reviewSnapshotId;
    const pending = await db.approvalRequest.findFirstOrThrow({
      where: { submissionId: first.id, status: "PENDING" },
    });
    await governance.recordApproval(actor, {
      approvalRequestId: pending.id,
      outcome: "CHANGES_REQUESTED",
      comment: "Need deeper cost analysis",
      expectedVersion: pending.version,
    });
    const revisedBundle = await governance.reviseGovernanceSubmission(actor, {
      previousSubmissionId: first.id,
      notes: "Updated cost assessment",
    });
    const revised = revisedBundle.submission;
    expect(revised.reviewSnapshotId).not.toBe(firstSnapId);
    const snapshots = await db.reviewSnapshot.findMany({
      where: { initiativeId: ready.id },
    });
    expect(snapshots).toHaveLength(2);
    const old = await db.reviewSnapshot.findUniqueOrThrow({
      where: { id: firstSnapId },
    });
    expect(old.id).toBe(firstSnapId);
    const prev = await db.governanceSubmission.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(prev.status).toBe("SUPERSEDED");
  });
});

describe("APPROVAL", () => {
  it("authorized approval APPROVED", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitPreStudy(actor, ready.id);
    const request = await db.approvalRequest.findFirstOrThrow({
      where: { submissionId: submission.id, status: "PENDING" },
    });
    const result = await governance.recordApproval(actor, {
      approvalRequestId: request.id,
      outcome: "APPROVED",
      expectedVersion: request.version,
    });
    expect(result.record.outcome).toBe("APPROVED");
  });

  it("unauthorized principal rejected FORBIDDEN", async () => {
    const actor = principal();
    const stranger = principal();
    const { org, department } = await seedOrg(actor);
    await db.principal.create({ data: { id: stranger.id, displayName: "Stranger" } });
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitPreStudy(actor, ready.id);
    const request = await db.approvalRequest.findFirstOrThrow({
      where: { submissionId: submission.id, status: "PENDING" },
    });
    await expect(
      governance.recordApproval(stranger, {
        approvalRequestId: request.id,
        outcome: "APPROVED",
        expectedVersion: request.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("REJECTED cancels remaining pending requests", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitPreStudy(actor, ready.id);
    const request = await db.approvalRequest.findFirstOrThrow({
      where: { submissionId: submission.id, status: "PENDING" },
    });
    await governance.recordApproval(actor, {
      approvalRequestId: request.id,
      outcome: "REJECTED",
      comment: "Not viable",
      expectedVersion: request.version,
    });
    const refreshed = await db.governanceSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(refreshed.status).toBe("IN_REVIEW");
    const pending = await db.approvalRequest.count({
      where: { submissionId: submission.id, status: "PENDING" },
    });
    expect(pending).toBe(0);
  });

  it("CHANGES_REQUESTED sets submission status", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitPreStudy(actor, ready.id);
    const request = await db.approvalRequest.findFirstOrThrow({
      where: { submissionId: submission.id, status: "PENDING" },
    });
    await governance.recordApproval(actor, {
      approvalRequestId: request.id,
      outcome: "CHANGES_REQUESTED",
      expectedVersion: request.version,
    });
    const refreshed = await db.governanceSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(refreshed.status).toBe("CHANGES_REQUESTED");
  });

  it("completed approval immutable (second recordApproval CONFLICT)", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitPreStudy(actor, ready.id);
    const request = await db.approvalRequest.findFirstOrThrow({
      where: { submissionId: submission.id, status: "PENDING" },
    });
    await governance.recordApproval(actor, {
      approvalRequestId: request.id,
      outcome: "APPROVED",
      expectedVersion: request.version,
    });
    await expect(
      governance.recordApproval(actor, {
        approvalRequestId: request.id,
        outcome: "REJECTED",
        expectedVersion: request.version + 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("stale approval request version rejected STALE_VERSION", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitPreStudy(actor, ready.id);
    const request = await db.approvalRequest.findFirstOrThrow({
      where: { submissionId: submission.id, status: "PENDING" },
    });
    await expect(
      governance.recordApproval(actor, {
        approvalRequestId: request.id,
        outcome: "APPROVED",
        expectedVersion: request.version + 5,
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
  });
});

describe("DECISION", () => {
  it("unauthorized decision rejected", async () => {
    const actor = principal();
    const stranger = principal();
    const { org, department } = await seedOrg(actor);
    await db.principal.create({ data: { id: stranger.id } });
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprove(actor, ready.id);
    await expect(
      governance.recordDecision(stranger, {
        submissionId: submission.id,
        outcome: "GO",
        rationale: "Proceed",
        expectedPackageVersion: submission.decisionPackage!.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("GO / CONDITIONAL_GO / NO_GO / HOLD outcomes with rationale", async () => {
    const outcomes = ["GO", "CONDITIONAL_GO", "NO_GO", "HOLD"] as const;
    for (const outcome of outcomes) {
      await resetDb();
      const actor = principal();
      const { org, department } = await seedOrg(actor);
      const ready = await makeReadyPreStudy(actor, org.id, department.id);
      const submission = await submitAndApprove(actor, ready.id);
      const decision = await governance.recordDecision(actor, {
        submissionId: submission.id,
        outcome,
        rationale: `Rationale for ${outcome}`,
        conditions:
          outcome === "CONDITIONAL_GO"
            ? [
                {
                  description: "Complete security sign-off",
                  requiredBeforeProgression: true,
                },
              ]
            : [],
        expectedPackageVersion: submission.decisionPackage!.version,
      });
      expect(decision.outcome).toBe(outcome);
      expect(decision.rationale).toBe(`Rationale for ${outcome}`);
      if (outcome === "CONDITIONAL_GO") {
        expect(decision.conditions).toHaveLength(1);
        expect(decision.conditions[0].status).toBe("OPEN");
      }
    }
  });

  it("recommendation on package does not auto-set outcome", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprove(actor, ready.id);
    expect(submission.decisionPackage?.recommendationText).toContain(
      "Recommended alternative",
    );
    const decision = await governance.recordDecision(actor, {
      submissionId: submission.id,
      outcome: "HOLD",
      rationale: "Pause despite recommendation",
      expectedPackageVersion: submission.decisionPackage!.version,
    });
    expect(decision.outcome).toBe("HOLD");
    expect(decision.recommendationText).toContain("Recommended alternative");
  });

  it("decision requires APPROVALS_COMPLETE", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitPreStudy(actor, ready.id);
    const pkg = await db.decisionPackage.findUniqueOrThrow({
      where: { submissionId: submission.id },
    });
    await expect(
      governance.recordDecision(actor, {
        submissionId: submission.id,
        outcome: "GO",
        rationale: "Too early",
        expectedPackageVersion: pkg.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("LIFECYCLE", () => {
  it("GO permits createPoC and stage→POC", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprove(actor, ready.id);
    await governance.recordDecision(actor, {
      submissionId: submission.id,
      outcome: "GO",
      rationale: "Ready for PoC",
      expectedPackageVersion: submission.decisionPackage!.version,
    });
    const poc = await governance.createPoC(actor, {
      initiativeId: ready.id,
      title: "PoC Alpha",
      objective: "Validate approach",
      hypothesis: "Will reduce cycle time",
      scope: "One department",
    });
    expect(poc.status).toBe("DRAFT");
    const updated = await db.initiative.findUniqueOrThrow({
      where: { id: ready.id },
    });
    expect(updated.currentStage).toBe("POC");
  });

  it("NO_GO does not create PoC (initiative CANCELLED)", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprove(actor, ready.id);
    await governance.recordDecision(actor, {
      submissionId: submission.id,
      outcome: "NO_GO",
      rationale: "Not viable",
      expectedPackageVersion: submission.decisionPackage!.version,
    });
    await expect(
      governance.createPoC(actor, {
        initiativeId: ready.id,
        title: "PoC",
        objective: "o",
        hypothesis: "h",
        scope: "s",
      }),
    ).rejects.toBeInstanceOf(AppError);
    const updated = await db.initiative.findUniqueOrThrow({
      where: { id: ready.id },
    });
    expect(updated.status).toBe("CANCELLED");
    expect(await db.poC.count({ where: { initiativeId: ready.id } })).toBe(0);
  });

  it("HOLD does not create PoC (ON_HOLD)", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprove(actor, ready.id);
    await governance.recordDecision(actor, {
      submissionId: submission.id,
      outcome: "HOLD",
      rationale: "Wait for budget",
      expectedPackageVersion: submission.decisionPackage!.version,
    });
    await expect(
      governance.createPoC(actor, {
        initiativeId: ready.id,
        title: "PoC",
        objective: "o",
        hypothesis: "h",
        scope: "s",
      }),
    ).rejects.toBeInstanceOf(AppError);
    const updated = await db.initiative.findUniqueOrThrow({
      where: { id: ready.id },
    });
    expect(updated.status).toBe("ON_HOLD");
  });

  it("blocking Conditional-Go condition prevents createPoC; resolve then permits", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprove(actor, ready.id);
    const decision = await governance.recordDecision(actor, {
      submissionId: submission.id,
      outcome: "CONDITIONAL_GO",
      rationale: "Go with conditions",
      conditions: [
        {
          description: "Security review signed",
          requiredBeforeProgression: true,
        },
      ],
      expectedPackageVersion: submission.decisionPackage!.version,
    });
    await expect(
      governance.createPoC(actor, {
        initiativeId: ready.id,
        title: "PoC",
        objective: "o",
        hypothesis: "h",
        scope: "s",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const condition = decision.conditions[0];
    await governance.resolveDecisionCondition(actor, {
      conditionId: condition.id,
      status: "RESOLVED",
      resolutionNote: "Signed off",
      expectedVersion: condition.version,
    });

    const poc = await governance.createPoC(actor, {
      initiativeId: ready.id,
      title: "PoC after condition",
      objective: "Validate",
      hypothesis: "Works",
      scope: "Limited",
    });
    expect(poc.id).toBeTruthy();
  });
});

describe("PoC", () => {
  async function initiativeWithGoPoC(actor: Principal) {
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprove(actor, ready.id);
    await governance.recordDecision(actor, {
      submissionId: submission.id,
      outcome: "GO",
      rationale: "Go",
      expectedPackageVersion: submission.decisionPackage!.version,
    });
    const poc = await governance.createPoC(actor, {
      initiativeId: ready.id,
      title: "PoC",
      objective: "Validate latency",
      hypothesis: "p95 under 200ms",
      scope: "One service",
    });
    return { org, ready, poc };
  }

  it("create, criteria, transitions, invalid transition rejected", async () => {
    const actor = principal();
    const { poc } = await initiativeWithGoPoC(actor);
    const criterion = await governance.upsertPoCCriterion(actor, {
      pocId: poc.id,
      description: "Latency",
      measurementMethod: "p95",
      target: "<200ms",
      required: true,
    });
    expect(criterion.evaluationState).toBe("NOT_EVALUATED");

    let current = await db.poC.findUniqueOrThrow({ where: { id: poc.id } });
    current = await governance.transitionPoC(actor, {
      pocId: poc.id,
      toStatus: "READY",
      expectedVersion: current.version,
    });
    expect(current.status).toBe("READY");

    await expect(
      governance.transitionPoC(actor, {
        pocId: poc.id,
        toStatus: "EVALUATION",
        expectedVersion: current.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    current = await governance.transitionPoC(actor, {
      pocId: poc.id,
      toStatus: "IN_PROGRESS",
      expectedVersion: current.version,
    });
    expect(current.status).toBe("IN_PROGRESS");
  });

  it("evaluation readiness derived; unevaluated required criterion blocks", async () => {
    const actor = principal();
    const { poc } = await initiativeWithGoPoC(actor);
    const criterion = await governance.upsertPoCCriterion(actor, {
      pocId: poc.id,
      description: "Latency",
      measurementMethod: "p95",
      target: "<200ms",
      required: true,
    });
    let current = await db.poC.findUniqueOrThrow({ where: { id: poc.id } });
    for (const toStatus of ["READY", "IN_PROGRESS", "EVALUATION"] as const) {
      current = await governance.transitionPoC(actor, {
        pocId: poc.id,
        toStatus,
        expectedVersion: current.version,
      });
    }
    current = await governance.updatePoCResults(actor, {
      pocId: poc.id,
      results: "Observed 180ms",
      findings: "Hypothesis held",
      expectedVersion: current.version,
    });

    let readiness = evaluatePoCReadiness(current, [
      { required: true, evaluationState: "NOT_EVALUATED" },
    ]);
    expect(readiness.ready).toBe(false);

    await governance.updateCriterionEvaluation(actor, {
      criterionId: criterion.id,
      evaluationState: "PASS",
      actualResult: "180ms",
      expectedVersion: criterion.version,
    });
    const criteria = await db.poCSuccessCriterion.findMany({
      where: { pocId: poc.id },
    });
    current = await db.poC.findUniqueOrThrow({ where: { id: poc.id } });
    readiness = evaluatePoCReadiness(current, criteria);
    expect(readiness.ready).toBe(true);
  });

  it("submitPoCForGovernance when ready", async () => {
    const actor = principal();
    const { poc } = await initiativeWithGoPoC(actor);
    const criterion = await governance.upsertPoCCriterion(actor, {
      pocId: poc.id,
      description: "Latency",
      measurementMethod: "p95",
      target: "<200ms",
      required: true,
    });
    let current = await db.poC.findUniqueOrThrow({ where: { id: poc.id } });
    for (const toStatus of [
      "READY",
      "IN_PROGRESS",
      "EVALUATION",
      "COMPLETED",
    ] as const) {
      current = await governance.transitionPoC(actor, {
        pocId: poc.id,
        toStatus,
        expectedVersion: current.version,
      });
    }
    current = await governance.updatePoCResults(actor, {
      pocId: poc.id,
      results: "Observed 180ms",
      findings: "Hypothesis held",
      expectedVersion: current.version,
    });
    await governance.updateCriterionEvaluation(actor, {
      criterionId: criterion.id,
      evaluationState: "PASS",
      actualResult: "180ms",
      expectedVersion: criterion.version,
    });

    const init = await db.initiative.findFirstOrThrow({
      where: { poc: { id: poc.id } },
    });
    const pocBundle = await governance.submitPoCForGovernance(actor, {
      initiativeId: init.id,
    });
    expect(pocBundle.submission.status).toBe("IN_REVIEW");
  });
});

describe("ATTENTION", () => {
  it("pending approval / changes / decision / condition / poc blocker appear and clear", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitPreStudy(actor, ready.id);

    let workspace = await initiative.getInitiativeWorkspace(actor, ready.id);
    expect(
      workspace.attention.some((a) => a.key.startsWith("pending-approval")),
    ).toBe(true);

    const pending = await db.approvalRequest.findFirstOrThrow({
      where: { submissionId: submission.id, status: "PENDING" },
    });
    await governance.recordApproval(actor, {
      approvalRequestId: pending.id,
      outcome: "CHANGES_REQUESTED",
      expectedVersion: pending.version,
    });
    workspace = await initiative.getInitiativeWorkspace(actor, ready.id);
    expect(
      workspace.attention.some((a) => a.key.startsWith("changes-requested")),
    ).toBe(true);

    const revisedBundle = await governance.reviseGovernanceSubmission(actor, {
      previousSubmissionId: submission.id,
    });
    const revised = revisedBundle.submission;
    await approveAllPending(actor, revised.id);
    workspace = await initiative.getInitiativeWorkspace(actor, ready.id);
    expect(
      workspace.attention.some((a) => a.key.startsWith("decision-required")),
    ).toBe(true);

    const pkg = await db.decisionPackage.findUniqueOrThrow({
      where: { submissionId: revised.id },
    });
    const decision = await governance.recordDecision(actor, {
      submissionId: revised.id,
      outcome: "CONDITIONAL_GO",
      rationale: "Conditional",
      conditions: [
        {
          description: "Resolve dependency",
          requiredBeforeProgression: true,
        },
      ],
      expectedPackageVersion: pkg.version,
    });
    workspace = await initiative.getInitiativeWorkspace(actor, ready.id);
    expect(
      workspace.attention.some((a) => a.key.startsWith("open-conditions")),
    ).toBe(true);

    await governance.resolveDecisionCondition(actor, {
      conditionId: decision.conditions[0].id,
      status: "RESOLVED",
      resolutionNote: "Done",
      expectedVersion: decision.conditions[0].version,
    });
    workspace = await initiative.getInitiativeWorkspace(actor, ready.id);
    expect(
      workspace.attention.some((a) => a.key.startsWith("open-conditions")),
    ).toBe(false);

    const poc = await governance.createPoC(actor, {
      initiativeId: ready.id,
      title: "PoC",
      objective: "o",
      hypothesis: "h",
      scope: "s",
    });
    const criterion = await governance.upsertPoCCriterion(actor, {
      pocId: poc.id,
      description: "Metric",
      measurementMethod: "count",
      target: "10",
      required: true,
    });
    let current = await db.poC.findUniqueOrThrow({ where: { id: poc.id } });
    for (const toStatus of ["READY", "IN_PROGRESS", "EVALUATION"] as const) {
      current = await governance.transitionPoC(actor, {
        pocId: poc.id,
        toStatus,
        expectedVersion: current.version,
      });
    }
    await governance.updatePoCResults(actor, {
      pocId: poc.id,
      results: "r",
      findings: "f",
      expectedVersion: current.version,
    });
    workspace = await initiative.getInitiativeWorkspace(actor, ready.id);
    expect(
      workspace.attention.some((a) => a.key === "poc-criteria-unevaluated"),
    ).toBe(true);

    await governance.updateCriterionEvaluation(actor, {
      criterionId: criterion.id,
      evaluationState: "PASS",
      expectedVersion: criterion.version,
    });
    workspace = await initiative.getInitiativeWorkspace(actor, ready.id);
    expect(
      workspace.attention.some((a) => a.key === "poc-criteria-unevaluated"),
    ).toBe(false);
  });
});

describe("SECURITY", () => {
  it("cross-org access rejected", async () => {
    const actorA = principal();
    const actorB = principal();
    const orgA = await seedOrg(actorA);
    await db.principal.create({ data: { id: actorB.id, displayName: "Actor B" } });
    // actorA retains platform bootstrap and can create a second org; grant B admin there only
    const orgB = await organization.createOrganization(actorA, { name: "Org B" });
    await authz.grantOrganizationAdmin(actorB.id, orgB.id);
    const sectionB = await organization.createSection(actorA, {
      organizationId: orgB.id,
      name: "Section B",
    });
    await organization.createDepartment(actorA, {
      sectionId: sectionB.id,
      name: "Dept B",
    });

    const readyA = await makeReadyPreStudy(actorA, orgA.org.id, orgA.department.id);
    const submission = await submitPreStudy(actorA, readyA.id);
    await expect(
      initiative.getInitiativeWorkspace(actorB, readyA.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      governance.submitPreStudyForGovernance(actorB, {
        initiativeId: readyA.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const request = await db.approvalRequest.findFirstOrThrow({
      where: { submissionId: submission.id },
    });
    await expect(
      governance.recordApproval(actorB, {
        approvalRequestId: request.id,
        outcome: "APPROVED",
        expectedVersion: request.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(orgB.id).not.toBe(orgA.org.id);
  });
});

describe("CONCURRENCY", () => {
  it("concurrent requirement reference allocation yields unique keys", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    let created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Concurrent reqs",
      requesterName: "R",
      businessOwnerName: "O",
    });
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
      urgency: "LOW",
      strategicAlignment: "S",
      initialImpact: "I",
    });
    created = await db.initiative.findUniqueOrThrow({ where: { id: created.id } });
    created = await initiative.advanceLifecycle(actor, {
      initiativeId: created.id,
      toStage: "REQUIREMENTS",
      expectedVersion: created.version,
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        initiative.createRequirement(actor, {
          initiativeId: created.id,
          title: `Req ${i}`,
          description: `Desc ${i}`,
          category: "BUSINESS",
          status: "ACCEPTED",
          acceptanceCriteria: [],
        }),
      ),
    );
    const keys = results.map((r) => r.referenceKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("stale decision package version rejected", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprove(actor, ready.id);
    await expect(
      governance.recordDecision(actor, {
        submissionId: submission.id,
        outcome: "GO",
        rationale: "Stale",
        expectedPackageVersion: submission.decisionPackage!.version + 3,
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
  });
});
