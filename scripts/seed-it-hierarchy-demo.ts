/**
 * Seed Organization I → Section IN → departments INF/INFB/INFF/ING/INA
 * with IT initiatives (demand, pre-study, PoC, project) + resources, and
 * demo personas for the top-bar level switcher.
 *
 * Usage:
 *   DEV_AUTH_PRINCIPAL_ID=<uuid> npx tsx scripts/seed-it-hierarchy-demo.ts
 *   # or TEMP_AUTH_PRINCIPAL_ID / DEMO_SEED_PRINCIPAL_ID
 *
 * Local logins (password DemoLevel2026!):
 *   demo.orgadmin, demo.inmanager, demo.infmanager, demo.infbmanager,
 *   demo.ingmanager, demo.inamanager, demo.viewer
 *
 * Enable switcher with ALLOW_DEMO_PERSONA_SWITCH=1 (or local ALLOW_DEV_AUTH).
 */
import { hash as bcryptHash } from "bcryptjs";
import { PrismaClient, ScopeType } from "@prisma/client";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { LOCAL_LOGIN_ISSUER } from "@/modules/identity-access/application/temp-auth-constants";
import {
  DEMO_ORG_NAME,
  DEMO_PERSONA_PASSWORD,
  DEMO_PERSONAS,
  DEMO_SECTION_NAME,
  IT_DEMO_IDS,
} from "@/modules/demo/it-hierarchy-demo";

const db = new PrismaClient();
const authz = new AuthorizationService(db);

function resolveActorPrincipalId(): string {
  const actorId =
    process.env.DEMO_SEED_PRINCIPAL_ID ||
    process.env.TEMP_AUTH_PRINCIPAL_ID ||
    process.env.DEV_AUTH_PRINCIPAL_ID;
  if (!actorId) {
    throw new Error(
      "Set DEMO_SEED_PRINCIPAL_ID, TEMP_AUTH_PRINCIPAL_ID, or DEV_AUTH_PRINCIPAL_ID before seeding.",
    );
  }
  return actorId;
}

async function wipePrevious() {
  const org =
    (await db.organization.findUnique({ where: { id: IT_DEMO_IDS.org } })) ??
    (await db.organization.findFirst({ where: { name: DEMO_ORG_NAME } }));
  if (org) {
    const initIds = (
      await db.initiative.findMany({
        where: { organizationId: org.id },
        select: { id: true },
      })
    ).map((row) => row.id);
    const projectIds = (
      await db.project.findMany({
        where: { organizationId: org.id },
        select: { id: true },
      })
    ).map((row) => row.id);

    if (projectIds.length) {
      await db.projectIssue.deleteMany({ where: { projectId: { in: projectIds } } });
      await db.projectWorkItem.deleteMany({ where: { projectId: { in: projectIds } } });
      await db.projectMilestone.deleteMany({ where: { projectId: { in: projectIds } } });
      await db.projectParticipatingDepartment.deleteMany({
        where: { projectId: { in: projectIds } },
      });
      await db.project.deleteMany({ where: { id: { in: projectIds } } });
    }

    if (initIds.length) {
      await db.poCSuccessCriterion
        .deleteMany({ where: { poc: { initiativeId: { in: initIds } } } })
        .catch(() => undefined);
      await db.poC.deleteMany({ where: { initiativeId: { in: initIds } } }).catch(() => undefined);
      await db.pilotCriterion
        .deleteMany({ where: { pilot: { initiativeId: { in: initIds } } } })
        .catch(() => undefined);
      await db.pilotFeedback
        .deleteMany({ where: { pilot: { initiativeId: { in: initIds } } } })
        .catch(() => undefined);
      await db.pilot.deleteMany({ where: { initiativeId: { in: initIds } } }).catch(() => undefined);
      await db.solutionAlternative
        .deleteMany({ where: { preStudy: { initiativeId: { in: initIds } } } })
        .catch(() => undefined);
      await db.preStudyAssessment
        .deleteMany({ where: { preStudy: { initiativeId: { in: initIds } } } })
        .catch(() => undefined);
      await db.preStudy.deleteMany({ where: { initiativeId: { in: initIds } } }).catch(() => undefined);
      await db.requirement.deleteMany({ where: { initiativeId: { in: initIds } } }).catch(() => undefined);
      await db.risk.deleteMany({ where: { initiativeId: { in: initIds } } }).catch(() => undefined);
      await db.demand.deleteMany({ where: { initiativeId: { in: initIds } } }).catch(() => undefined);
      await db.lifecycleTransition
        .deleteMany({ where: { initiativeId: { in: initIds } } })
        .catch(() => undefined);
      await db.initiative.deleteMany({ where: { id: { in: initIds } } });
    }

    await db.resourceMembership.deleteMany({
      where: { resource: { organizationId: org.id } },
    });
    await db.resource.deleteMany({ where: { organizationId: org.id } });
    await db.roleBinding.deleteMany({ where: { organizationId: org.id } });
    await db.team.deleteMany({
      where: { department: { section: { organizationId: org.id } } },
    });
    await db.department.deleteMany({
      where: {
        section: { organizationId: org.id },
        parentDepartmentId: { not: null },
      },
    });
    await db.department.deleteMany({
      where: { section: { organizationId: org.id } },
    });
    await db.section.deleteMany({ where: { organizationId: org.id } });
    await db.organization.delete({ where: { id: org.id } });
  }

  for (const persona of DEMO_PERSONAS) {
    await db.localLoginCredential
      .deleteMany({ where: { principalId: persona.principalId } })
      .catch(() => undefined);
    await db.externalIdentity
      .deleteMany({ where: { principalId: persona.principalId } })
      .catch(() => undefined);
    await db.roleBinding
      .deleteMany({ where: { principalId: persona.principalId } })
      .catch(() => undefined);
    await db.principal.deleteMany({ where: { id: persona.principalId } }).catch(() => undefined);
  }
}

async function ensureRole(key: string) {
  await authz.ensureSystemRoles();
  const role = await db.roleDefinition.findUnique({ where: { key } });
  if (!role) throw new Error(`Missing role ${key}`);
  return role;
}

async function main() {
  const actorId = resolveActorPrincipalId();
  console.log("Wiping previous IT hierarchy demo…");
  await wipePrevious();

  await db.principal.upsert({
    where: { id: actorId },
    create: {
      id: actorId,
      displayName:
        process.env.DEMO_SEED_DISPLAY_NAME ||
        process.env.DEV_AUTH_DISPLAY_NAME ||
        "Demo Seeder",
    },
    update: {},
  });
  await authz.ensureBootstrapBinding(actorId);
  await authz.ensureSystemRoles();

  console.log("Creating Organization I / Section IN / departments…");
  const org = await db.organization.create({
    data: {
      id: IT_DEMO_IDS.org,
      name: DEMO_ORG_NAME,
      description:
        "Top organization for the IT hierarchy demo (I → IN → INF/ING/INA).",
    },
  });
  await authz.grantOrganizationAdmin(actorId, org.id);

  const section = await db.section.create({
    data: {
      id: IT_DEMO_IDS.sectionIn,
      organizationId: org.id,
      name: DEMO_SECTION_NAME,
      description: "IT section under organization I",
    },
  });

  const inf = await db.department.create({
    data: {
      id: IT_DEMO_IDS.deptInf,
      sectionId: section.id,
      name: "INF",
      description: "IT Foundation / platforms parent department",
    },
  });
  const infb = await db.department.create({
    data: {
      id: IT_DEMO_IDS.deptInfb,
      sectionId: section.id,
      parentDepartmentId: inf.id,
      name: "INFB",
      description: "Business applications under INF",
    },
  });
  const inff = await db.department.create({
    data: {
      id: IT_DEMO_IDS.deptInff,
      sectionId: section.id,
      parentDepartmentId: inf.id,
      name: "INFF",
      description: "Data & integration under INF",
    },
  });
  const ing = await db.department.create({
    data: {
      id: IT_DEMO_IDS.deptIng,
      sectionId: section.id,
      name: "ING",
      description: "Infrastructure & networks",
    },
  });
  const ina = await db.department.create({
    data: {
      id: IT_DEMO_IDS.deptIna,
      sectionId: section.id,
      name: "INA",
      description: "Architecture & demand intake",
    },
  });

  const teams = {
    infPlatform: await db.team.create({
      data: {
        id: IT_DEMO_IDS.teamInfPlatform,
        departmentId: inf.id,
        name: "Platform Core",
      },
    }),
    infbApps: await db.team.create({
      data: {
        id: IT_DEMO_IDS.teamInfbApps,
        departmentId: infb.id,
        name: "Apps Delivery",
      },
    }),
    infbOps: await db.team.create({
      data: {
        id: IT_DEMO_IDS.teamInfbOps,
        departmentId: infb.id,
        name: "Apps Ops",
      },
    }),
    inffData: await db.team.create({
      data: {
        id: IT_DEMO_IDS.teamInffData,
        departmentId: inff.id,
        name: "Data Services",
      },
    }),
    ingInfra: await db.team.create({
      data: {
        id: IT_DEMO_IDS.teamIngInfra,
        departmentId: ing.id,
        name: "Network Ops",
      },
    }),
    inaDemand: await db.team.create({
      data: {
        id: IT_DEMO_IDS.teamInaDemand,
        departmentId: ina.id,
        name: "Demand Office",
      },
    }),
  };

  console.log("Creating people resources…");
  async function person(name: string, role: string, teamId: string) {
    const resource = await db.resource.create({
      data: {
        organizationId: org.id,
        name,
        type: "PERSON",
        functionRole: role,
        skillsJson: ["IT"],
        capacityHoursPerWeek: 40,
        status: "ACTIVE",
      },
    });
    await db.resourceMembership.create({
      data: {
        resourceId: resource.id,
        teamId,
        isPrimary: true,
        allocationPercent: 100,
      },
    });
    return resource;
  }

  const ira = await person("Ira INF Manager", "Department Manager", teams.infPlatform.id);
  const bo = await person("Bo INFB Manager", "Department Manager", teams.infbApps.id);
  const freja = await person("Freja App Dev", "Developer", teams.infbApps.id);
  const viktor = await person("Viktor App Ops", "Ops Engineer", teams.infbOps.id);
  const nora = await person("Nora Data Lead", "Data Lead", teams.inffData.id);
  const gina = await person("Gina ING Manager", "Department Manager", teams.ingInfra.id);
  const omar = await person("Omar Network", "Network Engineer", teams.ingInfra.id);
  const ana = await person("Ana INA Manager", "Department Manager", teams.inaDemand.id);
  const sam = await person("Sam IN Manager", "Section Manager", teams.inaDemand.id);

  async function createInitiative(opts: {
    key: string;
    title: string;
    stage: "DEMAND" | "REQUIREMENTS" | "PRE_STUDY" | "POC" | "PROJECT";
    departmentId: string;
    owner: { id: string; name: string };
  }) {
    const initiative = await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: opts.departmentId,
        referenceKey: opts.key,
        title: opts.title,
        requesterName: "IT Demand Office",
        businessOwnerName: opts.owner.name,
        businessOwnerResourceId: opts.owner.id,
        currentStage: opts.stage,
        status: "ACTIVE",
      },
    });
    await db.demand.create({
      data: {
        initiativeId: initiative.id,
        problemOpportunity: `IT need: ${opts.title}`,
        reasonForRequest: "Demo hierarchy visibility seed",
        expectedValue: "Clearer ownership and delivery across IN departments",
        affectedAreas: "IN / INF / child departments",
        urgency: "HIGH",
        strategicAlignment: "IT operating model",
        initialImpact: "Medium",
      },
    });
    await db.lifecycleTransition.create({
      data: {
        initiativeId: initiative.id,
        fromStage: "DEMAND",
        toStage: opts.stage === "DEMAND" ? "DEMAND" : opts.stage,
        actorPrincipalId: actorId,
        comment: "IT demo seed",
      },
    });
    return initiative;
  }

  console.log("Creating demand / pre-study / PoC / project work…");
  await createInitiative({
    key: "INI-IT-DEMAND-01",
    title: "New plant self-service portal (demand)",
    stage: "DEMAND",
    departmentId: ina.id,
    owner: ana,
  });

  const preStudy = await createInitiative({
    key: "INI-IT-PRESTUDY-01",
    title: "Identity platform upgrade pre-study",
    stage: "PRE_STUDY",
    departmentId: inf.id,
    owner: ira,
  });
  await db.preStudy.create({ data: { initiativeId: preStudy.id } });
  await db.risk.create({
    data: {
      initiativeId: preStudy.id,
      referenceKey: "RSK-IT-01",
      title: "Legacy IdP connectors",
      description: "Plant AD connectors may need rewrite",
      ownerName: ira.name,
      ownerResourceId: ira.id,
      probability: "MEDIUM",
      impact: "HIGH",
      status: "OPEN",
    },
  });

  const pocInit = await createInitiative({
    key: "INI-IT-POC-01",
    title: "Zero-trust network access PoC",
    stage: "POC",
    departmentId: ing.id,
    owner: gina,
  });
  const poc = await db.poC.create({
    data: {
      initiativeId: pocInit.id,
      title: "ZTA pilot for remote admins",
      objective: "Prove safer remote admin access without full VPN",
      hypothesis: "Device posture + SSO reduces open VPN risk",
      scope: "ING network admins and two jump hosts",
      outOfScope: "Plant OT networks",
      ownerName: gina.name,
      ownerResourceId: gina.id,
      plannedStart: new Date("2026-09-01"),
      plannedEnd: new Date("2026-11-30"),
      estimatedCost: "28000",
      status: "IN_PROGRESS",
    },
  });
  await db.poCSuccessCriterion.create({
    data: {
      pocId: poc.id,
      description: "Successful admin sessions without legacy VPN",
      measurementMethod: "Weekly access log review",
      target: "≥ 95%",
      unit: "%",
      sortOrder: 1,
    },
  });

  const reqInit = await createInitiative({
    key: "INI-IT-REQ-01",
    title: "Master data sync for INFF services",
    stage: "REQUIREMENTS",
    departmentId: inff.id,
    owner: nora,
  });
  await db.requirement.create({
    data: {
      initiativeId: reqInit.id,
      referenceKey: "REQ-IT-01",
      title: "Near-real-time plant master data feed",
      description: "Propagate item masters to INFF consumers within 5 minutes",
      category: "FUNCTIONAL",
      status: "DRAFT",
      priority: "MUST",
    },
  });

  const projectInit = await createInitiative({
    key: "INI-IT-PROJ-01",
    title: "Maintenance work-order app (product)",
    stage: "PROJECT",
    departmentId: infb.id,
    owner: bo,
  });
  const product = await db.project.create({
    data: {
      initiativeId: projectInit.id,
      organizationId: org.id,
      departmentId: infb.id,
      referenceKey: "PROJ-IT-01",
      name: "Maintenance work-order app",
      description: "Mobile work orders for plant maintenance teams",
      ownerName: bo.name,
      ownerResourceId: bo.id,
      status: "ACTIVE",
      priority: "HIGH",
      plannedStart: new Date("2026-08-01"),
      plannedEnd: new Date("2027-02-28"),
      objectives: "Ship MVP for Plant A maintenance crews",
    },
  });
  await db.projectParticipatingDepartment.create({
    data: { projectId: product.id, departmentId: inf.id },
  });

  console.log("Creating demo personas + local logins…");
  const passwordHash = await bcryptHash(DEMO_PERSONA_PASSWORD, 10);
  for (const persona of DEMO_PERSONAS) {
    const role = await ensureRole(persona.roleKey);
    await db.principal.create({
      data: {
        id: persona.principalId,
        displayName: persona.displayName,
        externalSubject: `demo:${persona.key}`,
      },
    });
    await db.externalIdentity.create({
      data: {
        issuer: LOCAL_LOGIN_ISSUER,
        subject: persona.username,
        principalId: persona.principalId,
        displayNameSnapshot: persona.displayName,
      },
    });
    await db.localLoginCredential.create({
      data: {
        principalId: persona.principalId,
        username: persona.username,
        passwordHash,
        displayName: persona.displayName,
        createdByPrincipalId: actorId,
      },
    });
    await db.roleBinding.create({
      data: {
        principalId: persona.principalId,
        roleDefinitionId: role.id,
        scopeType: ScopeType[persona.scopeType],
        organizationId: org.id,
        scopeId:
          persona.scopeType === "ORGANIZATION" ? org.id : persona.scopeId,
      },
    });
  }

  // Link manager resources to persona principals where names match.
  await db.resource.update({
    where: { id: ira.id },
    data: {
      linkedPrincipalId: DEMO_PERSONAS.find((p) => p.key === "inf-manager")!
        .principalId,
    },
  });
  await db.resource.update({
    where: { id: bo.id },
    data: {
      linkedPrincipalId: DEMO_PERSONAS.find((p) => p.key === "infb-manager")!
        .principalId,
    },
  });
  await db.resource.update({
    where: { id: gina.id },
    data: {
      linkedPrincipalId: DEMO_PERSONAS.find((p) => p.key === "ing-manager")!
        .principalId,
    },
  });
  await db.resource.update({
    where: { id: ana.id },
    data: {
      linkedPrincipalId: DEMO_PERSONAS.find((p) => p.key === "ina-manager")!
        .principalId,
    },
  });
  await db.resource.update({
    where: { id: sam.id },
    data: {
      linkedPrincipalId: DEMO_PERSONAS.find((p) => p.key === "in-manager")!
        .principalId,
    },
  });

  console.log(`
IT hierarchy demo ready.
  Organization: ${org.name} (${org.id})
  Section: ${section.name}
  Departments: INF → INFB, INFF | ING | INA

Local logins (password: ${DEMO_PERSONA_PASSWORD}):
${DEMO_PERSONAS.map((p) => `  - ${p.username}  (${p.levelLabel})`).join("\n")}

Top-bar dropdown: set ALLOW_DEMO_PERSONA_SWITCH=1 (or use local DEV auth),
sign in as owner/dev, then pick a level to simulate visibility.
`);
  void freja;
  void viktor;
  void omar;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
