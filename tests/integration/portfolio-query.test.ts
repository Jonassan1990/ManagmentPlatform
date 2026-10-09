/**
 * M2A Portfolio Query Service — persistence-backed aggregation + Phase 0C isolation.
 */
import { randomUUID } from "crypto";
import { PrismaClient, ScopeType } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { PortfolioQueryService } from "@/modules/portfolio/application/portfolio-query-service";
import { ROLE_KEYS } from "@/modules/shared/permissions";
import { AppError } from "@/modules/shared/errors";
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
const portfolio = new PortfolioQueryService(db, authz, audit);

function principal(id = randomUUID()): Principal {
  return { id, displayName: "Portfolio Tester", source: "test" };
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
  await db.projectIssue.deleteMany();
  await db.projectClosure.deleteMany();
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
  await db.resourceMembership.deleteMany();
  await db.resource.deleteMany();
  await db.team.deleteMany();
  await db.department.deleteMany();
  await db.section.deleteMany();
  await db.roleBinding.deleteMany();
  await db.bootstrapConsumption.deleteMany();
  await db.externalIdentity.deleteMany();
  await db.organization.deleteMany();
  await db.principal.deleteMany();
}

async function seedOrg(actor: Principal) {
  await db.principal.create({
    data: { id: actor.id, displayName: actor.displayName },
  });
  await authz.ensureBootstrapBinding(actor.id);
  const org = await organization.createOrganization(actor, { name: "Portfolio Org" });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section A",
  });
  const deptA = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept A",
  });
  const deptB = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept B",
  });
  return { org, section, deptA, deptB };
}

async function bindRole(
  actor: Principal,
  targetId: string,
  roleKey: string,
  scope: {
    scopeType: ScopeType;
    organizationId?: string | null;
    scopeId?: string | null;
  },
) {
  await authz.ensureSystemRoles();
  const role = await db.roleDefinition.findUniqueOrThrow({
    where: { key: roleKey },
  });
  return authz.assignRoleBinding(actor, {
    principalId: targetId,
    roleDefinitionId: role.id,
    scopeType: scope.scopeType,
    organizationId: scope.organizationId ?? null,
    scopeId: scope.scopeId ?? null,
  });
}

async function createInitiative(opts: {
  organizationId: string;
  departmentId: string;
  stage?: "DEMAND" | "REQUIREMENTS" | "PRE_STUDY" | "POC" | "PILOT" | "PROJECT";
  status?: "ACTIVE" | "ON_HOLD" | "CANCELLED";
  referenceKey: string;
  businessOwnerResourceId?: string;
}) {
  return db.initiative.create({
    data: {
      organizationId: opts.organizationId,
      departmentId: opts.departmentId,
      referenceKey: opts.referenceKey,
      title: opts.referenceKey,
      requesterName: "R",
      businessOwnerName: "O",
      currentStage: opts.stage ?? "DEMAND",
      status: opts.status ?? "ACTIVE",
      businessOwnerResourceId: opts.businessOwnerResourceId,
    },
  });
}

beforeAll(async () => {
  await db.$connect();
});

beforeEach(async () => {
  await resetDb();
  await authz.ensureSystemRoles();
});

afterAll(async () => {
  await resetDb();
  await db.$disconnect();
});

describe("M2A Portfolio Query — empty and multi-org", () => {
  it("empty organization returns available zeros", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);

    const snap = await portfolio.getPortfolioSnapshot(admin, {
      organizationId: org.id,
    });

    expect(snap.scope.mode).toBe("organization");
    expect(snap.initiatives.available).toBe(true);
    if (snap.initiatives.available) {
      expect(snap.initiatives.value.total).toBe(0);
    }
    expect(snap.projects.available && snap.projects.value.active).toBe(0);
    expect(snap.issues.available && snap.issues.value.openIssues).toBe(0);
    expect(snap.governance.available && snap.governance.value.waitingForDecision).toBe(
      0,
    );
    expect(snap.piCapacity.available).toBe(false);
  });

  it("denies cross-organization access", async () => {
    const admin = principal();
    const { org: orgA } = await seedOrg(admin);
    const outsider = principal();
    await db.principal.create({
      data: { id: outsider.id, displayName: "Outsider" },
    });
    // Outsider gets org admin on a different org only
    const orgB = await organization.createOrganization(admin, { name: "Other Org" });
    await bindRole(admin, outsider.id, ROLE_KEYS.VIEWER, {
      scopeType: ScopeType.ORGANIZATION,
      organizationId: orgB.id,
      scopeId: orgB.id,
    });

    await expect(
      portfolio.getPortfolioSnapshot(outsider, { organizationId: orgA.id }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      portfolio.getPortfolioSnapshot(outsider, { organizationId: orgA.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("M2A Portfolio Query — department isolation", () => {
  it("department manager sees only their department aggregates", async () => {
    const admin = principal();
    const { org, deptA, deptB } = await seedOrg(admin);

    await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-A1",
      stage: "DEMAND",
    });
    await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-A2",
      stage: "PROJECT",
    });
    await createInitiative({
      organizationId: org.id,
      departmentId: deptB.id,
      referenceKey: "INIT-B1",
      stage: "POC",
    });

    const initA = await db.initiative.findFirstOrThrow({
      where: { referenceKey: "INIT-A2" },
    });
    const initB = await db.initiative.findFirstOrThrow({
      where: { referenceKey: "INIT-B1" },
    });

    await db.project.create({
      data: {
        initiativeId: initA.id,
        organizationId: org.id,
        departmentId: deptA.id,
        referenceKey: "PRJ-A",
        name: "Project A",
        status: "ACTIVE",
      },
    });
    await db.project.create({
      data: {
        initiativeId: initB.id,
        organizationId: org.id,
        departmentId: deptB.id,
        referenceKey: "PRJ-B",
        name: "Project B",
        status: "COMPLETED",
      },
    });

    const mgr = principal();
    await db.principal.create({ data: { id: mgr.id, displayName: "Dept Mgr" } });
    await bindRole(admin, mgr.id, ROLE_KEYS.DEPARTMENT_MANAGER, {
      scopeType: ScopeType.DEPARTMENT,
      organizationId: org.id,
      scopeId: deptA.id,
    });

    const snap = await portfolio.getPortfolioSnapshot(mgr, {
      organizationId: org.id,
    });

    expect(snap.scope).toEqual({
      mode: "departments",
      organizationId: org.id,
      departmentIds: [deptA.id],
    });
    expect(snap.initiatives.available && snap.initiatives.value.total).toBe(2);
    expect(
      snap.initiatives.available && snap.initiatives.value.byStage.DEMAND,
    ).toBe(1);
    expect(
      snap.initiatives.available && snap.initiatives.value.byStage.PROJECT,
    ).toBe(1);
    expect(snap.projects.available && snap.projects.value.active).toBe(1);
    expect(snap.projects.available && snap.projects.value.completed).toBe(0);

    // Explicit other department denied
    await expect(
      portfolio.getPortfolioSnapshot(mgr, {
        organizationId: org.id,
        departmentId: deptB.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("viewer with org scope can read org-wide but cannot escalate via ownership", async () => {
    const admin = principal();
    const { org, deptA, deptB } = await seedOrg(admin);
    await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-V1",
    });
    await createInitiative({
      organizationId: org.id,
      departmentId: deptB.id,
      referenceKey: "INIT-V2",
    });

    const viewer = principal();
    await db.principal.create({ data: { id: viewer.id, displayName: "Viewer" } });
    await bindRole(admin, viewer.id, ROLE_KEYS.VIEWER, {
      scopeType: ScopeType.ORGANIZATION,
      organizationId: org.id,
      scopeId: org.id,
    });

    const snap = await portfolio.getPortfolioSnapshot(viewer, {
      organizationId: org.id,
    });
    expect(snap.scope.mode).toBe("organization");
    expect(snap.initiatives.available && snap.initiatives.value.total).toBe(2);
  });
});

describe("M2A Portfolio Query — metrics", () => {
  it("counts lifecycle, projects, issues, blockers, delayed, governance, experiments", async () => {
    const admin = principal();
    const { org, deptA } = await seedOrg(admin);

    const resource = await db.resource.create({
      data: {
        organizationId: org.id,
        name: "Owner Res",
        type: "PERSON",
        referenceCode: "R-1",
      },
    });

    const initDemand = await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-D",
      stage: "DEMAND",
      businessOwnerResourceId: resource.id,
    });
    const initProj = await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-P",
      stage: "PROJECT",
    });
    const initPoc = await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-POC",
      stage: "POC",
    });
    const initPilot = await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-PIL",
      stage: "PILOT",
    });

    const past = new Date("2020-01-01T00:00:00.000Z");
    const projectActive = await db.project.create({
      data: {
        initiativeId: initProj.id,
        organizationId: org.id,
        departmentId: deptA.id,
        referenceKey: "PRJ-1",
        name: "Active delayed",
        status: "ACTIVE",
        plannedEnd: past,
        ownerResourceId: resource.id,
      },
    });
    await db.projectMilestone.create({
      data: {
        projectId: projectActive.id,
        referenceKey: "MS-1",
        title: "Missed MS",
        status: "MISSED",
      },
    });

    // Second initiative needs its own project — convert path: create for initDemand as completed
    // initDemand is DEMAND stage; still can attach project row for count tests via second initiative.
    // Use initPoc's sibling: create completed project on a dedicated initiative
    const initDone = await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-DONE",
      stage: "PROJECT",
    });
    await db.project.create({
      data: {
        initiativeId: initDone.id,
        organizationId: org.id,
        departmentId: deptA.id,
        referenceKey: "PRJ-DONE",
        name: "Done",
        status: "COMPLETED",
      },
    });

    await db.projectIssue.create({
      data: {
        projectId: projectActive.id,
        organizationId: org.id,
        referenceKey: "ISS-1",
        title: "Open critical blocker",
        severity: "CRITICAL",
        status: "OPEN",
        isBlocker: true,
      },
    });
    await db.projectIssue.create({
      data: {
        projectId: projectActive.id,
        organizationId: org.id,
        referenceKey: "ISS-2",
        title: "Resolved",
        severity: "LOW",
        status: "RESOLVED",
        isBlocker: true,
      },
    });

    await db.poC.create({
      data: {
        initiativeId: initPoc.id,
        title: "PoC",
        objective: "o",
        hypothesis: "h",
        scope: "s",
        status: "IN_PROGRESS",
        ownerResourceId: resource.id,
      },
    });
    await db.pilot.create({
      data: {
        initiativeId: initPilot.id,
        objective: "o",
        scope: "s",
        status: "EVALUATION",
        ownerResourceId: resource.id,
      },
    });

    const gate = await db.governanceGate.create({
      data: {
        initiativeId: initDemand.id,
        gateType: "PRE_STUDY_GATE",
        stage: "PRE_STUDY",
      },
    });
    const snapshot1 = await db.reviewSnapshot.create({
      data: {
        initiativeId: initDemand.id,
        gateType: "PRE_STUDY_GATE",
        revision: 1,
        payload: {},
      },
    });
    const snapshot2 = await db.reviewSnapshot.create({
      data: {
        initiativeId: initDemand.id,
        gateType: "PRE_STUDY_GATE",
        revision: 2,
        payload: {},
      },
    });
    const submission = await db.governanceSubmission.create({
      data: {
        initiativeId: initDemand.id,
        gateId: gate.id,
        status: "APPROVALS_COMPLETE",
        revision: 1,
        submittedByPrincipalId: admin.id,
        reviewSnapshotId: snapshot1.id,
      },
    });
    await db.approvalRequest.create({
      data: {
        submissionId: submission.id,
        status: "PENDING",
        authorityKey: "approver",
        requiredPermission: "approval.review",
        label: "Approver",
        reviewSnapshotId: snapshot1.id,
      },
    });
    await db.governanceSubmission.create({
      data: {
        initiativeId: initDemand.id,
        gateId: gate.id,
        status: "IN_REVIEW",
        revision: 2,
        submittedByPrincipalId: admin.id,
        reviewSnapshotId: snapshot2.id,
      },
    });

    await db.planningDependency.create({
      data: {
        organizationId: org.id,
        type: "BLOCKS",
        status: "OPEN",
        criticality: "CRITICAL",
        sourceType: "PROJECT",
        sourceId: projectActive.id,
        targetType: "PROJECT",
        targetId: projectActive.id,
      },
    });

    const snap = await portfolio.getPortfolioSnapshot(admin, {
      organizationId: org.id,
      asOf: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(snap.initiatives.available && snap.initiatives.value.total).toBe(5);
    expect(snap.initiatives.available && snap.initiatives.value.byStage.DEMAND).toBe(
      1,
    );
    expect(snap.projects.available && snap.projects.value.active).toBe(1);
    expect(snap.projects.available && snap.projects.value.completed).toBe(1);
    expect(snap.delayedProjects.available && snap.delayedProjects.value.delayedProjects).toBe(
      1,
    );
    expect(snap.issues.available && snap.issues.value.openIssues).toBe(1);
    expect(snap.issues.available && snap.issues.value.criticalOpenIssues).toBe(1);
    expect(snap.issues.available && snap.issues.value.activeBlockers).toBe(1);
    expect(
      snap.experimentation.available && snap.experimentation.value.activePocs,
    ).toBe(1);
    expect(
      snap.experimentation.available && snap.experimentation.value.activePilots,
    ).toBe(1);
    expect(
      snap.governance.available && snap.governance.value.waitingForDecision,
    ).toBe(1);
    expect(
      snap.governance.available && snap.governance.value.waitingForApproval,
    ).toBe(1);
    expect(
      snap.governance.available && snap.governance.value.pendingApprovalRequests,
    ).toBe(1);
    expect(
      snap.dependencies.available && snap.dependencies.value.openDependencies,
    ).toBe(1);
    expect(
      snap.ownership.available &&
        snap.ownership.value.some((o) => o.resourceId === resource.id),
    ).toBe(true);
  });
});

describe("M2B Portfolio Dashboard — scope options", () => {
  it("department options never expand beyond Phase 0C visibility", async () => {
    const admin = principal();
    const { org, deptA, deptB } = await seedOrg(admin);

    const mgr = principal();
    await db.principal.create({ data: { id: mgr.id, displayName: "Dept Mgr" } });
    await bindRole(admin, mgr.id, ROLE_KEYS.DEPARTMENT_MANAGER, {
      scopeType: ScopeType.DEPARTMENT,
      organizationId: org.id,
      scopeId: deptA.id,
    });

    const options = await portfolio.listDepartmentOptions(mgr, org.id);
    expect(options.map((d) => d.id)).toEqual([deptA.id]);
    expect(options.map((d) => d.id)).not.toContain(deptB.id);

    const viewer = principal();
    await db.principal.create({ data: { id: viewer.id, displayName: "Viewer" } });
    await bindRole(admin, viewer.id, ROLE_KEYS.VIEWER, {
      scopeType: ScopeType.ORGANIZATION,
      organizationId: org.id,
      scopeId: org.id,
    });
    const all = await portfolio.listDepartmentOptions(viewer, org.id);
    expect(all.map((d) => d.id).sort()).toEqual([deptA.id, deptB.id].sort());
  });
});

describe("M2C Portfolio Explorer", () => {
  it("empty portfolio returns total 0 with available empty rows", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);
    const result = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
    });
    expect(result.total).toBe(0);
    expect(result.rows).toEqual([]);
    expect(result.page).toBe(1);
    expect(result.scope.mode).toBe("organization");
  });

  it("searches, filters, sorts, paginates with stable ordering and truthful hrefs", async () => {
    const admin = principal();
    const { org, section, deptA, deptB } = await seedOrg(admin);
    const resource = await db.resource.create({
      data: { organizationId: org.id, name: "Structured Owner" },
    });

    await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "EXP-A1",
      stage: "DEMAND",
      businessOwnerResourceId: resource.id,
    });
    // Force legacy owner name on a second initiative
    await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: deptA.id,
        referenceKey: "EXP-A2",
        title: "Legacy owned demand",
        requesterName: "R",
        businessOwnerName: "Legacy Label",
        currentStage: "REQUIREMENTS",
        status: "ACTIVE",
      },
    });
    const initProject = await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "EXP-A3",
      stage: "PROJECT",
      businessOwnerResourceId: resource.id,
    });
    await createInitiative({
      organizationId: org.id,
      departmentId: deptB.id,
      referenceKey: "EXP-B1",
      stage: "POC",
    });

    const delayed = await db.project.create({
      data: {
        initiativeId: initProject.id,
        organizationId: org.id,
        departmentId: deptA.id,
        referenceKey: "EXP-PRJ-1",
        name: "Delivery Alpha",
        status: "ACTIVE",
        plannedEnd: new Date(Date.now() - 86400000),
        ownerResourceId: resource.id,
      },
    });
    await db.projectIssue.create({
      data: {
        organizationId: org.id,
        projectId: delayed.id,
        title: "Blocker",
        description: "Blocks delivery",
        status: "OPEN",
        severity: "CRITICAL",
        isBlocker: true,
        referenceKey: "ISS-1",
      },
    });

    // Search by reference
    const search = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      q: "EXP-A1",
    });
    expect(search.total).toBe(1);
    expect(search.rows[0]?.referenceKey).toBe("EXP-A1");
    expect(search.rows[0]?.href).toBe(`/initiatives/${search.rows[0]?.id}`);

    // Stage filter
    const byStage = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      initiativeStage: "DEMAND",
      entityKinds: ["INITIATIVE"],
    });
    expect(byStage.total).toBe(1);
    expect(byStage.rows.every((r) => r.statusLabel === "DEMAND")).toBe(true);

    // Department filter
    const byDept = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      departmentId: deptB.id,
    });
    expect(byDept.rows.every((r) => r.departmentId === deptB.id)).toBe(true);
    expect(byDept.total).toBe(1);

    // Section filter
    const bySection = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      sectionId: section.id,
      entityKinds: ["INITIATIVE"],
    });
    expect(bySection.total).toBe(4);

    // Owner resource filter + legacy fallback display
    const byOwner = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      ownerResourceId: resource.id,
      entityKinds: ["INITIATIVE"],
    });
    expect(byOwner.total).toBe(2);
    expect(byOwner.rows.every((r) => r.owner.source === "resource")).toBe(true);

    const legacy = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      q: "Legacy owned",
      entityKinds: ["INITIATIVE"],
    });
    expect(legacy.rows[0]?.owner).toEqual({
      resourceId: null,
      displayName: "Legacy Label",
      source: "legacy",
    });

    // Project status + delivery filters
    const delayedOnly = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      delivery: "DELAYED",
    });
    expect(delayedOnly.total).toBe(1);
    expect(delayedOnly.rows[0]?.kind).toBe("PROJECT");
    expect(delayedOnly.rows[0]?.href).toBe(
      `/initiatives/${initProject.id}/project`,
    );
    expect(delayedOnly.rows[0]?.delivery.delayed).toBe(true);

    const blocked = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      delivery: "ACTIVE_BLOCKER",
    });
    expect(blocked.total).toBe(1);
    expect(blocked.rows[0]?.delivery.activeBlocker).toBe(true);
    expect(blocked.rows[0]?.delivery.criticalOpenIssue).toBe(true);

    // Sort by name asc — stable
    const sorted = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      entityKinds: ["INITIATIVE"],
      sortBy: "name",
      sortDir: "asc",
      pageSize: 2,
      page: 1,
    });
    expect(sorted.rows).toHaveLength(2);
    expect(sorted.total).toBe(4);
    expect(sorted.rows[0]!.title <= sorted.rows[1]!.title).toBe(true);
    const page2 = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      entityKinds: ["INITIATIVE"],
      sortBy: "name",
      sortDir: "asc",
      pageSize: 2,
      page: 2,
    });
    expect(page2.rows).toHaveLength(2);
    const allKeys = [...sorted.rows, ...page2.rows].map((r) => r.referenceKey);
    expect(new Set(allKeys).size).toBe(4);

    // Combined filters
    const combined = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      departmentId: deptA.id,
      q: "EXP",
      entityKinds: ["PROJECT"],
      projectStatus: "ACTIVE",
      ownerResourceId: resource.id,
      delivery: "CRITICAL_ISSUE",
    });
    expect(combined.total).toBe(1);
    expect(combined.rows[0]?.referenceKey).toBe("EXP-PRJ-1");
  });

  it("enforces org and department isolation; viewer read; unauthorized denied", async () => {
    const admin = principal();
    const { org, deptA, deptB } = await seedOrg(admin);
    await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "ISO-A",
    });
    await createInitiative({
      organizationId: org.id,
      departmentId: deptB.id,
      referenceKey: "ISO-B",
    });

    const otherOrg = await organization.createOrganization(admin, {
      name: "Other Explorer Org",
    });

    const mgr = principal();
    await db.principal.create({ data: { id: mgr.id, displayName: "Mgr" } });
    await bindRole(admin, mgr.id, ROLE_KEYS.DEPARTMENT_MANAGER, {
      scopeType: ScopeType.DEPARTMENT,
      organizationId: org.id,
      scopeId: deptA.id,
    });

    const scoped = await portfolio.explorePortfolio(mgr, {
      organizationId: org.id,
    });
    expect(scoped.rows.every((r) => r.departmentId === deptA.id)).toBe(true);
    expect(scoped.total).toBe(1);

    await expect(
      portfolio.explorePortfolio(mgr, {
        organizationId: org.id,
        departmentId: deptB.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      portfolio.explorePortfolio(mgr, { organizationId: otherOrg.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const outsider = principal();
    await db.principal.create({
      data: { id: outsider.id, displayName: "Outsider" },
    });
    await expect(
      portfolio.explorePortfolio(outsider, { organizationId: org.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const viewer = principal();
    await db.principal.create({
      data: { id: viewer.id, displayName: "Viewer" },
    });
    await bindRole(admin, viewer.id, ROLE_KEYS.VIEWER, {
      scopeType: ScopeType.ORGANIZATION,
      organizationId: org.id,
      scopeId: org.id,
    });
    const view = await portfolio.explorePortfolio(viewer, {
      organizationId: org.id,
    });
    expect(view.total).toBe(2);
    expect(view.scope.mode).toBe("organization");
  });
});

describe("M2D-A Delivery Health Classification", () => {
  const AS_OF = new Date("2026-06-15T12:00:00.000Z");
  const PAST = new Date("2026-01-01T00:00:00.000Z");
  const FUTURE = new Date("2026-12-01T00:00:00.000Z");
  const BOUNDARY = new Date("2026-06-15T12:00:00.000Z");

  async function createProjectFor(
    orgId: string,
    deptId: string,
    ref: string,
    data: {
      status?: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
      plannedEnd?: Date | null;
      plannedStart?: Date | null;
      name?: string;
    } = {},
  ) {
    const init = await createInitiative({
      organizationId: orgId,
      departmentId: deptId,
      referenceKey: `INIT-${ref}`,
      stage: "PROJECT",
    });
    return db.project.create({
      data: {
        initiativeId: init.id,
        organizationId: orgId,
        departmentId: deptId,
        referenceKey: ref,
        name: data.name ?? ref,
        status: data.status ?? "ACTIVE",
        plannedEnd: data.plannedEnd === undefined ? null : data.plannedEnd,
        plannedStart: data.plannedStart === undefined ? null : data.plannedStart,
      },
    });
  }

  it("empty portfolio returns zero counts and empty attention", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);

    const summary = await portfolio.getDeliveryHealthSummary(admin, {
      organizationId: org.id,
      asOf: AS_OF,
    });
    expect(summary.totalProjects).toBe(0);
    expect(summary.attentionCount).toBe(0);
    expect(summary.counts).toEqual({
      BLOCKED: 0,
      AT_RISK: 0,
      ON_TRACK: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      UNKNOWN: 0,
    });

    const attention = await portfolio.listDeliveryHealthAttention(admin, {
      organizationId: org.id,
      asOf: AS_OF,
    });
    expect(attention.total).toBe(0);
    expect(attention.rows).toEqual([]);
    expect(attention.attentionCount).toBe(0);
  });

  it("classifies UNKNOWN, ON_TRACK, BLOCKED, AT_RISK, COMPLETED, CANCELLED with precedence", async () => {
    const admin = principal();
    const { org, deptA } = await seedOrg(admin);

    const unknown = await createProjectFor(org.id, deptA.id, "DH-UNK");
    const onTrack = await createProjectFor(org.id, deptA.id, "DH-OK", {
      plannedEnd: FUTURE,
    });
    const blocked = await createProjectFor(org.id, deptA.id, "DH-BLK", {
      plannedEnd: FUTURE,
    });
    await db.projectIssue.create({
      data: {
        projectId: blocked.id,
        organizationId: org.id,
        referenceKey: "ISS-BLK",
        title: "Active blocker",
        severity: "HIGH",
        status: "OPEN",
        isBlocker: true,
      },
    });
    // Mixed: blocker + overdue — precedence stays BLOCKED
    await db.projectMilestone.create({
      data: {
        projectId: blocked.id,
        referenceKey: "MS-MISS",
        title: "Missed",
        status: "MISSED",
        criticality: true,
      },
    });

    const atRiskCritical = await createProjectFor(org.id, deptA.id, "DH-CRIT", {
      plannedEnd: FUTURE,
    });
    await db.projectIssue.create({
      data: {
        projectId: atRiskCritical.id,
        organizationId: org.id,
        referenceKey: "ISS-CRIT",
        title: "Critical open",
        severity: "CRITICAL",
        status: "IN_PROGRESS",
        isBlocker: false,
      },
    });

    const atRiskMs = await createProjectFor(org.id, deptA.id, "DH-MS", {
      plannedEnd: FUTURE,
    });
    await db.projectMilestone.create({
      data: {
        projectId: atRiskMs.id,
        referenceKey: "MS-1",
        title: "Late",
        status: "MISSED",
        criticality: false,
      },
    });

    const atRiskDep = await createProjectFor(org.id, deptA.id, "DH-DEP", {
      plannedEnd: FUTURE,
    });
    await db.planningDependency.create({
      data: {
        organizationId: org.id,
        type: "BLOCKS",
        status: "OPEN",
        criticality: "CRITICAL",
        sourceType: "PROJECT",
        sourceId: atRiskDep.id,
        targetType: "PROJECT",
        targetId: atRiskDep.id,
      },
    });

    const completed = await createProjectFor(org.id, deptA.id, "DH-DONE", {
      status: "COMPLETED",
      plannedEnd: PAST,
    });
    await db.projectClosure.create({
      data: {
        projectId: completed.id,
        closedAt: PAST,
        closedByPrincipalId: admin.id,
        outcome: "DELIVERED",
        readinessSnapshot: {},
      },
    });

    const cancelled = await createProjectFor(org.id, deptA.id, "DH-CAN", {
      status: "CANCELLED",
      plannedEnd: PAST,
    });

    const summary = await portfolio.getDeliveryHealthSummary(admin, {
      organizationId: org.id,
      asOf: AS_OF,
    });
    expect(summary.counts.UNKNOWN).toBe(1);
    expect(summary.counts.ON_TRACK).toBe(1);
    expect(summary.counts.BLOCKED).toBe(1);
    expect(summary.counts.AT_RISK).toBe(3);
    expect(summary.counts.COMPLETED).toBe(1);
    expect(summary.counts.CANCELLED).toBe(1);
    expect(summary.attentionCount).toBe(4);
    expect(summary.totalProjects).toBe(8);

    const unk = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: unknown.id,
      asOf: AS_OF,
    });
    expect(unk.classification).toBe("UNKNOWN");
    expect(unk.reasons.some((r) => r.code === "INSUFFICIENT_SCHEDULE_DATA")).toBe(
      true,
    );

    const ok = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: onTrack.id,
      asOf: AS_OF,
    });
    expect(ok.classification).toBe("ON_TRACK");
    expect(
      ok.reasons.some((r) => r.code === "SCHEDULE_EVIDENCE_PRESENT"),
    ).toBe(true);

    const depEval = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: atRiskDep.id,
      asOf: AS_OF,
    });
    expect(depEval.classification).toBe("AT_RISK");
    expect(depEval.reasons.some((r) => r.code === "CRITICAL_DEPENDENCY")).toBe(
      true,
    );

    const blk = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: blocked.id,
      asOf: AS_OF,
    });
    expect(blk.classification).toBe("BLOCKED");
    expect(blk.reasons.some((r) => r.code === "ACTIVE_BLOCKER_ISSUE")).toBe(true);
    expect(
      blk.reasons.some((r) => r.code === "OVERDUE_CRITICAL_MILESTONE"),
    ).toBe(true);

    const done = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: completed.id,
      asOf: AS_OF,
    });
    expect(done.classification).toBe("COMPLETED");
    expect(done.closureOutcome).toBe("DELIVERED");
    expect(done.reasons.some((r) => r.code === "PROJECT_COMPLETED")).toBe(true);

    const can = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: cancelled.id,
      asOf: AS_OF,
    });
    expect(can.classification).toBe("CANCELLED");
    expect(can.classification).not.toBe("COMPLETED");
    expect(can.reasons.some((r) => r.code === "PROJECT_CANCELLED")).toBe(true);
  });

  it("resolved blocker no longer BLOCKED; overdue plannedEnd and as-of boundary", async () => {
    const admin = principal();
    const { org, deptA } = await seedOrg(admin);

    const project = await createProjectFor(org.id, deptA.id, "DH-RES", {
      plannedEnd: FUTURE,
    });
    const issue = await db.projectIssue.create({
      data: {
        projectId: project.id,
        organizationId: org.id,
        referenceKey: "ISS-RES",
        title: "Was blocker",
        severity: "HIGH",
        status: "OPEN",
        isBlocker: true,
      },
    });

    let eval1 = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: project.id,
      asOf: AS_OF,
    });
    expect(eval1.classification).toBe("BLOCKED");

    await db.projectIssue.update({
      where: { id: issue.id },
      data: { status: "RESOLVED", resolvedAt: AS_OF },
    });

    eval1 = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: project.id,
      asOf: AS_OF,
    });
    expect(eval1.classification).toBe("ON_TRACK");

    // plannedEnd exactly equal to asOf is NOT overdue
    const boundary = await createProjectFor(org.id, deptA.id, "DH-BND", {
      plannedEnd: BOUNDARY,
    });
    const atBoundary = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: boundary.id,
      asOf: AS_OF,
    });
    expect(atBoundary.classification).toBe("ON_TRACK");

    const overdue = await createProjectFor(org.id, deptA.id, "DH-OVR", {
      plannedEnd: PAST,
    });
    const overEval = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: overdue.id,
      asOf: AS_OF,
    });
    expect(overEval.classification).toBe("AT_RISK");
    expect(overEval.reasons.some((r) => r.code === "OVERDUE_PROJECT_END")).toBe(
      true,
    );

    // asOf before plannedEnd → not overdue
    const early = await portfolio.getProjectDeliveryHealth(admin, {
      organizationId: org.id,
      projectId: overdue.id,
      asOf: new Date("2019-01-01T00:00:00.000Z"),
    });
    expect(early.classification).toBe("ON_TRACK");
  });

  it("enforces scope isolation; owner does not expand portfolio; pagination stable", async () => {
    const admin = principal();
    const { org, section, deptA, deptB } = await seedOrg(admin);

    const pA = await createProjectFor(org.id, deptA.id, "DH-A1", {
      plannedEnd: PAST,
      name: "Alpha Risk",
    });
    const pA2 = await createProjectFor(org.id, deptA.id, "DH-A2", {
      plannedEnd: FUTURE,
      name: "Beta Ok",
    });
    await db.projectIssue.create({
      data: {
        projectId: pA2.id,
        organizationId: org.id,
        referenceKey: "ISS-A2",
        title: "Blocker A2",
        severity: "MEDIUM",
        status: "OPEN",
        isBlocker: true,
      },
    });
    const pB = await createProjectFor(org.id, deptB.id, "DH-B1", {
      plannedEnd: PAST,
      name: "Sibling Risk",
    });

    const mgr = principal();
    await db.principal.create({ data: { id: mgr.id, displayName: "DeptMgr" } });
    await bindRole(admin, mgr.id, ROLE_KEYS.DEPARTMENT_MANAGER, {
      scopeType: ScopeType.DEPARTMENT,
      organizationId: org.id,
      scopeId: deptA.id,
    });

    const scoped = await portfolio.getDeliveryHealthSummary(mgr, {
      organizationId: org.id,
      asOf: AS_OF,
    });
    expect(scoped.totalProjects).toBe(2);
    expect(scoped.counts.AT_RISK).toBe(1);
    expect(scoped.counts.BLOCKED).toBe(1);
    expect(scoped.scope.mode).toBe("departments");

    await expect(
      portfolio.getDeliveryHealthSummary(mgr, {
        organizationId: org.id,
        departmentId: deptB.id,
        asOf: AS_OF,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      portfolio.getProjectDeliveryHealth(mgr, {
        organizationId: org.id,
        projectId: pB.id,
        asOf: AS_OF,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const sectionSummary = await portfolio.getDeliveryHealthSummary(admin, {
      organizationId: org.id,
      sectionId: section.id,
      asOf: AS_OF,
    });
    expect(sectionSummary.totalProjects).toBe(3);

    const sectionMgr = principal();
    await db.principal.create({
      data: { id: sectionMgr.id, displayName: "SectionMgr" },
    });
    await bindRole(admin, sectionMgr.id, ROLE_KEYS.SECTION_MANAGER, {
      scopeType: ScopeType.SECTION,
      organizationId: org.id,
      scopeId: section.id,
    });
    const sectionMgrSummary = await portfolio.getDeliveryHealthSummary(
      sectionMgr,
      { organizationId: org.id, asOf: AS_OF },
    );
    expect(sectionMgrSummary.totalProjects).toBe(3);
    expect(sectionMgrSummary.scope.mode).toBe("departments");

    // Owner relationship alone does not grant portfolio visibility
    const ownerOnly = principal();
    await db.principal.create({
      data: { id: ownerOnly.id, displayName: "OwnerOnly" },
    });
    const resource = await db.resource.create({
      data: {
        organizationId: org.id,
        name: "Owner Person",
        type: "PERSON",
        referenceCode: "OWN-1",
      },
    });
    await db.project.update({
      where: { id: pA.id },
      data: { ownerResourceId: resource.id },
    });
    await expect(
      portfolio.getDeliveryHealthSummary(ownerOnly, {
        organizationId: org.id,
        asOf: AS_OF,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Cross-org denial
    const other = await organization.createOrganization(admin, {
      name: "Other Health Org",
    });
    await expect(
      portfolio.getDeliveryHealthSummary(mgr, {
        organizationId: other.id,
        asOf: AS_OF,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Viewer org-wide
    const viewer = principal();
    await db.principal.create({
      data: { id: viewer.id, displayName: "HealthViewer" },
    });
    await bindRole(admin, viewer.id, ROLE_KEYS.VIEWER, {
      scopeType: ScopeType.ORGANIZATION,
      organizationId: org.id,
      scopeId: org.id,
    });
    const viewSummary = await portfolio.getDeliveryHealthSummary(viewer, {
      organizationId: org.id,
      asOf: AS_OF,
    });
    expect(viewSummary.totalProjects).toBe(3);

    // Pagination + stable ordering (classification then referenceKey)
    const page1 = await portfolio.listDeliveryHealthAttention(admin, {
      organizationId: org.id,
      asOf: AS_OF,
      page: 1,
      pageSize: 1,
      sortBy: "classification",
      sortDir: "asc",
    });
    // BLOCKED (pA2) + AT_RISK (pA, pB) → 3
    expect(page1.total).toBe(3);
    expect(page1.rows).toHaveLength(1);
    expect(page1.rows[0]?.classification).toBe("BLOCKED");
    expect(page1.rows[0]?.referenceKey).toBe("DH-A2");
    expect(page1.rows[0]?.href).toMatch(/^\/initiatives\/.+\/project$/);
    expect(page1.rows[0]?.reasons.length).toBeGreaterThan(0);

    const page2 = await portfolio.listDeliveryHealthAttention(admin, {
      organizationId: org.id,
      asOf: AS_OF,
      page: 2,
      pageSize: 1,
      sortBy: "classification",
      sortDir: "asc",
    });
    expect(page2.rows[0]?.classification).toBe("AT_RISK");
    expect(page2.attentionCount).toBe(3);

    const page3 = await portfolio.listDeliveryHealthAttention(admin, {
      organizationId: org.id,
      asOf: AS_OF,
      page: 3,
      pageSize: 1,
      sortBy: "classification",
      sortDir: "asc",
    });
    expect(page3.rows[0]?.classification).toBe("AT_RISK");
    // Stable: referenceKey order among AT_RISK
    expect(["DH-A1", "DH-B1"]).toContain(page2.rows[0]?.referenceKey);
    expect(["DH-A1", "DH-B1"]).toContain(page3.rows[0]?.referenceKey);
    expect(page2.rows[0]?.referenceKey).not.toBe(page3.rows[0]?.referenceKey);
    expect(
      (page2.rows[0]?.referenceKey ?? "") < (page3.rows[0]?.referenceKey ?? ""),
    ).toBe(true);
  });
});

describe("M2D-B Delivery Health UI contracts", () => {
  const AS_OF = new Date("2026-06-15T12:00:00.000Z");
  const FUTURE = new Date("2026-12-01T00:00:00.000Z");

  it("explorer deliveryHealth filter is server-side; attention includes owner", async () => {
    const admin = principal();
    const { org, deptA } = await seedOrg(admin);

    const resource = await db.resource.create({
      data: {
        organizationId: org.id,
        name: "Health Owner",
        type: "PERSON",
        referenceCode: "HO-1",
      },
    });

    const initOk = await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-HOK",
      stage: "PROJECT",
    });
    const initBlk = await createInitiative({
      organizationId: org.id,
      departmentId: deptA.id,
      referenceKey: "INIT-HBLK",
      stage: "PROJECT",
    });
    const ok = await db.project.create({
      data: {
        initiativeId: initOk.id,
        organizationId: org.id,
        departmentId: deptA.id,
        referenceKey: "H-OK",
        name: "Healthy",
        status: "ACTIVE",
        plannedEnd: FUTURE,
        ownerResourceId: resource.id,
      },
    });
    const blocked = await db.project.create({
      data: {
        initiativeId: initBlk.id,
        organizationId: org.id,
        departmentId: deptA.id,
        referenceKey: "H-BLK",
        name: "Blocked",
        status: "ACTIVE",
        plannedEnd: FUTURE,
        ownerResourceId: resource.id,
      },
    });
    await db.projectIssue.create({
      data: {
        projectId: blocked.id,
        organizationId: org.id,
        referenceKey: "ISS-H1",
        title: "Blocker",
        severity: "HIGH",
        status: "OPEN",
        isBlocker: true,
      },
    });

    const filtered = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      deliveryHealth: "BLOCKED",
      asOf: AS_OF,
    });
    expect(filtered.total).toBe(1);
    expect(filtered.rows[0]?.referenceKey).toBe("H-BLK");
    expect(filtered.rows[0]?.kind).toBe("PROJECT");
    expect(filtered.rows[0]?.delivery.health).toBe("BLOCKED");

    const onTrack = await portfolio.explorePortfolio(admin, {
      organizationId: org.id,
      deliveryHealth: "ON_TRACK",
      asOf: AS_OF,
    });
    expect(onTrack.rows.some((r) => r.id === ok.id)).toBe(true);
    expect(onTrack.rows.every((r) => r.delivery.health === "ON_TRACK")).toBe(
      true,
    );

    const attention = await portfolio.listDeliveryHealthAttention(admin, {
      organizationId: org.id,
      asOf: AS_OF,
    });
    expect(attention.rows[0]?.owner.resourceId).toBe(resource.id);
    expect(attention.rows[0]?.owner.displayName).toBe("Health Owner");
    expect(attention.rows[0]?.owner.source).toBe("resource");
  });
});
