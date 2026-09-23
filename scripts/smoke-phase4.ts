/**
 * Phase 4 smoke: Pilot → scale decision → Project conversion happy / conditional / extend paths.
 * Fixtures only — no hardcoded business users in product code.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import { GovernanceService } from "../src/modules/governance/application/governance-service";
import { InitiativeService } from "../src/modules/initiative/application/initiative-service";
import { OrganizationService } from "../src/modules/organization/application/organization-service";
import { ProjectService } from "../src/modules/project/application/project-service";
import { REQUIRED_ASSESSMENT_AREAS } from "../src/modules/initiative/application/readiness-policy";
import { AppError } from "../src/modules/shared/errors";

type Actor = { id: string; displayName: string; source: "test" };

async function approveAll(
  governance: GovernanceService,
  db: PrismaClient,
  actor: Actor,
  submissionId: string,
) {
  const requests = await db.approvalRequest.findMany({
    where: { submissionId, status: "PENDING" },
    orderBy: { authorityKey: "asc" },
  });
  for (const request of requests) {
    await governance.recordApproval(actor, {
      approvalRequestId: request.id,
      outcome: "APPROVED",
      comment: "Smoke approval",
      expectedVersion: request.version,
    });
  }
}

async function completePreStudyToReady(
  initiativeSvc: InitiativeService,
  db: PrismaClient,
  actor: Actor,
  orgId: string,
  departmentId: string,
  title: string,
) {
  let initiative = await initiativeSvc.createInitiative(actor, {
    organizationId: orgId,
    departmentId,
    title,
    requesterName: "Requester",
    businessOwnerName: "Owner",
  });
  const demand = await db.demand.findUniqueOrThrow({
    where: { initiativeId: initiative.id },
  });
  await initiativeSvc.updateDemand(actor, {
    initiativeId: initiative.id,
    expectedVersion: demand.version,
    problemOpportunity: "Fragmented planning",
    reasonForRequest: "Need structured governance",
    expectedValue: "Faster decisions",
    affectedAreas: "All departments",
    urgency: "HIGH",
    strategicAlignment: "Portfolio clarity",
    initialImpact: "Medium operational change",
  });
  initiative = await db.initiative.findUniqueOrThrow({
    where: { id: initiative.id },
  });
  initiative = await initiativeSvc.advanceLifecycle(actor, {
    initiativeId: initiative.id,
    toStage: "REQUIREMENTS",
    expectedVersion: initiative.version,
  });
  await initiativeSvc.createRequirement(actor, {
    initiativeId: initiative.id,
    title: "Capture demand",
    description: "System captures structured demand",
    category: "BUSINESS",
    status: "ACCEPTED",
    acceptanceCriteria: ["Demand form complete"],
  });
  initiative = await db.initiative.findUniqueOrThrow({
    where: { id: initiative.id },
  });
  initiative = await initiativeSvc.advanceLifecycle(actor, {
    initiativeId: initiative.id,
    toStage: "PRE_STUDY",
    expectedVersion: initiative.version,
  });
  for (const area of REQUIRED_ASSESSMENT_AREAS) {
    await initiativeSvc.upsertAssessment(actor, {
      initiativeId: initiative.id,
      area,
      status: "COMPLETE",
      summary: "Complete",
      findings: "Findings",
      conclusion: "Proceed",
      ownerName: "Analyst",
    });
  }
  await initiativeSvc.createAlternative(actor, {
    initiativeId: initiative.id,
    title: "Extend tooling",
    description: "Improve process",
    isRecommended: true,
  });
  await initiativeSvc.createRisk(actor, {
    initiativeId: initiative.id,
    title: "Adoption",
    description: "Users may resist",
  });
  return db.initiative.findUniqueOrThrow({ where: { id: initiative.id } });
}

async function gateDecision(
  governance: GovernanceService,
  db: PrismaClient,
  actor: Actor,
  submit: () => Promise<{ submission: { id: string } }>,
  outcome:
    | "GO"
    | "SCALE"
    | "CONDITIONAL_SCALE"
    | "EXTEND_PILOT"
    | "STOP"
    | "HOLD",
  extras?: {
    conditions?: {
      description: string;
      requiredBeforeProgression: boolean;
    }[];
    extension?: { newPlannedEnd: Date; reason: string };
    rationale?: string;
  },
) {
  const bundle = await submit();
  await approveAll(governance, db, actor, bundle.submission.id);
  const submission = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: bundle.submission.id },
    include: { decisionPackage: true },
  });
  return governance.recordDecision(actor, {
    submissionId: submission.id,
    outcome,
    rationale: extras?.rationale ?? `Smoke ${outcome}`,
    conditions: extras?.conditions ?? [],
    extension: extras?.extension,
    expectedPackageVersion: submission.decisionPackage!.version,
  });
}

async function makePoCReady(
  governance: GovernanceService,
  db: PrismaClient,
  actor: Actor,
  pocId: string,
) {
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

async function makePilotReady(
  governance: GovernanceService,
  db: PrismaClient,
  actor: Actor,
  pilotId: string,
) {
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
  await governance.addPilotFeedback(actor, {
    pilotId,
    sourceType: "operator",
    summary: "Positive feedback",
    sentiment: "POSITIVE",
  });
  return db.pilot.findUniqueOrThrow({ where: { id: pilotId } });
}

async function buildThroughPilotDraft(
  governance: GovernanceService,
  initiativeSvc: InitiativeService,
  db: PrismaClient,
  actor: Actor,
  orgId: string,
  departmentId: string,
  title: string,
) {
  const ready = await completePreStudyToReady(
    initiativeSvc,
    db,
    actor,
    orgId,
    departmentId,
    title,
  );
  await gateDecision(
    governance,
    db,
    actor,
    () =>
      governance.submitPreStudyForGovernance(actor, {
        initiativeId: ready.id,
      }),
    "GO",
  );
  const poc = await governance.createPoC(actor, {
    initiativeId: ready.id,
    title: "Smoke PoC",
    objective: "Validate latency",
    hypothesis: "p95 under 200ms",
    scope: "One service",
  });
  await makePoCReady(governance, db, actor, poc.id);
  await gateDecision(
    governance,
    db,
    actor,
    () =>
      governance.submitPoCForGovernance(actor, { initiativeId: ready.id }),
    "GO",
  );
  const pilot = await governance.createPilot(actor, {
    initiativeId: ready.id,
    objective: "Prove scale readiness",
    scope: "Plant A line 2",
    siteOrArea: "Plant A",
    environment: "Production-like",
    supportModel: "On-call + L2",
    rollbackPlan: "Disable feature flag",
    plannedEnd: new Date("2026-12-01"),
  });
  return { initiativeId: ready.id, poc, pilot };
}

async function main() {
  const db = new PrismaClient();
  const authz = new AuthorizationService(db);
  const audit = new AuditService(db);
  const organization = new OrganizationService(db, authz, audit);
  const governance = new GovernanceService(db, authz, audit);
  const initiativeSvc = new InitiativeService(db, authz, audit, governance);
  const projectSvc = new ProjectService(db, authz, audit);

  const actor: Actor = {
    id: randomUUID(),
    displayName: "Phase4 Smoke Actor",
    source: "test",
  };
  await db.principal.create({
    data: { id: actor.id, displayName: actor.displayName },
  });
  await governance.ensureTemplates();

  const org = await organization.createOrganization(actor, {
    name: "Phase4 Smoke Org",
  });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section",
  });
  const department = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept",
  });

  const sections: Record<string, unknown> = {};

  // ─── Happy path → Project + milestone + work item + traceability ──────────
  console.log("\n=== HAPPY: Pilot → SCALE → Project → milestone/work item ===");
  const happy = await buildThroughPilotDraft(
    governance,
    initiativeSvc,
    db,
    actor,
    org.id,
    department.id,
    "Smoke Happy Initiative",
  );
  await makePilotReady(governance, db, actor, happy.pilot.id);
  await gateDecision(
    governance,
    db,
    actor,
    () =>
      governance.submitPilotForGovernance(actor, {
        initiativeId: happy.initiativeId,
      }),
    "SCALE",
    { rationale: "Ready to scale" },
  );
  const project = await governance.convertToProject(actor, {
    initiativeId: happy.initiativeId,
    name: "Smoke Delivery Project",
    estimatedCost: "100000.00",
    approvedBudget: "120000.00",
  });
  const milestone = await projectSvc.createMilestone(actor, {
    projectId: project.id,
    title: "Cutover",
    criticality: true,
  });
  const epic = await projectSvc.createWorkItem(actor, {
    projectId: project.id,
    type: "EPIC",
    title: "Rollout",
  });
  const task = await projectSvc.createWorkItem(actor, {
    projectId: project.id,
    type: "TASK",
    title: "Provision",
    parentId: epic.id,
  });
  const trace = await projectSvc.getTraceability(actor, happy.initiativeId);
  console.log("Happy path project", project.referenceKey);
  sections.happy = {
    initiativeId: happy.initiativeId,
    pilotId: happy.pilot.id,
    projectId: project.id,
    projectReferenceKey: project.referenceKey,
    milestoneId: milestone.id,
    workItemIds: [epic.id, task.id],
    traceability: {
      hasPoc: Boolean(trace.poc),
      hasPilot: Boolean(trace.pilot),
      hasProject: Boolean(trace.project),
      decisionOutcomes: trace.decisions.map((d) => d.outcome),
    },
  };

  // ─── CONDITIONAL_SCALE → block → resolve → convert ────────────────────────
  console.log(
    "\n=== CONDITIONAL_SCALE: block → resolve → convertToProject ===",
  );
  const conditional = await buildThroughPilotDraft(
    governance,
    initiativeSvc,
    db,
    actor,
    org.id,
    department.id,
    "Smoke Conditional Scale",
  );
  await makePilotReady(governance, db, actor, conditional.pilot.id);
  const condDecision = await gateDecision(
    governance,
    db,
    actor,
    () =>
      governance.submitPilotForGovernance(actor, {
        initiativeId: conditional.initiativeId,
      }),
    "CONDITIONAL_SCALE",
    {
      conditions: [
        {
          description: "Budget signed",
          requiredBeforeProgression: true,
        },
      ],
    },
  );

  let blockedConvert = false;
  try {
    await governance.convertToProject(actor, {
      initiativeId: conditional.initiativeId,
      name: "Should fail",
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "VALIDATION") {
      blockedConvert = true;
      console.log("convertToProject blocked by open condition");
    } else {
      throw error;
    }
  }
  if (!blockedConvert) {
    throw new Error("Expected convertToProject to fail with open condition");
  }

  await governance.resolveDecisionCondition(actor, {
    conditionId: condDecision.conditions[0]!.id,
    status: "RESOLVED",
    resolutionNote: "Budget signed",
    expectedVersion: condDecision.conditions[0]!.version,
  });
  const afterResolve = await governance.convertToProject(actor, {
    initiativeId: conditional.initiativeId,
    name: "Conditional Delivery",
  });
  console.log("convertToProject succeeded after resolve", afterResolve.id);
  sections.conditionalScale = {
    blockedThenResolved: true,
    projectId: afterResolve.id,
  };

  // ─── EXTEND_PILOT → conversion rejected → history retained ────────────────
  console.log("\n=== EXTEND_PILOT: conversion rejected, history retained ===");
  const extend = await buildThroughPilotDraft(
    governance,
    initiativeSvc,
    db,
    actor,
    org.id,
    department.id,
    "Smoke Extend Pilot",
  );
  await makePilotReady(governance, db, actor, extend.pilot.id);
  const criteriaBefore = await db.pilotCriterion.count({
    where: { pilotId: extend.pilot.id },
  });
  await gateDecision(
    governance,
    db,
    actor,
    () =>
      governance.submitPilotForGovernance(actor, {
        initiativeId: extend.initiativeId,
      }),
    "EXTEND_PILOT",
    {
      extension: {
        newPlannedEnd: new Date("2027-04-01"),
        reason: "Need more adoption samples",
      },
    },
  );

  let extendBlocked = false;
  try {
    await governance.convertToProject(actor, {
      initiativeId: extend.initiativeId,
      name: "Should fail extend",
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "VALIDATION") {
      extendBlocked = true;
      console.log("convertToProject correctly rejected after EXTEND_PILOT");
    } else {
      throw error;
    }
  }
  if (!extendBlocked) {
    throw new Error("Expected convertToProject to fail after EXTEND_PILOT");
  }

  const criteriaAfter = await db.pilotCriterion.count({
    where: { pilotId: extend.pilot.id },
  });
  const extensions = await db.pilotExtension.findMany({
    where: { pilotId: extend.pilot.id },
  });
  const initiativeAfter = await db.initiative.findUniqueOrThrow({
    where: { id: extend.initiativeId },
  });
  sections.extendPilot = {
    conversionRejected: true,
    criteriaRetained: criteriaAfter === criteriaBefore && criteriaAfter > 0,
    extensionCount: extensions.length,
    currentStage: initiativeAfter.currentStage,
  };

  const summary = {
    ok: true as const,
    sections,
  };
  console.log("\n" + JSON.stringify(summary, null, 2));

  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
