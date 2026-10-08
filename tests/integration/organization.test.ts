import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import type { Principal } from "@/modules/identity-access/domain/types";
import { OrganizationService } from "@/modules/organization/application/organization-service";
import { AppError } from "@/modules/shared/errors";
import { resetEnvCacheForTests } from "@/server/env";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://mgmt:mgmt_dev_only@localhost:5432/management_platform?schema=public";

process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = process.env.DIRECT_URL ?? databaseUrl;
process.env.ALLOW_DEV_AUTH = "false";
resetEnvCacheForTests();

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);
const organization = new OrganizationService(db, authz, audit);

function principal(id = randomUUID()): Principal {
  return { id, displayName: "Test Principal", source: "test" };
}

async function resetDb() {
  await db.auditEvent.deleteMany();
  // Phase 5 PI Planning — FK-safe order (workAllocation before work items/teams)
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
  // ResourceMembership.allocationPercent is a column on membership rows (deleted below)
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

describe("organization hierarchy integration", () => {
  it("creates organization and hierarchy with valid parents", async () => {
    const actor = principal();
    await db.principal.create({ data: { id: actor.id, displayName: actor.displayName } });

    const org = await organization.createOrganization(actor, {
      name: "Org One",
      description: "Test",
    });
    expect(org.name).toBe("Org One");

    const section = await organization.createSection(actor, {
      organizationId: org.id,
      name: "Section A",
    });
    const department = await organization.createDepartment(actor, {
      sectionId: section.id,
      name: "Dept A",
    });
    const team = await organization.createTeam(actor, {
      departmentId: department.id,
      name: "Team A",
    });
    const resource = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Alex Resource",
      type: "PERSON",
      skills: ["planning"],
      primaryTeamId: team.id,
      capacityHoursPerWeek: 36,
    });

    const loaded = await organization.getResource(actor, resource.id);
    expect(loaded.memberships).toHaveLength(1);
    expect(loaded.memberships[0]?.teamId).toBe(team.id);
  });

  it("rejects invalid organization create", async () => {
    const actor = principal();
    await db.principal.create({ data: { id: actor.id } });
    await expect(
      organization.createOrganization(actor, { name: "" }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects section for unknown organization", async () => {
    const actor = principal();
    await db.principal.create({ data: { id: actor.id } });
    await organization.createOrganization(actor, { name: "Org" });
    await expect(
      organization.createSection(actor, {
        organizationId: randomUUID(),
        name: "Orphan Section",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects department for unknown section", async () => {
    const actor = principal();
    await db.principal.create({ data: { id: actor.id } });
    await organization.createOrganization(actor, { name: "Org" });
    await expect(
      organization.createDepartment(actor, {
        sectionId: randomUUID(),
        name: "Orphan Dept",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects team for unknown department", async () => {
    const actor = principal();
    await db.principal.create({ data: { id: actor.id } });
    await organization.createOrganization(actor, { name: "Org" });
    await expect(
      organization.createTeam(actor, {
        departmentId: randomUUID(),
        name: "Orphan Team",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects cross-organization resource membership", async () => {
    const actor = principal();
    await db.principal.create({ data: { id: actor.id } });
    const orgA = await organization.createOrganization(actor, { name: "A" });
    // Second org requires platform manage — grant via bootstrap only works when empty.
    // Use direct DB + grant for second org setup.
    const orgB = await db.organization.create({ data: { name: "B" } });
    await authz.grantOrganizationAdmin(actor.id, orgB.id);

    const sectionB = await organization.createSection(actor, {
      organizationId: orgB.id,
      name: "SecB",
    });
    const deptB = await organization.createDepartment(actor, {
      sectionId: sectionB.id,
      name: "DeptB",
    });
    const teamB = await organization.createTeam(actor, {
      departmentId: deptB.id,
      name: "TeamB",
    });

    const resourceA = await organization.createResource(actor, {
      organizationId: orgA.id,
      name: "ResA",
      type: "PERSON",
      skills: [],
    });

    await expect(
      organization.assignMembership(actor, {
        resourceId: resourceA.id,
        teamId: teamB.id,
        isPrimary: true,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("updates organization and rejects stale version", async () => {
    const actor = principal();
    await db.principal.create({ data: { id: actor.id } });
    const org = await organization.createOrganization(actor, { name: "Versioned" });

    const updated = await organization.updateOrganization(actor, {
      id: org.id,
      name: "Versioned 2",
      expectedVersion: org.version,
    });
    expect(updated.version).toBe(org.version + 1);

    await expect(
      organization.updateOrganization(actor, {
        id: org.id,
        name: "Stale write",
        expectedVersion: org.version,
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
  });

  it("rejects unauthorized mutation", async () => {
    const owner = principal();
    const stranger = principal();
    await db.principal.create({ data: { id: owner.id } });
    await db.principal.create({ data: { id: stranger.id } });
    const org = await organization.createOrganization(owner, { name: "Owned" });

    await expect(
      organization.createSection(stranger, {
        organizationId: org.id,
        name: "Nope",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("writes audit events for organization create", async () => {
    const actor = principal();
    await db.principal.create({ data: { id: actor.id } });
    const org = await organization.createOrganization(actor, { name: "Audited" });
    const events = await db.auditEvent.findMany({
      where: { subjectId: org.id, actionType: "organization.created" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.actorPrincipalId).toBe(actor.id);
  });
});

describe("Phase 0A Principal ↔ Resource optional link", () => {
  async function seedOrgWithPersonResource() {
    const actor = principal();
    await db.principal.create({
      data: { id: actor.id, displayName: actor.displayName },
    });
    const org = await organization.createOrganization(actor, { name: "Link Org" });
    const resource = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Person Resource",
      type: "PERSON",
      skills: [],
      capacityHoursPerWeek: 40,
    });
    return { actor, org, resource };
  }

  it("allows Resource without Principal and Principal without Resource", async () => {
    const { resource } = await seedOrgWithPersonResource();
    expect(resource.linkedPrincipalId).toBeNull();

    const lonePrincipalId = randomUUID();
    await db.principal.create({
      data: { id: lonePrincipalId, displayName: "Service Account" },
    });
    const lone = await db.principal.findUnique({
      where: { id: lonePrincipalId },
      include: { linkedResource: true },
    });
    expect(lone?.linkedResource).toBeNull();
  });

  it("links and unlinks a PERSON resource with audit events", async () => {
    const { actor, resource } = await seedOrgWithPersonResource();
    const targetId = randomUUID();
    await db.principal.create({
      data: { id: targetId, displayName: "Target User", email: "display@example.com" },
    });

    const linked = await organization.linkResourcePrincipal(actor, {
      resourceId: resource.id,
      principalId: targetId,
    });
    expect(linked.linkedPrincipalId).toBe(targetId);
    expect(linked.linkedPrincipal?.id).toBe(targetId);
    expect(Number(linked.capacityHoursPerWeek)).toBe(40);

    const again = await organization.linkResourcePrincipal(actor, {
      resourceId: resource.id,
      principalId: targetId,
    });
    expect(again.linkedPrincipalId).toBe(targetId);

    const linkEvents = await db.auditEvent.findMany({
      where: {
        subjectId: resource.id,
        actionType: "resource.principal.linked",
      },
    });
    expect(linkEvents.length).toBeGreaterThanOrEqual(1);
    expect(linkEvents[0]?.payload).toMatchObject({
      operation: "link",
      newLinkedPrincipalId: targetId,
      oldLinkedPrincipalId: null,
    });

    const unlinked = await organization.unlinkResourcePrincipal(actor, {
      resourceId: resource.id,
    });
    expect(unlinked.linkedPrincipalId).toBeNull();
    expect(unlinked.capacityHoursPerWeek?.toString()).toBe("40");

    const principalStillExists = await db.principal.findUnique({
      where: { id: targetId },
    });
    expect(principalStillExists).not.toBeNull();

    const unlinkEvents = await db.auditEvent.findMany({
      where: {
        subjectId: resource.id,
        actionType: "resource.principal.unlinked",
      },
    });
    expect(unlinkEvents).toHaveLength(1);
    expect(unlinkEvents[0]?.payload).toMatchObject({
      operation: "unlink",
      oldLinkedPrincipalId: targetId,
      newLinkedPrincipalId: null,
    });
  });

  it("rejects linking OTHER resources and duplicate Principal links", async () => {
    const { actor, org, resource } = await seedOrgWithPersonResource();
    const other = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Server Rack",
      type: "OTHER",
      skills: [],
    });
    const targetId = randomUUID();
    await db.principal.create({ data: { id: targetId, displayName: "Shared" } });

    await expect(
      organization.linkResourcePrincipal(actor, {
        resourceId: other.id,
        principalId: targetId,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await organization.linkResourcePrincipal(actor, {
      resourceId: resource.id,
      principalId: targetId,
    });

    const second = await organization.createResource(actor, {
      organizationId: org.id,
      name: "Second Person",
      type: "PERSON",
      skills: [],
    });
    await expect(
      organization.linkResourcePrincipal(actor, {
        resourceId: second.id,
        principalId: targetId,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects nonexistent Resource/Principal and unauthorized callers", async () => {
    const { actor, resource } = await seedOrgWithPersonResource();
    const stranger = principal();
    await db.principal.create({ data: { id: stranger.id } });
    const targetId = randomUUID();
    await db.principal.create({ data: { id: targetId } });

    await expect(
      organization.linkResourcePrincipal(actor, {
        resourceId: randomUUID(),
        principalId: targetId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      organization.linkResourcePrincipal(actor, {
        resourceId: resource.id,
        principalId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      organization.linkResourcePrincipal(stranger, {
        resourceId: resource.id,
        principalId: targetId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("clears link on Principal delete without deleting Resource (SetNull)", async () => {
    const { actor, resource } = await seedOrgWithPersonResource();
    const targetId = randomUUID();
    await db.principal.create({ data: { id: targetId, displayName: "Temp" } });
    await organization.linkResourcePrincipal(actor, {
      resourceId: resource.id,
      principalId: targetId,
    });

    await db.principal.delete({ where: { id: targetId } });

    const reloaded = await db.resource.findUnique({ where: { id: resource.id } });
    expect(reloaded).not.toBeNull();
    expect(reloaded?.linkedPrincipalId).toBeNull();
    expect(reloaded?.name).toBe("Person Resource");
  });

  it("does not change capacity fields when linking", async () => {
    const { actor, org, resource } = await seedOrgWithPersonResource();
    const section = await organization.createSection(actor, {
      organizationId: org.id,
      name: "Sec",
    });
    const dept = await organization.createDepartment(actor, {
      sectionId: section.id,
      name: "Dept",
    });
    const team = await organization.createTeam(actor, {
      departmentId: dept.id,
      name: "Team",
    });
    await organization.assignMembership(actor, {
      resourceId: resource.id,
      teamId: team.id,
      isPrimary: true,
      allocationPercent: 50,
    });

    const targetId = randomUUID();
    await db.principal.create({ data: { id: targetId } });
    const linked = await organization.linkResourcePrincipal(actor, {
      resourceId: resource.id,
      principalId: targetId,
    });

    expect(Number(linked.capacityHoursPerWeek)).toBe(40);
    expect(linked.memberships).toHaveLength(1);
    expect(Number(linked.memberships[0]?.allocationPercent)).toBe(50);
  });
});
