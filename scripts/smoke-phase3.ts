/**
 * Phase 3 smoke: governance + approvals + decisions + PoC happy / negative / conditional paths.
 * Fixtures only — no hardcoded business users in product code.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import { GovernanceService } from "../src/modules/governance/application/governance-service";
import { evaluatePoCReadiness } from "../src/modules/governance/application/poc-readiness-policy";
import { InitiativeService } from "../src/modules/initiative/application/initiative-service";
import { OrganizationService } from "../src/modules/organization/application/organization-service";
import { REQUIRED_ASSESSMENT_AREAS } from "../src/modules/initiative/application/readiness-policy";
import { AppError } from "../src/modules/shared/errors";

async function approveAll(
  governance: GovernanceService,
  db: PrismaClient,
  actor: { id: string; displayName: string; source: "test" },
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
  actor: { id: string; displayName: string; source: "test" },
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
    title: "Extend current tooling",
    description: "Improve existing process with platform",
    isRecommended: true,
  });
  await initiativeSvc.createRisk(actor, {
    initiativeId: initiative.id,
    title: "Change fatigue",
    description: "Teams may resist new process",
  });
  return db.initiative.findUniqueOrThrow({ where: { id: initiative.id } });
}

async function main() {
  const db = new PrismaClient();
  const authz = new AuthorizationService(db);
  const audit = new AuditService(db);
  const organization = new OrganizationService(db, authz, audit);
  const governance = new GovernanceService(db, authz, audit);
  const initiativeSvc = new InitiativeService(db, authz, audit, governance);

  const sections: Record<string, unknown> = {};

  // ─── HAPPY PATH ───────────────────────────────────────────────────────────
  console.log("\n=== HAPPY PATH ===");
  const happyId = randomUUID();
  await db.principal.create({ data: { id: happyId, displayName: "Smoke P3" } });
  const actor = { id: happyId, displayName: "Smoke P3", source: "test" as const };

  const org = await organization.createOrganization(actor, {
    name: `Smoke Org ${happyId.slice(0, 8)}`,
  });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Smoke Section",
  });
  const department = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Smoke Dept",
  });

  const initiative = await completePreStudyToReady(
    initiativeSvc,
    db,
    actor,
    org.id,
    department.id,
    "Smoke Happy Initiative",
  );
  const workspaceReady = await initiativeSvc.getInitiativeWorkspace(
    actor,
    initiative.id,
  );
  if (!workspaceReady.readiness?.ready) {
    throw new Error("Expected pre-study readiness before governance submit");
  }
  console.log("READY for governance");

  await governance.ensureTemplates();
  const submitted = await governance.submitPreStudyForGovernance(actor, {
    initiativeId: initiative.id,
  });
  console.log("Submitted pre-study governance", submitted.submission.id);
  await approveAll(governance, db, actor, submitted.submission.id);
  const approved = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: submitted.submission.id },
    include: { decisionPackage: true },
  });
  if (approved.status !== "APPROVALS_COMPLETE") {
    throw new Error(`Expected APPROVALS_COMPLETE, got ${approved.status}`);
  }
  console.log("Approvals complete");

  await governance.recordDecision(actor, {
    submissionId: approved.id,
    outcome: "GO",
    rationale: "Evidence supports proceeding to PoC",
    expectedPackageVersion: approved.decisionPackage!.version,
  });
  console.log("Decision GO recorded");

  let poc = await governance.createPoC(actor, {
    initiativeId: initiative.id,
    title: "Smoke PoC",
    objective: "Validate governance path",
    hypothesis: "Managers can walk Demand→PoC decision",
    scope: "One department smoke path",
  });
  console.log("PoC created", poc.id);

  const criterion = await governance.upsertPoCCriterion(actor, {
    pocId: poc.id,
    description: "Cycle-time improvement observed",
    measurementMethod: "Before/after timing",
    target: ">=20% faster",
    required: true,
  });

  for (const toStatus of ["READY", "IN_PROGRESS"] as const) {
    poc = await governance.transitionPoC(actor, {
      pocId: poc.id,
      toStatus,
      expectedVersion: poc.version,
    });
  }
  poc = await governance.updatePoCResults(actor, {
    pocId: poc.id,
    results: "Observed 25% faster intake",
    findings: "Hypothesis held under smoke conditions",
    expectedVersion: poc.version,
  });
  poc = await governance.transitionPoC(actor, {
    pocId: poc.id,
    toStatus: "EVALUATION",
    expectedVersion: poc.version,
  });
  await governance.updateCriterionEvaluation(actor, {
    criterionId: criterion.id,
    evaluationState: "PASS",
    actualResult: "25%",
    expectedVersion: criterion.version,
  });
  poc = await governance.transitionPoC(actor, {
    pocId: poc.id,
    toStatus: "COMPLETED",
    expectedVersion: poc.version,
  });

  const criteria = await db.poCSuccessCriterion.findMany({
    where: { pocId: poc.id },
  });
  const pocReadiness = evaluatePoCReadiness(poc, criteria);
  if (!pocReadiness.ready) {
    throw new Error(
      `Expected PoC readiness after COMPLETED: ${pocReadiness.blockers.join("; ")}`,
    );
  }
  console.log("READY FOR PoC DECISION", pocReadiness);

  const pocSubmitted = await governance.submitPoCForGovernance(actor, {
    initiativeId: initiative.id,
    notes: "Optional PoC gate submit",
  });
  console.log("PoC gate submitted", pocSubmitted.submission.id);

  sections.happy = {
    initiativeId: initiative.id,
    stage: (await db.initiative.findUniqueOrThrow({ where: { id: initiative.id } }))
      .currentStage,
    pocStatus: poc.status,
    pocReady: pocReadiness.ready,
    pocSubmissionId: pocSubmitted.submission.id,
  };

  // ─── NEGATIVE: not ready ──────────────────────────────────────────────────
  console.log("\n=== NEGATIVE: incomplete pre-study submit fails ===");
  const negId = randomUUID();
  await db.principal.create({ data: { id: negId, displayName: "Smoke Neg" } });
  const negActor = { id: negId, displayName: "Smoke Neg", source: "test" as const };
  // Reuse same empty-org bootstrap path: create a second org after first exists requires bootstrap or admin.
  // Grant via creating org while no orgs would fail — actor needs bootstrap. Use happy actor org instead.
  let incomplete = await initiativeSvc.createInitiative(actor, {
    organizationId: org.id,
    departmentId: department.id,
    title: "Incomplete Smoke",
    requesterName: "R",
    businessOwnerName: "O",
  });
  const incompleteDemand = await db.demand.findUniqueOrThrow({
    where: { initiativeId: incomplete.id },
  });
  await initiativeSvc.updateDemand(actor, {
    initiativeId: incomplete.id,
    expectedVersion: incompleteDemand.version,
    problemOpportunity: "P",
    reasonForRequest: "R",
    expectedValue: "V",
    affectedAreas: "A",
    urgency: "LOW",
    strategicAlignment: "S",
    initialImpact: "I",
  });
  incomplete = await db.initiative.findUniqueOrThrow({
    where: { id: incomplete.id },
  });
  incomplete = await initiativeSvc.advanceLifecycle(actor, {
    initiativeId: incomplete.id,
    toStage: "REQUIREMENTS",
    expectedVersion: incomplete.version,
  });
  await initiativeSvc.createRequirement(actor, {
    initiativeId: incomplete.id,
    title: "Only req",
    description: "Desc",
    category: "BUSINESS",
    status: "ACCEPTED",
    acceptanceCriteria: [],
  });
  incomplete = await db.initiative.findUniqueOrThrow({
    where: { id: incomplete.id },
  });
  await initiativeSvc.advanceLifecycle(actor, {
    initiativeId: incomplete.id,
    toStage: "PRE_STUDY",
    expectedVersion: incomplete.version,
  });

  let negativeOk = false;
  try {
    await governance.submitPreStudyForGovernance(actor, {
      initiativeId: incomplete.id,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "VALIDATION") {
      negativeOk = true;
      console.log("Submit correctly rejected:", error.message);
      sections.negative = {
        rejected: true,
        code: error.code,
        blockers: (error.details as { blockers?: string[] } | undefined)?.blockers,
      };
    } else {
      throw error;
    }
  }
  if (!negativeOk) throw new Error("Expected incomplete submit to fail");
  void negActor;

  // ─── CONDITIONAL GO blocking path ─────────────────────────────────────────
  console.log("\n=== CONDITIONAL GO: blocking condition → resolve → createPoC ===");
  const conditional = await completePreStudyToReady(
    initiativeSvc,
    db,
    actor,
    org.id,
    department.id,
    "Smoke Conditional Initiative",
  );
  const condSubmitted = await governance.submitPreStudyForGovernance(actor, {
    initiativeId: conditional.id,
  });
  await approveAll(governance, db, actor, condSubmitted.submission.id);
  const condApproved = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: condSubmitted.submission.id },
    include: { decisionPackage: true },
  });
  const decision = await governance.recordDecision(actor, {
    submissionId: condApproved.id,
    outcome: "CONDITIONAL_GO",
    rationale: "Proceed after security sign-off",
    conditions: [
      {
        description: "Security review signed",
        requiredBeforeProgression: true,
      },
    ],
    expectedPackageVersion: condApproved.decisionPackage!.version,
  });

  let blockedCreate = false;
  try {
    await governance.createPoC(actor, {
      initiativeId: conditional.id,
      title: "Should fail",
      objective: "o",
      hypothesis: "h",
      scope: "s",
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "VALIDATION") {
      blockedCreate = true;
      console.log("createPoC blocked by open condition");
    } else {
      throw error;
    }
  }
  if (!blockedCreate) throw new Error("Expected createPoC to fail with open condition");

  await governance.resolveDecisionCondition(actor, {
    conditionId: decision.conditions[0].id,
    status: "RESOLVED",
    resolutionNote: "Security signed",
    expectedVersion: decision.conditions[0].version,
  });
  const afterResolve = await governance.createPoC(actor, {
    initiativeId: conditional.id,
    title: "Conditional PoC",
    objective: "Validate after condition",
    hypothesis: "Still holds",
    scope: "Limited",
  });
  console.log("createPoC succeeded after resolve", afterResolve.id);
  sections.conditional = {
    blockedThenResolved: true,
    pocId: afterResolve.id,
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
