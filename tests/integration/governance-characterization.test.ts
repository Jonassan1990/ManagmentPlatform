/**
 * Phase 1A — Governance characterization safety net.
 *
 * Locks AS-IS observable behavior before Phase 1B GovernanceService boundary
 * refactor. Prefer business outcomes over internal call structure.
 * Existing suites (governance.test.ts, pilot-project.test.ts, phase0c) remain
 * the primary coverage; this file strengthens documented gaps only.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { GovernanceService } from "@/modules/governance/application/governance-service";
import { InitiativeService } from "@/modules/initiative/application/initiative-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { REQUIRED_ASSESSMENT_AREAS } from "@/modules/initiative/application/readiness-policy";
import { PERMISSIONS } from "@/modules/shared/permissions";
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
  await db.pilotFeedback.deleteMany();
  await db.pilotCriterion.deleteMany();
  await db.pilotExtension.deleteMany();
  await db.pilot.deleteMany();
  await db.projectWorkItem.deleteMany();
  await db.projectMilestone.deleteMany();
  await db.projectParticipatingDepartment.deleteMany();
  await db.project.deleteMany();
  await db.projectReferenceCounter.deleteMany();
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

async function seedOrg(actor: Principal, name = "Org Char") {
  await db.principal.create({ data: { id: actor.id, displayName: "Actor" } });
  const org = await organization.createOrganization(actor, { name });
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

async function makeReadyPreStudy(
  actor: Principal,
  orgId: string,
  deptId: string,
  title = "Characterization ready",
) {
  let created = await initiative.createInitiative(actor, {
    organizationId: orgId,
    departmentId: deptId,
    title,
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

async function submitAndApprovePreStudy(actor: Principal, initiativeId: string) {
  await governance.ensureTemplates();
  const bundle = await governance.submitPreStudyForGovernance(actor, {
    initiativeId,
  });
  await approveAllPending(actor, bundle.submission.id);
  return db.governanceSubmission.findUniqueOrThrow({
    where: { id: bundle.submission.id },
    include: {
      decisionPackage: true,
      reviewSnapshot: true,
      approvalRequests: { include: { record: true } },
    },
  });
}

async function makePoCReadyForGate(actor: Principal, pocId: string) {
  const criterion = await governance.upsertPoCCriterion(actor, {
    pocId,
    description: "Latency",
    measurementMethod: "p95",
    target: "<200ms",
    required: true,
  });
  let current = await db.poC.findUniqueOrThrow({ where: { id: pocId } });
  for (const toStatus of ["READY", "IN_PROGRESS", "EVALUATION"] as const) {
    current = await governance.transitionPoC(actor, {
      pocId,
      toStatus,
      expectedVersion: current.version,
    });
  }
  current = await governance.updatePoCResults(actor, {
    pocId,
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
  return current;
}

async function buildThroughPoCGoThenCreatePilot(actor: Principal) {
  const { org, department } = await seedOrg(actor);
  const ready = await makeReadyPreStudy(actor, org.id, department.id);
  const preStudySub = await submitAndApprovePreStudy(actor, ready.id);
  await governance.recordDecision(actor, {
    submissionId: preStudySub.id,
    outcome: "GO",
    rationale: "Proceed to PoC",
    expectedPackageVersion: preStudySub.decisionPackage!.version,
  });
  const poc = await governance.createPoC(actor, {
    initiativeId: ready.id,
    title: "PoC",
    objective: "Validate latency",
    hypothesis: "p95 under 200ms",
    scope: "One service",
  });
  await makePoCReadyForGate(actor, poc.id);
  const pocBundle = await governance.submitPoCForGovernance(actor, {
    initiativeId: ready.id,
  });
  await approveAllPending(actor, pocBundle.submission.id);
  const pocSub = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: pocBundle.submission.id },
    include: { decisionPackage: true },
  });
  await governance.recordDecision(actor, {
    submissionId: pocSub.id,
    outcome: "GO",
    rationale: "Proceed to Pilot",
    expectedPackageVersion: pocSub.decisionPackage!.version,
  });
  const pilot = await governance.createPilot(actor, {
    initiativeId: ready.id,
    objective: "Prove scale readiness",
    scope: "Plant A",
    siteOrArea: "Plant A",
    environment: "Production-like",
    supportModel: "On-call",
    rollbackPlan: "Feature flag off",
    plannedEnd: new Date("2026-12-01"),
  });
  const initiativeRow = await db.initiative.findUniqueOrThrow({
    where: { id: ready.id },
  });
  return { org, department, initiative: initiativeRow, poc, pilot };
}

async function advancePilotToEvaluationReady(actor: Principal, pilotId: string) {
  const criterion = await governance.upsertPilotCriterion(actor, {
    pilotId,
    category: "OPERATIONAL",
    title: "Adoption",
    description: "Weekly active operators",
    measurementMethod: "Telemetry",
    target: ">70%",
    required: true,
  });
  let current = await db.pilot.findUniqueOrThrow({ where: { id: pilotId } });
  for (const toStatus of ["READY", "IN_PROGRESS", "EVALUATION"] as const) {
    current = await governance.transitionPilot(actor, {
      pilotId,
      toStatus,
      expectedVersion: current.version,
    });
  }
  current = await governance.updatePilotResults(actor, {
    pilotId,
    results: "Adoption 78%",
    businessFindings: "Value confirmed",
    technicalFindings: "Stable",
    operationalFindings: "Support held",
    expectedVersion: current.version,
  });
  await governance.evaluatePilotCriterion(actor, {
    criterionId: criterion.id,
    evaluationState: "PASS",
    actualResult: "78%",
    expectedVersion: criterion.version,
  });
  return current;
}

async function submitApprovePilotGate(actor: Principal, initiativeId: string) {
  const bundle = await governance.submitPilotForGovernance(actor, {
    initiativeId,
  });
  await approveAllPending(actor, bundle.submission.id);
  return db.governanceSubmission.findUniqueOrThrow({
    where: { id: bundle.submission.id },
    include: { decisionPackage: true },
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

describe("CHARACTERIZATION — review snapshot immutability", () => {
  it("source mutation after submit leaves ReviewSnapshot.payload unchanged", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(
      actor,
      org.id,
      department.id,
      "Frozen title",
    );
    await governance.ensureTemplates();
    const bundle = await governance.submitPreStudyForGovernance(actor, {
      initiativeId: ready.id,
    });
    const snapshot = await db.reviewSnapshot.findUniqueOrThrow({
      where: { id: bundle.submission.reviewSnapshotId },
    });
    const frozenPayload = structuredClone(snapshot.payload);

    await initiative.updateInitiative(actor, {
      id: ready.id,
      title: "MUTATED AFTER SUBMIT",
      requesterName: ready.requesterName,
      businessOwnerName: ready.businessOwnerName,
      expectedVersion: ready.version,
    });
    const demand = await db.demand.findUniqueOrThrow({
      where: { initiativeId: ready.id },
    });
    await initiative.updateDemand(actor, {
      initiativeId: ready.id,
      expectedVersion: demand.version,
      problemOpportunity: "MUTATED PROBLEM",
      reasonForRequest: demand.reasonForRequest ?? "x",
      expectedValue: demand.expectedValue ?? "x",
      affectedAreas: demand.affectedAreas ?? "x",
      urgency: demand.urgency ?? "HIGH",
      strategicAlignment: demand.strategicAlignment ?? "x",
      initialImpact: demand.initialImpact ?? "x",
    });

    const after = await db.reviewSnapshot.findUniqueOrThrow({
      where: { id: snapshot.id },
    });
    expect(after.payload).toEqual(frozenPayload);
    const payload = after.payload as {
      initiative: { title: string };
      demand: { problemOpportunity: string } | null;
    };
    expect(payload.initiative.title).toBe("Frozen title");
    expect(payload.demand?.problemOpportunity).toBe("Fragmented planning");

    const live = await db.initiative.findUniqueOrThrow({
      where: { id: ready.id },
    });
    expect(live.title).toBe("MUTATED AFTER SUBMIT");
  });
});

describe("CHARACTERIZATION — explicit progression (no auto-create)", () => {
  it("pre-study GO does not create PoC and leaves stage PRE_STUDY", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprovePreStudy(actor, ready.id);
    await governance.recordDecision(actor, {
      submissionId: submission.id,
      outcome: "GO",
      rationale: "Go",
      expectedPackageVersion: submission.decisionPackage!.version,
    });

    expect(await db.poC.count({ where: { initiativeId: ready.id } })).toBe(0);
    expect(await db.pilot.count({ where: { initiativeId: ready.id } })).toBe(0);
    expect(await db.project.count({ where: { initiativeId: ready.id } })).toBe(
      0,
    );
    const init = await db.initiative.findUniqueOrThrow({
      where: { id: ready.id },
    });
    expect(init.currentStage).toBe("PRE_STUDY");
    expect(init.status).toBe("ACTIVE");
  });

  it("PoC-gate GO does not create Pilot or Project", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const preStudySub = await submitAndApprovePreStudy(actor, ready.id);
    await governance.recordDecision(actor, {
      submissionId: preStudySub.id,
      outcome: "GO",
      rationale: "Go",
      expectedPackageVersion: preStudySub.decisionPackage!.version,
    });
    const poc = await governance.createPoC(actor, {
      initiativeId: ready.id,
      title: "PoC",
      objective: "o",
      hypothesis: "h",
      scope: "s",
    });
    await makePoCReadyForGate(actor, poc.id);
    const pocBundle = await governance.submitPoCForGovernance(actor, {
      initiativeId: ready.id,
    });
    await approveAllPending(actor, pocBundle.submission.id);
    const pocSub = await db.governanceSubmission.findUniqueOrThrow({
      where: { id: pocBundle.submission.id },
      include: { decisionPackage: true },
    });
    await governance.recordDecision(actor, {
      submissionId: pocSub.id,
      outcome: "GO",
      rationale: "Go pilot",
      expectedPackageVersion: pocSub.decisionPackage!.version,
    });

    expect(await db.pilot.count({ where: { initiativeId: ready.id } })).toBe(0);
    expect(await db.project.count({ where: { initiativeId: ready.id } })).toBe(
      0,
    );
    const init = await db.initiative.findUniqueOrThrow({
      where: { id: ready.id },
    });
    expect(init.currentStage).toBe("POC");
  });

  it("SCALE does not create Project; COUNT(Project) stays 0 until convert", async () => {
    const actor = principal();
    const { initiative: init, pilot } =
      await buildThroughPoCGoThenCreatePilot(actor);
    await advancePilotToEvaluationReady(actor, pilot.id);
    const sub = await submitApprovePilotGate(actor, init.id);
    await governance.recordDecision(actor, {
      submissionId: sub.id,
      outcome: "SCALE",
      rationale: "Scale",
      expectedPackageVersion: sub.decisionPackage!.version,
    });

    expect(await db.project.count({ where: { initiativeId: init.id } })).toBe(0);
    expect(init.id).toBeTruthy();
    const afterScale = await db.initiative.findUniqueOrThrow({
      where: { id: init.id },
    });
    expect(afterScale.currentStage).toBe("PILOT");
    expect(afterScale.status).toBe("ACTIVE");
  });
});

describe("CHARACTERIZATION — decision outcome matrix", () => {
  it("rejects SCALE / EXTEND_PILOT / STOP / CONDITIONAL_SCALE on PRE_STUDY_GATE", async () => {
    const invalid = [
      "SCALE",
      "EXTEND_PILOT",
      "STOP",
      "CONDITIONAL_SCALE",
    ] as const;
    for (const outcome of invalid) {
      await resetDb();
      const actor = principal();
      const { org, department } = await seedOrg(actor);
      const ready = await makeReadyPreStudy(actor, org.id, department.id);
      const submission = await submitAndApprovePreStudy(actor, ready.id);
      await expect(
        governance.recordDecision(actor, {
          submissionId: submission.id,
          outcome,
          rationale: "wrong gate",
          conditions:
            outcome === "CONDITIONAL_SCALE"
              ? [{ description: "x", requiredBeforeProgression: true }]
              : [],
          extension:
            outcome === "EXTEND_PILOT"
              ? {
                  newPlannedEnd: new Date("2027-01-01"),
                  reason: "more time",
                }
              : undefined,
          expectedPackageVersion: submission.decisionPackage!.version,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    }
  });

  it("rejects GO / CONDITIONAL_GO / NO_GO on PILOT_GATE", async () => {
    const invalid = ["GO", "CONDITIONAL_GO", "NO_GO"] as const;
    for (const outcome of invalid) {
      await resetDb();
      const actor = principal();
      const { initiative: init, pilot } =
        await buildThroughPoCGoThenCreatePilot(actor);
      await advancePilotToEvaluationReady(actor, pilot.id);
      const sub = await submitApprovePilotGate(actor, init.id);
      await expect(
        governance.recordDecision(actor, {
          submissionId: sub.id,
          outcome,
          rationale: "wrong gate",
          conditions:
            outcome === "CONDITIONAL_GO"
              ? [{ description: "x", requiredBeforeProgression: true }]
              : [],
          expectedPackageVersion: sub.decisionPackage!.version,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    }
  });

  it("CONDITIONAL_GO without conditions is rejected", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprovePreStudy(actor, ready.id);
    await expect(
      governance.recordDecision(actor, {
        submissionId: submission.id,
        outcome: "CONDITIONAL_GO",
        rationale: "Missing conditions",
        conditions: [],
        expectedPackageVersion: submission.decisionPackage!.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("EXTEND_PILOT without extension is rejected", async () => {
    const actor = principal();
    const { initiative: init, pilot } =
      await buildThroughPoCGoThenCreatePilot(actor);
    await advancePilotToEvaluationReady(actor, pilot.id);
    const sub = await submitApprovePilotGate(actor, init.id);
    await expect(
      governance.recordDecision(actor, {
        submissionId: sub.id,
        outcome: "EXTEND_PILOT",
        rationale: "Missing extension",
        expectedPackageVersion: sub.decisionPackage!.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("CONDITIONAL_SCALE without conditions is rejected", async () => {
    const actor = principal();
    const { initiative: init, pilot } =
      await buildThroughPoCGoThenCreatePilot(actor);
    await advancePilotToEvaluationReady(actor, pilot.id);
    const sub = await submitApprovePilotGate(actor, init.id);
    await expect(
      governance.recordDecision(actor, {
        submissionId: sub.id,
        outcome: "CONDITIONAL_SCALE",
        rationale: "Missing conditions",
        conditions: [],
        expectedPackageVersion: sub.decisionPackage!.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("CHARACTERIZATION — decision & approval immutability", () => {
  it("second decision on same submission is rejected; first outcome unchanged", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprovePreStudy(actor, ready.id);
    const first = await governance.recordDecision(actor, {
      submissionId: submission.id,
      outcome: "GO",
      rationale: "First",
      expectedPackageVersion: submission.decisionPackage!.version,
    });

    // AS-IS: status becomes DECISION_RECORDED, so the early status guard
    // returns VALIDATION before the decisionRecord CONFLICT branch.
    await expect(
      governance.recordDecision(actor, {
        submissionId: submission.id,
        outcome: "NO_GO",
        rationale: "Second attempt",
        expectedPackageVersion: submission.decisionPackage!.version + 1,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const persisted = await db.decisionRecord.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(persisted.outcome).toBe("GO");
    expect(persisted.rationale).toBe("First");
    expect(
      await db.decisionRecord.count({ where: { submissionId: submission.id } }),
    ).toBe(1);
    const sub = await db.governanceSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(sub.status).toBe("DECISION_RECORDED");
  });

  it("package recommendationText never forces DecisionRecord.outcome on PoC gate", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const preStudySub = await submitAndApprovePreStudy(actor, ready.id);
    await governance.recordDecision(actor, {
      submissionId: preStudySub.id,
      outcome: "GO",
      rationale: "Go",
      expectedPackageVersion: preStudySub.decisionPackage!.version,
    });
    const poc = await governance.createPoC(actor, {
      initiativeId: ready.id,
      title: "PoC",
      objective: "o",
      hypothesis: "h",
      scope: "s",
    });
    await makePoCReadyForGate(actor, poc.id);
    const pocBundle = await governance.submitPoCForGovernance(actor, {
      initiativeId: ready.id,
    });
    await approveAllPending(actor, pocBundle.submission.id);
    const pocSub = await db.governanceSubmission.findUniqueOrThrow({
      where: { id: pocBundle.submission.id },
      include: { decisionPackage: true },
    });
    await db.decisionPackage.update({
      where: { id: pocSub.decisionPackage!.id },
      data: { recommendationText: "Strongly recommend GO to Pilot" },
    });
    const refreshed = await db.governanceSubmission.findUniqueOrThrow({
      where: { id: pocSub.id },
      include: { decisionPackage: true },
    });
    const decision = await governance.recordDecision(actor, {
      submissionId: refreshed.id,
      outcome: "HOLD",
      rationale: "Pause despite package recommendation",
      expectedPackageVersion: refreshed.decisionPackage!.version,
    });
    expect(decision.outcome).toBe("HOLD");
    expect(decision.recommendationText).toContain("recommend GO");
  });
});

describe("CHARACTERIZATION — project conversion idempotency", () => {
  it("exactly one Project per initiative after convert; duplicate CONFLICT; COUNT<=1", async () => {
    const actor = principal();
    const { org, initiative: init, pilot } =
      await buildThroughPoCGoThenCreatePilot(actor);
    await advancePilotToEvaluationReady(actor, pilot.id);
    const sub = await submitApprovePilotGate(actor, init.id);
    await governance.recordDecision(actor, {
      submissionId: sub.id,
      outcome: "SCALE",
      rationale: "Scale",
      expectedPackageVersion: sub.decisionPackage!.version,
    });

    const ownerResource = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Project Owner",
      type: "PERSON",
      skills: [],
    });

    const created = await governance.convertToProject(actor, {
      initiativeId: init.id,
      name: "Delivery",
      ownerResourceId: ownerResource.id,
    });
    expect(created.initiativeId).toBe(init.id);
    expect(created.ownerResourceId).toBe(ownerResource.id);
    expect(created.organizationId).toBe(org.id);

    await expect(
      governance.convertToProject(actor, {
        initiativeId: init.id,
        name: "Duplicate",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const count = await db.project.count({
      where: { initiativeId: init.id },
    });
    expect(count).toBeLessThanOrEqual(1);
    expect(count).toBe(1);

    const updated = await db.initiative.findUniqueOrThrow({
      where: { id: init.id },
    });
    expect(updated.currentStage).toBe("PROJECT");
    expect(await db.poC.count({ where: { initiativeId: init.id } })).toBe(1);
    expect(await db.pilot.count({ where: { initiativeId: init.id } })).toBe(1);
  });
});

describe("CHARACTERIZATION — authorization boundaries (Phase 0C)", () => {
  it("business ownership does not grant approval.review or decision.make", async () => {
    const admin = principal();
    const { org, department } = await seedOrg(admin);
    const ownerPrincipal = principal();
    await db.principal.create({
      data: { id: ownerPrincipal.id, displayName: "Owner" },
    });
    const ownerResource = await organization.createResource(admin, {
      organizationId: org.id,
      name: "Owner",
      type: "PERSON",
      skills: [],
    });
    await organization.linkResourcePrincipal(admin, {
      resourceId: ownerResource.id,
      principalId: ownerPrincipal.id,
    });
    const init = await initiative.createInitiative(admin, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Owned",
      requesterName: "R",
      businessOwnerResourceId: ownerResource.id,
    });

    await expect(
      authz.assertCan(
        ownerPrincipal,
        PERMISSIONS.APPROVAL_REVIEW,
        { type: "ORGANIZATION", organizationId: org.id },
        { kind: "INITIATIVE_BUSINESS_OWNER", initiativeId: init.id },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      authz.assertCan(
        ownerPrincipal,
        PERMISSIONS.DECISION_MAKE,
        { type: "ORGANIZATION", organizationId: org.id },
        { kind: "INITIATIVE_BUSINESS_OWNER", initiativeId: init.id },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      authz.assertCan(
        ownerPrincipal,
        PERMISSIONS.GOVERNANCE_SUBMIT,
        { type: "ORGANIZATION", organizationId: org.id },
        { kind: "INITIATIVE_BUSINESS_OWNER", initiativeId: init.id },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("CHARACTERIZATION — audit contract", () => {
  it("records audit for submission, approval, decision, poc.created, project.converted", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);

    await governance.ensureTemplates();
    const bundle = await governance.submitPreStudyForGovernance(actor, {
      initiativeId: ready.id,
    });
    const submissionEvents = await db.auditEvent.findMany({
      where: {
        actionType: "governance.submission.created",
        actorPrincipalId: actor.id,
      },
    });
    expect(submissionEvents.length).toBeGreaterThanOrEqual(1);
    expect(submissionEvents[0]!.subjectType).toBeTruthy();

    const request = await db.approvalRequest.findFirstOrThrow({
      where: { submissionId: bundle.submission.id, status: "PENDING" },
    });
    await governance.recordApproval(actor, {
      approvalRequestId: request.id,
      outcome: "APPROVED",
      comment: "ok",
      expectedVersion: request.version,
    });
    const approvalEvents = await db.auditEvent.findMany({
      where: {
        actionType: "governance.approval.recorded",
        actorPrincipalId: actor.id,
      },
    });
    expect(approvalEvents.length).toBeGreaterThanOrEqual(1);
    expect(approvalEvents[0]!.subjectType).toBe("ApprovalRecord");

    await approveAllPending(actor, bundle.submission.id);
    const submission = await db.governanceSubmission.findUniqueOrThrow({
      where: { id: bundle.submission.id },
      include: { decisionPackage: true },
    });
    const decision = await governance.recordDecision(actor, {
      submissionId: submission.id,
      outcome: "GO",
      rationale: "Go",
      expectedPackageVersion: submission.decisionPackage!.version,
    });
    const decisionEvents = await db.auditEvent.findMany({
      where: {
        actionType: "governance.decision.recorded",
        subjectId: decision.id,
      },
    });
    expect(decisionEvents).toHaveLength(1);
    const decisionPayload = decisionEvents[0]!.payload as {
      outcome: string;
      submissionId: string;
    };
    expect(decisionPayload.outcome).toBe("GO");
    expect(decisionPayload.submissionId).toBe(submission.id);

    const poc = await governance.createPoC(actor, {
      initiativeId: ready.id,
      title: "PoC",
      objective: "o",
      hypothesis: "h",
      scope: "s",
    });
    const pocEvents = await db.auditEvent.findMany({
      where: { actionType: "poc.created", subjectId: poc.id },
    });
    expect(pocEvents).toHaveLength(1);

    await makePoCReadyForGate(actor, poc.id);
    const pocBundle = await governance.submitPoCForGovernance(actor, {
      initiativeId: ready.id,
    });
    await approveAllPending(actor, pocBundle.submission.id);
    const pocSub = await db.governanceSubmission.findUniqueOrThrow({
      where: { id: pocBundle.submission.id },
      include: { decisionPackage: true },
    });
    await governance.recordDecision(actor, {
      submissionId: pocSub.id,
      outcome: "GO",
      rationale: "Pilot",
      expectedPackageVersion: pocSub.decisionPackage!.version,
    });
    const pilot = await governance.createPilot(actor, {
      initiativeId: ready.id,
      objective: "Pilot obj",
      scope: "Plant",
      siteOrArea: "A",
      environment: "Prod-like",
      supportModel: "On-call",
      rollbackPlan: "Flag off",
      plannedEnd: new Date("2026-12-01"),
    });
    const pilotEvents = await db.auditEvent.findMany({
      where: { actionType: "pilot.created", subjectId: pilot.id },
    });
    expect(pilotEvents).toHaveLength(1);

    await advancePilotToEvaluationReady(actor, pilot.id);
    const pilotSub = await submitApprovePilotGate(actor, ready.id);
    await governance.recordDecision(actor, {
      submissionId: pilotSub.id,
      outcome: "SCALE",
      rationale: "Scale",
      expectedPackageVersion: pilotSub.decisionPackage!.version,
    });
    const project = await governance.convertToProject(actor, {
      initiativeId: ready.id,
      name: "Converted",
    });
    const convertEvents = await db.auditEvent.findMany({
      where: {
        actionType: "project.converted",
        subjectId: project.id,
      },
    });
    expect(convertEvents).toHaveLength(1);
    const convertPayload = convertEvents[0]!.payload as {
      initiativeId: string;
      referenceKey: string;
    };
    expect(convertPayload.initiativeId).toBe(ready.id);
    expect(convertPayload.referenceKey).toMatch(/^PROJ-/);
  });
});

describe("CHARACTERIZATION — assignedPrincipalId AS-IS", () => {
  it("approval requests are created with null assignedPrincipalId (unused assignee)", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    await governance.ensureTemplates();
    const bundle = await governance.submitPreStudyForGovernance(actor, {
      initiativeId: ready.id,
    });
    const requests = await db.approvalRequest.findMany({
      where: { submissionId: bundle.submission.id },
    });
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.assignedPrincipalId).toBeNull();
    }
  });
});

describe("CHARACTERIZATION — terminal outcomes leave progression closed", () => {
  it("NO_GO cancels initiative and blocks createPoC", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const ready = await makeReadyPreStudy(actor, org.id, department.id);
    const submission = await submitAndApprovePreStudy(actor, ready.id);
    await governance.recordDecision(actor, {
      submissionId: submission.id,
      outcome: "NO_GO",
      rationale: "Stop",
      expectedPackageVersion: submission.decisionPackage!.version,
    });
    const init = await db.initiative.findUniqueOrThrow({
      where: { id: ready.id },
    });
    expect(init.status).toBe("CANCELLED");
    expect(init.currentStage).toBe("PRE_STUDY");
    await expect(
      governance.createPoC(actor, {
        initiativeId: ready.id,
        title: "Should fail",
        objective: "o",
        hypothesis: "h",
        scope: "s",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
