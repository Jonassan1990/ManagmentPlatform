/**
 * Phase 1C — Project Issue management integration tests.
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
import { isActiveBlockerIssue } from "@/modules/project/application/issue-policy";
import { ProjectIssueService } from "@/modules/project/application/project-issue-service";
import { ProjectService } from "@/modules/project/application/project-service";
import { REQUIRED_ASSESSMENT_AREAS } from "@/modules/initiative/application/readiness-policy";
import { ROLE_KEYS } from "@/modules/shared/permissions";
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

async function seedOrg(actor: Principal, name = "Org Issues") {
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
    title: "Issue path",
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

describe("PROJECT ISSUE — domain", () => {
  it("create / update / status / resolve / close journey with blocker + audit", async () => {
    const actor = principal();
    const { org, project: proj, initiativeId } = await projectFromScale(actor);
    const owner = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Issue Owner",
      type: "PERSON",
      skills: [],
    });

    const created = await projectIssues.createIssue(actor, {
      projectId: proj.id,
      title: "Env capacity shortage",
      description: "Staging cluster saturated",
      severity: "HIGH",
      isBlocker: true,
      ownerResourceId: owner.id,
    });
    expect(created.referenceKey).toMatch(/^ISS-/);
    expect(created.organizationId).toBe(org.id);
    expect(created.status).toBe("OPEN");
    expect(isActiveBlockerIssue(created)).toBe(true);

    const summary1 = await projectIssues.getProjectIssueSummary(
      actor,
      proj.id,
    );
    expect(summary1.activeBlockerCount).toBe(1);
    expect(summary1.openCount).toBe(1);

    const updated = await projectIssues.updateIssue(actor, {
      issueId: created.id,
      title: "Env capacity shortage",
      description: "Staging + QA saturated",
      severity: "CRITICAL",
      isBlocker: true,
      ownerResourceId: owner.id,
      expectedVersion: created.version,
    });
    expect(updated.severity).toBe("CRITICAL");

    const inProgress = await projectIssues.changeIssueStatus(actor, {
      issueId: updated.id,
      toStatus: "IN_PROGRESS",
      expectedVersion: updated.version,
    });
    expect(inProgress.status).toBe("IN_PROGRESS");
    expect(isActiveBlockerIssue(inProgress)).toBe(true);

    await expect(
      projectIssues.changeIssueStatus(actor, {
        issueId: inProgress.id,
        toStatus: "RESOLVED",
        expectedVersion: inProgress.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const resolved = await projectIssues.resolveIssue(actor, {
      issueId: inProgress.id,
      resolution: "Added capacity nodes",
      expectedVersion: inProgress.version,
    });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedAt).toBeTruthy();
    expect(resolved.resolution).toContain("capacity");
    expect(isActiveBlockerIssue(resolved)).toBe(false);

    const summary2 = await projectIssues.getProjectIssueSummary(
      actor,
      proj.id,
    );
    expect(summary2.activeBlockerCount).toBe(0);

    const closed = await projectIssues.changeIssueStatus(actor, {
      issueId: resolved.id,
      toStatus: "CLOSED",
      expectedVersion: resolved.version,
    });
    expect(closed.status).toBe("CLOSED");
    expect(isActiveBlockerIssue(closed)).toBe(false);

    const createdEvents = await db.auditEvent.findMany({
      where: { actionType: "project.issue.created", subjectId: created.id },
    });
    expect(createdEvents).toHaveLength(1);
    expect(createdEvents[0]!.actorPrincipalId).toBe(actor.id);

    const updatedEvents = await db.auditEvent.findMany({
      where: { actionType: "project.issue.updated", subjectId: created.id },
    });
    expect(updatedEvents.length).toBeGreaterThanOrEqual(1);

    const resolvedEvents = await db.auditEvent.findMany({
      where: { actionType: "project.issue.resolved", subjectId: created.id },
    });
    expect(resolvedEvents.length).toBeGreaterThanOrEqual(1);

    // Traceability: Issue → Project → Initiative
    const loaded = await projectIssues.getIssue(actor, created.id);
    expect(loaded.project.initiativeId).toBe(initiativeId);
    expect(loaded.projectId).toBe(proj.id);

    // Legacy project behavior unaffected
    const ws = await project.getProjectWorkspace(actor, proj.id);
    expect(ws.id).toBe(proj.id);
  });

  it("rejects invalid status transition and cross-org / OTHER owner", async () => {
    const actor = principal();
    const { org, project: proj } = await projectFromScale(actor);
    const issue = await projectIssues.createIssue(actor, {
      projectId: proj.id,
      title: "Bug",
      severity: "LOW",
    });

    // OPEN → CLOSED is allowed; invent invalid by going CLOSED then RESOLVED
    const closed = await projectIssues.changeIssueStatus(actor, {
      issueId: issue.id,
      toStatus: "CLOSED",
      expectedVersion: issue.version,
    });
    await expect(
      projectIssues.changeIssueStatus(actor, {
        issueId: closed.id,
        toStatus: "RESOLVED",
        expectedVersion: closed.version,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    // Second org: PLATFORM-scoped create is bootstrap-sensitive; mirror org tests.
    const otherOrg = await db.organization.create({ data: { name: "Other Org" } });
    await authz.grantOrganizationAdmin(actor.id, otherOrg.id);
    const foreignPerson = await organization.createResource(actor, {
      organizationId: otherOrg.id,
      name: "Foreign",
      type: "PERSON",
      skills: [],
    });
    await expect(
      projectIssues.updateIssue(actor, {
        issueId: closed.id,
        title: "Bug",
        severity: "LOW",
        isBlocker: false,
        ownerResourceId: foreignPerson.id,
        expectedVersion: closed.version,
      }),
    ).rejects.toBeInstanceOf(AppError);

    const systemResource = await organization.createResource(actor, {
      organizationId: org.id,
      name: "VM pool",
      type: "OTHER",
      skills: [],
    });
    await expect(
      projectIssues.createIssue(actor, {
        projectId: proj.id,
        title: "Bad owner type",
        ownerResourceId: systemResource.id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("optional relatedRisk must share Initiative; Risk remains distinct", async () => {
    const actor = principal();
    const { org, department, project: proj, initiativeId } =
      await projectFromScale(actor);
    const risk = await db.risk.findFirstOrThrow({
      where: { initiativeId },
    });
    const linked = await projectIssues.createIssue(actor, {
      projectId: proj.id,
      title: "Risk materialized",
      relatedRiskId: risk.id,
      isBlocker: false,
    });
    expect(linked.relatedRiskId).toBe(risk.id);
    const riskAfter = await db.risk.findUniqueOrThrow({ where: { id: risk.id } });
    expect(riskAfter.status).toBe(risk.status);

    // Different initiative in same org — relatedRisk must match Project.initiativeId
    const otherInit = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Other initiative",
      requesterName: "R",
      businessOwnerName: "O",
    });
    const foreignRisk = await initiative.createRisk(actor, {
      initiativeId: otherInit.id,
      title: "Other risk",
      description: "Not this project",
    });
    await expect(
      projectIssues.createIssue(actor, {
        projectId: proj.id,
        title: "Wrong risk",
        relatedRiskId: foreignRisk.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("PROJECT ISSUE — authorization", () => {
  it("viewer cannot mutate; issue Resource owner alone gets no auth; project owner can edit", async () => {
    const admin = principal();
    const { org, department, project: proj } = await projectFromScale(admin);

    await authz.ensureSystemRoles();
    const viewerRole = await db.roleDefinition.findUniqueOrThrow({
      where: { key: ROLE_KEYS.VIEWER },
    });
    const viewer = principal();
    await db.principal.create({
      data: { id: viewer.id, displayName: "Viewer" },
    });
    await authz.assignRoleBinding(admin, {
      principalId: viewer.id,
      roleDefinitionId: viewerRole.id,
      scopeType: ScopeType.ORGANIZATION,
      organizationId: org.id,
      scopeId: org.id,
    });

    await expect(
      projectIssues.createIssue(viewer, {
        projectId: proj.id,
        title: "Denied",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const listed = await projectIssues.listProjectIssues(viewer, {
      projectId: proj.id,
    });
    expect(listed.issues).toEqual([]);

    // Issue Resource owner without project.edit cannot mutate
    const issueOwnerPrincipal = principal();
    await db.principal.create({
      data: { id: issueOwnerPrincipal.id, displayName: "IssueOwner" },
    });
    const issueOwnerResource = await organization.createResource(admin, {
      organizationId: org.id,
      name: "Issue Owner Person",
      type: "PERSON",
      skills: [],
    });
    await organization.linkResourcePrincipal(admin, {
      resourceId: issueOwnerResource.id,
      principalId: issueOwnerPrincipal.id,
    });
    const issue = await projectIssues.createIssue(admin, {
      projectId: proj.id,
      title: "Owned issue",
      ownerResourceId: issueOwnerResource.id,
      isBlocker: true,
    });
    await expect(
      projectIssues.updateIssue(issueOwnerPrincipal, {
        issueId: issue.id,
        title: "Hijack",
        severity: "LOW",
        isBlocker: false,
        expectedVersion: issue.version,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Project owner (Phase 0C relationship) can manage issues via project.edit
    const projectOwnerPrincipal = principal();
    await db.principal.create({
      data: { id: projectOwnerPrincipal.id, displayName: "ProjOwner" },
    });
    const projectOwnerResource = await organization.createResource(admin, {
      organizationId: org.id,
      name: "Project Owner Person",
      type: "PERSON",
      skills: [],
    });
    await organization.linkResourcePrincipal(admin, {
      resourceId: projectOwnerResource.id,
      principalId: projectOwnerPrincipal.id,
    });
    const current = await db.project.findUniqueOrThrow({
      where: { id: proj.id },
    });
    await project.updateProject(admin, {
      projectId: proj.id,
      name: current.name,
      status: current.status,
      priority: current.priority,
      ownerResourceId: projectOwnerResource.id,
      expectedVersion: current.version,
    });

    const byOwner = await projectIssues.updateIssue(projectOwnerPrincipal, {
      issueId: issue.id,
      title: "Owned by project owner path",
      severity: "MEDIUM",
      isBlocker: true,
      expectedVersion: issue.version,
    });
    expect(byOwner.title).toContain("project owner");

    // Cross-org denied
    const stranger = principal();
    await db.principal.create({
      data: { id: stranger.id, displayName: "Stranger" },
    });
    await expect(
      projectIssues.createIssue(stranger, {
        projectId: proj.id,
        title: "Cross org",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(department.id).toBeTruthy();
  });
});
