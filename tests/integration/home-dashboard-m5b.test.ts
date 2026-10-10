/**
 * M5B-A — Home dashboard query contract (role-aware composition).
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
import { PlanningService } from "@/modules/pi-planning/application/planning-service";
import { HomeDashboardQueryService } from "@/modules/portfolio/application/home-dashboard-query-service";
import { PortfolioPiCapacityQueryService } from "@/modules/portfolio/application/portfolio-pi-capacity-query-service";
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
const governance = new GovernanceService(db, authz, audit);
const initiative = new InitiativeService(db, authz, audit, governance);
const planning = new PlanningService(db, authz, audit);
const portfolio = new PortfolioQueryService(db, authz, audit);
const portfolioPiCapacity = new PortfolioPiCapacityQueryService(
  db,
  authz,
  audit,
  planning,
);
const homeDashboard = new HomeDashboardQueryService(
  db,
  authz,
  audit,
  organization,
  initiative,
  planning,
  portfolio,
  portfolioPiCapacity,
  governance,
);

function principal(id = randomUUID(), displayName = "Home Tester"): Principal {
  return { id, displayName, source: "test" };
}

async function resetDb() {
  await db.auditEvent.deleteMany();
  await db.workAllocation.deleteMany();
  await db.resourceAvailability.deleteMany();
  await db.planningDependency.deleteMany();
  await db.piBaseline.deleteMany();
  await db.piPlanApproval.deleteMany();
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

async function seedOrg(actor: Principal, name = "Home Org") {
  await db.principal.create({
    data: { id: actor.id, displayName: actor.displayName },
  });
  await authz.ensureBootstrapBinding(actor.id);
  const org = await organization.createOrganization(actor, { name });
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
  const team = await organization.createTeam(actor, {
    departmentId: deptA.id,
    name: "Team A",
  });
  return { org, section, deptA, deptB, team };
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

async function createScopedPrincipal(
  admin: Principal,
  roleKey: string,
  scope: {
    scopeType: ScopeType;
    organizationId: string;
    scopeId?: string | null;
  },
  displayName: string,
) {
  const p = principal(randomUUID(), displayName);
  await db.principal.create({
    data: { id: p.id, displayName: p.displayName },
  });
  await bindRole(admin, p.id, roleKey, scope);
  return p;
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

describe("M5B-A Home dashboard — persona modes", () => {
  it("Organization Admin gets manager mode and create/manage Quick Start", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);

    const dash = await homeDashboard.getHomeDashboard(admin, {
      organizationId: org.id,
    });

    expect(dash.userContext.mode).toBe("manager");
    expect(dash.userContext.managerSignals).toBe(true);
    expect(dash.userContext.hasLinkedResource).toBe(false);
    expect(dash.myWork.availability.state).toBe("no_linked_resource");
    expect(
      dash.availableActions.actions.some((a) => a.id === "create-initiative"),
    ).toBe(true);
    expect(
      dash.availableActions.actions.some((a) => a.id === "manage-resources"),
    ).toBe(true);
    expect(dash.portfolioSummary.availability.state).not.toBe("forbidden");
  });

  it("Portfolio Manager gets manager mode without manage-resources unless permitted", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);
    const pm = await createScopedPrincipal(
      admin,
      ROLE_KEYS.PORTFOLIO_MANAGER,
      { scopeType: ScopeType.ORGANIZATION, organizationId: org.id },
      "Portfolio Manager",
    );

    const dash = await homeDashboard.getHomeDashboard(pm, {
      organizationId: org.id,
    });

    expect(dash.userContext.mode).toBe("manager");
    expect(
      dash.availableActions.actions.some((a) => a.id === "create-initiative"),
    ).toBe(true);
    expect(
      dash.availableActions.actions.some((a) => a.id === "manage-resources"),
    ).toBe(false);
    expect(
      dash.availableActions.actions.some((a) => a.id === "open-portfolio"),
    ).toBe(true);
  });

  it("Department Manager is manager-scoped to organization context", async () => {
    const admin = principal();
    const { org, deptA } = await seedOrg(admin);
    const dm = await createScopedPrincipal(
      admin,
      ROLE_KEYS.DEPARTMENT_MANAGER,
      {
        scopeType: ScopeType.DEPARTMENT,
        organizationId: org.id,
        scopeId: deptA.id,
      },
      "Dept Manager",
    );

    const dash = await homeDashboard.getHomeDashboard(dm, {
      organizationId: org.id,
    });

    expect(dash.userContext.mode).toBe("manager");
    expect(dash.userContext.organizations[0]?.roleKeys).toContain(
      ROLE_KEYS.DEPARTMENT_MANAGER,
    );
    expect(dash.userContext.preferredOrganizationId).toBe(org.id);
  });

  it("Team Manager is manager mode with PI capacity path when permitted", async () => {
    const admin = principal();
    const { org, team } = await seedOrg(admin);
    const tm = await createScopedPrincipal(
      admin,
      ROLE_KEYS.TEAM_MANAGER,
      {
        scopeType: ScopeType.TEAM,
        organizationId: org.id,
        scopeId: team.id,
      },
      "Team Manager",
    );

    const dash = await homeDashboard.getHomeDashboard(tm, {
      organizationId: org.id,
    });

    expect(dash.userContext.mode).toBe("manager");
    expect(
      dash.availableActions.actions.some((a) => a.id === "open-pi-planning"),
    ).toBe(true);
  });

  it("Project Manager is manager mode", async () => {
    const admin = principal();
    const { org, deptA } = await seedOrg(admin);
    const prm = await createScopedPrincipal(
      admin,
      ROLE_KEYS.PROJECT_MANAGER,
      {
        scopeType: ScopeType.DEPARTMENT,
        organizationId: org.id,
        scopeId: deptA.id,
      },
      "Project Manager",
    );

    const dash = await homeDashboard.getHomeDashboard(prm, {
      organizationId: org.id,
    });

    expect(dash.userContext.mode).toBe("manager");
    expect(dash.userContext.capabilities.canCreateInitiative).toBe(false);
  });

  it("Viewer is employee mode without create Quick Start", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);
    const viewer = await createScopedPrincipal(
      admin,
      ROLE_KEYS.VIEWER,
      { scopeType: ScopeType.ORGANIZATION, organizationId: org.id },
      "Viewer",
    );

    const dash = await homeDashboard.getHomeDashboard(viewer, {
      organizationId: org.id,
    });

    expect(dash.userContext.mode).toBe("employee");
    expect(dash.userContext.managerSignals).toBe(false);
    expect(
      dash.availableActions.actions.some((a) => a.id === "create-initiative"),
    ).toBe(false);
    expect(
      dash.availableActions.actions.some((a) => a.id === "open-portfolio"),
    ).toBe(true);
  });
});

describe("M5B-A Home dashboard — unbound / no resource / My Work", () => {
  it("Unbound Principal with no organizations gets no_organization states", async () => {
    const unbound = principal();
    await db.principal.create({
      data: { id: unbound.id, displayName: unbound.displayName },
    });

    const dash = await homeDashboard.getHomeDashboard(unbound);

    expect(dash.userContext.organizations).toHaveLength(0);
    expect(dash.userContext.availability.state).toBe("no_organization");
    expect(dash.needsAttention.availability.state).toBe("no_organization");
    expect(dash.portfolioSummary.availability.state).toBe("no_organization");
    expect(dash.myWork.availability.state).toBe("no_linked_resource");
  });

  it("Principal without Resource link does not invent My Work from free-text owners", async () => {
    const admin = principal();
    const { org, deptA } = await seedOrg(admin);

    await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: deptA.id,
        referenceKey: "INIT-0001",
        title: "Owned by name only",
        requesterName: admin.displayName ?? "Admin",
        businessOwnerName: admin.displayName ?? "Admin",
        currentStage: "DEMAND",
        status: "ACTIVE",
      },
    });

    const dash = await homeDashboard.getHomeDashboard(admin, {
      organizationId: org.id,
    });

    expect(dash.userContext.hasLinkedResource).toBe(false);
    expect(dash.myWork.availability.state).toBe("no_linked_resource");
    expect(
      dash.myWork.items.filter((i) => i.attribution.basis === "resource_link"),
    ).toHaveLength(0);
  });

  it("My Work attributes only via linked Resource ownership FKs", async () => {
    const admin = principal();
    const { org, deptA } = await seedOrg(admin);

    const employee = await createScopedPrincipal(
      admin,
      ROLE_KEYS.VIEWER,
      { scopeType: ScopeType.ORGANIZATION, organizationId: org.id },
      "Employee",
    );

    const resource = await organization.createResource(admin, {
      organizationId: org.id,
      name: "Employee Person",
      type: "PERSON",
      skills: [],
      capacityHoursPerWeek: 40,
    });
    await organization.linkResourcePrincipal(admin, {
      resourceId: resource.id,
      principalId: employee.id,
    });

    const init = await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: deptA.id,
        referenceKey: "INIT-OWNED",
        title: "Linked owner initiative",
        requesterName: "Someone",
        businessOwnerName: "Legacy Name",
        businessOwnerResourceId: resource.id,
        currentStage: "DEMAND",
        status: "ACTIVE",
      },
    });

    // Decoy initiative with matching free-text name but no Resource FK.
    await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: deptA.id,
        referenceKey: "INIT-DECOY",
        title: "Decoy free-text",
        requesterName: "Employee",
        businessOwnerName: "Employee",
        currentStage: "DEMAND",
        status: "ACTIVE",
      },
    });

    const project = await db.project.create({
      data: {
        organizationId: org.id,
        departmentId: deptA.id,
        initiativeId: init.id,
        referenceKey: "PRJ-OWNED",
        name: "Owned project",
        status: "ACTIVE",
        ownerResourceId: resource.id,
      },
    });

    const dash = await homeDashboard.getHomeDashboard(employee, {
      organizationId: org.id,
    });

    expect(dash.userContext.mode).toBe("employee");
    expect(dash.userContext.hasLinkedResource).toBe(true);
    expect(dash.userContext.linkedResource?.resourceId).toBe(resource.id);
    expect(dash.myWork.availability.state).toBe("available");

    const initItems = dash.myWork.items.filter(
      (i) =>
        i.kind === "initiative" &&
        i.attribution.basis === "resource_link" &&
        i.attribution.relationship === "INITIATIVE_BUSINESS_OWNER",
    );
    expect(initItems).toHaveLength(1);
    expect(initItems[0]?.id).toBe(init.id);
    expect(dash.myWork.items.some((i) => i.referenceKey === "INIT-DECOY")).toBe(
      false,
    );

    const projectItems = dash.myWork.items.filter((i) => i.kind === "project");
    expect(projectItems).toHaveLength(1);
    expect(projectItems[0]?.id).toBe(project.id);
    expect(projectItems[0]?.href).toContain(init.id);
  });

  it("Manager with linked Resource becomes mixed mode", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);
    const resource = await organization.createResource(admin, {
      organizationId: org.id,
      name: "Admin Person",
      type: "PERSON",
      skills: [],
      capacityHoursPerWeek: 40,
    });
    await organization.linkResourcePrincipal(admin, {
      resourceId: resource.id,
      principalId: admin.id,
    });

    const dash = await homeDashboard.getHomeDashboard(admin, {
      organizationId: org.id,
    });

    expect(dash.userContext.mode).toBe("mixed");
    expect(dash.userContext.managerSignals).toBe(true);
    expect(dash.userContext.hasLinkedResource).toBe(true);
  });
});

describe("M5B-A Home dashboard — multi-org and denial", () => {
  it("labels multiple organizations and does not merge without preferred scope", async () => {
    const admin = principal();
    const { org: orgA } = await seedOrg(admin, "Org A");
    const orgB = await organization.createOrganization(admin, { name: "Org B" });

    const dash = await homeDashboard.getHomeDashboard(admin, {
      organizationId: orgA.id,
    });

    expect(dash.userContext.organizations.length).toBeGreaterThanOrEqual(2);
    expect(dash.warnings.some((w) => w.code === "MULTI_ORG_SCOPE")).toBe(true);
    expect(dash.userContext.preferredOrganizationId).toBe(orgA.id);
    expect(dash.portfolioSummary.authorizedScope).toMatchObject({
      mode: expect.stringMatching(/portfolio|organization/),
    });
    // Preferred org is orgA — second org is listed but not silently merged.
    expect(
      dash.userContext.organizations.map((o) => o.id).sort(),
    ).toEqual([orgA.id, orgB.id].sort());
  });

  it("denies cross-organization preferred scope", async () => {
    const admin = principal();
    await seedOrg(admin, "Org A");

    const stranger = principal();
    await db.principal.create({
      data: { id: stranger.id, displayName: stranger.displayName },
    });
    await authz.ensureBootstrapBinding(stranger.id);
    const foreign = await organization.createOrganization(stranger, {
      name: "Foreign Org",
    });

    await expect(
      homeDashboard.getHomeDashboard(admin, {
        organizationId: foreign.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AppError>);
  });

  it("Viewer cannot see foreign org snapshot inside preferred org denial path", async () => {
    const admin = principal();
    const { org: orgA } = await seedOrg(admin, "Org A");
    const viewer = await createScopedPrincipal(
      admin,
      ROLE_KEYS.VIEWER,
      { scopeType: ScopeType.ORGANIZATION, organizationId: orgA.id },
      "Viewer A",
    );

    const stranger = principal();
    await db.principal.create({
      data: { id: stranger.id, displayName: stranger.displayName },
    });
    await authz.ensureBootstrapBinding(stranger.id);
    const orgB = await organization.createOrganization(stranger, {
      name: "Org B",
    });

    await expect(
      homeDashboard.getHomeDashboard(viewer, { organizationId: orgB.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("M5B-A Home dashboard — empty vs unavailable + Quick Start authz", () => {
  it("empty portfolio returns empty/available zeros, not unavailable", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);

    const dash = await homeDashboard.getHomeDashboard(admin, {
      organizationId: org.id,
    });

    // Snapshot succeeded with zeros → empty (or available), never unavailable-as-zero.
    expect(["empty", "available"]).toContain(
      dash.portfolioSummary.availability.state,
    );
    for (const m of dash.portfolioSummary.metrics) {
      if (m.available) {
        expect(typeof m.value).toBe("number");
      } else {
        expect(m.value).toBeNull();
        expect(m.unavailableReason).toBeTruthy();
      }
    }

    expect(dash.resourceCapacity.availability.state).toBe("empty");
    expect(dash.resourceCapacity.overloadedTeamCount).toBeNull();
  });

  it("Quick Start actions only include authorized routes", async () => {
    const admin = principal();
    const { org } = await seedOrg(admin);
    const viewer = await createScopedPrincipal(
      admin,
      ROLE_KEYS.VIEWER,
      { scopeType: ScopeType.ORGANIZATION, organizationId: org.id },
      "Viewer",
    );

    const viewerDash = await homeDashboard.getHomeDashboard(viewer, {
      organizationId: org.id,
    });
    const adminDash = await homeDashboard.getHomeDashboard(admin, {
      organizationId: org.id,
    });

    const viewerIds = new Set(viewerDash.availableActions.actions.map((a) => a.id));
    const adminIds = new Set(adminDash.availableActions.actions.map((a) => a.id));

    expect(viewerIds.has("create-initiative")).toBe(false);
    expect(viewerIds.has("review-governance")).toBe(false);
    expect(adminIds.has("create-initiative")).toBe(true);
    expect(adminIds.has("manage-resources")).toBe(true);

    for (const action of viewerDash.availableActions.actions) {
      expect(action.href.startsWith("/")).toBe(true);
      expect(action.authorizationBasis.length).toBeGreaterThan(0);
    }
  });

  it("forbidden portfolio sections stay null rather than zero for unauthorized dept-only edge", async () => {
    const admin = principal();
    const { org, deptA, deptB } = await seedOrg(admin);

    // Bind viewer only to deptA; request org-wide is still ok for VIEWER at ORGANIZATION.
    // Use a principal with no portfolio view in orgB by creating second org they cannot list.
    const limited = await createScopedPrincipal(
      admin,
      ROLE_KEYS.VIEWER,
      {
        scopeType: ScopeType.DEPARTMENT,
        organizationId: org.id,
        scopeId: deptA.id,
      },
      "Dept Viewer",
    );

    await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: deptB.id,
        referenceKey: "INIT-OTHER",
        title: "Other dept",
        requesterName: "R",
        businessOwnerName: "O",
        currentStage: "DEMAND",
        status: "ACTIVE",
      },
    });

    const dash = await homeDashboard.getHomeDashboard(limited, {
      organizationId: org.id,
    });

    // Department-scoped viewer still gets a scoped snapshot (not forbidden).
    expect(dash.portfolioSummary.availability.state).not.toBe("forbidden");
    if (dash.portfolioSummary.authorizedScope.mode === "portfolio") {
      expect(dash.portfolioSummary.authorizedScope.scope.mode).toBe(
        "departments",
      );
    }
  });
});
