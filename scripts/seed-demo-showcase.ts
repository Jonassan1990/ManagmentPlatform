/**
 * Demo showcase seed — organization, departments, initiatives, projects, issues.
 * Safe to re-run: clears prior DEMO-* reference keys first.
 *
 * Usage:
 *   DEV_AUTH_PRINCIPAL_ID=<uuid> npx tsx scripts/seed-demo-showcase.ts
 *   # Production / temp-owner:
 *   TEMP_AUTH_PRINCIPAL_ID=<uuid> npx tsx scripts/seed-demo-showcase.ts
 *
 * Optional one-shot on Vercel production build:
 *   DEMO_SEED_RUN=1 (build env) — see scripts/maybe-seed-demo.mjs
 */
import { PrismaClient } from "@prisma/client";
import { AuditService } from "@/modules/audit/application/audit-service";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";

const db = new PrismaClient();
const authz = new AuthorizationService(db);
const audit = new AuditService(db);

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

async function wipeDemoArtifacts() {
  // Cascade-friendly order for demo-tagged rows
  const demoProjects = await db.project.findMany({
    where: { referenceKey: { startsWith: "PROJ-DEMO-" } },
    select: { id: true, initiativeId: true },
  });
  const projectIds = demoProjects.map((p) => p.id);
  const initiativeIds = demoProjects.map((p) => p.initiativeId);

  const demoInits = await db.initiative.findMany({
    where: {
      OR: [
        { referenceKey: { startsWith: "INI-DEMO-" } },
        { id: { in: initiativeIds } },
      ],
    },
    select: { id: true },
  });
  const allInitIds = [...new Set([...initiativeIds, ...demoInits.map((i) => i.id)])];

  if (projectIds.length) {
    await db.projectIssue.deleteMany({ where: { projectId: { in: projectIds } } });
    await db.projectClosure.deleteMany({ where: { projectId: { in: projectIds } } }).catch(() => undefined);
    await db.projectWorkItem.deleteMany({ where: { projectId: { in: projectIds } } });
    await db.projectMilestone.deleteMany({ where: { projectId: { in: projectIds } } });
    await db.projectParticipatingDepartment.deleteMany({
      where: { projectId: { in: projectIds } },
    });
    await db.project.deleteMany({ where: { id: { in: projectIds } } });
  }

  if (allInitIds.length) {
    await db.approvalRecord.deleteMany({
      where: { approvalRequest: { submission: { initiativeId: { in: allInitIds } } } },
    }).catch(() => undefined);
    await db.approvalRequest.deleteMany({
      where: { submission: { initiativeId: { in: allInitIds } } },
    }).catch(() => undefined);
    await db.decisionCondition.deleteMany({
      where: { decision: { initiativeId: { in: allInitIds } } },
    }).catch(() => undefined);
    await db.decisionRecord.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.evidenceEntry.deleteMany({
      where: { package: { submission: { initiativeId: { in: allInitIds } } } },
    }).catch(() => undefined);
    await db.evidencePackage.deleteMany({
      where: { submission: { initiativeId: { in: allInitIds } } },
    }).catch(() => undefined);
    await db.decisionPackage.deleteMany({
      where: { submission: { initiativeId: { in: allInitIds } } },
    }).catch(() => undefined);
    await db.governanceSubmission.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.reviewSnapshot.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.governanceGate.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.pilotFeedback.deleteMany({ where: { pilot: { initiativeId: { in: allInitIds } } } }).catch(() => undefined);
    await db.pilotCriterion.deleteMany({ where: { pilot: { initiativeId: { in: allInitIds } } } }).catch(() => undefined);
    await db.pilotExtension.deleteMany({ where: { pilot: { initiativeId: { in: allInitIds } } } }).catch(() => undefined);
    await db.pilot.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.poCSuccessCriterion.deleteMany({ where: { poc: { initiativeId: { in: allInitIds } } } }).catch(() => undefined);
    await db.poC.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.documentVersion.deleteMany({
      where: { document: { initiativeId: { in: allInitIds } } },
    }).catch(() => undefined);
    await db.managedDocument.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.requirementRelation.deleteMany({
      where: {
        OR: [
          { fromRequirement: { initiativeId: { in: allInitIds } } },
          { toRequirement: { initiativeId: { in: allInitIds } } },
        ],
      },
    }).catch(() => undefined);
    await db.acceptanceCriterion.deleteMany({
      where: { requirement: { initiativeId: { in: allInitIds } } },
    }).catch(() => undefined);
    await db.requirement.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.solutionAlternative.deleteMany({
      where: { preStudy: { initiativeId: { in: allInitIds } } },
    }).catch(() => undefined);
    await db.preStudyAssessment.deleteMany({
      where: { preStudy: { initiativeId: { in: allInitIds } } },
    }).catch(() => undefined);
    await db.preStudy.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.risk.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.lifecycleTransition.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.demand.deleteMany({ where: { initiativeId: { in: allInitIds } } }).catch(() => undefined);
    await db.initiative.deleteMany({ where: { id: { in: allInitIds } } });
  }

  const demoOrg = await db.organization.findFirst({
    where: { name: "Nordic Demo Manufacturing" },
    select: { id: true },
  });
  if (!demoOrg) return;

  // Wipe CM / PI planning leftovers that are not DEMO-* project keyed.
  const pis = await db.programIncrement.findMany({
    where: { organizationId: demoOrg.id },
    select: { id: true },
  });
  for (const pi of pis) {
    const revs = await db.planningRevision.findMany({
      where: { piId: pi.id },
      select: { id: true },
    });
    const revIds = revs.map((r) => r.id);
    if (revIds.length) {
      await db.workAllocation.deleteMany({ where: { revisionId: { in: revIds } } });
    }
    const iters = await db.piIteration.findMany({
      where: { piId: pi.id },
      select: { id: true },
    });
    if (iters.length) {
      await db.resourceAvailability.deleteMany({
        where: { iterationId: { in: iters.map((i) => i.id) } },
      });
    }
    await db.planningDependency.deleteMany({ where: { organizationId: demoOrg.id } });
    await db.piParticipatingTeam.deleteMany({ where: { piId: pi.id } });
    await db.piParticipatingDepartment.deleteMany({ where: { piId: pi.id } });
    await db.planningRevision.deleteMany({ where: { piId: pi.id } });
    await db.piIteration.deleteMany({ where: { piId: pi.id } });
    await db.programIncrement.delete({ where: { id: pi.id } });
  }

  const remainingInits = await db.initiative.findMany({
    where: { organizationId: demoOrg.id },
    select: { id: true },
  });
  const remainingInitIds = remainingInits.map((i) => i.id);
  if (remainingInitIds.length) {
    const remainingProjects = await db.project.findMany({
      where: { initiativeId: { in: remainingInitIds } },
      select: { id: true },
    });
    const rpids = remainingProjects.map((p) => p.id);
    if (rpids.length) {
      await db.projectIssue.deleteMany({ where: { projectId: { in: rpids } } });
      await db.projectWorkItem.deleteMany({ where: { projectId: { in: rpids } } });
      await db.projectMilestone.deleteMany({ where: { projectId: { in: rpids } } });
      await db.projectParticipatingDepartment.deleteMany({
        where: { projectId: { in: rpids } },
      });
      await db.project.deleteMany({ where: { id: { in: rpids } } });
    }
    await db.demand.deleteMany({ where: { initiativeId: { in: remainingInitIds } } });
    await db.lifecycleTransition.deleteMany({
      where: { initiativeId: { in: remainingInitIds } },
    });
    await db.initiative.deleteMany({ where: { id: { in: remainingInitIds } } });
  }

  await db.resourceMembership.deleteMany({
    where: { resource: { organizationId: demoOrg.id } },
  });
  await db.resource.deleteMany({ where: { organizationId: demoOrg.id } });
  await db.roleBinding.deleteMany({ where: { organizationId: demoOrg.id } });
  await db.team.deleteMany({
    where: { department: { section: { organizationId: demoOrg.id } } },
  });
  await db.department.deleteMany({
    where: { section: { organizationId: demoOrg.id } },
  });
  await db.section.deleteMany({ where: { organizationId: demoOrg.id } });
  await db.organization.delete({ where: { id: demoOrg.id } });
}

async function main() {
  const actorId = resolveActorPrincipalId();
  const actor = {
    id: actorId,
    displayName:
      process.env.DEMO_SEED_DISPLAY_NAME ||
      process.env.TEMP_AUTH_DISPLAY_NAME ||
      process.env.DEV_AUTH_DISPLAY_NAME ||
      "Demo User",
    source: "test" as const,
  };

  console.log("Cleaning previous demo data…");
  await wipeDemoArtifacts();

  await db.principal.upsert({
    where: { id: actorId },
    create: { id: actorId, displayName: actor.displayName },
    update: { displayName: actor.displayName },
  });
  await authz.ensureBootstrapBinding(actorId);

  console.log("Creating organization tree…");
  const org = await db.organization.create({
    data: {
      name: "Nordic Demo Manufacturing",
      description:
        "Demo company for showcasing the Management Platform — plants, IT, and operations.",
    },
  });
  await authz.grantOrganizationAdmin(actorId, org.id);
  await audit.record({
    actorPrincipalId: actorId,
    actionType: "demo.seed.started",
    subjectType: "Organization",
    subjectId: org.id,
    organizationId: org.id,
    payload: { purpose: "showcase" },
    result: "success",
  });

  const opsSection = await db.section.create({
    data: {
      organizationId: org.id,
      name: "Operations",
      description: "Plant operations and continuous improvement",
    },
  });
  const digitalSection = await db.section.create({
    data: {
      organizationId: org.id,
      name: "Digital & IT",
      description: "Enterprise platforms and plant systems",
    },
  });
  const qualitySection = await db.section.create({
    data: {
      organizationId: org.id,
      name: "Quality & Continuous Improvement",
      description: "Quality systems, audits, and lean coaching",
    },
  });

  const plantA = await db.department.create({
    data: {
      sectionId: opsSection.id,
      name: "Plant A — Assembly",
      description: "Main assembly line",
    },
  });
  const plantB = await db.department.create({
    data: {
      sectionId: opsSection.id,
      name: "Plant B — Logistics",
      description: "Warehouse and outbound logistics",
    },
  });
  const itPlatform = await db.department.create({
    data: {
      sectionId: digitalSection.id,
      name: "IT Platform",
      description: "Shared digital platforms",
    },
  });
  const dataDept = await db.department.create({
    data: {
      sectionId: digitalSection.id,
      name: "Data & Analytics",
      description: "Reporting and analytics products",
    },
  });
  const qualityDept = await db.department.create({
    data: {
      sectionId: qualitySection.id,
      name: "Quality Systems",
      description: "Plant quality management and supplier audits",
    },
  });
  const leanDept = await db.department.create({
    data: {
      sectionId: qualitySection.id,
      name: "Lean Office",
      description: "CI coaching and standard work",
    },
  });

  const teamA = await db.team.create({
    data: { departmentId: plantA.id, name: "Line 2 Improvement" },
  });
  const teamIT = await db.team.create({
    data: { departmentId: itPlatform.id, name: "Platform Delivery" },
  });
  const teamData = await db.team.create({
    data: { departmentId: dataDept.id, name: "Analytics Delivery" },
  });
  const teamQuality = await db.team.create({
    data: { departmentId: qualityDept.id, name: "Audit Ops" },
  });
  const teamLean = await db.team.create({
    data: { departmentId: leanDept.id, name: "CI Coaches" },
  });

  const people = await Promise.all(
    [
      ["Sara Lind", "Plant Manager"],
      ["Erik Holm", "Logistics Lead"],
      ["Mina Kader", "Product Owner"],
      ["Jonas Berg", "Tech Lead"],
      ["Nora Ali", "Data Analyst"],
      ["Lina Persson", "Quality Manager"],
      ["Omar Hassan", "Lean Coach"],
      ["Freja Nyström", "Scrum Master"],
      ["Viktor Ek", "OT Engineer"],
      ["Aisha Rahman", "UX Researcher"],
    ].map(([name, role]) =>
      db.resource.create({
        data: {
          organizationId: org.id,
          name,
          type: "PERSON",
          functionRole: role,
          skillsJson: [],
          capacityHoursPerWeek: 40,
          status: "ACTIVE",
        },
      }),
    ),
  );
  const [sara, erik, mina, jonas, nora, lina, omar, freja, viktor, aisha] =
    people;

  await db.resourceMembership.createMany({
    data: [
      { resourceId: sara.id, teamId: teamA.id, isPrimary: true, allocationPercent: 100 },
      { resourceId: jonas.id, teamId: teamIT.id, isPrimary: true, allocationPercent: 100 },
      { resourceId: mina.id, teamId: teamIT.id, isPrimary: true, allocationPercent: 80 },
      { resourceId: freja.id, teamId: teamIT.id, isPrimary: true, allocationPercent: 100 },
      { resourceId: nora.id, teamId: teamData.id, isPrimary: true, allocationPercent: 100 },
      { resourceId: aisha.id, teamId: teamData.id, isPrimary: false, allocationPercent: 50 },
      { resourceId: lina.id, teamId: teamQuality.id, isPrimary: true, allocationPercent: 100 },
      { resourceId: omar.id, teamId: teamLean.id, isPrimary: true, allocationPercent: 100 },
      { resourceId: viktor.id, teamId: teamA.id, isPrimary: false, allocationPercent: 60 },
      { resourceId: erik.id, teamId: teamA.id, isPrimary: false, allocationPercent: 20 },
    ],
  });

  async function createInitiative(opts: {
    key: string;
    title: string;
    stage: "DEMAND" | "REQUIREMENTS" | "PRE_STUDY" | "POC" | "PILOT" | "PROJECT";
    departmentId: string;
    ownerResourceId: string;
    ownerName: string;
    urgency?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }) {
    const init = await db.initiative.create({
      data: {
        organizationId: org.id,
        departmentId: opts.departmentId,
        referenceKey: opts.key,
        title: opts.title,
        requesterName: "Demo Requester",
        businessOwnerName: opts.ownerName,
        businessOwnerResourceId: opts.ownerResourceId,
        currentStage: opts.stage,
        status: "ACTIVE",
      },
    });
    await db.demand.create({
      data: {
        initiativeId: init.id,
        problemOpportunity: `Business need behind ${opts.title}`,
        reasonForRequest: "Demo showcase for stakeholders",
        expectedValue: "Faster decisions and clearer delivery ownership",
        affectedAreas: "Operations and Digital",
        urgency: opts.urgency ?? "HIGH",
        strategicAlignment: "Operational excellence portfolio",
        initialImpact: "Medium — process and tooling change",
      },
    });
    await db.lifecycleTransition.create({
      data: {
        initiativeId: init.id,
        fromStage: "DEMAND",
        toStage: opts.stage === "DEMAND" ? "DEMAND" : opts.stage,
        actorPrincipalId: actorId,
        comment: "Demo seed lifecycle position",
      },
    });
    return init;
  }

  console.log("Creating initiatives across lifecycle stages…");
  const demandInit = await createInitiative({
    key: "INI-DEMO-01",
    title: "Shift handover digital checklist",
    stage: "DEMAND",
    departmentId: plantA.id,
    ownerResourceId: sara.id,
    ownerName: sara.name,
    urgency: "MEDIUM",
  });

  const reqInit = await createInitiative({
    key: "INI-DEMO-02",
    title: "Spare-parts demand forecasting",
    stage: "REQUIREMENTS",
    departmentId: dataDept.id,
    ownerResourceId: nora.id,
    ownerName: nora.name,
  });
  await db.requirement.create({
    data: {
      initiativeId: reqInit.id,
      referenceKey: "REQ-001",
      title: "Weekly forecast accuracy report",
      description: "Show MAPE by part family",
      category: "BUSINESS",
      status: "ACCEPTED",
      priority: "MUST",
    },
  });

  const preStudyInit = await createInitiative({
    key: "INI-DEMO-03",
    title: "Operator tablet rollout study",
    stage: "PRE_STUDY",
    departmentId: plantA.id,
    ownerResourceId: sara.id,
    ownerName: sara.name,
  });
  await db.preStudy.create({ data: { initiativeId: preStudyInit.id } });
  await db.risk.create({
    data: {
      initiativeId: preStudyInit.id,
      referenceKey: "RSK-001",
      title: "Network coverage in assembly hall",
      description: "Wi-Fi may drop near welding cells",
      ownerName: jonas.name,
      ownerResourceId: jonas.id,
      probability: "MEDIUM",
      impact: "HIGH",
      status: "OPEN",
    },
  });

  const pocInit = await createInitiative({
    key: "INI-DEMO-07",
    title: "Vision-based defect detection PoC",
    stage: "POC",
    departmentId: qualityDept.id,
    ownerResourceId: lina.id,
    ownerName: lina.name,
    urgency: "HIGH",
  });
  const poc = await db.poC.create({
    data: {
      initiativeId: pocInit.id,
      title: "Camera defect detection on Line 2",
      objective: "Prove AI vision can flag paint defects with ≥90% precision.",
      hypothesis:
        "Edge inference on existing PLC cameras reduces escaped defects by 30%.",
      scope: "Two camera stations on Line 2; offline labeling week 1–2.",
      outOfScope: "Full MES integration and plant-wide rollout.",
      ownerName: lina.name,
      ownerResourceId: lina.id,
      plannedStart: new Date("2026-09-15"),
      plannedEnd: new Date("2026-11-15"),
      estimatedCost: "45000",
      status: "IN_PROGRESS",
    },
  });
  await db.poCSuccessCriterion.createMany({
    data: [
      {
        pocId: poc.id,
        description: "Precision on held-out defect set",
        measurementMethod: "Confusion matrix weekly review",
        target: "≥ 0.90",
        unit: "ratio",
        sortOrder: 1,
      },
      {
        pocId: poc.id,
        description: "False positive rate acceptable to operators",
        measurementMethod: "Operator diary + sample audit",
        target: "≤ 5%",
        unit: "%",
        sortOrder: 2,
      },
    ],
  });

  const pilotInit = await createInitiative({
    key: "INI-DEMO-08",
    title: "Digital andon & escalation pilot",
    stage: "PILOT",
    departmentId: plantA.id,
    ownerResourceId: omar.id,
    ownerName: omar.name,
    urgency: "CRITICAL",
  });
  const pilot = await db.pilot.create({
    data: {
      initiativeId: pilotInit.id,
      objective: "Validate digital andon reduces mean response time on Line 2.",
      scope: "Line 2 cells A–D; team leads and maintenance on-call.",
      outOfScope: "Other plants and vendor SLA changes.",
      ownerName: omar.name,
      ownerResourceId: omar.id,
      siteOrArea: "Plant A — Assembly Line 2",
      targetUsers: "Team leads, maintenance technicians, shift managers",
      plannedStart: new Date("2026-10-01"),
      plannedEnd: new Date("2026-12-15"),
      estimatedCost: 62000,
      status: "IN_PROGRESS",
      environment: "Production cells with staging fallback",
      supportModel: "Platform Delivery on-call + Lean Office coaching",
      rollbackPlan: "Revert to physical andon boards within one shift",
    },
  });
  await db.pilotCriterion.createMany({
    data: [
      {
        pilotId: pilot.id,
        category: "OPERATIONAL",
        title: "Mean response time",
        description: "Time from andon pull to first acknowledge",
        measurementMethod: "Andon event timestamps",
        target: "≤ 8 minutes",
        unit: "minutes",
        sortOrder: 1,
      },
      {
        pilotId: pilot.id,
        category: "BUSINESS",
        title: "Operator adoption",
        description: "Active users per shift",
        measurementMethod: "Weekly active operator count",
        target: "≥ 85%",
        unit: "%",
        sortOrder: 2,
      },
    ],
  });
  await db.pilotFeedback.create({
    data: {
      pilotId: pilot.id,
      sourceType: "OPERATOR_INTERVIEW",
      summary: "Team leads like mobile ack; want louder secondary alert.",
      sentiment: "MIXED",
      submittedByName: sara.name,
    },
  });

  const projectInitA = await createInitiative({
    key: "INI-DEMO-04",
    title: "Plant A OEE dashboard",
    stage: "PROJECT",
    departmentId: plantA.id,
    ownerResourceId: mina.id,
    ownerName: mina.name,
    urgency: "CRITICAL",
  });
  const projectInitB = await createInitiative({
    key: "INI-DEMO-05",
    title: "Yard slot booking for outbound trucks",
    stage: "PROJECT",
    departmentId: plantB.id,
    ownerResourceId: erik.id,
    ownerName: erik.name,
  });
  const projectInitC = await createInitiative({
    key: "INI-DEMO-06",
    title: "Identity & access self-service portal",
    stage: "PROJECT",
    departmentId: itPlatform.id,
    ownerResourceId: jonas.id,
    ownerName: jonas.name,
  });
  const projectInitD = await createInitiative({
    key: "INI-DEMO-09",
    title: "Supplier quality scorecard",
    stage: "PROJECT",
    departmentId: qualityDept.id,
    ownerResourceId: lina.id,
    ownerName: lina.name,
    urgency: "HIGH",
  });
  const projectInitE = await createInitiative({
    key: "INI-DEMO-10",
    title: "Shift capacity planner for coaches",
    stage: "PROJECT",
    departmentId: leanDept.id,
    ownerResourceId: omar.id,
    ownerName: omar.name,
    urgency: "MEDIUM",
  });

  console.log("Creating projects, work items, milestones, issues…");
  async function createProject(opts: {
    initiativeId: string;
    key: string;
    name: string;
    departmentId: string;
    ownerResourceId: string;
    ownerName: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    description: string;
  }) {
    return db.project.create({
      data: {
        initiativeId: opts.initiativeId,
        organizationId: org.id,
        departmentId: opts.departmentId,
        referenceKey: opts.key,
        name: opts.name,
        description: opts.description,
        ownerName: opts.ownerName,
        ownerResourceId: opts.ownerResourceId,
        status: "ACTIVE",
        priority: opts.priority,
        plannedStart: new Date("2026-09-01"),
        plannedEnd: new Date("2027-03-31"),
        estimatedCost: "120000",
        approvedBudget: "150000",
        currencyCode: "EUR",
        objectives: "Deliver measurable operational improvement with governed scope.",
      },
    });
  }

  const projA = await createProject({
    initiativeId: projectInitA.id,
    key: "PROJ-DEMO-01",
    name: "OEE Dashboard Delivery",
    departmentId: plantA.id,
    ownerResourceId: mina.id,
    ownerName: mina.name,
    priority: "CRITICAL",
    description: "Real-time OEE for Line 2 with shift review views.",
  });
  const projB = await createProject({
    initiativeId: projectInitB.id,
    key: "PROJ-DEMO-02",
    name: "Outbound Yard Booking",
    departmentId: plantB.id,
    ownerResourceId: erik.id,
    ownerName: erik.name,
    priority: "HIGH",
    description: "Slot booking to reduce truck wait times.",
  });
  const projC = await createProject({
    initiativeId: projectInitC.id,
    key: "PROJ-DEMO-03",
    name: "Access Self-Service",
    departmentId: itPlatform.id,
    ownerResourceId: jonas.id,
    ownerName: jonas.name,
    priority: "MEDIUM",
    description: "Managers request and approve system access without tickets.",
  });
  const projD = await createProject({
    initiativeId: projectInitD.id,
    key: "PROJ-DEMO-04",
    name: "Supplier Quality Scorecard",
    departmentId: qualityDept.id,
    ownerResourceId: lina.id,
    ownerName: lina.name,
    priority: "HIGH",
    description: "Rolling scorecard for top 40 suppliers with audit linkage.",
  });
  const projE = await createProject({
    initiativeId: projectInitE.id,
    key: "PROJ-DEMO-05",
    name: "Coach Shift Capacity Planner",
    departmentId: leanDept.id,
    ownerResourceId: omar.id,
    ownerName: omar.name,
    priority: "MEDIUM",
    description: "Allocate CI coaches across plants by week with skill tags.",
  });

  await db.projectParticipatingDepartment.createMany({
    data: [
      { projectId: projA.id, departmentId: plantA.id },
      { projectId: projA.id, departmentId: itPlatform.id },
      { projectId: projB.id, departmentId: plantB.id },
      { projectId: projD.id, departmentId: qualityDept.id },
      { projectId: projD.id, departmentId: plantA.id },
      { projectId: projE.id, departmentId: leanDept.id },
      { projectId: projE.id, departmentId: plantB.id },
      { projectId: projC.id, departmentId: itPlatform.id },
    ],
  });

  await db.projectMilestone.createMany({
    data: [
      {
        projectId: projA.id,
        referenceKey: "MS-001",
        title: "Sensor data pipeline live",
        status: "COMPLETED",
        criticality: true,
        ownerName: jonas.name,
        ownerResourceId: jonas.id,
        plannedDate: new Date("2026-10-15"),
        actualDate: new Date("2026-10-12"),
      },
      {
        projectId: projA.id,
        referenceKey: "MS-002",
        title: "Shift review pilot",
        status: "IN_PROGRESS",
        criticality: true,
        ownerName: sara.name,
        ownerResourceId: sara.id,
        plannedDate: new Date("2026-11-30"),
      },
      {
        projectId: projB.id,
        referenceKey: "MS-001",
        title: "Carrier portal MVP",
        status: "PLANNED",
        criticality: false,
        ownerName: erik.name,
        ownerResourceId: erik.id,
        plannedDate: new Date("2026-12-15"),
      },
      {
        projectId: projD.id,
        referenceKey: "MS-001",
        title: "Scorecard data model approved",
        status: "COMPLETED",
        criticality: true,
        ownerName: lina.name,
        ownerResourceId: lina.id,
        plannedDate: new Date("2026-10-01"),
        actualDate: new Date("2026-09-28"),
      },
      {
        projectId: projD.id,
        referenceKey: "MS-002",
        title: "First supplier cohort live",
        status: "IN_PROGRESS",
        criticality: true,
        ownerName: lina.name,
        ownerResourceId: lina.id,
        plannedDate: new Date("2026-11-20"),
      },
      {
        projectId: projE.id,
        referenceKey: "MS-001",
        title: "Coach skills taxonomy",
        status: "IN_PROGRESS",
        criticality: false,
        ownerName: omar.name,
        ownerResourceId: omar.id,
        plannedDate: new Date("2026-11-10"),
      },
    ],
  });

  const epicA = await db.projectWorkItem.create({
    data: {
      projectId: projA.id,
      type: "EPIC",
      referenceKey: "WI-001",
      title: "OEE visualization",
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      ownerName: mina.name,
      ownerResourceId: mina.id,
    },
  });
  await db.projectWorkItem.createMany({
    data: [
      {
        projectId: projA.id,
        type: "FEATURE",
        referenceKey: "WI-002",
        title: "Line heatmap",
        status: "READY",
        priority: "HIGH",
        parentId: epicA.id,
        ownerName: jonas.name,
        ownerResourceId: jonas.id,
        estimateHours: "40",
      },
      {
        projectId: projA.id,
        type: "TASK",
        referenceKey: "WI-003",
        title: "Wire PLC tags for Line 2",
        status: "IN_PROGRESS",
        priority: "HIGH",
        parentId: epicA.id,
        ownerName: jonas.name,
        ownerResourceId: jonas.id,
        estimateHours: "16",
      },
      {
        projectId: projB.id,
        type: "EPIC",
        referenceKey: "WI-001",
        title: "Booking calendar",
        status: "BACKLOG",
        priority: "MEDIUM",
        ownerName: erik.name,
        ownerResourceId: erik.id,
      },
      {
        projectId: projC.id,
        type: "FEATURE",
        referenceKey: "WI-001",
        title: "Approval workflow",
        status: "READY",
        priority: "MEDIUM",
        ownerName: jonas.name,
        ownerResourceId: jonas.id,
        estimateHours: "32",
      },
      {
        projectId: projD.id,
        type: "EPIC",
        referenceKey: "WI-001",
        title: "Supplier score engine",
        status: "IN_PROGRESS",
        priority: "HIGH",
        ownerName: lina.name,
        ownerResourceId: lina.id,
      },
      {
        projectId: projD.id,
        type: "FEATURE",
        referenceKey: "WI-002",
        title: "Audit evidence upload",
        status: "READY",
        priority: "MEDIUM",
        ownerName: aisha.name,
        ownerResourceId: aisha.id,
        estimateHours: "24",
      },
      {
        projectId: projE.id,
        type: "FEATURE",
        referenceKey: "WI-001",
        title: "Weekly coach board",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        ownerName: omar.name,
        ownerResourceId: omar.id,
        estimateHours: "28",
      },
      {
        projectId: projA.id,
        type: "TASK",
        referenceKey: "WI-004",
        title: "UX pass for shift review cards",
        status: "READY",
        priority: "MEDIUM",
        parentId: epicA.id,
        ownerName: aisha.name,
        ownerResourceId: aisha.id,
        estimateHours: "12",
      },
    ],
  });

  await db.projectIssue.createMany({
    data: [
      {
        organizationId: org.id,
        projectId: projA.id,
        referenceKey: "ISS-001",
        title: "Historian API rate limits during peak shift",
        description: "Dashboard refresh fails between 06:00–07:00.",
        severity: "CRITICAL",
        status: "OPEN",
        isBlocker: true,
        ownerName: jonas.name,
        ownerResourceId: jonas.id,
        reportedAt: new Date(),
      },
      {
        organizationId: org.id,
        projectId: projA.id,
        referenceKey: "ISS-002",
        title: "Operator labels translated inconsistently",
        description: "Swedish/English mix on one card.",
        severity: "MEDIUM",
        status: "IN_PROGRESS",
        isBlocker: false,
        ownerName: mina.name,
        ownerResourceId: mina.id,
        reportedAt: new Date(),
      },
      {
        organizationId: org.id,
        projectId: projB.id,
        referenceKey: "ISS-001",
        title: "Carrier email notifications delayed",
        severity: "HIGH",
        status: "OPEN",
        isBlocker: true,
        ownerName: erik.name,
        ownerResourceId: erik.id,
        reportedAt: new Date(),
      },
      {
        organizationId: org.id,
        projectId: projC.id,
        referenceKey: "ISS-001",
        title: "SSO group mapping incomplete for contractors",
        severity: "HIGH",
        status: "RESOLVED",
        isBlocker: true,
        ownerName: jonas.name,
        ownerResourceId: jonas.id,
        reportedAt: new Date("2026-09-20"),
        resolvedAt: new Date("2026-10-01"),
        resolution: "Added contractor OU mapping in IdP.",
      },
      {
        organizationId: org.id,
        projectId: projD.id,
        referenceKey: "ISS-001",
        title: "Supplier master data duplicates across sites",
        description: "Same VAT ID appears under two plant codes.",
        severity: "HIGH",
        status: "OPEN",
        isBlocker: true,
        ownerName: lina.name,
        ownerResourceId: lina.id,
        reportedAt: new Date(),
      },
      {
        organizationId: org.id,
        projectId: projE.id,
        referenceKey: "ISS-001",
        title: "Coach calendar sync drops weekend slots",
        severity: "MEDIUM",
        status: "IN_PROGRESS",
        isBlocker: false,
        ownerName: freja.name,
        ownerResourceId: freja.id,
        reportedAt: new Date(),
      },
    ],
  });

  await db.risk.createMany({
    data: [
      {
        initiativeId: projectInitA.id,
        referenceKey: "RSK-001",
        title: "OT network change window slips",
        description: "May delay PLC tag wiring",
        ownerName: sara.name,
        ownerResourceId: sara.id,
        probability: "MEDIUM",
        impact: "HIGH",
        status: "MITIGATING",
        mitigation: "Book joint OT/IT change slot in November",
      },
      {
        initiativeId: pocInit.id,
        referenceKey: "RSK-001",
        title: "Labeled defect set too small",
        description: "Model may overfit paint flakes vs scratches",
        ownerName: lina.name,
        ownerResourceId: lina.id,
        probability: "HIGH",
        impact: "MEDIUM",
        status: "OPEN",
        mitigation: "Borrow annotated frames from Plant B pilot archive",
      },
      {
        initiativeId: pilotInit.id,
        referenceKey: "RSK-001",
        title: "On-call fatigue during pilot",
        description: "Maintenance ack volume spikes mid-shift",
        ownerName: omar.name,
        ownerResourceId: omar.id,
        probability: "MEDIUM",
        impact: "HIGH",
        status: "MITIGATING",
        mitigation: "Rotate secondary alert channel; cap concurrent pulls",
      },
      {
        initiativeId: projectInitD.id,
        referenceKey: "RSK-001",
        title: "Supplier legal review of score publication",
        description: "Procurement counsel may delay external sharing",
        ownerName: lina.name,
        ownerResourceId: lina.id,
        probability: "MEDIUM",
        impact: "MEDIUM",
        status: "OPEN",
      },
    ],
  });

  await db.requirement.createMany({
    data: [
      {
        initiativeId: reqInit.id,
        referenceKey: "REQ-002",
        title: "Exception queue for low-confidence forecasts",
        description: "Planners can accept/override suggested orders",
        category: "BUSINESS",
        status: "DRAFT",
        priority: "SHOULD",
      },
      {
        initiativeId: demandInit.id,
        referenceKey: "REQ-001",
        title: "Offline mode for shift checklist",
        description: "Operators complete checklist without Wi-Fi for 2 hours",
        category: "BUSINESS",
        status: "PROPOSED",
        priority: "MUST",
      },
    ],
  });

  const summary = {
    organization: org.name,
    organizationId: org.id,
    DEV_AUTH_PRINCIPAL_ID: actorId,
    sections: [opsSection.name, digitalSection.name, qualitySection.name],
    departments: [
      plantA.name,
      plantB.name,
      itPlatform.name,
      dataDept.name,
      qualityDept.name,
      leanDept.name,
    ],
    people: people.map((p) => p.name),
    initiatives: [
      { key: demandInit.referenceKey, stage: "DEMAND", title: demandInit.title },
      { key: reqInit.referenceKey, stage: "REQUIREMENTS", title: reqInit.title },
      { key: preStudyInit.referenceKey, stage: "PRE_STUDY", title: preStudyInit.title },
      { key: pocInit.referenceKey, stage: "POC", title: pocInit.title },
      { key: pilotInit.referenceKey, stage: "PILOT", title: pilotInit.title },
      { key: projectInitA.referenceKey, stage: "PROJECT", title: projectInitA.title, project: projA.referenceKey },
      { key: projectInitB.referenceKey, stage: "PROJECT", title: projectInitB.title, project: projB.referenceKey },
      { key: projectInitC.referenceKey, stage: "PROJECT", title: projectInitC.title, project: projC.referenceKey },
      { key: projectInitD.referenceKey, stage: "PROJECT", title: projectInitD.title, project: projD.referenceKey },
      { key: projectInitE.referenceKey, stage: "PROJECT", title: projectInitE.title, project: projE.referenceKey },
    ],
    demoUrls: {
      home: "/",
      organization: `/organization/${org.id}`,
      initiatives: "/initiatives",
      projectOee: `/initiatives/${projectInitA.id}/project`,
      projectYard: `/initiatives/${projectInitB.id}/project`,
      projectAccess: `/initiatives/${projectInitC.id}/project`,
      projectQuality: `/initiatives/${projectInitD.id}/project`,
      projectLean: `/initiatives/${projectInitE.id}/project`,
      pocVision: `/initiatives/${pocInit.id}/poc`,
      pilotAndon: `/initiatives/${pilotInit.id}/pilot`,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log("\nDemo seed complete. Start the app with:");
  console.log("  npm run dev");
  console.log("Then open http://localhost:3000 — DEV auth uses the seeded principal as Org Admin.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
