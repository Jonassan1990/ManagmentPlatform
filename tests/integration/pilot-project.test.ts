import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { evaluatePilotGovernanceReadiness } from "@/modules/governance/application/pilot-readiness-policy";
import { GovernanceService } from "@/modules/governance/application/governance-service";
import { InitiativeService } from "@/modules/initiative/application/initiative-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { ProjectService } from "@/modules/project/application/project-service";
import { REQUIRED_ASSESSMENT_AREAS } from "@/modules/initiative/application/readiness-policy";
import { AppError } from "@/modules/shared/errors";
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
const governance = new GovernanceService(db, authz, audit);
const initiative = new InitiativeService(db, authz, audit, governance);
const project = new ProjectService(db, authz, audit);

function principal(id = randomUUID()): Principal {
  return { id, displayName: "Test", source: "test" };
}

async function resetDb() {
  await db.auditEvent.deleteMany();
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
  await db.principal.deleteMany();
  await db.roleDefinition.deleteMany();
}

async function seedOrg(actor: Principal, name = "Org P4") {
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
  title = "Phase4 ready",
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
    include: { decisionPackage: true },
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

/**
 * Build through PoC GO then createPilot — speeds Phase 4 scenarios.
 */
async function buildThroughPoCGoThenCreatePilot(
  actor: Principal,
  opts?: { title?: string; orgName?: string },
) {
  const { org, department } = await seedOrg(actor, opts?.orgName ?? "Org P4");
  const ready = await makeReadyPreStudy(
    actor,
    org.id,
    department.id,
    opts?.title ?? "Pilot path",
  );
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
    objective: "Prove scale readiness in one plant",
    scope: "Plant A line 2",
    siteOrArea: "Plant A",
    environment: "Production-like",
    supportModel: "On-call + L2",
    rollbackPlan: "Disable feature flag",
    plannedEnd: new Date("2026-12-01"),
  });
  const initiativeRow = await db.initiative.findUniqueOrThrow({
    where: { id: ready.id },
  });
  return { org, department, initiative: initiativeRow, poc, pilot };
}

async function completePilotDefinition(actor: Principal, pilotId: string) {
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
  // Ensure operational fields present (createPilot already set them)
  current = await governance.updatePilot(actor, {
    pilotId,
    objective: current.objective,
    scope: current.scope,
    siteOrArea: current.siteOrArea ?? "Plant A",
    environment: current.environment ?? "Production-like",
    supportModel: current.supportModel ?? "On-call + L2",
    rollbackPlan: current.rollbackPlan ?? "Disable feature flag",
    expectedVersion: current.version,
  });
  return { criterion, pilot: current };
}

async function advancePilotToEvaluationReady(actor: Principal, pilotId: string) {
  const { criterion } = await completePilotDefinition(actor, pilotId);
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
    technicalFindings: "Stable under load",
    operationalFindings: "Support model held",
    expectedVersion: current.version,
  });
  await governance.evaluatePilotCriterion(actor, {
    criterionId: criterion.id,
    evaluationState: "PASS",
    actualResult: "78%",
    expectedVersion: criterion.version,
  });
  return db.pilot.findUniqueOrThrow({
    where: { id: pilotId },
    include: { criteria: true },
  });
}

async function submitApprovePilotGate(actor: Principal, initiativeId: string) {
  const bundle = await governance.submitPilotForGovernance(actor, {
    initiativeId,
  });
  await approveAllPending(actor, bundle.submission.id);
  return db.governanceSubmission.findUniqueOrThrow({
    where: { id: bundle.submission.id },
    include: { decisionPackage: true, approvalRequests: true },
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

describe("PILOT PROGRESSION", () => {
  it("GO permits createPilot and stage→PILOT", async () => {
    const actor = principal();
    const { initiative: init, pilot } = await buildThroughPoCGoThenCreatePilot(
      actor,
    );
    expect(pilot.status).toBe("DRAFT");
    const updated = await db.initiative.findUniqueOrThrow({
      where: { id: init.id },
    });
    expect(updated.currentStage).toBe("PILOT");
  });

  it("Conditional GO blocks createPilot until condition resolved", async () => {
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
    const decision = await governance.recordDecision(actor, {
      submissionId: pocSub.id,
      outcome: "CONDITIONAL_GO",
      rationale: "Need ops sign-off",
      conditions: [
        {
          description: "Ops readiness signed",
          requiredBeforeProgression: true,
        },
      ],
      expectedPackageVersion: pocSub.decisionPackage!.version,
    });

    await expect(
      governance.createPilot(actor, {
        initiativeId: ready.id,
        objective: "Should fail",
        scope: "s",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await governance.resolveDecisionCondition(actor, {
      conditionId: decision.conditions[0]!.id,
      status: "RESOLVED",
      resolutionNote: "Signed",
      expectedVersion: decision.conditions[0]!.version,
    });

    const pilot = await governance.createPilot(actor, {
      initiativeId: ready.id,
      objective: "After resolve",
      scope: "Plant A",
      siteOrArea: "Plant A",
      environment: "prod-like",
      supportModel: "L2",
      rollbackPlan: "flag",
    });
    expect(pilot.id).toBeTruthy();
  });

  it("NO_GO / HOLD block createPilot", async () => {
    for (const outcome of ["NO_GO", "HOLD"] as const) {
      await resetDb();
      const actor = principal();
      const { org, department } = await seedOrg(actor, `Org ${outcome}`);
      const ready = await makeReadyPreStudy(
        actor,
        org.id,
        department.id,
        outcome,
      );
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
        outcome,
        rationale: outcome,
        expectedPackageVersion: pocSub.decisionPackage!.version,
      });
      await expect(
        governance.createPilot(actor, {
          initiativeId: ready.id,
          objective: "blocked",
          scope: "s",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    }
  });
});

describe("PILOT", () => {
  it("create validation, start readiness, transitions, invalid transition", async () => {
    const actor = principal();
    const { pilot } = await buildThroughPoCGoThenCreatePilot(actor);

    await expect(
      governance.createPilot(actor, {
        initiativeId: pilot.initiativeId,
        objective: "dup",
        scope: "s",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      governance.transitionPilot(actor, {
        pilotId: pilot.id,
        toStatus: "READY",
        expectedVersion: pilot.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const { criterion } = await completePilotDefinition(actor, pilot.id);
    let current = await db.pilot.findUniqueOrThrow({ where: { id: pilot.id } });
    current = await governance.transitionPilot(actor, {
      pilotId: pilot.id,
      toStatus: "READY",
      expectedVersion: current.version,
    });
    expect(current.status).toBe("READY");

    await expect(
      governance.transitionPilot(actor, {
        pilotId: pilot.id,
        toStatus: "EVALUATION",
        expectedVersion: current.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    current = await governance.transitionPilot(actor, {
      pilotId: pilot.id,
      toStatus: "IN_PROGRESS",
      expectedVersion: current.version,
    });
    expect(current.status).toBe("IN_PROGRESS");
    expect(criterion.id).toBeTruthy();
  });

  it("criteria, results, feedback, governance readiness", async () => {
    const actor = principal();
    const { pilot } = await buildThroughPoCGoThenCreatePilot(actor);
    const ready = await advancePilotToEvaluationReady(actor, pilot.id);
    expect(
      evaluatePilotGovernanceReadiness(ready, ready.criteria).ready,
    ).toBe(true);

    const feedback = await governance.addPilotFeedback(actor, {
      pilotId: pilot.id,
      sourceType: "operator",
      summary: "Easy to use",
      sentiment: "POSITIVE",
    });
    expect(feedback.summary).toBe("Easy to use");

    const incomplete = evaluatePilotGovernanceReadiness(
      { ...ready, results: null },
      ready.criteria,
    );
    expect(incomplete.ready).toBe(false);
  });
});

describe("PILOT GOVERNANCE", () => {
  it("submit when ready → snapshot → approval → decision", async () => {
    const actor = principal();
    const { initiative: init, pilot } =
      await buildThroughPoCGoThenCreatePilot(actor);
    await advancePilotToEvaluationReady(actor, pilot.id);

    const bundle = await governance.submitPilotForGovernance(actor, {
      initiativeId: init.id,
    });
    expect(bundle.submission.status).toBe("IN_REVIEW");
    expect(bundle.snapshot.id).toBeTruthy();
    expect(bundle.approvalRequests.length).toBeGreaterThan(0);

    await approveAllPending(actor, bundle.submission.id);
    const approved = await db.governanceSubmission.findUniqueOrThrow({
      where: { id: bundle.submission.id },
      include: { decisionPackage: true },
    });
    expect(approved.status).toBe("APPROVALS_COMPLETE");

    const decision = await governance.recordDecision(actor, {
      submissionId: approved.id,
      outcome: "SCALE",
      rationale: "Scale to project",
      recommendationText: "Prefer phased rollout",
      expectedPackageVersion: approved.decisionPackage!.version,
    });
    expect(decision.outcome).toBe("SCALE");
    expect(decision.recommendationText).toBe("Prefer phased rollout");
  });
});

describe("SCALE DECISION", () => {
  async function readyForScaleDecision(actor: Principal) {
    const ctx = await buildThroughPoCGoThenCreatePilot(actor);
    await advancePilotToEvaluationReady(actor, ctx.pilot.id);
    const sub = await submitApprovePilotGate(actor, ctx.initiative.id);
    return { ...ctx, sub };
  }

  it("SCALE / EXTEND_PILOT / CONDITIONAL_SCALE / STOP / HOLD; recommendation separate", async () => {
    const outcomes = [
      "SCALE",
      "EXTEND_PILOT",
      "CONDITIONAL_SCALE",
      "STOP",
      "HOLD",
    ] as const;

    for (const outcome of outcomes) {
      await resetDb();
      const actor = principal();
      const { sub, initiative: init, pilot } =
        await readyForScaleDecision(actor);

      const decision = await governance.recordDecision(actor, {
        submissionId: sub.id,
        outcome,
        rationale: `Decide ${outcome}`,
        recommendationText: "Recommendation stays informational",
        conditions:
          outcome === "CONDITIONAL_SCALE"
            ? [
                {
                  description: "Budget approved",
                  requiredBeforeProgression: true,
                },
              ]
            : [],
        extension:
          outcome === "EXTEND_PILOT"
            ? {
                newPlannedEnd: new Date("2027-03-01"),
                reason: "Need more adoption data",
              }
            : undefined,
        expectedPackageVersion: sub.decisionPackage!.version,
      });

      expect(decision.outcome).toBe(outcome);
      expect(decision.recommendationText).toBe(
        "Recommendation stays informational",
      );

      const updated = await db.initiative.findUniqueOrThrow({
        where: { id: init.id },
      });
      if (outcome === "STOP") expect(updated.status).toBe("CANCELLED");
      if (outcome === "HOLD") expect(updated.status).toBe("ON_HOLD");
      if (outcome === "EXTEND_PILOT") {
        expect(updated.currentStage).toBe("PILOT");
        const extensions = await db.pilotExtension.findMany({
          where: { pilotId: pilot.id },
        });
        expect(extensions).toHaveLength(1);
        const refreshed = await db.pilot.findUniqueOrThrow({
          where: { id: pilot.id },
        });
        expect(refreshed.plannedEnd?.toISOString()).toContain("2027-03-01");
      }
    }
  });
});

describe("PROJECT CONVERSION", () => {
  it("SCALE permits convert; same Initiative; duplicate CONFLICT; traceability", async () => {
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

    const created = await governance.convertToProject(actor, {
      initiativeId: init.id,
      name: "Delivery project",
      estimatedCost: "100000.50",
      approvedBudget: "120000.00",
    });
    expect(created.initiativeId).toBe(init.id);
    expect(created.organizationId).toBe(org.id);
    expect(created.referenceKey).toMatch(/^PROJ-/);

    const updated = await db.initiative.findUniqueOrThrow({
      where: { id: init.id },
    });
    expect(updated.currentStage).toBe("PROJECT");

    await expect(
      governance.convertToProject(actor, {
        initiativeId: init.id,
        name: "Duplicate",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const trace = await project.getTraceability(actor, init.id);
    expect(trace.poc?.id).toBeTruthy();
    expect(trace.pilot?.id).toBe(pilot.id);
    expect(trace.project?.id).toBe(created.id);
    expect(trace.decisions.some((d) => d.outcome === "SCALE")).toBe(true);
  });

  it("blocking CONDITIONAL_SCALE prevents convert until resolved", async () => {
    const actor = principal();
    const { initiative: init, pilot } =
      await buildThroughPoCGoThenCreatePilot(actor);
    await advancePilotToEvaluationReady(actor, pilot.id);
    const sub = await submitApprovePilotGate(actor, init.id);
    const decision = await governance.recordDecision(actor, {
      submissionId: sub.id,
      outcome: "CONDITIONAL_SCALE",
      rationale: "After budget",
      conditions: [
        {
          description: "Budget signed",
          requiredBeforeProgression: true,
        },
      ],
      expectedPackageVersion: sub.decisionPackage!.version,
    });

    await expect(
      governance.convertToProject(actor, {
        initiativeId: init.id,
        name: "Blocked",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await governance.resolveDecisionCondition(actor, {
      conditionId: decision.conditions[0]!.id,
      status: "RESOLVED",
      resolutionNote: "Budget signed",
      expectedVersion: decision.conditions[0]!.version,
    });

    const created = await governance.convertToProject(actor, {
      initiativeId: init.id,
      name: "Unblocked project",
    });
    expect(created.id).toBeTruthy();
  });

  it("STOP / HOLD / EXTEND_PILOT prevent conversion", async () => {
    for (const outcome of ["STOP", "HOLD", "EXTEND_PILOT"] as const) {
      await resetDb();
      const actor = principal();
      const { initiative: init, pilot } =
        await buildThroughPoCGoThenCreatePilot(actor, {
          title: outcome,
        });
      await advancePilotToEvaluationReady(actor, pilot.id);
      const sub = await submitApprovePilotGate(actor, init.id);
      await governance.recordDecision(actor, {
        submissionId: sub.id,
        outcome,
        rationale: outcome,
        extension:
          outcome === "EXTEND_PILOT"
            ? {
                newPlannedEnd: new Date("2027-06-01"),
                reason: "More time",
              }
            : undefined,
        expectedPackageVersion: sub.decisionPackage!.version,
      });

      await expect(
        governance.convertToProject(actor, {
          initiativeId: init.id,
          name: "Should fail",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION" });

      if (outcome === "EXTEND_PILOT") {
        const criteria = await db.pilotCriterion.findMany({
          where: { pilotId: pilot.id },
        });
        expect(criteria.length).toBeGreaterThan(0);
        const extensions = await db.pilotExtension.findMany({
          where: { pilotId: pilot.id },
        });
        expect(extensions).toHaveLength(1);
      }
    }
  });
});

describe("PROJECT", () => {
  async function projectFromScale(actor: Principal) {
    const ctx = await buildThroughPoCGoThenCreatePilot(actor);
    await advancePilotToEvaluationReady(actor, ctx.pilot.id);
    const sub = await submitApprovePilotGate(actor, ctx.initiative.id);
    await governance.recordDecision(actor, {
      submissionId: sub.id,
      outcome: "SCALE",
      rationale: "Scale",
      expectedPackageVersion: sub.decisionPackage!.version,
    });
    const created = await governance.convertToProject(actor, {
      initiativeId: ctx.initiative.id,
      name: "Managed project",
      estimatedCost: "50000.25",
      approvedBudget: "60000.00",
    });
    return { ...ctx, project: created };
  }

  it("update, stale update, Decimal budget, milestone, work item hierarchy", async () => {
    const actor = principal();
    const { project: proj } = await projectFromScale(actor);

    const updated = await project.updateProject(actor, {
      projectId: proj.id,
      name: "Managed project v2",
      status: "ACTIVE",
      priority: "HIGH",
      objectives: "Deliver at scale",
      expectedVersion: proj.version,
    });
    expect(updated.name).toBe("Managed project v2");
    expect(updated.priority).toBe("HIGH");

    await expect(
      project.updateProject(actor, {
        projectId: proj.id,
        name: "Stale",
        status: "ACTIVE",
        priority: "LOW",
        expectedVersion: proj.version,
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });

    const budgeted = await project.updateBudget(actor, {
      projectId: proj.id,
      estimatedCost: "50000.25",
      approvedBudget: "60000.00",
      plannedCost: "55000.10",
      forecastCost: "58000.00",
      actualCost: "12000.50",
      expectedVersion: updated.version,
    });
    expect(budgeted.estimatedCost?.toString()).toBe("50000.25");
    expect(budgeted.approvedBudget?.toString()).toBe("60000");
    expect(budgeted.plannedCost?.toString()).toBe("55000.1");
    expect(budgeted.actualCost?.toString()).toBe("12000.5");

    const milestone = await project.createMilestone(actor, {
      projectId: proj.id,
      title: "Cutover",
      criticality: true,
    });
    expect(milestone.referenceKey).toMatch(/^MS-/);

    const epic = await project.createWorkItem(actor, {
      projectId: proj.id,
      type: "EPIC",
      title: "Platform rollout",
    });
    const feature = await project.createWorkItem(actor, {
      projectId: proj.id,
      type: "FEATURE",
      title: "Plant onboarding",
      parentId: epic.id,
    });
    const task = await project.createWorkItem(actor, {
      projectId: proj.id,
      type: "TASK",
      title: "Provision access",
      parentId: feature.id,
      estimateHours: "8.5",
    });
    expect(feature.parentId).toBe(epic.id);
    expect(task.parentId).toBe(feature.id);
    expect(task.estimateHours?.toString()).toBe("8.5");
  });
});

describe("POLICY ADMIN", () => {
  it("authorized update; unauthorized rejected; historical submission unaffected", async () => {
    const actor = principal();
    const { org, initiative: init, pilot } =
      await buildThroughPoCGoThenCreatePilot(actor);
    await advancePilotToEvaluationReady(actor, pilot.id);

    const bundle = await governance.submitPilotForGovernance(actor, {
      initiativeId: init.id,
    });
    const originalRequests = await db.approvalRequest.findMany({
      where: { submissionId: bundle.submission.id },
      orderBy: { authorityKey: "asc" },
    });
    expect(originalRequests.length).toBeGreaterThan(0);
    const snapshotAuthorities = originalRequests.map((r) => ({
      authorityKey: r.authorityKey,
      requiredPermission: r.requiredPermission,
      label: r.label,
    }));

    const templates = await governance.listApprovalTemplates(
      actor,
      "PILOT_GATE",
    );
    const business = templates.find((t) => t.authorityKey === "business");
    expect(business).toBeTruthy();

    const stranger = principal();
    await db.principal.create({
      data: { id: stranger.id, displayName: "Stranger" },
    });
    await expect(
      governance.updateApprovalTemplate(stranger, {
        id: business!.id,
        active: true,
        required: true,
        authorityKey: "business",
        requiredPermission: "approval.authority.business",
        label: "Hacked Business",
        sortOrder: 0,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const updated = await governance.updateApprovalTemplate(actor, {
      id: business!.id,
      active: true,
      required: true,
      authorityKey: "business",
      requiredPermission: "approval.authority.business",
      label: "Business Sponsor (v2)",
      sortOrder: 0,
    });
    expect(updated.policyVersion).toBeGreaterThan(business!.policyVersion);
    expect(updated.label).toBe("Business Sponsor (v2)");

    const historical = await db.approvalRequest.findMany({
      where: { submissionId: bundle.submission.id },
      orderBy: { authorityKey: "asc" },
    });
    expect(
      historical.map((r) => ({
        authorityKey: r.authorityKey,
        requiredPermission: r.requiredPermission,
        label: r.label,
      })),
    ).toEqual(snapshotAuthorities);

    void org;
  });
});

describe("AUTH", () => {
  it("capabilities helper; unauthorized mutation rejected", async () => {
    const actor = principal();
    const { org, pilot } = await buildThroughPoCGoThenCreatePilot(actor);

    const caps = await governance.getPrincipalCapabilities(actor, org.id);
    expect(caps.canCreatePilot).toBe(true);
    expect(caps.canConvertProject).toBe(true);
    expect(caps.canManageGovernancePolicy).toBe(true);
    expect(caps.canEditProject).toBe(true);

    const stranger = principal();
    await db.principal.create({
      data: { id: stranger.id, displayName: "No roles" },
    });
    await expect(
      governance.updatePilot(stranger, {
        pilotId: pilot.id,
        objective: "hack",
        scope: "hack",
        expectedVersion: pilot.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("SECURITY", () => {
  it("cross-org access rejected", async () => {
    const actorA = principal();
    const { pilot } = await buildThroughPoCGoThenCreatePilot(actorA, {
      orgName: "Org A",
    });

    const actorB = principal();
    await db.principal.create({
      data: { id: actorB.id, displayName: "Actor B" },
    });
    // actorA retains platform bootstrap and can create a second org; grant B admin there only
    const orgB = await organization.createOrganization(actorA, { name: "Org B" });
    await authz.grantOrganizationAdmin(actorB.id, orgB.id);

    await expect(
      governance.updatePilot(actorB, {
        pilotId: pilot.id,
        objective: "cross",
        scope: "cross",
        expectedVersion: pilot.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      project.getTraceability(actorB, pilot.initiativeId),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("CONCURRENCY", () => {
  it("duplicate convertToProject yields CONFLICT", async () => {
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

    const input = {
      initiativeId: init.id,
      name: "Concurrent project",
    };
    const results = await Promise.allSettled([
      governance.convertToProject(actor, input),
      governance.convertToProject(actor, input),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const err = (rejected[0] as PromiseRejectedResult).reason;
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("CONFLICT");
  });
});
