import { randomUUID } from "crypto";
import { PrismaClient, ScopeType } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { InitiativeService } from "@/modules/initiative/application/initiative-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { ROLE_KEYS, PERMISSIONS } from "@/modules/shared/permissions";
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
const initiative = new InitiativeService(db, authz, audit);

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

async function seedOrgTree(actor: Principal) {
  await db.principal.create({ data: { id: actor.id, displayName: "Admin" } });
  const org = await organization.createOrganization(actor, { name: "Org 0C" });
  const sectionA = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section A",
  });
  const sectionB = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section B",
  });
  const deptA1 = await organization.createDepartment(actor, {
    sectionId: sectionA.id,
    name: "Dept A1",
  });
  const deptA2 = await organization.createDepartment(actor, {
    sectionId: sectionA.id,
    name: "Dept A2",
  });
  const teamA1 = await organization.createTeam(actor, {
    departmentId: deptA1.id,
    name: "Team A1",
  });
  const teamA2 = await organization.createTeam(actor, {
    departmentId: deptA2.id,
    name: "Team A2",
  });
  return { org, sectionA, sectionB, deptA1, deptA2, teamA1, teamA2 };
}

async function bindRole(
  actor: Principal,
  targetId: string,
  roleKey: string,
  scope: {
    scopeType: ScopeType;
    organizationId?: string;
    scopeId?: string | null;
  },
) {
  await authz.ensureSystemRoles();
  const role = await db.roleDefinition.findUniqueOrThrow({ where: { key: roleKey } });
  return authz.assignRoleBinding(actor, {
    principalId: targetId,
    roleDefinitionId: role.id,
    scopeType: scope.scopeType,
    organizationId: scope.organizationId ?? null,
    scopeId: scope.scopeId ?? null,
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

describe("Phase 0C — PLATFORM hardening", () => {
  it("PLATFORM binding does not satisfy ORGANIZATION initiative edit", async () => {
    const actor = principal();
    const { org, deptA1 } = await seedOrgTree(actor);

    // Strip org admin; keep only PLATFORM bootstrap binding
    await db.roleBinding.deleteMany({
      where: { principalId: actor.id, scopeType: ScopeType.ORGANIZATION },
    });

    const init = await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: deptA1.id,
        referenceKey: "INIT-P",
        title: "Platform only",
        requesterName: "R",
        businessOwnerName: "O",
      },
    });

    await expect(
      authz.assertCan(actor, PERMISSIONS.INITIATIVE_EDIT, {
        type: "DEPARTMENT",
        organizationId: org.id,
        departmentId: deptA1.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // PLATFORM request still works for platform permission
    await expect(
      authz.assertCan(actor, PERMISSIONS.PLATFORM_BOOTSTRAP, {
        type: "PLATFORM",
      }),
    ).resolves.toBeUndefined();

    // Org structure manage at PLATFORM still works (second-org path)
    await expect(
      authz.assertCan(actor, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
        type: "PLATFORM",
      }),
    ).resolves.toBeUndefined();

    void init;
  });

  it("bootstrap remains recoverable: empty → create org → org admin can edit", async () => {
    const actor = principal();
    await db.principal.create({ data: { id: actor.id, displayName: "Boot" } });
    await authz.ensureBootstrapBinding(actor.id);

    const org = await organization.createOrganization(actor, { name: "First" });
    const section = await organization.createSection(actor, {
      organizationId: org.id,
      name: "S",
    });
    const dept = await organization.createDepartment(actor, {
      sectionId: section.id,
      name: "D",
    });
    const created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: dept.id,
      title: "After bootstrap",
      requesterName: "R",
      businessOwnerName: "O",
    });
    expect(created.id).toBeTruthy();
  });
});

describe("Phase 0C — hierarchy scopes", () => {
  it("Department Manager operates in department, not sibling, not other org", async () => {
    const admin = principal();
    const { org, deptA1, deptA2 } = await seedOrgTree(admin);

    const mgr = principal();
    await db.principal.create({ data: { id: mgr.id, displayName: "DeptMgr" } });
    await bindRole(admin, mgr.id, ROLE_KEYS.DEPARTMENT_MANAGER, {
      scopeType: ScopeType.DEPARTMENT,
      organizationId: org.id,
      scopeId: deptA1.id,
    });

    await expect(
      authz.assertCan(mgr, PERMISSIONS.INITIATIVE_EDIT, {
        type: "DEPARTMENT",
        organizationId: org.id,
        departmentId: deptA1.id,
      }),
    ).resolves.toBeUndefined();

    await expect(
      authz.assertCan(mgr, PERMISSIONS.INITIATIVE_EDIT, {
        type: "DEPARTMENT",
        organizationId: org.id,
        departmentId: deptA2.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const orgB = await organization.createOrganization(admin, { name: "Org B" });
    const sectionB = await organization.createSection(admin, {
      organizationId: orgB.id,
      name: "SB",
    });
    const deptB = await organization.createDepartment(admin, {
      sectionId: sectionB.id,
      name: "DB",
    });
    await expect(
      authz.assertCan(mgr, PERMISSIONS.INITIATIVE_EDIT, {
        type: "DEPARTMENT",
        organizationId: orgB.id,
        departmentId: deptB.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("Section Manager reaches descendant departments, not sibling section", async () => {
    const admin = principal();
    const { org, sectionA, sectionB, deptA1 } = await seedOrgTree(admin);
    const mgr = principal();
    await db.principal.create({ data: { id: mgr.id, displayName: "SecMgr" } });
    await bindRole(admin, mgr.id, ROLE_KEYS.SECTION_MANAGER, {
      scopeType: ScopeType.SECTION,
      organizationId: org.id,
      scopeId: sectionA.id,
    });

    await expect(
      authz.assertCan(mgr, PERMISSIONS.INITIATIVE_EDIT, {
        type: "DEPARTMENT",
        organizationId: org.id,
        departmentId: deptA1.id,
      }),
    ).resolves.toBeUndefined();

    await expect(
      authz.assertCan(mgr, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
        type: "SECTION",
        organizationId: org.id,
        sectionId: sectionB.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("Team Manager cannot escalate to department administration", async () => {
    const admin = principal();
    const { org, deptA1, teamA1, teamA2 } = await seedOrgTree(admin);
    const mgr = principal();
    await db.principal.create({ data: { id: mgr.id, displayName: "TeamMgr" } });
    await bindRole(admin, mgr.id, ROLE_KEYS.TEAM_MANAGER, {
      scopeType: ScopeType.TEAM,
      organizationId: org.id,
      scopeId: teamA1.id,
    });

    await expect(
      authz.assertCan(mgr, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
        type: "TEAM",
        organizationId: org.id,
        teamId: teamA1.id,
      }),
    ).resolves.toBeUndefined();

    await expect(
      authz.assertCan(mgr, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
        type: "TEAM",
        organizationId: org.id,
        teamId: teamA2.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      authz.assertCan(mgr, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
        type: "DEPARTMENT",
        organizationId: org.id,
        departmentId: deptA1.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("TEAM binding no longer satisfies ORGANIZATION requests", async () => {
    const admin = principal();
    const { org, teamA1 } = await seedOrgTree(admin);
    const mgr = principal();
    await db.principal.create({ data: { id: mgr.id, displayName: "T" } });
    await bindRole(admin, mgr.id, ROLE_KEYS.TEAM_MANAGER, {
      scopeType: ScopeType.TEAM,
      organizationId: org.id,
      scopeId: teamA1.id,
    });
    await expect(
      authz.assertCan(mgr, PERMISSIONS.ORG_STRUCTURE_READ, {
        type: "ORGANIZATION",
        organizationId: org.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Phase 0C — Organization Admin isolation", () => {
  it("org admin cannot mutate another organization", async () => {
    const admin = principal();
    const { org } = await seedOrgTree(admin);
    const orgB = await organization.createOrganization(admin, { name: "Other" });

    const orgAdmin = principal();
    await db.principal.create({ data: { id: orgAdmin.id, displayName: "OA" } });
    // Remove any accidental bindings; grant only Org A
    await bindRole(admin, orgAdmin.id, ROLE_KEYS.ORGANIZATION_ADMIN, {
      scopeType: ScopeType.ORGANIZATION,
      organizationId: org.id,
      scopeId: org.id,
    });

    await expect(
      authz.assertCan(orgAdmin, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
        type: "ORGANIZATION",
        organizationId: org.id,
      }),
    ).resolves.toBeUndefined();

    await expect(
      authz.assertCan(orgAdmin, PERMISSIONS.ORG_STRUCTURE_MANAGE, {
        type: "ORGANIZATION",
        organizationId: orgB.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      authz.assertCan(orgAdmin, PERMISSIONS.PLATFORM_BOOTSTRAP, {
        type: "PLATFORM",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Phase 0C — Viewer cannot mutate", () => {
  it("viewer is forbidden for edit mutations server-side", async () => {
    const admin = principal();
    const { org, deptA1 } = await seedOrgTree(admin);
    const viewer = principal();
    await db.principal.create({ data: { id: viewer.id, displayName: "V" } });
    await bindRole(admin, viewer.id, ROLE_KEYS.VIEWER, {
      scopeType: ScopeType.ORGANIZATION,
      organizationId: org.id,
      scopeId: org.id,
    });

    await expect(
      authz.assertCan(viewer, PERMISSIONS.INITIATIVE_VIEW, {
        type: "DEPARTMENT",
        organizationId: org.id,
        departmentId: deptA1.id,
      }),
    ).resolves.toBeUndefined();

    await expect(
      authz.assertCan(viewer, PERMISSIONS.INITIATIVE_EDIT, {
        type: "DEPARTMENT",
        organizationId: org.id,
        departmentId: deptA1.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      initiative.createInitiative(viewer, {
        organizationId: org.id,
        departmentId: deptA1.id,
        title: "Nope",
        requesterName: "R",
        businessOwnerName: "O",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Phase 0C — ownership relationship authorization", () => {
  it("linked Principal who owns Initiative may edit; wrong Principal denied", async () => {
    const admin = principal();
    const { org, deptA1 } = await seedOrgTree(admin);

    const ownerPrincipal = principal();
    await db.principal.create({
      data: { id: ownerPrincipal.id, displayName: "Owner" },
    });
    const ownerResource = await organization.createResource(admin, {
      organizationId: org.id,
      name: "Owner Person",
      type: "PERSON",
      skills: [],
      capacityHoursPerWeek: 40,
    });
    await organization.linkResourcePrincipal(admin, {
      resourceId: ownerResource.id,
      principalId: ownerPrincipal.id,
    });

    const init = await initiative.createInitiative(admin, {
      organizationId: org.id,
      departmentId: deptA1.id,
      title: "Owned",
      requesterName: "R",
      businessOwnerResourceId: ownerResource.id,
    });

    // Owner has no role binding — only relationship
    await expect(
      initiative.updateInitiative(ownerPrincipal, {
        id: init.id,
        title: "Owned updated",
        requesterName: init.requesterName,
        businessOwnerResourceId: ownerResource.id,
        expectedVersion: init.version,
      }),
    ).resolves.toMatchObject({ title: "Owned updated" });

    const stranger = principal();
    await db.principal.create({
      data: { id: stranger.id, displayName: "Stranger" },
    });
    await expect(
      initiative.updateInitiative(stranger, {
        id: init.id,
        title: "Hijack",
        requesterName: init.requesterName,
        businessOwnerResourceId: ownerResource.id,
        expectedVersion: init.version + 1,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("owner Resource without Principal link grants no login authorization", async () => {
    const admin = principal();
    const { org, deptA1 } = await seedOrgTree(admin);
    const resource = await organization.createResource(admin, {
      organizationId: org.id,
      name: "No Login",
      type: "PERSON",
      skills: [],
      capacityHoursPerWeek: 40,
    });
    expect(resource.linkedPrincipalId).toBeNull();

    const init = await initiative.createInitiative(admin, {
      organizationId: org.id,
      departmentId: deptA1.id,
      title: "Owned no login",
      requesterName: "R",
      businessOwnerResourceId: resource.id,
    });

    const unprivileged = principal();
    await db.principal.create({
      data: { id: unprivileged.id, displayName: "Nobody" },
    });
    await expect(
      authz.assertCan(
        unprivileged,
        PERMISSIONS.INITIATIVE_EDIT,
        {
          type: "DEPARTMENT",
          organizationId: org.id,
          departmentId: deptA1.id,
        },
        { kind: "INITIATIVE_BUSINESS_OWNER", initiativeId: init.id },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ownership does not grant decision.make", async () => {
    const admin = principal();
    const { org, deptA1 } = await seedOrgTree(admin);
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
      departmentId: deptA1.id,
      title: "Gov",
      requesterName: "R",
      businessOwnerResourceId: ownerResource.id,
    });

    await expect(
      authz.assertCan(
        ownerPrincipal,
        PERMISSIONS.DECISION_MAKE,
        { type: "ORGANIZATION", organizationId: org.id },
        { kind: "INITIATIVE_BUSINESS_OWNER", initiativeId: init.id },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Phase 0C — role binding admin + audit + lockout", () => {
  it("assigns and expires bindings with audit; blocks last org admin expire", async () => {
    const admin = principal();
    const { org } = await seedOrgTree(admin);
    await authz.ensureSystemRoles();
    const viewerRole = await db.roleDefinition.findUniqueOrThrow({
      where: { key: ROLE_KEYS.VIEWER },
    });
    const target = principal();
    await db.principal.create({ data: { id: target.id, displayName: "T" } });

    const binding = await authz.assignRoleBinding(admin, {
      principalId: target.id,
      roleDefinitionId: viewerRole.id,
      scopeType: ScopeType.ORGANIZATION,
      organizationId: org.id,
      scopeId: org.id,
    });

    const createdEvents = await db.auditEvent.findMany({
      where: { actionType: "role_binding.created", subjectId: binding.id },
    });
    expect(createdEvents).toHaveLength(1);

    await authz.expireRoleBinding(admin, { bindingId: binding.id });
    const expiredEvents = await db.auditEvent.findMany({
      where: { actionType: "role_binding.expired", subjectId: binding.id },
    });
    expect(expiredEvents).toHaveLength(1);

    const orgAdminBinding = await db.roleBinding.findFirst({
      where: {
        principalId: admin.id,
        organizationId: org.id,
        scopeType: ScopeType.ORGANIZATION,
        effectiveTo: null,
        roleDefinition: { key: ROLE_KEYS.ORGANIZATION_ADMIN },
      },
    });
    expect(orgAdminBinding).toBeTruthy();
    await expect(
      authz.expireRoleBinding(admin, { bindingId: orgAdminBinding!.id }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("Phase 0C — Phase 0A/0B regression smoke", () => {
  it("ownership query and principal link still work", async () => {
    const admin = principal();
    const { org, deptA1 } = await seedOrgTree(admin);
    const person = await organization.createResource(admin, {
      organizationId: org.id,
      name: "Linked",
      type: "PERSON",
      skills: [],
      capacityHoursPerWeek: 40,
    });
    const target = await db.principal.create({
      data: { displayName: "Linked User" },
    });
    await organization.linkResourcePrincipal(admin, {
      resourceId: person.id,
      principalId: target.id,
    });
    const init = await initiative.createInitiative(admin, {
      organizationId: org.id,
      departmentId: deptA1.id,
      title: "Owned",
      requesterName: "R",
      businessOwnerResourceId: person.id,
    });
    const ownership = await organization.getResourceOwnership(admin, person.id);
    expect(ownership.ownership.initiativesAsBusinessOwner.map((i) => i.id)).toContain(
      init.id,
    );
    expect(ownership.resource.linkedPrincipalId).toBe(target.id);
  });
});
