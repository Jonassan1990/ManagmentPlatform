import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { InitiativeService } from "@/modules/initiative/application/initiative-service";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { ProjectService } from "@/modules/project/application/project-service";
import { GovernanceService } from "@/modules/governance/application/governance-service";
import { AppError } from "@/modules/shared/errors";
import { displayOwnerName } from "@/modules/organization/application/ownership-policy";
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
const project = new ProjectService(db, authz, audit);
const governance = new GovernanceService(db, authz, audit);

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

async function seedOrg(actor: Principal) {
  await db.principal.create({ data: { id: actor.id, displayName: "Actor" } });
  const org = await organization.createOrganization(actor, { name: "Org 0B" });
  const section = await organization.createSection(actor, {
    organizationId: org.id,
    name: "Section",
  });
  const department = await organization.createDepartment(actor, {
    sectionId: section.id,
    name: "Dept",
  });
  const team = await organization.createTeam(actor, {
    departmentId: department.id,
    name: "Team Alpha",
  });
  return { org, department, team };
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

describe("Phase 0B — migration legacy compatibility", () => {
  it("preserves text-only ownership with null Resource FKs", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);

    const created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Legacy text owner",
      requesterName: "Requester",
      businessOwnerName: "Old Owner",
    });

    expect(created.businessOwnerName).toBe("Old Owner");
    expect(created.businessOwnerResourceId).toBeNull();
    expect(created.requesterResourceId).toBeNull();
    expect(created.sponsorResourceId).toBeNull();

    const reloaded = await db.initiative.findUnique({ where: { id: created.id } });
    expect(reloaded?.businessOwnerName).toBe("Old Owner");
    expect(reloaded?.businessOwnerResourceId).toBeNull();
    expect(displayOwnerName(null, reloaded?.businessOwnerName)).toBe("Old Owner");
  });
});

describe("Phase 0B — Initiative structured ownership", () => {
  it("creates with PERSON owner, writes FK + name snapshot, audits", async () => {
    const actor = principal();
    const { org, department, team } = await seedOrg(actor);
    const person = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Jane Doe",
      type: "PERSON",
      skills: [],
      capacityHoursPerWeek: 40,
      primaryTeamId: team.id,
    });

    const created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Structured owner",
      requesterName: "Req",
      businessOwnerResourceId: person.id,
      businessOwnerName: "ignored-when-resource-set",
    });

    expect(created.businessOwnerResourceId).toBe(person.id);
    expect(created.businessOwnerName).toBe("Jane Doe");

    const events = await db.auditEvent.findMany({
      where: { subjectId: created.id, actionType: "initiative.created" },
    });
    expect(events).toHaveLength(1);
    const payload = events[0].payload as Record<string, unknown>;
    expect(payload.businessOwnerResourceId).toBe(person.id);
    expect(payload.businessOwnerName).toBe("Jane Doe");
  });

  it("rejects OTHER resource as business owner", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const other = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Lab Kit",
      type: "OTHER",
      capacityHoursPerWeek: 0,
    });

    await expect(
      initiative.createInitiative(actor, {
        organizationId: org.id,
        departmentId: department.id,
        title: "Bad owner type",
        requesterName: "Req",
        businessOwnerResourceId: other.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects cross-org owner Resource", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const orgB = await organization.createOrganization(actor, { name: "Org B" });
    const foreign = await organization.createResource(actor, {
      organizationId: orgB.id,
      name: "Foreign Person",
      type: "PERSON",
      capacityHoursPerWeek: 40,
    });

    await expect(
      initiative.createInitiative(actor, {
        organizationId: org.id,
        departmentId: department.id,
        title: "Cross org",
        requesterName: "Req",
        businessOwnerResourceId: foreign.id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects nonexistent Resource", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    await expect(
      initiative.createInitiative(actor, {
        organizationId: org.id,
        departmentId: department.id,
        title: "Missing",
        requesterName: "Req",
        businessOwnerResourceId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows owner Resource without linked Principal", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const person = await organization.createResource(actor, {
      organizationId: org.id,
      name: "No Login Owner",
      type: "PERSON",
      capacityHoursPerWeek: 32,
    });
    expect(person.linkedPrincipalId).toBeNull();

    const created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "No login ownership",
      requesterName: "Req",
      businessOwnerResourceId: person.id,
    });
    expect(created.businessOwnerResourceId).toBe(person.id);
    expect(created.businessOwnerName).toBe("No Login Owner");
  });

  it("updates ownership and audits old/new Resource FKs", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const a = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Owner A",
      type: "PERSON",
      capacityHoursPerWeek: 40,
    });
    const b = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Owner B",
      type: "PERSON",
      capacityHoursPerWeek: 40,
    });

    const created = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Swap owner",
      requesterName: "Req",
      businessOwnerResourceId: a.id,
    });

    const updated = await initiative.updateInitiative(actor, {
      id: created.id,
      title: created.title,
      requesterName: created.requesterName,
      businessOwnerResourceId: b.id,
      expectedVersion: created.version,
    });
    expect(updated.businessOwnerResourceId).toBe(b.id);
    expect(updated.businessOwnerName).toBe("Owner B");

    const events = await db.auditEvent.findMany({
      where: { subjectId: created.id, actionType: "initiative.updated" },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
    const payload = events[events.length - 1].payload as Record<string, unknown>;
    expect(payload.oldBusinessOwnerResourceId).toBe(a.id);
    expect(payload.newBusinessOwnerResourceId).toBe(b.id);
    expect(payload.oldBusinessOwnerName).toBe("Owner A");
    expect(payload.newBusinessOwnerName).toBe("Owner B");
  });
});

describe("Phase 0B — Resource ownership queryability", () => {
  it("lists initiatives/projects/risks owned by a Resource", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const person = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Portfolio Owner",
      type: "PERSON",
      capacityHoursPerWeek: 40,
    });

    const init = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Owned init",
      requesterName: "Req",
      businessOwnerResourceId: person.id,
    });

    await initiative.createRisk(actor, {
      initiativeId: init.id,
      title: "Owned risk",
      description: "Desc",
      ownerResourceId: person.id,
      probability: "MEDIUM",
      impact: "HIGH",
      status: "OPEN",
    });

    // Direct project row (conversion path tested in pilot-project suite)
    const proj = await db.project.create({
      data: {
        initiativeId: init.id,
        organizationId: org.id,
        departmentId: department.id,
        referenceKey: "PRJ-0001",
        name: "Owned project",
        ownerName: person.name,
        ownerResourceId: person.id,
        status: "ACTIVE",
        priority: "MEDIUM",
        currencyCode: "EUR",
      },
    });

    const result = await organization.getResourceOwnership(actor, person.id);
    expect(result.resource.id).toBe(person.id);
    expect(result.ownership.initiativesAsBusinessOwner.map((i) => i.id)).toContain(
      init.id,
    );
    expect(result.ownership.projects.map((p) => p.id)).toContain(proj.id);
    expect(result.ownership.risks).toHaveLength(1);
    expect(result.ownership.risks[0].title).toBe("Owned risk");
  });
});

describe("Phase 0B — Project structured ownership", () => {
  it("persists ownerResourceId and keeps legacy readable", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const person = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Proj Owner",
      type: "PERSON",
      capacityHoursPerWeek: 40,
    });
    const init = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "For project",
      requesterName: "Req",
      businessOwnerName: "Legacy Init Owner",
    });

    const legacyProject = await db.project.create({
      data: {
        initiativeId: init.id,
        organizationId: org.id,
        departmentId: department.id,
        referenceKey: "PRJ-LEGACY",
        name: "Legacy project",
        ownerName: "Old Project Owner",
        ownerResourceId: null,
        status: "ACTIVE",
        priority: "MEDIUM",
        currencyCode: "EUR",
      },
    });
    expect(legacyProject.ownerResourceId).toBeNull();
    expect(displayOwnerName(null, legacyProject.ownerName)).toBe(
      "Old Project Owner",
    );

    const updated = await project.updateProject(actor, {
      projectId: legacyProject.id,
      expectedVersion: legacyProject.version,
      name: legacyProject.name,
      ownerResourceId: person.id,
      ownerName: "ignored",
      status: "ACTIVE",
      priority: "MEDIUM",
    });
    expect(updated.ownerResourceId).toBe(person.id);
    expect(updated.ownerName).toBe("Proj Owner");

    const events = await db.auditEvent.findMany({
      where: { subjectId: legacyProject.id, actionType: "project.updated" },
    });
    const payload = events[0].payload as Record<string, unknown>;
    expect(payload.oldOwnerResourceId).toBeNull();
    expect(payload.newOwnerResourceId).toBe(person.id);
    expect(payload.oldOwnerName).toBe("Old Project Owner");
    expect(payload.newOwnerName).toBe("Proj Owner");
  });
});

describe("Phase 0B — PoC ownership (lifecycle unchanged)", () => {
  it("accepts PERSON owner on PoC create without altering stage rules", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const person = await organization.createResource(actor, {
      organizationId: org.id,
      name: "PoC Owner",
      type: "PERSON",
      capacityHoursPerWeek: 40,
    });
    const init = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "PoC path",
      requesterName: "Req",
      businessOwnerName: "Owner",
    });

    // PoC creation requires PRE_STUDY readiness + GO gate in full journey;
    // here we only validate ownership validation rejects OTHER / accepts PERSON
    // when createPoC is reachable. Direct DB PoC + update covers ownership write.
    const poc = await db.poC.create({
      data: {
        initiativeId: init.id,
        title: "Experiment",
        objective: "Obj",
        hypothesis: "Hyp",
        scope: "Scope",
        ownerName: "Old",
        ownerResourceId: null,
        status: "DRAFT",
      },
    });

    const updated = await governance.updatePoC(actor, {
      pocId: poc.id,
      expectedVersion: poc.version,
      title: poc.title,
      objective: poc.objective,
      hypothesis: poc.hypothesis,
      scope: poc.scope,
      ownerResourceId: person.id,
    });
    expect(updated.ownerResourceId).toBe(person.id);
    expect(updated.ownerName).toBe("PoC Owner");
    expect(updated.status).toBe("DRAFT");

    await expect(
      governance.updatePoC(actor, {
        pocId: updated.id,
        expectedVersion: updated.version,
        title: updated.title,
        objective: updated.objective,
        hypothesis: updated.hypothesis,
        scope: updated.scope,
        ownerResourceId: (
          await organization.createResource(actor, {
            organizationId: org.id,
            name: "Equipment",
            type: "OTHER",
            capacityHoursPerWeek: 0,
          })
        ).id,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("Phase 0B — Phase 0A regression (link intact)", () => {
  it("Resource can own without Principal; link still works independently", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const person = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Linkable Owner",
      type: "PERSON",
      capacityHoursPerWeek: 40,
    });
    const init = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Own then link",
      requesterName: "Req",
      businessOwnerResourceId: person.id,
    });
    expect(init.businessOwnerResourceId).toBe(person.id);
    expect(person.linkedPrincipalId).toBeNull();

    const target = await db.principal.create({
      data: { displayName: "Linked User" },
    });
    const linked = await organization.linkResourcePrincipal(actor, {
      resourceId: person.id,
      principalId: target.id,
    });
    expect(linked.linkedPrincipalId).toBe(target.id);

    const ownership = await organization.getResourceOwnership(actor, person.id);
    expect(ownership.ownership.initiativesAsBusinessOwner).toHaveLength(1);
    expect(ownership.resource.linkedPrincipalId).toBe(target.id);
  });
});

describe("Phase 0B — Resource delete SET NULL", () => {
  it("deleting Resource clears ownership FKs without deleting Initiative", async () => {
    const actor = principal();
    const { org, department } = await seedOrg(actor);
    const person = await organization.createResource(actor, {
      organizationId: org.id,
      name: "To Delete",
      type: "PERSON",
      capacityHoursPerWeek: 40,
    });
    const init = await initiative.createInitiative(actor, {
      organizationId: org.id,
      departmentId: department.id,
      title: "Survives delete",
      requesterName: "Req",
      businessOwnerResourceId: person.id,
    });

    // Soft-archive is the domain path; hard-delete Resource to assert FK SET NULL.
    await db.resource.delete({ where: { id: person.id } });
    const reloaded = await db.initiative.findUnique({ where: { id: init.id } });
    expect(reloaded).not.toBeNull();
    expect(reloaded?.businessOwnerResourceId).toBeNull();
    expect(reloaded?.businessOwnerName).toBe("To Delete");
  });
});
