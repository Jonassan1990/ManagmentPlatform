import { Prisma, ScopeType } from "@prisma/client";
import { hash as bcryptHash } from "bcryptjs";
import { prisma } from "@/server/db";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { LOCAL_LOGIN_ISSUER } from "@/modules/identity-access/application/temp-auth-constants";
import { ROLE_KEYS } from "@/modules/shared/permissions";
import {
  INFB_DEMO_PIPELINE,
  MANAGER_DEMO_CAST,
  MANAGER_DEMO_IDS,
  MANAGER_DEMO_PASSWORD,
  castDisplayName,
  castResourceId,
  type ManagerDemoCastMember,
} from "@/modules/demo/manager-demo-story";
import {
  DEMO_ORG_NAME,
  DEMO_SECTION_NAME,
  IT_DEMO_DEPTS,
  IT_DEMO_IDS,
} from "@/modules/demo/it-hierarchy-demo";
import { AppError } from "@/modules/shared/errors";

export type ManagerDemoStoryResult = {
  organizationId: string;
  castCount: number;
  pendingVacations: number;
  initiatives: number;
  projects: number;
  projectReady: boolean;
};

function isoDate(daysFromToday: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d;
}

/**
 * Seed a vivid INFB manager walkthrough:
 * cast logins, pending leave, and a full initiative pipeline with costs.
 */
export async function ensureManagerDemoStory(): Promise<ManagerDemoStoryResult> {
  const authz = new AuthorizationService(prisma);
  await authz.ensureSystemRoles();

  const org = await prisma.organization.upsert({
    where: { id: MANAGER_DEMO_IDS.org },
    create: {
      id: MANAGER_DEMO_IDS.org,
      name: DEMO_ORG_NAME,
      description:
        "Industrial IT organization for manager demos (I → IN → INF / INFB).",
    },
    update: { name: DEMO_ORG_NAME, status: "ACTIVE" },
  });

  await prisma.section.upsert({
    where: { id: MANAGER_DEMO_IDS.sectionIn },
    create: {
      id: MANAGER_DEMO_IDS.sectionIn,
      organizationId: org.id,
      name: DEMO_SECTION_NAME,
      description: "IT section for the manager demo story.",
    },
    update: { name: DEMO_SECTION_NAME, status: "ACTIVE" },
  });

  await prisma.department.upsert({
    where: { id: MANAGER_DEMO_IDS.deptInf },
    create: {
      id: MANAGER_DEMO_IDS.deptInf,
      sectionId: MANAGER_DEMO_IDS.sectionIn,
      name: IT_DEMO_DEPTS.inf.name,
      description: IT_DEMO_DEPTS.inf.description,
    },
    update: { status: "ACTIVE", name: IT_DEMO_DEPTS.inf.name },
  });

  await prisma.department.upsert({
    where: { id: MANAGER_DEMO_IDS.deptInfb },
    create: {
      id: MANAGER_DEMO_IDS.deptInfb,
      sectionId: MANAGER_DEMO_IDS.sectionIn,
      parentDepartmentId: MANAGER_DEMO_IDS.deptInf,
      name: IT_DEMO_DEPTS.infb.name,
      description: IT_DEMO_DEPTS.infb.description,
    },
    update: {
      status: "ACTIVE",
      name: IT_DEMO_DEPTS.infb.name,
      parentDepartmentId: MANAGER_DEMO_IDS.deptInf,
    },
  });

  await prisma.team.upsert({
    where: { id: MANAGER_DEMO_IDS.teamApps },
    create: {
      id: MANAGER_DEMO_IDS.teamApps,
      departmentId: MANAGER_DEMO_IDS.deptInfb,
      name: "Apps Delivery",
    },
    update: { status: "ACTIVE", name: "Apps Delivery" },
  });

  const roleRows = await prisma.roleDefinition.findMany({
    where: {
      key: {
        in: [
          ROLE_KEYS.DEPARTMENT_MANAGER,
          ROLE_KEYS.VIEWER,
          ROLE_KEYS.PORTFOLIO_MANAGER,
        ],
      },
    },
    select: { id: true, key: true },
  });
  const managerRole = roleRows.find((r) => r.key === ROLE_KEYS.DEPARTMENT_MANAGER);
  const viewerRole = roleRows.find((r) => r.key === ROLE_KEYS.VIEWER);
  const portfolioRole = roleRows.find((r) => r.key === ROLE_KEYS.PORTFOLIO_MANAGER);
  if (!managerRole || !viewerRole) {
    throw new AppError(
      "INTERNAL",
      "System roles missing — cannot seed manager demo story.",
    );
  }

  const passwordHash = await bcryptHash(MANAGER_DEMO_PASSWORD, 10);

  for (const person of MANAGER_DEMO_CAST) {
    await upsertCastMember(person, org.id, passwordHash, {
      managerRoleId: managerRole.id,
      viewerRoleId: viewerRole.id,
      portfolioRoleId: portfolioRole?.id ?? null,
    });
  }

  await seedVacations(org.id);
  const portfolio = await seedInfbPipeline(org.id);

  const pendingVacations = await prisma.vacationRequest.count({
    where: {
      organizationId: org.id,
      status: "SUBMITTED",
      id: {
        in: [
          MANAGER_DEMO_IDS.vacationPendingFreja,
          MANAGER_DEMO_IDS.vacationPendingKlara,
          MANAGER_DEMO_IDS.vacationHoursFreja,
        ],
      },
    },
  });

  if (portfolio.initiatives < 4 || portfolio.projects < 1) {
    throw new AppError(
      "INTERNAL",
      `Manager demo portfolio incomplete (initiatives=${portfolio.initiatives}, projects=${portfolio.projects}).`,
    );
  }

  return {
    organizationId: org.id,
    castCount: MANAGER_DEMO_CAST.length,
    pendingVacations,
    initiatives: portfolio.initiatives,
    projects: portfolio.projects,
    projectReady: portfolio.projects > 0,
  };
}

async function upsertCastMember(
  person: ManagerDemoCastMember,
  organizationId: string,
  passwordHash: string,
  roles: {
    managerRoleId: string;
    viewerRoleId: string;
    portfolioRoleId: string | null;
  },
) {
  await prisma.principal.upsert({
    where: { id: person.principalId },
    create: {
      id: person.principalId,
      displayName: person.displayName,
      externalSubject: `demo:story-${person.key}`,
    },
    update: {
      displayName: person.displayName,
      externalSubject: `demo:story-${person.key}`,
    },
  });

  const existingIdentity = await prisma.externalIdentity.findUnique({
    where: {
      issuer_subject: {
        issuer: LOCAL_LOGIN_ISSUER,
        subject: person.username,
      },
    },
  });
  if (!existingIdentity) {
    await prisma.externalIdentity.create({
      data: {
        issuer: LOCAL_LOGIN_ISSUER,
        subject: person.username,
        principalId: person.principalId,
        displayNameSnapshot: person.displayName,
      },
    });
  } else if (existingIdentity.principalId !== person.principalId) {
    await prisma.externalIdentity.update({
      where: { id: existingIdentity.id },
      data: {
        principalId: person.principalId,
        displayNameSnapshot: person.displayName,
      },
    });
  }

  const existingLogin = await prisma.localLoginCredential.findUnique({
    where: { username: person.username },
  });
  if (!existingLogin) {
    await prisma.localLoginCredential.create({
      data: {
        principalId: person.principalId,
        username: person.username,
        passwordHash,
        displayName: person.displayName,
      },
    });
  } else {
    await prisma.localLoginCredential.update({
      where: { id: existingLogin.id },
      data: {
        principalId: person.principalId,
        passwordHash,
        displayName: person.displayName,
        disabledAt: null,
      },
    });
  }

  await prisma.resource.upsert({
    where: { id: person.resourceId },
    create: {
      id: person.resourceId,
      organizationId,
      name: person.displayName,
      type: "PERSON",
      functionRole: person.role,
      skillsJson: [person.role, "INFB", "Demo"],
      capacityHoursPerWeek: 40,
      linkedPrincipalId: person.principalId,
      status: "ACTIVE",
      referenceCode: `demo:story:${person.key}`,
    },
    update: {
      name: person.displayName,
      functionRole: person.role,
      linkedPrincipalId: person.principalId,
      status: "ACTIVE",
    },
  });

  const membership = await prisma.resourceMembership.findFirst({
    where: {
      resourceId: person.resourceId,
      teamId: MANAGER_DEMO_IDS.teamApps,
      effectiveTo: null,
    },
  });
  if (!membership) {
    await prisma.resourceMembership.create({
      data: {
        resourceId: person.resourceId,
        teamId: MANAGER_DEMO_IDS.teamApps,
        isPrimary: true,
        allocationPercent: 100,
      },
    });
  }

  const roleId = person.manager ? roles.managerRoleId : roles.viewerRoleId;
  await ensureBinding({
    principalId: person.principalId,
    roleDefinitionId: roleId,
    scopeType: ScopeType.DEPARTMENT,
    organizationId,
    scopeId: MANAGER_DEMO_IDS.deptInfb,
  });

  if (person.manager && roles.portfolioRoleId) {
    await ensureBinding({
      principalId: person.principalId,
      roleDefinitionId: roles.portfolioRoleId,
      scopeType: ScopeType.ORGANIZATION,
      organizationId,
      scopeId: organizationId,
    });
  }
}

async function ensureBinding(input: {
  principalId: string;
  roleDefinitionId: string;
  scopeType: ScopeType;
  organizationId: string;
  scopeId: string;
}) {
  const existing = await prisma.roleBinding.findFirst({
    where: {
      principalId: input.principalId,
      roleDefinitionId: input.roleDefinitionId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      effectiveTo: null,
    },
  });
  if (existing) return;
  await prisma.roleBinding.create({
    data: {
      principalId: input.principalId,
      roleDefinitionId: input.roleDefinitionId,
      scopeType: input.scopeType,
      organizationId: input.organizationId,
      scopeId: input.scopeId,
    },
  });
}

async function seedVacations(organizationId: string) {
  const frejaStart = isoDate(14);
  const frejaEnd = isoDate(18);
  const klaraStart = isoDate(16);
  const klaraEnd = isoDate(20);
  const henrikStart = isoDate(7);
  const henrikEnd = isoDate(11);
  const hoursDay = isoDate(10);

  await upsertVacation({
    id: MANAGER_DEMO_IDS.vacationPendingFreja,
    organizationId,
    requesterPrincipalId: MANAGER_DEMO_IDS.frejaPrincipal,
    requesterResourceId: MANAGER_DEMO_IDS.frejaResource,
    startDate: frejaStart,
    endDate: frejaEnd,
    workingDays: new Prisma.Decimal(5),
    hours: new Prisma.Decimal(40),
    reason: "[demo-story] Summer bridge week — waiting for manager approval",
    status: "SUBMITTED",
  });
  await upsertVacation({
    id: MANAGER_DEMO_IDS.vacationPendingKlara,
    organizationId,
    requesterPrincipalId: MANAGER_DEMO_IDS.klaraPrincipal,
    requesterResourceId: MANAGER_DEMO_IDS.klaraResource,
    startDate: klaraStart,
    endDate: klaraEnd,
    workingDays: new Prisma.Decimal(5),
    hours: new Prisma.Decimal(40),
    reason:
      "[demo-story] Overlaps Freja — manager should see a coverage conflict",
    status: "SUBMITTED",
  });
  await upsertVacation({
    id: MANAGER_DEMO_IDS.vacationApprovedHenrik,
    organizationId,
    requesterPrincipalId: MANAGER_DEMO_IDS.henrikPrincipal,
    requesterResourceId: MANAGER_DEMO_IDS.henrikResource,
    startDate: henrikStart,
    endDate: henrikEnd,
    workingDays: new Prisma.Decimal(5),
    hours: new Prisma.Decimal(40),
    reason: "[demo-story] Already approved — visible on vacation plan",
    status: "APPROVED",
    reviewedByPrincipalId: MANAGER_DEMO_IDS.managerPrincipal,
    reviewedAt: new Date(),
    managerComment: "Approved — Ops coverage confirmed.",
  });
  await upsertVacation({
    id: MANAGER_DEMO_IDS.vacationHoursFreja,
    organizationId,
    requesterPrincipalId: MANAGER_DEMO_IDS.frejaPrincipal,
    requesterResourceId: MANAGER_DEMO_IDS.frejaResource,
    startDate: hoursDay,
    endDate: hoursDay,
    durationKind: "HOURS",
    workingDays: new Prisma.Decimal(0.5),
    hours: new Prisma.Decimal(4),
    reason: "[demo-story] Half-day dentist — still in Approvals",
    status: "SUBMITTED",
  });
}

async function upsertVacation(input: {
  id: string;
  organizationId: string;
  requesterPrincipalId: string;
  requesterResourceId: string;
  startDate: Date;
  endDate: Date;
  workingDays: Prisma.Decimal;
  hours: Prisma.Decimal;
  reason: string;
  status: "SUBMITTED" | "APPROVED";
  durationKind?: "FULL_DAYS" | "HOURS";
  reviewedByPrincipalId?: string;
  reviewedAt?: Date;
  managerComment?: string;
}) {
  await prisma.vacationRequest.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      organizationId: input.organizationId,
      requesterPrincipalId: input.requesterPrincipalId,
      requesterResourceId: input.requesterResourceId,
      departmentId: MANAGER_DEMO_IDS.deptInfb,
      sectionId: MANAGER_DEMO_IDS.sectionIn,
      startDate: input.startDate,
      endDate: input.endDate,
      durationKind: input.durationKind ?? "FULL_DAYS",
      hours: input.hours,
      workingDays: input.workingDays,
      reason: input.reason,
      status: input.status,
      reviewedByPrincipalId: input.reviewedByPrincipalId ?? null,
      reviewedAt: input.reviewedAt ?? null,
      managerComment: input.managerComment ?? null,
    },
    update: {
      startDate: input.startDate,
      endDate: input.endDate,
      durationKind: input.durationKind ?? "FULL_DAYS",
      hours: input.hours,
      workingDays: input.workingDays,
      reason: input.reason,
      status: input.status,
      reviewedByPrincipalId: input.reviewedByPrincipalId ?? null,
      reviewedAt: input.reviewedAt ?? null,
      managerComment: input.managerComment ?? null,
      departmentId: MANAGER_DEMO_IDS.deptInfb,
      sectionId: MANAGER_DEMO_IDS.sectionIn,
    },
  });
}

async function seedInfbPipeline(organizationId: string) {
  let initiatives = 0;
  let projects = 0;

  for (const item of INFB_DEMO_PIPELINE) {
    const ownerName = castDisplayName(item.owner);
    const ownerResourceId = castResourceId(item.owner);
    const initiative = await prisma.initiative.upsert({
      where: {
        organizationId_referenceKey: {
          organizationId,
          referenceKey: item.referenceKey,
        },
      },
      create: {
        organizationId,
        departmentId: MANAGER_DEMO_IDS.deptInfb,
        referenceKey: item.referenceKey,
        title: item.title,
        requesterName: item.requester,
        businessOwnerName: ownerName,
        businessOwnerResourceId: ownerResourceId,
        requesterResourceId: MANAGER_DEMO_IDS.klaraResource,
        currentStage: item.stage,
        status: "ACTIVE",
        demand: {
          create: {
            problemOpportunity: `${item.title}: shop-floor pain that managers need visibility on.`,
            reasonForRequest: `${item.requester} asked INFB to take this through the lifecycle.`,
            expectedValue: `Indicative envelope ~€${item.budgetHintEur.toLocaleString("en-SE")} with clearer status for Bo's team.`,
            affectedAreas: "INFB — Business apps, Plant A, Apps Delivery team",
            urgency: item.urgency,
            strategicAlignment: "Digital plant / maintenance excellence",
            initialImpact: `Stage ${item.stage} — demo pipeline for managers`,
            notes: `Demo budget hint €${item.budgetHintEur}. Owner: ${ownerName}.`,
          },
        },
      },
      update: {
        title: item.title,
        currentStage: item.stage,
        status: "ACTIVE",
        businessOwnerName: ownerName,
        businessOwnerResourceId: ownerResourceId,
        departmentId: MANAGER_DEMO_IDS.deptInfb,
      },
    });
    initiatives += 1;

    if (item.stage === "REQUIREMENTS") {
      const reqCount = await prisma.requirement.count({
        where: { initiativeId: initiative.id },
      });
      if (reqCount === 0) {
        await prisma.requirement.createMany({
          data: [
            {
              initiativeId: initiative.id,
              referenceKey: "REQ-01",
              title: "Offline-capable checklist",
              description:
                "Supervisors can complete handover even with weak Wi-Fi.",
              category: "FUNCTIONAL",
              priority: "MUST",
              ownerName: castDisplayName("freja"),
              status: "ACCEPTED",
              source: "Production Supervisors",
            },
            {
              initiativeId: initiative.id,
              referenceKey: "REQ-02",
              title: "Audit trail of acknowledgements",
              description: "Store who signed the shift handover and when.",
              category: "COMPLIANCE",
              priority: "MUST",
              ownerName: castDisplayName("klara"),
              status: "DRAFT",
              source: "Quality",
            },
          ],
        });
      }
    }

    if (item.stage === "PRE_STUDY") {
      const existing = await prisma.preStudy.findUnique({
        where: { initiativeId: initiative.id },
      });
      if (!existing) {
        const preStudy = await prisma.preStudy.create({
          data: {
            initiativeId: initiative.id,
            summary:
              "Compare build-vs-buy for a technician skill matrix. Recommendation leans buy + light integration.",
          },
        });
        await prisma.solutionAlternative.createMany({
          data: [
            {
              preStudyId: preStudy.id,
              title: "A — Buy SaaS skill matrix (recommended)",
              description: "Configure vendor product, integrate SSO later.",
              benefits: "Faster time-to-value, lower build cost.",
              drawbacks: "License fee; limited OT custom fields.",
              estimatedCost: `€${item.budgetHintEur.toLocaleString("en-SE")} / 3 years`,
              estimatedDuration: "6 months",
              riskUncertainty: "Medium",
              isRecommended: true,
            },
            {
              preStudyId: preStudy.id,
              title: "B — Build in-house on INFB stack",
              description: "Custom app owned by Apps Delivery.",
              benefits: "Full control of data model.",
              drawbacks: "Higher delivery cost and roadmap contention.",
              estimatedCost: `€${(item.budgetHintEur * 1.4).toLocaleString("en-SE")} / 3 years`,
              estimatedDuration: "12 months",
              riskUncertainty: "High",
              isRecommended: false,
            },
          ],
        });
      }
    }

    if (item.stage === "POC") {
      const existing = await prisma.poC.findUnique({
        where: { initiativeId: initiative.id },
      });
      if (!existing) {
        await prisma.poC.create({
          data: {
            initiativeId: initiative.id,
            title: "AR glasses field trial",
            objective:
              "Prove whether AR overlays reduce mean time to repair on two job types.",
            hypothesis:
              "Guided overlays cut lookup time without slowing experienced techs.",
            scope: "Plant A, 6 technicians, 3 weeks",
            outOfScope: "Full plant rollout, offline ML models",
            ownerName: castDisplayName("henrik"),
            ownerResourceId: castResourceId("henrik"),
            plannedStart: isoDate(-10),
            plannedEnd: isoDate(20),
            estimatedCost: `€${item.budgetHintEur.toLocaleString("en-SE")}`,
            status: "IN_PROGRESS",
          },
        });
      }
    }

    if (item.stage === "PROJECT" && "project" in item && item.project) {
      const projectSpec = item.project;
      let project = await prisma.project.findFirst({
        where: {
          organizationId,
          referenceKey: projectSpec.referenceKey,
        },
      });
      if (!project) {
        project = await prisma.project.create({
          data: {
            initiativeId: initiative.id,
            organizationId,
            departmentId: MANAGER_DEMO_IDS.deptInfb,
            referenceKey: projectSpec.referenceKey,
            name: item.title,
            description: `${item.title} — INFB Apps Delivery demo project with budget and assignees.`,
            ownerName,
            ownerResourceId,
            status: projectSpec.status,
            priority: projectSpec.priority,
            plannedStart: isoDate(-60),
            plannedEnd: isoDate(90),
            estimatedCost: projectSpec.plannedCost,
            approvedBudget: projectSpec.approvedBudget,
            plannedCost: projectSpec.plannedCost,
            forecastCost: projectSpec.forecastCost,
            actualCost: projectSpec.actualCost,
            currencyCode: "EUR",
            objectives:
              "Show managers cost, status, owners, milestones, and blockers in one place.",
          },
        });
      } else {
        await prisma.project.update({
          where: { id: project.id },
          data: {
            name: item.title,
            ownerName,
            ownerResourceId,
            status: projectSpec.status,
            priority: projectSpec.priority,
            approvedBudget: projectSpec.approvedBudget,
            plannedCost: projectSpec.plannedCost,
            forecastCost: projectSpec.forecastCost,
            actualCost: projectSpec.actualCost,
            departmentId: MANAGER_DEMO_IDS.deptInfb,
          },
        });
      }
      projects += 1;

      const milestoneCount = await prisma.projectMilestone.count({
        where: { projectId: project.id },
      });
      if (milestoneCount === 0) {
        await prisma.projectMilestone.createMany({
          data: [
            {
              projectId: project.id,
              referenceKey: "MS-01",
              title: "Discovery complete",
              ownerName: castDisplayName("klara"),
              ownerResourceId: castResourceId("klara"),
              plannedDate: isoDate(-35),
              actualDate: isoDate(-33),
              status: "COMPLETED",
              criticality: true,
            },
            {
              projectId: project.id,
              referenceKey: "MS-02",
              title: "Build in progress",
              ownerName: castDisplayName("freja"),
              ownerResourceId: castResourceId("freja"),
              plannedDate: isoDate(15),
              status: "IN_PROGRESS",
              criticality: true,
            },
            {
              projectId: project.id,
              referenceKey: "MS-03",
              title: "Plant A go-live",
              ownerName: castDisplayName("manager"),
              ownerResourceId: castResourceId("manager"),
              plannedDate: isoDate(55),
              status: "PLANNED",
              criticality: true,
            },
          ],
        });
      }

      const issueCount = await prisma.projectIssue.count({
        where: { projectId: project.id },
      });
      if (issueCount === 0) {
        await prisma.projectIssue.createMany({
          data: [
            {
              organizationId,
              projectId: project.id,
              referenceKey: "ISS-01",
              title: "Basement Wi-Fi drops break sync",
              description:
                "Queued updates lost in two workshops — blocks alpha confidence.",
              severity: "HIGH",
              status: "OPEN",
              isBlocker: true,
              ownerName: castDisplayName("henrik"),
              ownerResourceId: castResourceId("henrik"),
            },
            {
              organizationId,
              projectId: project.id,
              referenceKey: "ISS-02",
              title: "Budget forecast creeping (+7%)",
              description:
                "Extra device testing hours pushed forecast above plan.",
              severity: "MEDIUM",
              status: "OPEN",
              isBlocker: false,
              ownerName: castDisplayName("manager"),
              ownerResourceId: castResourceId("manager"),
            },
          ],
        });
      }

      const workCount = await prisma.projectWorkItem.count({
        where: { projectId: project.id },
      });
      if (workCount === 0) {
        await prisma.projectWorkItem.createMany({
          data: [
            {
              projectId: project.id,
              type: "EPIC",
              referenceKey: "WI-E01",
              title: "Core delivery epic",
              ownerName: castDisplayName("freja"),
              ownerResourceId: castResourceId("freja"),
              status: "IN_PROGRESS",
              priority: "CRITICAL",
              estimateHours: 240,
            },
            {
              projectId: project.id,
              type: "FEATURE",
              referenceKey: "WI-F01",
              title: "Owner: Freja — mobile flows",
              ownerName: castDisplayName("freja"),
              ownerResourceId: castResourceId("freja"),
              status: "IN_PROGRESS",
              priority: "HIGH",
              estimateHours: 120,
            },
            {
              projectId: project.id,
              type: "FEATURE",
              referenceKey: "WI-F02",
              title: "Owner: Klara — acceptance scenarios",
              ownerName: castDisplayName("klara"),
              ownerResourceId: castResourceId("klara"),
              status: "READY",
              priority: "HIGH",
              estimateHours: 60,
            },
            {
              projectId: project.id,
              type: "TASK",
              referenceKey: "WI-T01",
              title: "Owner: Henrik — device field test",
              ownerName: castDisplayName("henrik"),
              ownerResourceId: castResourceId("henrik"),
              status: "IN_PROGRESS",
              priority: "MEDIUM",
              estimateHours: 40,
            },
          ],
        });
      }
    }
  }

  // Keep counters ahead of demo keys so later UI creates do not collide.
  await bumpReferenceCounter(
    () =>
      prisma.initiativeReferenceCounter.findUnique({
        where: { organizationId },
      }),
    (nextValue) =>
      prisma.initiativeReferenceCounter.upsert({
        where: { organizationId },
        create: { organizationId, nextValue },
        update: { nextValue },
      }),
    80,
  );
  await bumpReferenceCounter(
    () =>
      prisma.projectReferenceCounter.findUnique({
        where: { organizationId },
      }),
    (nextValue) =>
      prisma.projectReferenceCounter.upsert({
        where: { organizationId },
        create: { organizationId, nextValue },
        update: { nextValue },
      }),
    40,
  );

  return { initiatives, projects };
}

async function bumpReferenceCounter(
  read: () => Promise<{ nextValue: number } | null>,
  write: (nextValue: number) => Promise<unknown>,
  minimum: number,
) {
  const current = await read();
  const nextValue = Math.max(current?.nextValue ?? 1, minimum);
  if (!current || current.nextValue < minimum) {
    await write(nextValue);
  }
}
