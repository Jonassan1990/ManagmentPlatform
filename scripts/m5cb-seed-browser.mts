/**
 * M5C-B — Seed Governance / PoC / Pilot fixtures for browser QA.
 * Non-destructive upserts on management_platform_m3d_qa (Capacity Org).
 *
 * Usage:
 *   DATABASE_URL=... TEMP_AUTH_PRINCIPAL_ID=... npx tsx scripts/m5cb-seed-browser.mts
 */
import { randomUUID } from "crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, ScopeType } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import type { Principal } from "../src/modules/identity-access/domain/types";
import { GovernanceService } from "../src/modules/governance/application/governance-service";
import { InitiativeService } from "../src/modules/initiative/application/initiative-service";
import { REQUIRED_ASSESSMENT_AREAS } from "../src/modules/initiative/application/readiness-policy";
import { ROLE_KEYS } from "../src/modules/shared/permissions";
import { resetEnvCacheForTests } from "../src/server/env";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@127.0.0.1:5432/management_platform_m3d_qa?schema=public";
process.env.DATABASE_URL = dbUrl;
process.env.DIRECT_URL = process.env.DIRECT_URL ?? dbUrl;
process.env.ALLOW_DEV_AUTH = "false";
process.env.NODE_ENV = "test";
resetEnvCacheForTests();

const orgId =
  process.env.QA_ORG_ID ?? "f6b317a2-839d-413b-9aa1-2ea4e006f486";
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID ??
  "f796fe09-b948-4eb6-9fcd-0770990ab453";
const outDir =
  process.env.QA_OUT_DIR ?? path.join(process.cwd(), "artifacts/m5cb-qa");
fs.mkdirSync(outDir, { recursive: true });

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const governance = new GovernanceService(db, authz, audit);
const initiative = new InitiativeService(db, authz, audit, governance);

const actor: Principal = {
  id: principalId,
  displayName: "M5CB QA Actor",
  source: "test",
};

async function ensureActorBindings() {
  await db.principal.upsert({
    where: { id: principalId },
    create: { id: principalId, displayName: "M5CB QA Actor" },
    update: {},
  });
  const adminRole = await db.roleDefinition.findFirstOrThrow({
    where: { key: ROLE_KEYS.ORGANIZATION_ADMIN },
  });
  const existing = await db.roleBinding.findFirst({
    where: {
      principalId,
      roleDefinitionId: adminRole.id,
      organizationId: orgId,
      scopeType: ScopeType.ORGANIZATION,
      effectiveTo: null,
    },
  });
  if (!existing) {
    await db.roleBinding.create({
      data: {
        id: randomUUID(),
        principalId,
        roleDefinitionId: adminRole.id,
        scopeType: ScopeType.ORGANIZATION,
        organizationId: orgId,
      },
    });
  }
}

async function deleteInitiativeTree(initiativeId: string) {
  const gates = await db.governanceGate.findMany({
    where: { initiativeId },
    select: { id: true },
  });
  const gateIds = gates.map((g) => g.id);
  const submissions = await db.governanceSubmission.findMany({
    where: { gateId: { in: gateIds } },
    select: { id: true },
  });
  const submissionIds = submissions.map((s) => s.id);
  await db.approvalRecord.deleteMany({
    where: { request: { submissionId: { in: submissionIds } } },
  });
  await db.approvalRequest.deleteMany({
    where: { submissionId: { in: submissionIds } },
  });
  await db.evidenceEntry.deleteMany({
    where: { package: { submissionId: { in: submissionIds } } },
  });
  await db.decisionCondition.deleteMany({
    where: { decision: { submissionId: { in: submissionIds } } },
  });
  await db.decisionRecord.deleteMany({
    where: { OR: [{ submissionId: { in: submissionIds } }, { initiativeId }] },
  });
  await db.evidencePackage.deleteMany({
    where: { submissionId: { in: submissionIds } },
  });
  await db.decisionPackage.deleteMany({
    where: { submissionId: { in: submissionIds } },
  });
  await db.reviewSnapshot.deleteMany({
    where: { submissionId: { in: submissionIds } },
  });
  await db.governanceSubmission.deleteMany({
    where: { id: { in: submissionIds } },
  });
  await db.governanceGate.deleteMany({ where: { initiativeId } });
  await db.poCSuccessCriterion.deleteMany({
    where: { poc: { initiativeId } },
  });
  await db.poC.deleteMany({ where: { initiativeId } });
  await db.pilotFeedback.deleteMany({ where: { pilot: { initiativeId } } });
  await db.pilotCriterion.deleteMany({ where: { pilot: { initiativeId } } });
  await db.pilotExtension.deleteMany({ where: { pilot: { initiativeId } } });
  await db.pilot.deleteMany({ where: { initiativeId } });
  await db.projectWorkItem.deleteMany({ where: { project: { initiativeId } } });
  await db.projectMilestone.deleteMany({ where: { project: { initiativeId } } });
  await db.projectParticipatingDepartment.deleteMany({
    where: { project: { initiativeId } },
  });
  await db.projectClosure.deleteMany({ where: { project: { initiativeId } } });
  await db.project.deleteMany({ where: { initiativeId } });
  await db.requirementRelation.deleteMany({
    where: { OR: [{ from: { initiativeId } }, { to: { initiativeId } }] },
  });
  await db.acceptanceCriterion.deleteMany({
    where: { requirement: { initiativeId } },
  });
  await db.requirement.deleteMany({ where: { initiativeId } });
  await db.solutionAlternative.deleteMany({
    where: { preStudy: { initiativeId } },
  });
  await db.preStudyAssessment.deleteMany({
    where: { preStudy: { initiativeId } },
  });
  await db.preStudy.deleteMany({ where: { initiativeId } });
  await db.risk.deleteMany({ where: { initiativeId } });
  await db.lifecycleTransition.deleteMany({ where: { initiativeId } });
  await db.demand.deleteMany({ where: { initiativeId } });
  await db.initiative.delete({ where: { id: initiativeId } });
}

async function resetRef(ref: string) {
  const existing = await db.initiative.findFirst({
    where: { organizationId: orgId, referenceKey: ref },
  });
  if (existing) await deleteInitiativeTree(existing.id);
}

async function makeReadyPreStudy(
  deptId: string,
  title: string,
  ref: string,
) {
  await resetRef(ref);
  let created = await initiative.createInitiative(actor, {
    organizationId: orgId,
    departmentId: deptId,
    title,
    requesterName: "M5CB Requester",
    businessOwnerName: "M5CB Owner",
  });
  await db.initiative.update({
    where: { id: created.id },
    data: { referenceKey: ref },
  });
  const demand = await db.demand.findUniqueOrThrow({
    where: { initiativeId: created.id },
  });
  await initiative.updateDemand(actor, {
    initiativeId: created.id,
    expectedVersion: demand.version,
    problemOpportunity: "Fragmented governance review experience",
    reasonForRequest: "Need clear evidence and next actions",
    expectedValue: "Faster, clearer gate decisions",
    affectedAreas: "Portfolio operations",
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
    title: "Capture evidence package",
    description: "Structured evidence for gate review",
    category: "BUSINESS",
    status: "ACCEPTED",
    acceptanceCriteria: ["Evidence complete"],
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
    title: "Recommended path",
    description: "Proceed with controlled PoC",
    isRecommended: true,
  });
  await initiative.createRisk(actor, {
    initiativeId: created.id,
    title: "Adoption risk",
    description: "Users may resist change",
  });
  return db.initiative.findUniqueOrThrow({ where: { id: created.id } });
}

async function approveAllPending(submissionId: string) {
  const requests = await db.approvalRequest.findMany({
    where: { submissionId, status: "PENDING" },
    orderBy: { authorityKey: "asc" },
  });
  for (const request of requests) {
    await governance.recordApproval(actor, {
      approvalRequestId: request.id,
      outcome: "APPROVED",
      comment: "M5CB fixture approval",
      expectedVersion: request.version,
    });
  }
}

async function main() {
  await ensureActorBindings();
  await governance.ensureTemplates();

  const dept = await db.department.findFirstOrThrow({
    where: { section: { organizationId: orgId } },
  });

  // 1. No submission — ready to submit
  const noSubmission = await makeReadyPreStudy(
    dept.id,
    "M5CB No Submission",
    "INIT-M5CB-NOSUB",
  );

  // 2. Pending approval
  const pendingInit = await makeReadyPreStudy(
    dept.id,
    "M5CB Pending Approval",
    "INIT-M5CB-PENDING",
  );
  const pendingBundle = await governance.submitPreStudyForGovernance(actor, {
    initiativeId: pendingInit.id,
  });

  // 3. Approvals complete — decision required
  const decisionInit = await makeReadyPreStudy(
    dept.id,
    "M5CB Awaiting Decision",
    "INIT-M5CB-DECIDE",
  );
  const decideBundle = await governance.submitPreStudyForGovernance(actor, {
    initiativeId: decisionInit.id,
  });
  await approveAllPending(decideBundle.submission.id);

  // 4. Conditional GO with open condition
  const conditionalInit = await makeReadyPreStudy(
    dept.id,
    "M5CB Conditional Decision",
    "INIT-M5CB-COND",
  );
  const condBundle = await governance.submitPreStudyForGovernance(actor, {
    initiativeId: conditionalInit.id,
  });
  await approveAllPending(condBundle.submission.id);
  const condSubmission = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: condBundle.submission.id },
    include: { decisionPackage: true },
  });
  await governance.recordDecision(actor, {
    submissionId: condSubmission.id,
    outcome: "CONDITIONAL_GO",
    rationale: "Proceed after security sign-off",
    conditions: [
      {
        description: "Complete security sign-off",
        requiredBeforeProgression: true,
        ownerName: "Security lead",
      },
    ],
    expectedPackageVersion: condSubmission.decisionPackage!.version,
  });

  // 5. GO → PoC evaluation fixture
  const pocInit = await makeReadyPreStudy(
    dept.id,
    "M5CB PoC Evaluation",
    "INIT-M5CB-POC",
  );
  const pocGateBundle = await governance.submitPreStudyForGovernance(actor, {
    initiativeId: pocInit.id,
  });
  await approveAllPending(pocGateBundle.submission.id);
  const pocSubmission = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: pocGateBundle.submission.id },
    include: { decisionPackage: true },
  });
  await governance.recordDecision(actor, {
    submissionId: pocSubmission.id,
    outcome: "GO",
    rationale: "Ready for PoC",
    expectedPackageVersion: pocSubmission.decisionPackage!.version,
  });
  const poc = await governance.createPoC(actor, {
    initiativeId: pocInit.id,
    title: "M5CB PoC",
    objective: "Validate integration feasibility",
    hypothesis: "API gateway reduces latency 20%",
    scope: "One department, two systems",
    outOfScope: "Full enterprise rollout",
    ownerName: "M5CB PoC Owner",
    plannedStart: new Date("2026-01-15"),
    plannedEnd: new Date("2026-03-15"),
  });
  await governance.upsertPoCCriterion(actor, {
    pocId: poc.id,
    description: "Latency improvement",
    measurementMethod: "p95 latency sample",
    target: "20",
    unit: "%",
    required: true,
  });
  await governance.updatePoCResults(actor, {
    pocId: poc.id,
    expectedVersion: (await db.poC.findUniqueOrThrow({ where: { id: poc.id } }))
      .version,
    results: "Latency improved 18% in pilot samples",
    findings: "Recommend proceed to Pilot with monitoring",
    lessonsLearned: "Need earlier security review",
  });

  // 6. Pilot evaluation fixture (GO pre-study → PoC → GO PoC → Pilot)
  const pilotInit = await makeReadyPreStudy(
    dept.id,
    "M5CB Pilot Evaluation",
    "INIT-M5CB-PILOT",
  );
  const pilotPre = await governance.submitPreStudyForGovernance(actor, {
    initiativeId: pilotInit.id,
  });
  await approveAllPending(pilotPre.submission.id);
  const pilotPreSub = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: pilotPre.submission.id },
    include: { decisionPackage: true },
  });
  await governance.recordDecision(actor, {
    submissionId: pilotPreSub.id,
    outcome: "GO",
    rationale: "Ready for PoC then Pilot",
    expectedPackageVersion: pilotPreSub.decisionPackage!.version,
  });
  const pilotPoC = await governance.createPoC(actor, {
    initiativeId: pilotInit.id,
    title: "M5CB Pilot precursor PoC",
    objective: "Prove value before pilot",
    hypothesis: "Users adopt within 4 weeks",
    scope: "Single site",
    ownerName: "M5CB Pilot Owner",
  });
  await governance.upsertPoCCriterion(actor, {
    pocId: pilotPoC.id,
    description: "Adoption rate",
    measurementMethod: "Active users / invited",
    target: "60",
    unit: "%",
    required: true,
  });
  let pilotPoCRow = await db.poC.findUniqueOrThrow({ where: { id: pilotPoC.id } });
  // Transition PoC through statuses required for governance readiness
  for (const to of ["READY", "IN_PROGRESS", "EVALUATION", "COMPLETED"] as const) {
    pilotPoCRow = await governance.transitionPoC(actor, {
      pocId: pilotPoC.id,
      toStatus: to,
      expectedVersion: pilotPoCRow.version,
    });
  }
  const criteria = await db.poCSuccessCriterion.findMany({
    where: { pocId: pilotPoC.id },
  });
  for (const c of criteria) {
    await governance.updateCriterionEvaluation(actor, {
      criterionId: c.id,
      evaluationState: "PASS",
      actualResult: "72",
      expectedVersion: c.version,
    });
  }
  pilotPoCRow = await db.poC.findUniqueOrThrow({ where: { id: pilotPoC.id } });
  await governance.updatePoCResults(actor, {
    pocId: pilotPoC.id,
    expectedVersion: pilotPoCRow.version,
    results: "Adoption exceeded target",
    findings: "Recommend Pilot",
    lessonsLearned: "Training materials critical",
  });
  const pocGov = await governance.submitPoCForGovernance(actor, {
    initiativeId: pilotInit.id,
  });
  await approveAllPending(pocGov.submission.id);
  const pocDecSub = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: pocGov.submission.id },
    include: { decisionPackage: true },
  });
  await governance.recordDecision(actor, {
    submissionId: pocDecSub.id,
    outcome: "GO",
    rationale: "Pilot authorized",
    expectedPackageVersion: pocDecSub.decisionPackage!.version,
  });
  const pilot = await governance.createPilot(actor, {
    initiativeId: pilotInit.id,
    objective: "Validate scale readiness at one site",
    scope: "One site, 50 users",
    outOfScope: "Multi-region",
    ownerName: "M5CB Pilot Owner",
    siteOrArea: "North site",
    targetUsers: "50 operations staff",
    plannedStart: new Date("2026-04-01"),
    plannedEnd: new Date("2026-06-30"),
    estimatedCost: 25000,
    currencyCode: "EUR",
  });
  await governance.upsertPilotCriterion(actor, {
    pilotId: pilot.id,
    title: "User satisfaction",
    description: "Average CSAT across pilot users",
    category: "USER_ADOPTION",
    measurementMethod: "CSAT survey",
    target: "4.0",
    unit: "/5",
    required: true,
  });
  await governance.updatePilotResults(actor, {
    pilotId: pilot.id,
    expectedVersion: (
      await db.pilot.findUniqueOrThrow({ where: { id: pilot.id } })
    ).version,
    results: "CSAT 4.2; ops load stable",
    businessFindings: "Recommend SCALE with phased rollout",
    technicalFindings: "Gateway stable under peak",
    operationalFindings: "Support playbook needed",
    lessonsLearned: "On-site champions accelerate adoption",
  });

  const seed = {
    milestone: "M5C-B",
    organizationId: orgId,
    principalId,
    generatedAt: new Date().toISOString(),
    initiatives: {
      noSubmission: { id: noSubmission.id, referenceKey: "INIT-M5CB-NOSUB" },
      pendingApproval: {
        id: pendingInit.id,
        referenceKey: "INIT-M5CB-PENDING",
        submissionId: pendingBundle.submission.id,
      },
      awaitingDecision: {
        id: decisionInit.id,
        referenceKey: "INIT-M5CB-DECIDE",
        submissionId: decideBundle.submission.id,
      },
      conditional: {
        id: conditionalInit.id,
        referenceKey: "INIT-M5CB-COND",
      },
      poc: { id: pocInit.id, referenceKey: "INIT-M5CB-POC", pocId: poc.id },
      pilot: {
        id: pilotInit.id,
        referenceKey: "INIT-M5CB-PILOT",
        pilotId: pilot.id,
      },
    },
  };

  fs.writeFileSync(
    path.join(outDir, "seed.json"),
    JSON.stringify(seed, null, 2),
  );
  console.log(JSON.stringify(seed, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
