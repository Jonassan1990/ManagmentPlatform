/**
 * Seed deterministic PI/capacity fixtures for M2E-B browser QA.
 * Safe to re-run; does not truncate the shared browser QA database.
 *
 * Usage:
 *   TEMP_AUTH_PRINCIPAL_ID=<uuid> node scripts/seed-m2e-capacity-ui.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const principalId =
  process.env.TEMP_AUTH_PRINCIPAL_ID || process.env.DEV_AUTH_PRINCIPAL_ID;
if (!principalId) {
  throw new Error("TEMP_AUTH_PRINCIPAL_ID (or DEV_AUTH_PRINCIPAL_ID) required");
}

const ORG_NAME = "M2E Capacity Org";
const PI_START = new Date("2026-01-01T00:00:00.000Z");
const PI_END = new Date("2026-03-31T00:00:00.000Z");
const IT1_START = new Date("2026-01-01T00:00:00.000Z");
const IT1_END = new Date("2026-01-14T00:00:00.000Z");
const IT2_START = new Date("2026-01-15T00:00:00.000Z");
const IT2_END = new Date("2026-01-28T00:00:00.000Z");

async function ensureOrgAdminRole() {
  let role = await db.roleDefinition.findFirst({
    where: { key: "organization.admin" },
  });
  if (!role) {
    role = await db.roleDefinition.create({
      data: {
        key: "organization.admin",
        name: "Organization Admin",
        description: "seed",
        permissions: [
          "org.structure.read",
          "org.structure.manage",
          "audit.read",
          "role.manage",
          "initiative.view",
          "initiative.create",
          "initiative.edit",
          "project.view",
          "project.edit",
          "project.manage_workitems",
          "pi.view",
          "pi.create",
          "pi.edit",
          "pi.allocate",
          "pi.manage_capacity",
          "pi.transition",
          "pi.baseline",
          "governance.view",
        ],
      },
    });
  }
  return role;
}

async function main() {
  await db.principal.upsert({
    where: { id: principalId },
    create: { id: principalId, displayName: "M2E Capacity Tester" },
    update: { displayName: "M2E Capacity Tester" },
  });

  const orgAdmin = await ensureOrgAdminRole();

  let org = await db.organization.findFirst({ where: { name: ORG_NAME } });
  if (!org) {
    org = await db.organization.create({
      data: {
        name: ORG_NAME,
        description: "Seeded for M2E-B PI capacity dashboard browser QA",
      },
    });
  }

  const binding = await db.roleBinding.findFirst({
    where: {
      principalId,
      roleDefinitionId: orgAdmin.id,
      organizationId: org.id,
      scopeType: "ORGANIZATION",
      effectiveTo: null,
    },
  });
  if (!binding) {
    await db.roleBinding.create({
      data: {
        principalId,
        roleDefinitionId: orgAdmin.id,
        scopeType: "ORGANIZATION",
        organizationId: org.id,
        scopeId: org.id,
      },
    });
  }

  let section = await db.section.findFirst({
    where: { organizationId: org.id, name: "Capacity Section" },
  });
  if (!section) {
    section = await db.section.create({
      data: { organizationId: org.id, name: "Capacity Section" },
    });
  }

  async function ensureDept(name) {
    let d = await db.department.findFirst({
      where: { sectionId: section.id, name },
    });
    if (!d) {
      d = await db.department.create({
        data: { sectionId: section.id, name },
      });
    }
    return d;
  }

  const deptA = await ensureDept("Asset Management");
  const deptB = await ensureDept("Reliability");

  async function ensureTeam(departmentId, name) {
    let t = await db.team.findFirst({ where: { departmentId, name } });
    if (!t) t = await db.team.create({ data: { departmentId, name } });
    return t;
  }

  const teamA = await ensureTeam(deptA.id, "OT Security");
  const teamB = await ensureTeam(deptB.id, "Reliability Eng");

  async function ensureResource(name, capacityHoursPerWeek) {
    let r = await db.resource.findFirst({
      where: { organizationId: org.id, name },
    });
    if (!r) {
      r = await db.resource.create({
        data: {
          organizationId: org.id,
          name,
          type: "PERSON",
          capacityHoursPerWeek,
        },
      });
    } else if (String(r.capacityHoursPerWeek) !== String(capacityHoursPerWeek)) {
      r = await db.resource.update({
        where: { id: r.id },
        data: { capacityHoursPerWeek },
      });
    }
    return r;
  }

  const resA = await ensureResource("Lina Andersson", 40);
  const resB = await ensureResource("Sofia Lindberg", 40);
  const resShared = await ensureResource("Shared Specialist", 40);

  async function ensureMembership(resourceId, teamId, allocationPercent, isPrimary) {
    const existing = await db.resourceMembership.findFirst({
      where: { resourceId, teamId, effectiveTo: null },
    });
    if (existing) {
      return db.resourceMembership.update({
        where: { id: existing.id },
        data: { allocationPercent, isPrimary },
      });
    }
    return db.resourceMembership.create({
      data: { resourceId, teamId, allocationPercent, isPrimary },
    });
  }

  await ensureMembership(resA.id, teamA.id, 100, true);
  await ensureMembership(resB.id, teamB.id, 100, true);
  await ensureMembership(resShared.id, teamA.id, 50, true);
  await ensureMembership(resShared.id, teamB.id, 50, false);

  let pi = await db.programIncrement.findFirst({
    where: { organizationId: org.id, name: "M2E Capacity PI Q1" },
  });
  if (!pi) {
    pi = await db.programIncrement.create({
      data: {
        organizationId: org.id,
        sectionId: section.id,
        referenceKey: "PI-M2E-CAP",
        name: "M2E Capacity PI Q1",
        status: "PLANNING",
        startDate: PI_START,
        endDate: PI_END,
        planningOwnerName: "Planner",
      },
    });
  }

  let revision = await db.planningRevision.findFirst({
    where: { piId: pi.id, isCurrent: true },
  });
  if (!revision) {
    revision = await db.planningRevision.create({
      data: {
        piId: pi.id,
        key: "CURRENT",
        version: 1,
        isCurrent: true,
      },
    });
  }

  async function ensureIteration(name, sequence, startDate, endDate) {
    let it = await db.piIteration.findFirst({
      where: { piId: pi.id, sequence },
    });
    if (!it) {
      it = await db.piIteration.create({
        data: {
          piId: pi.id,
          referenceKey: `IT-${sequence}`,
          name,
          sequence,
          startDate,
          endDate,
        },
      });
    }
    return it;
  }

  const it1 = await ensureIteration("Iteration 1", 1, IT1_START, IT1_END);
  await ensureIteration("Iteration 2", 2, IT2_START, IT2_END);

  for (const [departmentId] of [
    [deptA.id],
    [deptB.id],
  ]) {
    await db.piParticipatingDepartment.upsert({
      where: {
        piId_departmentId: { piId: pi.id, departmentId },
      },
      create: { piId: pi.id, departmentId },
      update: {},
    });
  }

  await db.piParticipatingTeam.upsert({
    where: { piId_teamId: { piId: pi.id, teamId: teamA.id } },
    create: { piId: pi.id, teamId: teamA.id, departmentId: deptA.id },
    update: { departmentId: deptA.id },
  });
  await db.piParticipatingTeam.upsert({
    where: { piId_teamId: { piId: pi.id, teamId: teamB.id } },
    create: { piId: pi.id, teamId: teamB.id, departmentId: deptB.id },
    update: { departmentId: deptB.id },
  });

  async function ensureProject(ref, name, departmentId) {
    let initiative = await db.initiative.findFirst({
      where: { organizationId: org.id, referenceKey: `INIT-${ref}` },
    });
    if (!initiative) {
      initiative = await db.initiative.create({
        data: {
          organizationId: org.id,
          departmentId,
          referenceKey: `INIT-${ref}`,
          title: name,
          requesterName: "Requester",
          businessOwnerName: "Owner",
          currentStage: "PROJECT",
          status: "ACTIVE",
        },
      });
    }
    let project = await db.project.findFirst({
      where: { organizationId: org.id, referenceKey: ref },
    });
    if (!project) {
      project = await db.project.create({
        data: {
          initiativeId: initiative.id,
          organizationId: org.id,
          departmentId,
          referenceKey: ref,
          name,
          status: "ACTIVE",
        },
      });
    }
    let wi = await db.projectWorkItem.findFirst({
      where: { projectId: project.id, referenceKey: `${ref}-WI1` },
    });
    if (!wi) {
      wi = await db.projectWorkItem.create({
        data: {
          projectId: project.id,
          type: "TASK",
          referenceKey: `${ref}-WI1`,
          title: `${name} task`,
          status: "BACKLOG",
          estimateHours: "40",
        },
      });
    }
    return { project, wi };
  }

  const heavy = await ensureProject("PRJ-M2E-HEAVY", "Heavy Delivery", deptA.id);
  const light = await ensureProject("PRJ-M2E-LIGHT", "Light Support", deptB.id);

  async function ensureAllocation(workItemId, teamId, resourceId, plannedHours) {
    const existing = await db.workAllocation.findFirst({
      where: { revisionId: revision.id, workItemId },
    });
    if (existing) {
      return db.workAllocation.update({
        where: { id: existing.id },
        data: {
          iterationId: it1.id,
          teamId,
          resourceId,
          plannedHours,
        },
      });
    }
    return db.workAllocation.create({
      data: {
        revisionId: revision.id,
        workItemId,
        iterationId: it1.id,
        teamId,
        resourceId,
        plannedHours,
      },
    });
  }

  // Overload team A (~120 available across memberships for it1 → commit 200)
  await ensureAllocation(heavy.wi.id, teamA.id, resA.id, "200");
  // Underutilize team B
  await ensureAllocation(light.wi.id, teamB.id, resB.id, "10");

  console.log(
    JSON.stringify(
      {
        organizationId: org.id,
        piId: pi.id,
        capacityUrl: `/portfolio/capacity?organizationId=${org.id}&piId=${pi.id}`,
        departmentAId: deptA.id,
        departmentBId: deptB.id,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
