/**
 * Seed Central Maintenance Resource Management fixtures.
 * Attaches to Nordic Demo Manufacturing when present, else creates a standalone org.
 *
 * Usage:
 *   TEMP_AUTH_PRINCIPAL_ID=<uuid> npx tsx scripts/seed-central-maintenance-resources.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const actorId =
  process.env.DEMO_SEED_PRINCIPAL_ID ||
  process.env.TEMP_AUTH_PRINCIPAL_ID ||
  process.env.DEV_AUTH_PRINCIPAL_ID;

if (!actorId) {
  throw new Error(
    "Set TEMP_AUTH_PRINCIPAL_ID, DEV_AUTH_PRINCIPAL_ID, or DEMO_SEED_PRINCIPAL_ID",
  );
}

const PI_START = new Date("2026-10-01T00:00:00.000Z");
const PI_END = new Date("2026-12-31T00:00:00.000Z");
const IT1_START = new Date("2026-10-01T00:00:00.000Z");
const IT1_END = new Date("2026-10-31T00:00:00.000Z");

async function ensureOrgAdmin(orgId: string) {
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
          "pi.manage_dependency",
          "pi.transition",
          "pi.baseline",
          "governance.view",
        ],
      },
    });
  }
  await db.principal.upsert({
    where: { id: actorId },
    create: {
      id: actorId,
      displayName: process.env.TEMP_AUTH_DISPLAY_NAME || "Demo User",
    },
    update: {},
  });
  const binding = await db.roleBinding.findFirst({
    where: {
      principalId: actorId,
      roleDefinitionId: role.id,
      organizationId: orgId,
      scopeType: "ORGANIZATION",
      effectiveTo: null,
    },
  });
  if (!binding) {
    await db.roleBinding.create({
      data: {
        principalId: actorId,
        roleDefinitionId: role.id,
        scopeType: "ORGANIZATION",
        organizationId: orgId,
        scopeId: orgId,
      },
    });
  }
}

async function main() {
  let org = await db.organization.findFirst({
    where: { name: "Nordic Demo Manufacturing" },
  });
  if (!org) {
    org = await db.organization.create({
      data: {
        name: "Nordic Demo Manufacturing",
        description: "Demo company including Central Maintenance resources",
      },
    });
  }
  await ensureOrgAdmin(org.id);

  // Wipe prior CM demo PI/allocations by reference keys
  const oldPi = await db.programIncrement.findFirst({
    where: { organizationId: org.id, referenceKey: "PI-DEMO-CM" },
  });
  if (oldPi) {
    const revs = await db.planningRevision.findMany({
      where: { piId: oldPi.id },
      select: { id: true },
    });
    const revIds = revs.map((r) => r.id);
    if (revIds.length) {
      await db.workAllocation.deleteMany({
        where: { revisionId: { in: revIds } },
      });
    }
    await db.planningDependency.deleteMany({
      where: {
        organizationId: org.id,
        OR: [
          { description: { startsWith: "CM-DEMO:" } },
          { ownerName: "Central Maintenance Coordinator" },
        ],
      },
    });
    await db.piParticipatingTeam.deleteMany({ where: { piId: oldPi.id } });
    await db.piParticipatingDepartment.deleteMany({
      where: { piId: oldPi.id },
    });
    const oldIters = await db.piIteration.findMany({
      where: { piId: oldPi.id },
      select: { id: true },
    });
    if (oldIters.length) {
      await db.resourceAvailability.deleteMany({
        where: { iterationId: { in: oldIters.map((i) => i.id) } },
      });
    }
    await db.planningRevision.deleteMany({ where: { piId: oldPi.id } });
    await db.piIteration.deleteMany({ where: { piId: oldPi.id } });
    await db.programIncrement.delete({ where: { id: oldPi.id } });
  }

  // Remove prior CM demo projects/initiatives
  const oldProjects = await db.project.findMany({
    where: {
      organizationId: org.id,
      referenceKey: { startsWith: "PROJ-CM-" },
    },
    select: { id: true, initiativeId: true },
  });
  const oldInits = await db.initiative.findMany({
    where: {
      organizationId: org.id,
      referenceKey: { startsWith: "INI-PROJ-CM-" },
    },
    select: { id: true },
  });
  const pids = oldProjects.map((p) => p.id);
  const iids = [
    ...new Set([
      ...oldProjects.map((p) => p.initiativeId),
      ...oldInits.map((i) => i.id),
    ]),
  ];
  if (pids.length) {
    await db.workAllocation.deleteMany({
      where: { workItem: { projectId: { in: pids } } },
    });
    await db.projectWorkItem.deleteMany({ where: { projectId: { in: pids } } });
    await db.projectParticipatingDepartment.deleteMany({
      where: { projectId: { in: pids } },
    });
    await db.project.deleteMany({ where: { id: { in: pids } } });
  }
  if (iids.length) {
    await db.demand.deleteMany({ where: { initiativeId: { in: iids } } });
    await db.lifecycleTransition.deleteMany({
      where: { initiativeId: { in: iids } },
    });
    await db.initiative.deleteMany({ where: { id: { in: iids } } });
  }

  let section = await db.section.findFirst({
    where: { organizationId: org.id, name: "Central Maintenance" },
  });
  if (!section) {
    section = await db.section.create({
      data: {
        organizationId: org.id,
        name: "Central Maintenance",
        description: "Asset, reliability, and maintenance systems",
      },
    });
  }

  async function ensureDept(name: string, description: string) {
    let d = await db.department.findFirst({
      where: { sectionId: section!.id, name },
    });
    if (!d) {
      d = await db.department.create({
        data: { sectionId: section!.id, name, description },
      });
    }
    return d;
  }

  const asset = await ensureDept(
    "Asset Management",
    "Inventory, classification & OT discovery",
  );
  const systems = await ensureDept(
    "Maintenance Systems",
    "Systems, backup & technical enablement",
  );
  const reliability = await ensureDept(
    "Reliability",
    "Operational reliability & change coordination",
  );
  const leadership = await ensureDept(
    "Leadership",
    "Priorities, governance & decision support",
  );
  // Partner departments for dependency framing
  const itInfra = await ensureDept(
    "IT Infrastructure",
    "Access, hosting & environments",
  );
  const network = await ensureDept(
    "Network & Security",
    "Connectivity, firewall & approvals",
  );
  const production = await ensureDept(
    "Production / PRU",
    "Site access & operational windows",
  );
  const procurement = await ensureDept(
    "Procurement",
    "Supplier and purchase-order steps",
  );

  async function ensureTeam(departmentId: string, name: string) {
    let t = await db.team.findFirst({ where: { departmentId, name } });
    if (!t) t = await db.team.create({ data: { departmentId, name } });
    return t;
  }

  const teamAsset = await ensureTeam(asset.id, "OT Security");
  const teamSystems = await ensureTeam(systems.id, "Systems Enablement");
  const teamRel = await ensureTeam(reliability.id, "Reliability Eng");
  const teamLead = await ensureTeam(leadership.id, "Maintenance Leadership");

  async function ensurePerson(
    name: string,
    role: string,
    capacityHoursPerWeek: number,
  ) {
    let r = await db.resource.findFirst({
      where: { organizationId: org!.id, name },
    });
    if (!r) {
      r = await db.resource.create({
        data: {
          organizationId: org!.id,
          name,
          type: "PERSON",
          functionRole: role,
          capacityHoursPerWeek,
          status: "ACTIVE",
          skillsJson: [],
        },
      });
    }
    return r;
  }

  const lina = await ensurePerson("Lina Andersson", "OT Security Specialist", 40);
  const anna = await ensurePerson("Anna Nilsson", "Asset Coordinator", 40);
  const erikJ = await ensurePerson(
    "Erik Johansson",
    "Maintenance Engineer",
    40,
  );
  const mikael = await ensurePerson("Mikael Berg", "Systems Engineer", 40);
  const oskar = await ensurePerson("Oskar Lund", "IT / OT Coordinator", 40);
  const sofia = await ensurePerson("Sofia Lindberg", "Reliability Engineer", 40);
  const johan = await ensurePerson("Johan Ek", "Change Coordinator", 40);
  const karin = await ensurePerson(
    "Karin Svensson",
    "Maintenance Manager",
    40,
  );

  async function ensureMembership(
    resourceId: string,
    teamId: string,
    allocationPercent: number,
    isPrimary: boolean,
  ) {
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

  await ensureMembership(lina.id, teamAsset.id, 100, true);
  await ensureMembership(anna.id, teamAsset.id, 100, true);
  await ensureMembership(erikJ.id, teamAsset.id, 70, true);
  await ensureMembership(erikJ.id, teamSystems.id, 30, false); // cross-functional
  await ensureMembership(mikael.id, teamSystems.id, 100, true);
  await ensureMembership(oskar.id, teamSystems.id, 50, true);
  await ensureMembership(oskar.id, teamAsset.id, 50, false); // cross-functional
  await ensureMembership(sofia.id, teamRel.id, 100, true);
  await ensureMembership(johan.id, teamRel.id, 100, true);
  await ensureMembership(karin.id, teamLead.id, 100, true);

  const pi = await db.programIncrement.create({
    data: {
      organizationId: org.id,
      sectionId: section.id,
      referenceKey: "PI-DEMO-CM",
      name: "Central Maintenance · Q4 2026",
      status: "PLANNING",
      startDate: PI_START,
      endDate: PI_END,
      planningOwnerName: karin.name,
    },
  });

  const revision = await db.planningRevision.create({
    data: {
      piId: pi.id,
      key: "CURRENT",
      version: 1,
      isCurrent: true,
    },
  });

  const it1 = await db.piIteration.create({
    data: {
      piId: pi.id,
      referenceKey: "IT-1",
      name: "October 2026",
      sequence: 1,
      startDate: IT1_START,
      endDate: IT1_END,
    },
  });

  for (const d of [asset, systems, reliability, leadership]) {
    await db.piParticipatingDepartment.create({
      data: { piId: pi.id, departmentId: d.id },
    });
  }
  for (const [team, dept] of [
    [teamAsset, asset],
    [teamSystems, systems],
    [teamRel, reliability],
    [teamLead, leadership],
  ] as const) {
    await db.piParticipatingTeam.create({
      data: {
        piId: pi.id,
        teamId: team.id,
        departmentId: dept.id,
      },
    });
  }

  async function ensureProject(
    ref: string,
    name: string,
    departmentId: string,
    ownerResourceId: string,
    ownerName: string,
  ) {
    const initiative = await db.initiative.create({
      data: {
        organizationId: org!.id,
        departmentId,
        referenceKey: `INI-${ref}`,
        title: name,
        requesterName: "CM Requester",
        businessOwnerName: ownerName,
        businessOwnerResourceId: ownerResourceId,
        currentStage: "PROJECT",
        status: "ACTIVE",
      },
    });
    await db.demand.create({
      data: {
        initiativeId: initiative.id,
        problemOpportunity: `Need for ${name}`,
        reasonForRequest: "Central Maintenance resource plan demo",
        expectedValue: "Safer assets and clearer capacity",
        affectedAreas: "Central Maintenance",
        urgency: "HIGH",
        strategicAlignment: "Maintenance excellence",
        initialImpact: "Capacity and partner-team coordination for maintenance delivery",
      },
    });
    const project = await db.project.create({
      data: {
        initiativeId: initiative.id,
        organizationId: org!.id,
        departmentId,
        referenceKey: ref,
        name,
        status: "ACTIVE",
        ownerName,
        ownerResourceId,
      },
    });
    return { project };
  }

  async function ensureWorkItem(
    projectId: string,
    ref: string,
    title: string,
  ) {
    return db.projectWorkItem.create({
      data: {
        projectId,
        type: "TASK",
        referenceKey: ref,
        title,
        status: "READY",
        estimateHours: "40",
      },
    });
  }

  const programme = await ensureProject(
    "PROJ-CM-PROGRAMME",
    "Programme coordination",
    leadership.id,
    karin.id,
    karin.name,
  );
  const assetWork = await ensureProject(
    "PROJ-CM-ASSET",
    "Asset management rollout",
    asset.id,
    lina.id,
    lina.name,
  );
  const backup = await ensureProject(
    "PROJ-CM-BACKUP",
    "Backup hardening",
    systems.id,
    mikael.id,
    mikael.name,
  );
  const change = await ensureProject(
    "PROJ-CM-CHANGE",
    "Change management pack",
    reliability.id,
    johan.id,
    johan.name,
  );
  const itSupport = await ensureProject(
    "PROJ-CM-IT",
    "IT support for OT",
    systems.id,
    oskar.id,
    oskar.name,
  );

  // Partner-side projects for dependency targets
  const partnerAccess = await ensureProject(
    "PROJ-CM-ACCESS",
    "Test environment access",
    itInfra.id,
    oskar.id,
    oskar.name,
  );
  const partnerFw = await ensureProject(
    "PROJ-CM-FIREWALL",
    "Firewall rule approval",
    network.id,
    mikael.id,
    mikael.name,
  );
  const partnerPru = await ensureProject(
    "PROJ-CM-PRU",
    "PRU maintenance window",
    production.id,
    erikJ.id,
    erikJ.name,
  );
  const partnerPo = await ensureProject(
    "PROJ-CM-PO",
    "Supplier PO confirmation",
    procurement.id,
    karin.id,
    karin.name,
  );

  async function allocate(
    workItemId: string,
    teamId: string,
    resourceId: string,
    plannedHours: string,
  ) {
    await db.workAllocation.create({
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

  // One WorkAllocation per work item (@@unique revisionId+workItemId).
  // Iteration ≈ 1 month → ~160h available at 40h/wk (membership % applied by policy).
  const wiLina = await ensureWorkItem(assetWork.project.id, "PROJ-CM-ASSET-LINA", "Asset · Lina");
  const wiAnna = await ensureWorkItem(assetWork.project.id, "PROJ-CM-ASSET-ANNA", "Asset · Anna");
  const wiErikA = await ensureWorkItem(assetWork.project.id, "PROJ-CM-ASSET-ERIK", "Asset · Erik");
  const wiMikael = await ensureWorkItem(backup.project.id, "PROJ-CM-BACKUP-MIK", "Backup · Mikael");
  const wiOskarB = await ensureWorkItem(backup.project.id, "PROJ-CM-BACKUP-OSK", "Backup · Oskar");
  const wiOskarIt = await ensureWorkItem(itSupport.project.id, "PROJ-CM-IT-OSK", "IT support · Oskar");
  const wiSofia = await ensureWorkItem(change.project.id, "PROJ-CM-CHANGE-SOF", "Change · Sofia");
  const wiJohan = await ensureWorkItem(change.project.id, "PROJ-CM-CHANGE-JOH", "Change · Johan");
  const wiKarin = await ensureWorkItem(programme.project.id, "PROJ-CM-PROG-KAR", "Programme · Karin");
  const wiErikSys = await ensureWorkItem(assetWork.project.id, "PROJ-CM-ASSET-ERIK-SYS", "Asset · Erik (Systems)");

  await allocate(wiLina.id, teamAsset.id, lina.id, "176");
  await allocate(wiAnna.id, teamAsset.id, anna.id, "144");
  await allocate(wiErikA.id, teamAsset.id, erikJ.id, "120");
  await allocate(wiMikael.id, teamSystems.id, mikael.id, "152");
  await allocate(wiOskarB.id, teamSystems.id, oskar.id, "64");
  await allocate(wiOskarIt.id, teamSystems.id, oskar.id, "40");
  await allocate(wiSofia.id, teamRel.id, sofia.id, "160");
  await allocate(wiJohan.id, teamRel.id, johan.id, "136");
  await allocate(wiKarin.id, teamLead.id, karin.id, "120");
  await allocate(wiErikSys.id, teamSystems.id, erikJ.id, "48");

  await db.planningDependency.createMany({
    data: [
      {
        organizationId: org.id,
        type: "BLOCKS",
        status: "OPEN",
        criticality: "HIGH",
        sourceType: "PROJECT",
        sourceId: assetWork.project.id,
        targetType: "PROJECT",
        targetId: partnerFw.project.id,
        ownerName: "Central Maintenance Coordinator",
        neededByDate: new Date("2026-10-14T00:00:00.000Z"),
        description: "CM-DEMO: Firewall rule approval — Network & Security",
      },
      {
        organizationId: org.id,
        type: "BLOCKS",
        status: "OPEN",
        criticality: "MEDIUM",
        sourceType: "PROJECT",
        sourceId: backup.project.id,
        targetType: "PROJECT",
        targetId: partnerAccess.project.id,
        ownerName: "Central Maintenance Coordinator",
        neededByDate: new Date("2026-10-16T00:00:00.000Z"),
        description: "CM-DEMO: Test environment access — IT Infrastructure",
      },
      {
        organizationId: org.id,
        type: "DEPENDS_ON",
        status: "OPEN",
        criticality: "MEDIUM",
        sourceType: "PROJECT",
        sourceId: change.project.id,
        targetType: "PROJECT",
        targetId: partnerPru.project.id,
        ownerName: "Central Maintenance Coordinator",
        neededByDate: new Date("2026-10-20T00:00:00.000Z"),
        description: "CM-DEMO: PRU maintenance window — Production / PRU",
      },
      {
        organizationId: org.id,
        type: "RELATED",
        status: "OPEN",
        criticality: "LOW",
        sourceType: "PROJECT",
        sourceId: programme.project.id,
        targetType: "PROJECT",
        targetId: partnerPo.project.id,
        ownerName: "Central Maintenance Coordinator",
        neededByDate: new Date("2026-10-22T00:00:00.000Z"),
        description: "CM-DEMO: Supplier PO confirmation — Procurement",
      },
    ],
  });

  const summary = {
    organizationId: org.id,
    organizationName: org.name,
    section: section.name,
    piId: pi.id,
    piReference: pi.referenceKey,
    resourcePlanningUrl: `/portfolio/capacity?organizationId=${org.id}&piId=${pi.id}`,
    departments: [
      asset.name,
      systems.name,
      reliability.name,
      leadership.name,
    ],
    partnerDepartments: [
      itInfra.name,
      network.name,
      production.name,
      procurement.name,
    ],
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
