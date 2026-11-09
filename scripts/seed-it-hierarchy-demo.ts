/**
 * Seed Organization I → Section IN → departments INF/INFB/INFF/ING/INA
 * with a realistic industrial-IT portfolio (demand → pre-study → PoC →
 * requirements → delivery project) plus resources and demo personas.
 *
 * Designed so a manager walkthrough is easy:
 *   IN overview → drill into INF/INFB → open Maintenance work-order project.
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
  DEMO_DEPARTMENT_USERS,
  DEMO_ORG_NAME,
  DEMO_PERSONA_PASSWORD,
  DEMO_PERSONAS,
  DEMO_SECTION_NAME,
  DEMO_SWITCH_PERSONAS,
  IT_DEMO_DEPTS,
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
    (await db.organization.findFirst({
      where: {
        OR: [{ name: DEMO_ORG_NAME }, { name: "I" }],
      },
    }));
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

  for (const persona of DEMO_SWITCH_PERSONAS) {
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
        "Industrial IT organization used for manager demos. Hierarchy: I → IN → INF (INFB, INFF) / ING / INA.",
    },
  });
  await authz.grantOrganizationAdmin(actorId, org.id);

  const section = await db.section.create({
    data: {
      id: IT_DEMO_IDS.sectionIn,
      organizationId: org.id,
      name: DEMO_SECTION_NAME,
      description:
        "IT section spanning platforms, infrastructure, and demand. Start here for the section-manager overview.",
    },
  });

  const inf = await db.department.create({
    data: {
      id: IT_DEMO_DEPTS.inf.id,
      sectionId: section.id,
      name: IT_DEMO_DEPTS.inf.name,
      description: IT_DEMO_DEPTS.inf.description,
    },
  });
  const infb = await db.department.create({
    data: {
      id: IT_DEMO_DEPTS.infb.id,
      sectionId: section.id,
      parentDepartmentId: inf.id,
      name: IT_DEMO_DEPTS.infb.name,
      description: IT_DEMO_DEPTS.infb.description,
    },
  });
  const inff = await db.department.create({
    data: {
      id: IT_DEMO_DEPTS.inff.id,
      sectionId: section.id,
      parentDepartmentId: inf.id,
      name: IT_DEMO_DEPTS.inff.name,
      description: IT_DEMO_DEPTS.inff.description,
    },
  });
  const ing = await db.department.create({
    data: {
      id: IT_DEMO_DEPTS.ing.id,
      sectionId: section.id,
      name: IT_DEMO_DEPTS.ing.name,
      description: IT_DEMO_DEPTS.ing.description,
    },
  });
  const ina = await db.department.create({
    data: {
      id: IT_DEMO_DEPTS.ina.id,
      sectionId: section.id,
      name: IT_DEMO_DEPTS.ina.name,
      description: IT_DEMO_DEPTS.ina.description,
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
  async function person(
    name: string,
    role: string,
    teamId: string,
    skills: string[],
  ) {
    const resource = await db.resource.create({
      data: {
        organizationId: org.id,
        name,
        type: "PERSON",
        functionRole: role,
        skillsJson: skills,
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

  const ira = await person("Ira INF Manager", "Department Manager", teams.infPlatform.id, [
    "Platforms",
    "Governance",
  ]);
  const bo = await person("Bo INFB Manager", "Department Manager", teams.infbApps.id, [
    "Delivery",
    "Product",
  ]);
  const freja = await person("Freja App Dev", "Developer", teams.infbApps.id, [
    "React",
    "Mobile",
    "TypeScript",
  ]);
  const lina = await person("Lina UX", "Product Designer", teams.infbApps.id, [
    "UX",
    "Field research",
  ]);
  const viktor = await person("Viktor App Ops", "Ops Engineer", teams.infbOps.id, [
    "SRE",
    "Kubernetes",
  ]);
  const nora = await person("Nora Data Lead", "Data Lead", teams.inffData.id, [
    "Integration",
    "Master data",
  ]);
  const erik = await person("Erik Integration", "Integration Engineer", teams.inffData.id, [
    "APIs",
    "EDI",
  ]);
  const gina = await person("Gina ING Manager", "Department Manager", teams.ingInfra.id, [
    "Network",
    "Security",
  ]);
  const omar = await person("Omar Network", "Network Engineer", teams.ingInfra.id, [
    "Zero-trust",
    "Firewall",
  ]);
  const ana = await person("Ana INA Manager", "Department Manager", teams.inaDemand.id, [
    "Demand",
    "Architecture",
  ]);
  const sam = await person("Sam IN Manager", "Section Manager", teams.inaDemand.id, [
    "Portfolio",
    "Leadership",
  ]);

  async function createInitiative(opts: {
    key: string;
    title: string;
    stage: "DEMAND" | "REQUIREMENTS" | "PRE_STUDY" | "POC" | "PROJECT";
    departmentId: string;
    owner: { id: string; name: string };
    requesterName: string;
    demand: {
      problemOpportunity: string;
      reasonForRequest: string;
      expectedValue: string;
      affectedAreas: string;
      urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      strategicAlignment: string;
      initialImpact: string;
      notes?: string;
    };
  }) {
    const initiative = await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: opts.departmentId,
        referenceKey: opts.key,
        title: opts.title,
        requesterName: opts.requesterName,
        businessOwnerName: opts.owner.name,
        businessOwnerResourceId: opts.owner.id,
        currentStage: opts.stage,
        status: "ACTIVE",
      },
    });
    await db.demand.create({
      data: {
        initiativeId: initiative.id,
        ...opts.demand,
      },
    });
    await db.lifecycleTransition.create({
      data: {
        initiativeId: initiative.id,
        fromStage: "DEMAND",
        toStage: opts.stage === "DEMAND" ? "DEMAND" : opts.stage,
        actorPrincipalId: actorId,
        comment: "Manager-demo seed — industrial IT portfolio",
      },
    });
    return initiative;
  }

  console.log("Creating clearer industrial IT portfolio…");

  // 1) INA — early demand a manager can discuss in intake meetings
  await createInitiative({
    key: "INI-IT-DEMAND-01",
    title: "Digital work instructions for assembly operators",
    stage: "DEMAND",
    departmentId: ina.id,
    owner: ana,
    requesterName: "Plant Production (Assembly)",
    demand: {
      problemOpportunity:
        "Operators still use paper work instructions that go stale after line changes. Quality deviations increase when the wrong revision is on the floor.",
      reasonForRequest:
        "Production asked IT for a tablet-based instruction viewer tied to the current product variant on each station.",
      expectedValue:
        "Fewer revision errors, faster line changeovers, and a single source of truth owned by process engineering.",
      affectedAreas: "Assembly lines A/B, process engineering, quality, INA demand, INFB apps",
      urgency: "HIGH",
      strategicAlignment: "Digital plant operations / paperless shop floor",
      initialImpact: "High on assembly quality; medium IT delivery effort",
      notes: "Still in intake — good example for INA manager walkthrough.",
    },
  });

  // 2) INF — pre-study with assessments + alternatives (decision-ready)
  const preStudyInit = await createInitiative({
    key: "INI-IT-PRESTUDY-01",
    title: "Identity & access platform upgrade",
    stage: "PRE_STUDY",
    departmentId: inf.id,
    owner: ira,
    requesterName: "IT Security Office",
    demand: {
      problemOpportunity:
        "Legacy IdP and plant AD connectors are hard to operate and block SSO for new shop-floor apps.",
      reasonForRequest:
        "Security and platforms need a clear recommendation before funding a multi-year identity program.",
      expectedValue:
        "One SSO pattern for business and plant apps, fewer VPN exceptions, easier joiner/mover/leaver.",
      affectedAreas: "INF platforms, ING network, all plant apps under INFB/INFF",
      urgency: "HIGH",
      strategicAlignment: "Zero-trust and industrial cybersecurity roadmap",
      initialImpact: "High — foundation for several delivery projects",
    },
  });
  const preStudy = await db.preStudy.create({
    data: {
      initiativeId: preStudyInit.id,
      summary:
        "Compare managed cloud IdP vs harden-in-place. Recommendation leans managed IdP with phased plant connector migration.",
    },
  });
  await db.preStudyAssessment.createMany({
    data: [
      {
        preStudyId: preStudy.id,
        area: "CURRENT_STATE",
        ownerName: ira.name,
        status: "COMPLETE",
        summary: "Mixed AD forests + aging federation gateway",
        findings:
          "Three plant forests, custom scripts for contractor accounts, no device posture on admin VPN.",
        conclusion: "Current state is operationally fragile for new digital plant apps.",
      },
      {
        preStudyId: preStudy.id,
        area: "SECURITY",
        ownerName: gina.name,
        status: "COMPLETE",
        summary: "Privileged access is the highest risk",
        findings:
          "Shared jump-host passwords still used by some contractors; MFA coverage incomplete on plant apps.",
        conclusion: "Any option must include MFA + privileged access workflow.",
      },
      {
        preStudyId: preStudy.id,
        area: "COST",
        ownerName: ira.name,
        status: "IN_PROGRESS",
        summary: "3-year TCO draft in progress",
        findings: "Licensing dominates managed IdP; staff time dominates harden-in-place.",
        conclusion: null,
      },
      {
        preStudyId: preStudy.id,
        area: "INTEGRATION",
        ownerName: nora.name,
        status: "IN_PROGRESS",
        summary: "Plant AD connector inventory ongoing",
        findings: "12 connectors identified; 4 undocumented.",
        conclusion: null,
      },
    ],
  });
  await db.solutionAlternative.createMany({
    data: [
      {
        preStudyId: preStudy.id,
        title: "A — Managed cloud IdP (recommended)",
        description:
          "Adopt a managed identity platform, keep plant AD as a source for a transition period, migrate connectors in waves.",
        benefits: "Faster MFA, better audit, less custom code, clearer vendor support.",
        drawbacks: "License cost; change management for plant IT.",
        estimatedCost: "€420k over 3 years",
        estimatedDuration: "18 months phased",
        riskUncertainty: "Medium — connector migration complexity",
        isRecommended: true,
      },
      {
        preStudyId: preStudy.id,
        title: "B — Harden existing IdP in place",
        description:
          "Upgrade current federation gateway, add MFA, rewrite the worst plant connectors.",
        benefits: "Lower license spend; keeps familiar tooling.",
        drawbacks: "Still carries technical debt; slower path to shop-floor SSO.",
        estimatedCost: "€260k over 3 years",
        estimatedDuration: "12 months",
        riskUncertainty: "High — remaining custom connectors",
        isRecommended: false,
      },
    ],
  });
  await db.risk.createMany({
    data: [
      {
        initiativeId: preStudyInit.id,
        referenceKey: "RSK-IT-01",
        title: "Undocumented plant AD connectors",
        description:
          "Four connectors lack owners; cutover could break contractor access on night shifts.",
        ownerName: ira.name,
        ownerResourceId: ira.id,
        probability: "MEDIUM",
        impact: "HIGH",
        status: "OPEN",
      },
      {
        initiativeId: preStudyInit.id,
        referenceKey: "RSK-IT-02",
        title: "Budget gate slips into Q2",
        description: "If cost assessment is late, program start moves past summer shutdown window.",
        ownerName: sam.name,
        ownerResourceId: sam.id,
        probability: "MEDIUM",
        impact: "MEDIUM",
        status: "OPEN",
      },
    ],
  });

  // 3) ING — active PoC with measurable success criteria
  const pocInit = await createInitiative({
    key: "INI-IT-POC-01",
    title: "Zero-trust remote admin access PoC",
    stage: "POC",
    departmentId: ing.id,
    owner: gina,
    requesterName: "Network Ops",
    demand: {
      problemOpportunity:
        "Remote admins still depend on broad site-to-site VPN, which widens blast radius if a laptop is compromised.",
      reasonForRequest:
        "Prove that device posture + SSO can replace VPN for a controlled admin group before plant rollout.",
      expectedValue:
        "Safer remote administration and a pattern that identity upgrade (INF) can reuse.",
      affectedAreas: "ING network, INF identity, plant jump hosts",
      urgency: "HIGH",
      strategicAlignment: "Zero-trust / industrial cybersecurity",
      initialImpact: "Medium scope PoC; high learning value",
    },
  });
  const poc = await db.poC.create({
    data: {
      initiativeId: pocInit.id,
      title: "ZTA pilot for remote admins",
      objective:
        "Prove safer remote admin access without full VPN for Network Ops and two jump hosts.",
      hypothesis:
        "Device posture checks plus SSO reduce open VPN risk while keeping admin productivity.",
      scope: "ING network admins, two jump hosts, one non-production plant VLAN",
      outOfScope: "OT/control networks, production PLC access",
      ownerName: gina.name,
      ownerResourceId: gina.id,
      plannedStart: new Date("2026-09-01"),
      plannedEnd: new Date("2026-11-30"),
      estimatedCost: "28000",
      status: "IN_PROGRESS",
    },
  });
  await db.poCSuccessCriterion.createMany({
    data: [
      {
        pocId: poc.id,
        description: "Successful admin sessions without legacy VPN",
        measurementMethod: "Weekly access log review",
        target: "≥ 95%",
        unit: "%",
        sortOrder: 1,
      },
      {
        pocId: poc.id,
        description: "Mean time to connect for admin tasks",
        measurementMethod: "Stopwatch sample of 20 sessions",
        target: "≤ 45",
        unit: "seconds",
        sortOrder: 2,
      },
      {
        pocId: poc.id,
        description: "Critical findings from security review",
        measurementMethod: "Security checklist sign-off",
        target: "0",
        unit: "findings",
        sortOrder: 3,
      },
    ],
  });
  await db.risk.create({
    data: {
      initiativeId: pocInit.id,
      referenceKey: "RSK-IT-03",
      title: "Jump-host agent compatibility",
      description: "Older jump hosts may not support the posture agent OS baseline.",
      ownerName: omar.name,
      ownerResourceId: omar.id,
      probability: "MEDIUM",
      impact: "MEDIUM",
      status: "MITIGATING",
    },
  });

  // 4) INFF — requirements stage with clear acceptance criteria
  const reqInit = await createInitiative({
    key: "INI-IT-REQ-01",
    title: "Plant master-data sync hub",
    stage: "REQUIREMENTS",
    departmentId: inff.id,
    owner: nora,
    requesterName: "Plant Logistics IT",
    demand: {
      problemOpportunity:
        "Item and BOM masters arrive late to downstream services, causing picking and kitting mistakes.",
      reasonForRequest:
        "Need a near-real-time sync hub owned by INFF that INFB apps can subscribe to.",
      expectedValue:
        "Stable ≤5 minute propagation of plant masters; fewer manual data fixes.",
      affectedAreas: "INFF data services, logistics, maintenance app (INFB)",
      urgency: "HIGH",
      strategicAlignment: "Reliable plant data foundation",
      initialImpact: "High for logistics accuracy",
    },
  });
  const req1 = await db.requirement.create({
    data: {
      initiativeId: reqInit.id,
      referenceKey: "REQ-IT-01",
      title: "Near-real-time item master feed",
      description:
        "Propagate item masters from the plant source system to subscribed INFF consumers within 5 minutes of change.",
      category: "DATA",
      status: "ACCEPTED",
      priority: "MUST",
      ownerName: nora.name,
      source: "Plant Logistics IT",
    },
  });
  await db.acceptanceCriterion.createMany({
    data: [
      {
        requirementId: req1.id,
        description: "p95 end-to-end latency ≤ 5 minutes over a 7-day sample",
        sortOrder: 1,
      },
      {
        requirementId: req1.id,
        description: "Failed messages are retried and visible in an ops dashboard",
        sortOrder: 2,
      },
    ],
  });
  await db.requirement.create({
    data: {
      initiativeId: reqInit.id,
      referenceKey: "REQ-IT-02",
      title: "Schema versioning for consumers",
      description:
        "Consumers must receive a versioned payload so INFB apps can upgrade without hard cutovers.",
      category: "ARCHITECTURE",
      status: "DRAFT",
      priority: "SHOULD",
      ownerName: erik.name,
      source: "INFF architecture review",
    },
  });
  await db.requirement.create({
    data: {
      initiativeId: reqInit.id,
      referenceKey: "REQ-IT-03",
      title: "Audit trail for master changes",
      description:
        "Every propagated change stores who/when/source system for compliance and troubleshooting.",
      category: "COMPLIANCE",
      status: "DRAFT",
      priority: "MUST",
      ownerName: nora.name,
      source: "Quality / audit",
    },
  });

  // 5) INFB — flagship delivery project with milestones, work, issues, budget
  const projectInit = await createInitiative({
    key: "INI-IT-PROJ-01",
    title: "Maintenance work-order mobile app",
    stage: "PROJECT",
    departmentId: infb.id,
    owner: bo,
    requesterName: "Plant Maintenance",
    demand: {
      problemOpportunity:
        "Technicians lose time walking back to the workshop PC to update work orders; paper notes get lost.",
      reasonForRequest:
        "Deliver a mobile work-order app for Plant A maintenance crews, integrated with master data from INFF.",
      expectedValue:
        "Faster close-out, better spare-part traceability, and live status for supervisors.",
      affectedAreas: "INFB apps, INFF master data, Plant A maintenance, INF platforms (SSO)",
      urgency: "CRITICAL",
      strategicAlignment: "Digital maintenance excellence",
      initialImpact: "High for maintenance productivity",
    },
  });
  const product = await db.project.create({
    data: {
      initiativeId: projectInit.id,
      organizationId: org.id,
      departmentId: infb.id,
      referenceKey: "PROJ-IT-01",
      name: "Maintenance work-order mobile app",
      description:
        "Flagship INFB delivery for manager demos. Mobile work orders for Plant A maintenance: create/update orders on the floor, attach photos, consume spare parts, and sync via the INFF master-data hub. Uses INF identity once SSO is ready.",
      ownerName: bo.name,
      ownerResourceId: bo.id,
      status: "ACTIVE",
      priority: "HIGH",
      plannedStart: new Date("2026-08-01"),
      plannedEnd: new Date("2027-02-28"),
      estimatedCost: 185000,
      approvedBudget: 210000,
      plannedCost: 185000,
      forecastCost: 192000,
      actualCost: 74000,
      currencyCode: "EUR",
      objectives:
        "1) MVP for Plant A crews by Dec 2026\n2) Offline-tolerant updates\n3) Supervisor live board\n4) Ready for Plant B rollout in 2027",
    },
  });
  await db.projectParticipatingDepartment.createMany({
    data: [
      { projectId: product.id, departmentId: inf.id },
      { projectId: product.id, departmentId: inff.id },
    ],
  });

  await db.projectMilestone.createMany({
    data: [
      {
        projectId: product.id,
        referenceKey: "MS-01",
        title: "Field research & UX prototype",
        description: "Ride-alongs with Plant A technicians; clickable prototype signed off.",
        ownerName: lina.name,
        ownerResourceId: lina.id,
        plannedDate: new Date("2026-09-15"),
        actualDate: new Date("2026-09-12"),
        status: "COMPLETED",
        criticality: true,
      },
      {
        projectId: product.id,
        referenceKey: "MS-02",
        title: "MVP backlog locked",
        description: "Scope freeze for first release with maintenance supervisors.",
        ownerName: bo.name,
        ownerResourceId: bo.id,
        plannedDate: new Date("2026-10-01"),
        actualDate: new Date("2026-10-03"),
        status: "COMPLETED",
        criticality: true,
      },
      {
        projectId: product.id,
        referenceKey: "MS-03",
        title: "Alpha on Plant A Wi-Fi",
        description: "Internal alpha with Apps Ops support on one crew.",
        ownerName: freja.name,
        ownerResourceId: freja.id,
        plannedDate: new Date("2026-11-20"),
        status: "IN_PROGRESS",
        criticality: true,
      },
      {
        projectId: product.id,
        referenceKey: "MS-04",
        title: "MVP go-live Plant A",
        description: "Production cutover for Plant A maintenance crews.",
        ownerName: bo.name,
        ownerResourceId: bo.id,
        plannedDate: new Date("2026-12-18"),
        status: "PLANNED",
        criticality: true,
      },
      {
        projectId: product.id,
        referenceKey: "MS-05",
        title: "Plant B readiness review",
        description: "Lessons learned + rollout plan for second site.",
        ownerName: sam.name,
        ownerResourceId: sam.id,
        plannedDate: new Date("2027-02-15"),
        status: "PLANNED",
        criticality: false,
      },
    ],
  });

  const epicOrders = await db.projectWorkItem.create({
    data: {
      projectId: product.id,
      type: "EPIC",
      referenceKey: "WI-E01",
      title: "Work-order lifecycle on mobile",
      description: "Create, assign, update, and close work orders from the device.",
      ownerName: freja.name,
      ownerResourceId: freja.id,
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      estimateHours: 320,
    },
  });
  const epicOffline = await db.projectWorkItem.create({
    data: {
      projectId: product.id,
      type: "EPIC",
      referenceKey: "WI-E02",
      title: "Offline-tolerant sync",
      description: "Queue updates when Wi-Fi drops in basement workshops.",
      ownerName: freja.name,
      ownerResourceId: freja.id,
      status: "READY",
      priority: "HIGH",
      estimateHours: 180,
    },
  });
  const epicParts = await db.projectWorkItem.create({
    data: {
      projectId: product.id,
      type: "EPIC",
      referenceKey: "WI-E03",
      title: "Spare-parts consumption",
      description: "Scan and consume parts against the order; sync stock via INFF.",
      ownerName: nora.name,
      ownerResourceId: nora.id,
      status: "BACKLOG",
      priority: "HIGH",
      estimateHours: 140,
    },
  });

  await db.projectWorkItem.createMany({
    data: [
      {
        projectId: product.id,
        type: "FEATURE",
        referenceKey: "WI-F01",
        title: "Technician order list & filters",
        parentId: epicOrders.id,
        ownerName: freja.name,
        ownerResourceId: freja.id,
        status: "DONE",
        priority: "HIGH",
        estimateHours: 40,
      },
      {
        projectId: product.id,
        type: "FEATURE",
        referenceKey: "WI-F02",
        title: "Photo attachments on close-out",
        parentId: epicOrders.id,
        ownerName: freja.name,
        ownerResourceId: freja.id,
        status: "IN_PROGRESS",
        priority: "HIGH",
        estimateHours: 56,
      },
      {
        projectId: product.id,
        type: "TASK",
        referenceKey: "WI-T01",
        title: "Supervisor live board API",
        parentId: epicOrders.id,
        ownerName: viktor.name,
        ownerResourceId: viktor.id,
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        estimateHours: 32,
      },
      {
        projectId: product.id,
        type: "FEATURE",
        referenceKey: "WI-F03",
        title: "Local queue + conflict resolve UI",
        parentId: epicOffline.id,
        ownerName: freja.name,
        ownerResourceId: freja.id,
        status: "READY",
        priority: "HIGH",
        estimateHours: 64,
      },
      {
        projectId: product.id,
        type: "TASK",
        referenceKey: "WI-T02",
        title: "INFF parts master subscription",
        parentId: epicParts.id,
        ownerName: erik.name,
        ownerResourceId: erik.id,
        status: "BACKLOG",
        priority: "MEDIUM",
        estimateHours: 40,
      },
    ],
  });

  await db.projectIssue.createMany({
    data: [
      {
        organizationId: org.id,
        projectId: product.id,
        referenceKey: "ISS-01",
        title: "Plant A Wi-Fi dead zones in basement workshop",
        description:
          "Alpha testers lose connectivity for 2–5 minutes in the south basement. Offline queue is the mitigation path.",
        severity: "HIGH",
        status: "IN_PROGRESS",
        isBlocker: true,
        ownerName: viktor.name,
        ownerResourceId: viktor.id,
      },
      {
        organizationId: org.id,
        projectId: product.id,
        referenceKey: "ISS-02",
        title: "SSO hand-off waiting on identity pre-study",
        description:
          "Temporary local login works for alpha; production should use INF identity recommendation.",
        severity: "MEDIUM",
        status: "OPEN",
        isBlocker: false,
        ownerName: ira.name,
        ownerResourceId: ira.id,
      },
      {
        organizationId: org.id,
        projectId: product.id,
        referenceKey: "ISS-03",
        title: "Photo upload size limits on older devices",
        description: "Some rugged tablets fail uploads >8 MB; need client-side compression.",
        severity: "MEDIUM",
        status: "OPEN",
        isBlocker: false,
        ownerName: freja.name,
        ownerResourceId: freja.id,
      },
    ],
  });

  await db.risk.create({
    data: {
      initiativeId: projectInit.id,
      referenceKey: "RSK-IT-04",
      title: "MVP date slips if offline epic starts late",
      description:
        "Basement Wi-Fi issue makes offline sync critical path for December go-live.",
      ownerName: bo.name,
      ownerResourceId: bo.id,
      probability: "HIGH",
      impact: "HIGH",
      status: "OPEN",
    },
  });

  console.log("Creating demo personas + department test users…");
  const passwordHash = await bcryptHash(DEMO_PERSONA_PASSWORD, 10);
  for (const persona of DEMO_SWITCH_PERSONAS) {
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

  for (const user of DEMO_DEPARTMENT_USERS) {
    await db.resource.create({
      data: {
        id: user.resourceId,
        organizationId: org.id,
        name: user.displayName,
        type: "PERSON",
        functionRole: user.functionRole,
        skillsJson: [user.functionRole, user.departmentLabel],
        capacityHoursPerWeek: 40,
        status: "ACTIVE",
        linkedPrincipalId: user.principalId,
        memberships: {
          create: {
            teamId: user.teamId,
            isPrimary: true,
            allocationPercent: 100,
          },
        },
      },
    });
  }

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
IT hierarchy manager demo ready.
  Organization: ${org.name}
  Section: ${section.name}
  Departments:
    ${inf.name} → ${infb.name}, ${inff.name}
    ${ing.name}
    ${ina.name}

Portfolio (easy manager walkthrough):
  1) INA  DEMAND        Digital work instructions for assembly operators
  2) INF  PRE-STUDY     Identity & access platform upgrade
  3) ING  PoC           Zero-trust remote admin access
  4) INFF REQUIREMENTS  Plant master-data sync hub
  5) INFB PROJECT       Maintenance work-order mobile app  ← flagship

Local logins (password: ${DEMO_PERSONA_PASSWORD}):
${DEMO_PERSONAS.map((p) => `  - ${p.username}  (${p.levelLabel})`).join("\n")}

Suggested manager path: sign in → Simulate = Section (IN) → open INFB →
open project PROJ-IT-01 → show milestones / issues / budget.
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
