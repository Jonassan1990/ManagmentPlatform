/**
 * Phase 5.5 acceptance E2E journey (service-level, real Postgres).
 *
 * Org → structure → Initiative → Demand → Reqs → Pre-study ready →
 * Governance → Approvals → GO → PoC → evaluate → PoC gate → GO →
 * Pilot → evaluate → Pilot gate → SCALE → Project → budget/milestone/work →
 * PI → iterations → participate → capacity → allocate → overload → resolve →
 * cross-dept dependency timing → resolve → REVIEW → baseline →
 * modify plan → baseline unchanged + changes-since.
 *
 * Fixtures only — no runtime app mocks. DATABASE_URL from env
 * (default: acceptance DB).
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../src/modules/audit/application/audit-service";
import { AuthorizationService } from "../src/modules/identity-access/application/authorization-service";
import { GovernanceService } from "../src/modules/governance/application/governance-service";
import { InitiativeService } from "../src/modules/initiative/application/initiative-service";
import { OrganizationService } from "../src/modules/organization/application/organization-service";
import { PlanningService } from "../src/modules/pi-planning/application/planning-service";
import type { BaselinePayload } from "../src/modules/pi-planning/application/baseline-snapshot";
import { ProjectService } from "../src/modules/project/application/project-service";
import { REQUIRED_ASSESSMENT_AREAS } from "../src/modules/initiative/application/readiness-policy";

type Actor = { id: string; displayName: string; source: "test" };

const DEFAULT_ACCEPTANCE_URL =
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform_acceptance?schema=public";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_ACCEPTANCE_URL;
}

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
  if (requests.length === 0) {
    throw new Error(`No pending approvals for submission ${submissionId}`);
  }
  for (const request of requests) {
    await governance.recordApproval(actor, {
      approvalRequestId: request.id,
      outcome: "APPROVED",
      comment: "Acceptance approval",
      expectedVersion: request.version,
    });
  }
}

async function gateDecision(
  governance: GovernanceService,
  db: PrismaClient,
  actor: Actor,
  submit: () => Promise<{ submission: { id: string } }>,
  outcome: "GO" | "SCALE",
  rationale: string,
) {
  const bundle = await submit();
  await approveAll(governance, db, actor, bundle.submission.id);
  const submission = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: bundle.submission.id },
    include: { decisionPackage: true },
  });
  if (submission.status !== "APPROVALS_COMPLETE") {
    throw new Error(
      `Expected APPROVALS_COMPLETE, got ${submission.status} for ${bundle.submission.id}`,
    );
  }
  return governance.recordDecision(actor, {
    submissionId: submission.id,
    outcome,
    rationale,
    conditions: [],
    expectedPackageVersion: submission.decisionPackage!.version,
  });
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
    problemOpportunity: "Fragmented planning across departments",
    reasonForRequest: "Need structured lifecycle and PI capacity",
    expectedValue: "Faster governed decisions with visible capacity",
    affectedAreas: "Platform and Operations",
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
    title: "Capture structured demand",
    description: "System captures demand fields used for governance",
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
    title: "Extend tooling with platform",
    description: "Improve process via governed platform path",
    isRecommended: true,
  });
  await initiativeSvc.createRisk(actor, {
    initiativeId: initiative.id,
    title: "Adoption risk",
    description: "Teams may resist new planning process",
  });
  const workspace = await initiativeSvc.getInitiativeWorkspace(
    actor,
    initiative.id,
  );
  if (!workspace.readiness?.ready) {
    throw new Error(
      `Pre-study not ready: ${workspace.readiness?.blockers?.join("; ") ?? "unknown"}`,
    );
  }
  return db.initiative.findUniqueOrThrow({ where: { id: initiative.id } });
}

async function makePoCReady(
  governance: GovernanceService,
  db: PrismaClient,
  actor: Actor,
  pocId: string,
) {
  const criterion = await governance.upsertPoCCriterion(actor, {
    pocId,
    description: "Latency under target",
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

/** Secondary department delivery project for cross-dept PI (real services). */
async function scaleSecondDepartmentProject(
  governance: GovernanceService,
  initiativeSvc: InitiativeService,
  projectSvc: ProjectService,
  db: PrismaClient,
  actor: Actor,
  orgId: string,
  departmentId: string,
) {
  const ready = await completePreStudyToReady(
    initiativeSvc,
    db,
    actor,
    orgId,
    departmentId,
    "Acceptance Cross-Dept Delivery",
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
    "Proceed secondary path to delivery",
  );
  const poc = await governance.createPoC(actor, {
    initiativeId: ready.id,
    title: "Secondary PoC",
    objective: "Validate ops path",
    hypothesis: "Ops can adopt",
    scope: "One ops workflow",
  });
  await makePoCReady(governance, db, actor, poc.id);
  await gateDecision(
    governance,
    db,
    actor,
    () => governance.submitPoCForGovernance(actor, { initiativeId: ready.id }),
    "GO",
    "PoC supports pilot",
  );
  const pilot = await governance.createPilot(actor, {
    initiativeId: ready.id,
    objective: "Prove ops readiness",
    scope: "Ops team",
    siteOrArea: "Ops float",
    environment: "Production-like",
    supportModel: "L2",
    rollbackPlan: "Feature flag off",
    plannedEnd: new Date("2026-12-01"),
  });
  await makePilotReady(governance, db, actor, pilot.id);
  await gateDecision(
    governance,
    db,
    actor,
    () =>
      governance.submitPilotForGovernance(actor, { initiativeId: ready.id }),
    "SCALE",
    "Ready to scale ops delivery",
  );
  const project = await governance.convertToProject(actor, {
    initiativeId: ready.id,
    name: "Ops Delivery Project",
    estimatedCost: "40000.00",
    approvedBudget: "50000.00",
  });
  const workItem = await projectSvc.createWorkItem(actor, {
    projectId: project.id,
    type: "TASK",
    title: "Runbook sync",
    estimateHours: "8",
  });
  return { project, workItem, initiativeId: ready.id };
}

async function main() {
  const db = new PrismaClient();
  const authz = new AuthorizationService(db);
  const audit = new AuditService(db);
  const organization = new OrganizationService(db, authz, audit);
  const governance = new GovernanceService(db, authz, audit);
  const initiativeSvc = new InitiativeService(db, authz, audit, governance);
  const projectSvc = new ProjectService(db, authz, audit);
  const planning = new PlanningService(db, authz, audit);

  const actor: Actor = {
    id: randomUUID(),
    displayName: "Phase55 Acceptance",
    source: "test",
  };
  await db.principal.create({
    data: { id: actor.id, displayName: actor.displayName },
  });
  await governance.ensureTemplates();

  const steps: Record<string, unknown> = {};

  // ─── 1. Org → sections / depts / teams / resources ────────────────────────
  console.log("=== Org structure ===");
  const org = await organization.createOrganization(actor, {
    name: `Acceptance Org ${randomUUID().slice(0, 8)}`,
  });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Delivery Section",
  });
  const deptA = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Platform",
  });
  const deptB = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Operations",
  });
  const teamA = await organization.createTeam(actor, {
    departmentId: deptA.id,
    name: "Platform Team",
  });
  const teamB = await organization.createTeam(actor, {
    departmentId: deptB.id,
    name: "Ops Team",
  });
  const shared = await organization.createResource(actor, {
    organizationId: org.id,
    name: "Shared Engineer",
    type: "PERSON",
    capacityHoursPerWeek: 40,
  });
  const dedicated = await organization.createResource(actor, {
    organizationId: org.id,
    name: "Platform Engineer",
    type: "PERSON",
    capacityHoursPerWeek: 40,
  });
  await organization.assignMembership(actor, {
    resourceId: shared.id,
    teamId: teamA.id,
    isPrimary: true,
    allocationPercent: 40,
  });
  await organization.assignMembership(actor, {
    resourceId: shared.id,
    teamId: teamB.id,
    isPrimary: false,
    allocationPercent: 60,
  });
  await organization.assignMembership(actor, {
    resourceId: dedicated.id,
    teamId: teamA.id,
    isPrimary: true,
    allocationPercent: 100,
  });
  steps.org = {
    organizationId: org.id,
    sections: 1,
    departments: 2,
    teams: 2,
    resources: 2,
  };

  // ─── 2. Initiative → Demand → Reqs → Pre-study ready ──────────────────────
  console.log("=== Initiative → Pre-study ready ===");
  const initiative = await completePreStudyToReady(
    initiativeSvc,
    db,
    actor,
    org.id,
    deptA.id,
    "Acceptance Primary Initiative",
  );
  steps.preStudy = {
    initiativeId: initiative.id,
    stage: initiative.currentStage,
    ready: true,
  };

  // ─── 3. Governance → Approvals → GO ───────────────────────────────────────
  console.log("=== Pre-study gate GO ===");
  await gateDecision(
    governance,
    db,
    actor,
    () =>
      governance.submitPreStudyForGovernance(actor, {
        initiativeId: initiative.id,
      }),
    "GO",
    "Evidence supports proceeding to PoC",
  );
  steps.preStudyGate = { outcome: "GO" };

  // ─── 4. PoC → evaluate → PoC gate → GO ────────────────────────────────────
  console.log("=== PoC → evaluate → gate GO ===");
  const poc = await governance.createPoC(actor, {
    initiativeId: initiative.id,
    title: "Acceptance PoC",
    objective: "Validate latency hypothesis",
    hypothesis: "p95 under 200ms",
    scope: "One platform service",
  });
  await makePoCReady(governance, db, actor, poc.id);
  await gateDecision(
    governance,
    db,
    actor,
    () =>
      governance.submitPoCForGovernance(actor, {
        initiativeId: initiative.id,
      }),
    "GO",
    "PoC evidence supports Pilot",
  );
  steps.pocGate = {
    pocId: poc.id,
    outcome: "GO",
  };

  // ─── 5. Pilot → evaluate → Pilot gate → SCALE ─────────────────────────────
  console.log("=== Pilot → evaluate → SCALE ===");
  const pilot = await governance.createPilot(actor, {
    initiativeId: initiative.id,
    objective: "Prove scale readiness",
    scope: "Plant A line 2",
    siteOrArea: "Plant A",
    environment: "Production-like",
    supportModel: "On-call + L2",
    rollbackPlan: "Disable feature flag",
    plannedEnd: new Date("2026-12-01"),
  });
  await makePilotReady(governance, db, actor, pilot.id);
  await gateDecision(
    governance,
    db,
    actor,
    () =>
      governance.submitPilotForGovernance(actor, {
        initiativeId: initiative.id,
      }),
    "SCALE",
    "Ready to scale to Project",
  );
  steps.pilotGate = {
    pilotId: pilot.id,
    outcome: "SCALE",
  };

  // ─── 6. Project → budget / milestone / work items ─────────────────────────
  console.log("=== Project + budget / milestone / work items ===");
  let project = await governance.convertToProject(actor, {
    initiativeId: initiative.id,
    name: "Platform Delivery Project",
    estimatedCost: "100000.00",
    approvedBudget: "120000.00",
  });
  project = await projectSvc.updateBudget(actor, {
    projectId: project.id,
    estimatedCost: "100000.00",
    approvedBudget: "120000.00",
    plannedCost: "110000.00",
    forecastCost: "115000.00",
    actualCost: "10000.00",
    currencyCode: "EUR",
    expectedVersion: project.version,
  });
  const milestone = await projectSvc.createMilestone(actor, {
    projectId: project.id,
    title: "Cutover",
    criticality: true,
    plannedDate: new Date("2026-05-15T00:00:00.000Z"),
  });
  const wiGateway = await projectSvc.createWorkItem(actor, {
    projectId: project.id,
    type: "TASK",
    title: "API gateway",
    estimateHours: "80",
  });
  const wiAuth = await projectSvc.createWorkItem(actor, {
    projectId: project.id,
    type: "TASK",
    title: "Auth hardening",
    estimateHours: "8",
  });
  const secondary = await scaleSecondDepartmentProject(
    governance,
    initiativeSvc,
    projectSvc,
    db,
    actor,
    org.id,
    deptB.id,
  );
  steps.project = {
    projectId: project.id,
    referenceKey: project.referenceKey,
    milestoneId: milestone.id,
    workItemIds: [wiGateway.id, wiAuth.id],
    budgetUpdated: true,
    secondaryProjectId: secondary.project.id,
    secondaryWorkItemId: secondary.workItem.id,
  };

  // ─── 7. PI → iterations → participate ─────────────────────────────────────
  console.log("=== PI / iterations / participation ===");
  const piStart = new Date("2026-04-01T00:00:00.000Z");
  const piEnd = new Date("2026-06-30T00:00:00.000Z");
  let pi = await planning.createProgramIncrement(actor, {
    organizationId: org.id,
    sectionId: section.id,
    name: "PI 2026.2 Acceptance",
    startDate: piStart,
    endDate: piEnd,
    planningOwnerName: "PI Owner",
  });
  const it1 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "IT-1",
    sequence: 1,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-04-14T00:00:00.000Z"),
  });
  const it2 = await planning.createIteration(actor, {
    piId: pi.id,
    name: "IT-2",
    sequence: 2,
    startDate: new Date("2026-04-15T00:00:00.000Z"),
    endDate: new Date("2026-04-28T00:00:00.000Z"),
  });
  pi = await planning.setParticipatingDepartments(actor, {
    piId: pi.id,
    departments: [
      { departmentId: deptA.id, planningOwnerName: "DeptA Lead" },
      { departmentId: deptB.id, planningOwnerName: "DeptB Lead" },
    ],
  });
  pi = await planning.setParticipatingTeams(actor, {
    piId: pi.id,
    teams: [
      { teamId: teamA.id, departmentId: deptA.id },
      { teamId: teamB.id, departmentId: deptB.id },
    ],
  });
  steps.pi = {
    id: pi.id,
    referenceKey: pi.referenceKey,
    iterations: 2,
    departments: pi.participatingDepartments.length,
    teams: pi.participatingTeams.length,
  };

  // ─── 8. Capacity + allocate → overload → resolve ──────────────────────────
  console.log("=== Allocate + capacity overload → resolve ===");
  const alloc1 = await planning.allocateWork(actor, {
    piId: pi.id,
    workItemId: wiGateway.id,
    iterationId: it1.id,
    teamId: teamA.id,
    resourceId: dedicated.id,
    plannedHours: "80",
  });
  const alloc2 = await planning.allocateWork(actor, {
    piId: pi.id,
    workItemId: wiAuth.id,
    iterationId: it2.id,
    teamId: teamA.id,
    plannedHours: "8",
  });
  const alloc3 = await planning.allocateWork(actor, {
    piId: pi.id,
    workItemId: secondary.workItem.id,
    iterationId: it1.id,
    teamId: teamB.id,
    plannedHours: "8",
  });
  await planning.setResourceAvailability(actor, {
    resourceId: dedicated.id,
    iterationId: it1.id,
    availableHours: "30",
    reductionHours: "0",
  });
  let conflicts = await planning.deriveConflictsForPi(pi.id);
  const overloadBefore = conflicts.filter((c) => c.type === "TEAM_OVERLOAD");
  if (overloadBefore.length === 0) {
    throw new Error("Expected TEAM_OVERLOAD before resolve");
  }
  // Resolve overload: lower planned load into capacity
  const resolvedAlloc1 = await planning.moveAllocation(actor, {
    allocationId: alloc1.id,
    iterationId: it1.id,
    teamId: teamA.id,
    plannedHours: "24",
    expectedVersion: alloc1.version,
  });
  conflicts = await planning.deriveConflictsForPi(pi.id);
  const overloadAfter = conflicts.filter((c) => c.type === "TEAM_OVERLOAD");
  steps.capacity = {
    allocated: 3,
    overloadDetected: overloadBefore.length > 0,
    overloadResolved: overloadAfter.length === 0,
  };
  if (overloadAfter.length > 0) {
    throw new Error("Expected overload to clear after plannedHours reduction");
  }

  // ─── 9. Cross-dept dependency timing → resolve ────────────────────────────
  console.log("=== Cross-dept dependency timing → resolve ===");
  // Predecessor: Platform WI (alloc1 / it1). Successor: Ops WI — place on earlier
  // iteration first so timing fires, then move successor after predecessor.
  await planning.moveAllocation(actor, {
    allocationId: alloc3.id,
    iterationId: it1.id,
    teamId: teamB.id,
    expectedVersion: alloc3.version,
  });
  // Move predecessor to it2 so successor (it1) precedes → DEPENDENCY_TIMING
  let pred = await planning.moveAllocation(actor, {
    allocationId: resolvedAlloc1.id,
    iterationId: it2.id,
    teamId: teamA.id,
    plannedHours: "24",
    expectedVersion: resolvedAlloc1.version,
  });
  const dep = await planning.createDependency(actor, {
    organizationId: org.id,
    type: "DEPENDS_ON",
    criticality: "HIGH",
    sourceType: "WORK_ITEM",
    sourceId: wiGateway.id,
    targetType: "WORK_ITEM",
    targetId: secondary.workItem.id,
    ownerName: "Dependency Owner",
  });
  let timingConflicts = await planning.deriveConflictsForPi(pi.id);
  const hadTiming = timingConflicts.some((c) => c.type === "DEPENDENCY_TIMING");
  if (!hadTiming) {
    throw new Error("Expected DEPENDENCY_TIMING after inverted schedule");
  }
  // Resolve: move successor to it2 (after/equal predecessor)
  const succRow = await db.workAllocation.findFirstOrThrow({
    where: { id: alloc3.id },
  });
  await planning.moveAllocation(actor, {
    allocationId: succRow.id,
    iterationId: it2.id,
    teamId: teamB.id,
    expectedVersion: succRow.version,
  });
  // Restore predecessor to it1 for a sensible plan before baseline
  pred = await planning.moveAllocation(actor, {
    allocationId: pred.id,
    iterationId: it1.id,
    teamId: teamA.id,
    plannedHours: "24",
    expectedVersion: pred.version,
  });
  timingConflicts = await planning.deriveConflictsForPi(pi.id);
  const timingAfter = timingConflicts.some(
    (c) => c.type === "DEPENDENCY_TIMING",
  );
  steps.dependency = {
    id: dep.id,
    crossDept: true,
    timingDetected: hadTiming,
    timingResolved: !timingAfter,
  };
  if (timingAfter) {
    throw new Error("Expected DEPENDENCY_TIMING cleared after resolve");
  }

  // ─── 10. REVIEW → baseline → modify → verify ──────────────────────────────
  console.log("=== REVIEW → baseline → plan change → verify ===");
  pi = await planning.transitionStatus(actor, {
    piId: pi.id,
    toStatus: "PLANNING",
    expectedVersion: (
      await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } })
    ).version,
  });
  pi = await planning.transitionStatus(actor, {
    piId: pi.id,
    toStatus: "REVIEW",
    expectedVersion: pi.version,
  });
  const baseline = await planning.createBaseline(actor, {
    piId: pi.id,
    label: "Acceptance baseline v1",
  });
  const frozenPayload = JSON.stringify(baseline.payload);
  const frozenAllocIteration = (
    baseline.payload as BaselinePayload
  ).allocations.find((a) => a.workItemId === wiGateway.id)?.iterationId;

  const livePred = await db.workAllocation.findFirstOrThrow({
    where: { workItemId: wiGateway.id },
  });
  await planning.moveAllocation(actor, {
    allocationId: livePred.id,
    iterationId: it2.id,
    teamId: teamB.id,
    expectedVersion: livePred.version,
  });
  const liveOps = await db.workAllocation.findFirstOrThrow({
    where: { id: alloc3.id },
  });
  await planning.moveAllocation(actor, {
    allocationId: liveOps.id,
    iterationId: it2.id,
    teamId: teamB.id,
    plannedHours: "16",
    expectedVersion: liveOps.version,
  });

  const historical = await planning.baselines.getBaseline(actor, baseline.id);
  const baselineUnchanged =
    JSON.stringify(historical.payload) === frozenPayload;
  const changes = await planning.getChangesSince(actor, pi.id, baseline.id);
  const detectedMove = changes.changes.some(
    (c) => c.kind === "allocation_moved",
  );
  const changeKinds = [...new Set(changes.changes.map((c) => c.kind))];

  steps.baseline = {
    versionNumber: baseline.versionNumber,
    baselineUnchanged,
    frozenAllocIteration,
    changesDetected: changes.changes.length > 0,
    detectedMove,
    changeKinds,
    piStatus: (
      await db.programIncrement.findUniqueOrThrow({ where: { id: pi.id } })
    ).status,
  };

  if (!baselineUnchanged) {
    throw new Error("Baseline payload mutated after plan change");
  }
  if (!detectedMove) {
    throw new Error("Expected allocation_moved in changes-since-baseline");
  }

  // silence unused after restore path
  void alloc2;
  void pred;

  const summary = { ok: true as const, steps };
  console.log("\n" + JSON.stringify(summary, null, 2));
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
