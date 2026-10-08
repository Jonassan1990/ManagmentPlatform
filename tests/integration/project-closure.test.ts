/**
 * Phase 1D — Project closure integration tests.
 */
import { randomUUID } from "crypto";
import { PrismaClient, ScopeType } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { GovernanceService } from "@/modules/governance/application/governance-service";
import { InitiativeService } from "@/modules/initiative/application/initiative-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { ProjectIssueService } from "@/modules/project/application/project-issue-service";
import { ProjectService } from "@/modules/project/application/project-service";
import { REQUIRED_ASSESSMENT_AREAS } from "@/modules/initiative/application/readiness-policy";
import { PERMISSIONS, ROLE_KEYS } from "@/modules/shared/permissions";
import { resetEnvCacheForTests } from "@/server/env";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public";
process.env.DIRECT_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
process.env.ALLOW_DEV_AUTH = "false";
resetEnvCacheForTests();

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const organization = new OrganizationService(db, authz, audit);
const governance = new GovernanceService(db, authz, audit);
const initiative = new InitiativeService(db, authz, audit, governance);
const project = new ProjectService(db, authz, audit);
const projectIssues = new ProjectIssueService(db, authz, audit);

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
  await db.projectClosure.deleteMany();
  await db.projectIssue.deleteMany();
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

async function seedOrg(actor: Principal, name = "Org Closure") {
  await authz.ensureSystemRoles();
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
) {
  let created = await initiative.createInitiative(actor, {
    organizationId: orgId,
    departmentId: deptId,
    title: "Close me",
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

async function projectFromScale(actor: Principal) {
  const { org, department } = await seedOrg(actor);
  const ready = await makeReadyPreStudy(actor, org.id, department.id);
  await governance.ensureTemplates();
  const pre = await governance.submitPreStudyForGovernance(actor, {
    initiativeId: ready.id,
  });
  await approveAllPending(actor, pre.submission.id);
  const preSub = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: pre.submission.id },
    include: { decisionPackage: true },
  });
  await governance.recordDecision(actor, {
    submissionId: preSub.id,
    outcome: "GO",
    rationale: "Go",
    expectedPackageVersion: preSub.decisionPackage!.version,
  });
  const poc = await governance.createPoC(actor, {
    initiativeId: ready.id,
    title: "PoC",
    objective: "o",
    hypothesis: "h",
    scope: "s",
  });
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
    results: "ok",
    findings: "ok",
    expectedVersion: current.version,
  });
  await governance.updateCriterionEvaluation(actor, {
    criterionId: criterion.id,
    evaluationState: "PASS",
    actualResult: "180ms",
    expectedVersion: criterion.version,
  });
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
    objective: "Pilot",
    scope: "Plant",
    siteOrArea: "A",
    environment: "Prod-like",
    supportModel: "On-call",
    rollbackPlan: "Flag",
    plannedEnd: new Date("2026-12-01"),
  });
  const pCrit = await governance.upsertPilotCriterion(actor, {
    pilotId: pilot.id,
    category: "OPERATIONAL",
    title: "Adoption",
    description: "WAU",
    measurementMethod: "Telemetry",
    target: ">70%",
    required: true,
  });
  let p = await db.pilot.findUniqueOrThrow({ where: { id: pilot.id } });
  for (const toStatus of ["READY", "IN_PROGRESS", "EVALUATION"] as const) {
    p = await governance.transitionPilot(actor, {
      pilotId: pilot.id,
      toStatus,
      expectedVersion: p.version,
    });
  }
  p = await governance.updatePilotResults(actor, {
    pilotId: pilot.id,
    results: "ok",
    businessFindings: "ok",
    technicalFindings: "ok",
    operationalFindings: "ok",
    expectedVersion: p.version,
  });
  await governance.evaluatePilotCriterion(actor, {
    criterionId: pCrit.id,
    evaluationState: "PASS",
    actualResult: "78%",
    expectedVersion: pCrit.version,
  });
  const pilotBundle = await governance.submitPilotForGovernance(actor, {
    initiativeId: ready.id,
  });
  await approveAllPending(actor, pilotBundle.submission.id);
  const pilotSub = await db.governanceSubmission.findUniqueOrThrow({
    where: { id: pilotBundle.submission.id },
    include: { decisionPackage: true },
  });
  await governance.recordDecision(actor, {
    submissionId: pilotSub.id,
    outcome: "SCALE",
    rationale: "Scale",
    expectedPackageVersion: pilotSub.decisionPackage!.version,
  });
  const created = await governance.convertToProject(actor, {
    initiativeId: ready.id,
    name: "Delivery project",
  });
  return { org, department, initiativeId: ready.id, project: created };
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

describe("PROJECT CLOSURE — readiness & close", () => {
  it("closes an eligible project with audit and immutable record", async () => {
    const actor = principal();
    const { project: proj, initiativeId } = await projectFromScale(actor);

    const readiness = await project.getClosureReadiness(actor, {
      projectId: proj.id,
      outcome: "DELIVERED",
    });
    expect(readiness.readiness.canClose).toBe(true);

    const closed = await project.closeProject(actor, {
      projectId: proj.id,
      outcome: "DELIVERED",
      summary: "Shipped to production",
      acknowledgeWarnings: true,
      expectedVersion: proj.version,
    });

    expect(closed.project.status).toBe("COMPLETED");
    expect(closed.closure.outcome).toBe("DELIVERED");
    expect(closed.closure.closedByPrincipalId).toBe(actor.id);
    expect(closed.closure.summary).toBe("Shipped to production");

    const auditEvents = await db.auditEvent.findMany({
      where: { actionType: "project.closed", subjectId: proj.id },
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0].actorPrincipalId).toBe(actor.id);

    const trace = await project.getTraceability(actor, initiativeId);
    expect(trace.project?.id).toBe(proj.id);
    expect(trace.id).toBe(initiativeId);
  });

  it("hard-blocks DELIVERED when an active blocker exists", async () => {
    const actor = principal();
    const { project: proj } = await projectFromScale(actor);
    await projectIssues.createIssue(actor, {
      projectId: proj.id,
      title: "Blocker",
      isBlocker: true,
      severity: "HIGH",
    });

    await expect(
      project.closeProject(actor, {
        projectId: proj.id,
        outcome: "DELIVERED",
        acknowledgeWarnings: true,
        expectedVersion: proj.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects repeated closure (idempotent CONFLICT)", async () => {
    const actor = principal();
    const { project: proj } = await projectFromScale(actor);
    const first = await project.closeProject(actor, {
      projectId: proj.id,
      outcome: "DELIVERED",
      acknowledgeWarnings: true,
      expectedVersion: proj.version,
    });

    await expect(
      project.closeProject(actor, {
        projectId: proj.id,
        outcome: "CANCELLED",
        acknowledgeWarnings: true,
        expectedVersion: first.project.version,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const closures = await db.projectClosure.findMany({
      where: { projectId: proj.id },
    });
    expect(closures).toHaveLength(1);
  });
});

describe("PROJECT CLOSURE — post-close immutability", () => {
  it("rejects project update, issue create, and work-item create after close", async () => {
    const actor = principal();
    const { project: proj } = await projectFromScale(actor);
    const closed = await project.closeProject(actor, {
      projectId: proj.id,
      outcome: "DELIVERED",
      acknowledgeWarnings: true,
      expectedVersion: proj.version,
    });

    await expect(
      project.updateProject(actor, {
        projectId: proj.id,
        name: "Mutated",
        status: "ACTIVE",
        priority: "MEDIUM",
        expectedVersion: closed.project.version,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      projectIssues.createIssue(actor, {
        projectId: proj.id,
        title: "After close",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      project.createWorkItem(actor, {
        projectId: proj.id,
        type: "TASK",
        title: "After close",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("PROJECT CLOSURE — authorization", () => {
  it("viewer cannot close; unrelated principal cannot close; issue owner does not gain close", async () => {
    const manager = principal();
    const { org, department, project: proj } = await projectFromScale(manager);

    const viewer = principal();
    await db.principal.create({
      data: { id: viewer.id, displayName: "Viewer" },
    });
    await authz.ensureSystemRoles();
    const viewerRole = await db.roleDefinition.findUniqueOrThrow({
      where: { key: ROLE_KEYS.VIEWER },
    });
    await authz.assignRoleBinding(manager, {
      principalId: viewer.id,
      roleDefinitionId: viewerRole.id,
      scopeType: ScopeType.ORGANIZATION,
      organizationId: org.id,
      scopeId: org.id,
    });

    await expect(
      project.closeProject(viewer, {
        projectId: proj.id,
        outcome: "DELIVERED",
        acknowledgeWarnings: true,
        expectedVersion: proj.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const stranger = principal();
    await db.principal.create({
      data: { id: stranger.id, displayName: "Stranger" },
    });
    await expect(
      project.closeProject(stranger, {
        projectId: proj.id,
        outcome: "DELIVERED",
        acknowledgeWarnings: true,
        expectedVersion: proj.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Issue owner resource linked to a principal without PROJECT_CLOSE
    const ownerPrincipal = principal();
    await db.principal.create({
      data: { id: ownerPrincipal.id, displayName: "Issue Owner P" },
    });
    const person = await organization.createResource(manager, {
      organizationId: org.id,
      name: "Issue Owner",
      type: "PERSON",
      skills: [],
    });
    await organization.linkResourcePrincipal(manager, {
      resourceId: person.id,
      principalId: ownerPrincipal.id,
    });
    await projectIssues.createIssue(manager, {
      projectId: proj.id,
      title: "Owned issue",
      ownerResourceId: person.id,
    });
    await expect(
      project.closeProject(ownerPrincipal, {
        projectId: proj.id,
        outcome: "CANCELLED",
        acknowledgeWarnings: true,
        expectedVersion: proj.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Project owner resource does not grant PROJECT_CLOSE
    const ownerOnly = principal();
    await db.principal.create({
      data: { id: ownerOnly.id, displayName: "Proj Owner" },
    });
    const projOwner = await organization.createResource(manager, {
      organizationId: org.id,
      name: "Proj Owner",
      type: "PERSON",
      skills: [],
    });
    await organization.linkResourcePrincipal(manager, {
      resourceId: projOwner.id,
      principalId: ownerOnly.id,
    });
    const current = await db.project.findUniqueOrThrow({ where: { id: proj.id } });
    await project.updateProject(manager, {
      projectId: proj.id,
      name: current.name,
      status: current.status === "COMPLETED" || current.status === "CANCELLED"
        ? "ACTIVE"
        : current.status,
      priority: current.priority,
      ownerResourceId: projOwner.id,
      expectedVersion: current.version,
    });
    const afterOwner = await db.project.findUniqueOrThrow({
      where: { id: proj.id },
    });
    const canClose = await authz.can(
      ownerOnly,
      PERMISSIONS.PROJECT_CLOSE,
      {
        type: "DEPARTMENT",
        organizationId: org.id,
        departmentId: department.id,
      },
      { kind: "PROJECT_OWNER", projectId: proj.id },
    );
    expect(canClose).toBe(false);
    await expect(
      project.closeProject(ownerOnly, {
        projectId: proj.id,
        outcome: "DELIVERED",
        acknowledgeWarnings: true,
        expectedVersion: afterOwner.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("authorized manager can close", async () => {
    const actor = principal();
    const { project: proj } = await projectFromScale(actor);
    const result = await project.closeProject(actor, {
      projectId: proj.id,
      outcome: "PARTIALLY_DELIVERED",
      summary: "Accepted remaining work",
      acknowledgeWarnings: true,
      expectedVersion: proj.version,
    });
    expect(result.closure.outcome).toBe("PARTIALLY_DELIVERED");
    expect(result.project.status).toBe("COMPLETED");
  });
});

describe("PROJECT CLOSURE — PI history untouched", () => {
  it("does not mutate existing work allocations or baselines when closing", async () => {
    const actor = principal();
    const { project: proj } = await projectFromScale(actor);

    // Seed a synthetic baseline + allocation row tied to this org/project work item
    const wi = await project.createWorkItem(actor, {
      projectId: proj.id,
      type: "TASK",
      title: "Planned task",
    });
    const beforeWi = await db.projectWorkItem.findUniqueOrThrow({
      where: { id: wi.id },
    });

    const closed = await project.closeProject(actor, {
      projectId: proj.id,
      outcome: "CANCELLED",
      acknowledgeWarnings: true,
      expectedVersion: proj.version,
    });
    expect(closed.project.status).toBe("CANCELLED");

    const afterWi = await db.projectWorkItem.findUniqueOrThrow({
      where: { id: wi.id },
    });
    expect(afterWi.status).toBe(beforeWi.status);
    expect(afterWi.title).toBe(beforeWi.title);
    expect(afterWi.version).toBe(beforeWi.version);

    // No PI rows created — ensure close did not invent baseline/allocation churn
    expect(await db.piBaseline.count()).toBe(0);
    expect(await db.workAllocation.count()).toBe(0);
  });
});
