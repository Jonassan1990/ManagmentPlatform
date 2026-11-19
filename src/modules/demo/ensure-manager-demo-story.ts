import { Prisma, ScopeType } from "@prisma/client";
import { hash as bcryptHash } from "bcryptjs";
import { prisma } from "@/server/db";
import { AuthorizationService } from "@/modules/identity-access/application/authorization-service";
import { LOCAL_LOGIN_ISSUER } from "@/modules/identity-access/application/temp-auth-constants";
import { ROLE_KEYS } from "@/modules/shared/permissions";
import {
  MANAGER_DEMO_CAST,
  MANAGER_DEMO_IDS,
  MANAGER_DEMO_PASSWORD,
} from "@/modules/demo/manager-demo-story";
import { IT_DEMO_DEPTS, IT_DEMO_IDS } from "@/modules/demo/it-hierarchy-demo";

export type ManagerDemoStoryResult = {
  organizationId: string;
  castCount: number;
  pendingVacations: number;
  initiatives: number;
  projectReady: boolean;
};

function isoDate(daysFromToday: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d;
}

/**
 * Seed a small, vivid manager walkthrough on top of the Industrial IT org:
 * demo cast logins, pending vacation for Approvals, portfolio + delivery project.
 */
export async function ensureManagerDemoStory(): Promise<ManagerDemoStoryResult> {
  const authz = new AuthorizationService(prisma);
  await authz.ensureSystemRoles();

  const org = await prisma.organization.findUnique({
    where: { id: MANAGER_DEMO_IDS.org },
    select: { id: true },
  });
  if (!org) {
    return {
      organizationId: "",
      castCount: 0,
      pendingVacations: 0,
      initiatives: 0,
      projectReady: false,
    };
  }

  // Ensure INFB + Apps team exist (created by platform admin ready).
  await prisma.department.upsert({
    where: { id: MANAGER_DEMO_IDS.deptInfb },
    create: {
      id: MANAGER_DEMO_IDS.deptInfb,
      sectionId: MANAGER_DEMO_IDS.sectionIn,
      parentDepartmentId: IT_DEMO_IDS.deptInf,
      name: IT_DEMO_DEPTS.infb.name,
      description: IT_DEMO_DEPTS.infb.description,
    },
    update: { status: "ACTIVE" },
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
      key: { in: [ROLE_KEYS.DEPARTMENT_MANAGER, ROLE_KEYS.VIEWER] },
    },
    select: { id: true, key: true },
  });
  const managerRole = roleRows.find((r) => r.key === ROLE_KEYS.DEPARTMENT_MANAGER);
  const viewerRole = roleRows.find((r) => r.key === ROLE_KEYS.VIEWER);
  if (!managerRole || !viewerRole) {
    return {
      organizationId: org.id,
      castCount: 0,
      pendingVacations: 0,
      initiatives: 0,
      projectReady: false,
    };
  }

  const passwordHash = await bcryptHash(MANAGER_DEMO_PASSWORD, 10);

  for (const person of MANAGER_DEMO_CAST) {
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

    await prisma.externalIdentity.upsert({
      where: {
        issuer_subject: {
          issuer: LOCAL_LOGIN_ISSUER,
          subject: person.username,
        },
      },
      create: {
        issuer: LOCAL_LOGIN_ISSUER,
        subject: person.username,
        principalId: person.principalId,
        displayNameSnapshot: person.displayName,
      },
      update: {
        principalId: person.principalId,
        displayNameSnapshot: person.displayName,
      },
    });

    await prisma.localLoginCredential.upsert({
      where: { principalId: person.principalId },
      create: {
        principalId: person.principalId,
        username: person.username,
        passwordHash,
        displayName: person.displayName,
      },
      update: {
        username: person.username,
        passwordHash,
        displayName: person.displayName,
        disabledAt: null,
      },
    });

    await prisma.resource.upsert({
      where: { id: person.resourceId },
      create: {
        id: person.resourceId,
        organizationId: org.id,
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

    const roleId = person.manager ? managerRole.id : viewerRole.id;
    const existingBinding = await prisma.roleBinding.findFirst({
      where: {
        principalId: person.principalId,
        roleDefinitionId: roleId,
        scopeType: ScopeType.DEPARTMENT,
        scopeId: MANAGER_DEMO_IDS.deptInfb,
        effectiveTo: null,
      },
    });
    if (!existingBinding) {
      await prisma.roleBinding.create({
        data: {
          principalId: person.principalId,
          roleDefinitionId: roleId,
          scopeType: ScopeType.DEPARTMENT,
          organizationId: org.id,
          scopeId: MANAGER_DEMO_IDS.deptInfb,
        },
      });
    }
  }

  await seedVacations(org.id);
  const { initiatives, projectReady } = await seedPortfolio(org.id);

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

  return {
    organizationId: org.id,
    castCount: MANAGER_DEMO_CAST.length,
    pendingVacations,
    initiatives,
    projectReady,
  };
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
      "[demo-story] Overlaps Freja — manager should see a coverage conflict in Approvals / plan",
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
    reason: "[demo-story] Already approved — shows on the vacation plan as taken",
    status: "APPROVED",
    reviewedByPrincipalId: MANAGER_DEMO_IDS.managerPrincipal,
    reviewedAt: new Date(),
    managerComment: "Approved — Ops coverage confirmed with night shift.",
  });

  await upsertVacation({
    id: MANAGER_DEMO_IDS.vacationHoursFreja,
    organizationId,
    requesterPrincipalId: MANAGER_DEMO_IDS.frejaPrincipal,
    requesterResourceId: MANAGER_DEMO_IDS.frejaResource,
    startDate: hoursDay,
    endDate: hoursDay,
    durationKind: "HOURS",
    dayPart: null,
    workingDays: new Prisma.Decimal(0.5),
    hours: new Prisma.Decimal(4),
    reason: "[demo-story] Half-day dentist — still waiting in Approvals",
    status: "SUBMITTED",
  });

  // Plan marks so the vacation plan grid is not empty for the manager.
  for (const mark of [
    {
      principalId: MANAGER_DEMO_IDS.henrikPrincipal,
      date: henrikStart,
      kind: "VACATION" as const,
    },
    {
      principalId: MANAGER_DEMO_IDS.frejaPrincipal,
      date: frejaStart,
      kind: "VACATION" as const,
    },
    {
      principalId: MANAGER_DEMO_IDS.klaraPrincipal,
      date: klaraStart,
      kind: "EDUCATION" as const,
    },
  ]) {
    await prisma.vacationPlanMark.upsert({
      where: {
        principalId_date: {
          principalId: mark.principalId,
          date: mark.date,
        },
      },
      create: {
        organizationId,
        departmentId: MANAGER_DEMO_IDS.deptInfb,
        principalId: mark.principalId,
        date: mark.date,
        kind: mark.kind,
        createdByPrincipalId: MANAGER_DEMO_IDS.managerPrincipal,
      },
      update: {
        kind: mark.kind,
        departmentId: MANAGER_DEMO_IDS.deptInfb,
      },
    });
  }
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
  dayPart?: null;
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
      dayPart: input.dayPart ?? null,
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

  const auditCount = await prisma.vacationRequestAudit.count({
    where: { vacationRequestId: input.id },
  });
  if (auditCount === 0) {
    await prisma.vacationRequestAudit.create({
      data: {
        vacationRequestId: input.id,
        actorPrincipalId: input.requesterPrincipalId,
        action: "CREATED",
        fromStatus: null,
        toStatus: "SUBMITTED",
        comment: null,
        payload: { demoStory: true },
      },
    });
    if (input.status === "APPROVED") {
      await prisma.vacationRequestAudit.create({
        data: {
          vacationRequestId: input.id,
          actorPrincipalId: input.reviewedByPrincipalId ?? null,
          action: "APPROVED",
          fromStatus: "SUBMITTED",
          toStatus: "APPROVED",
          comment: input.managerComment ?? null,
          payload: { demoStory: true },
        },
      });
    }
  }
}

async function seedPortfolio(organizationId: string) {
  const demand = await prisma.initiative.upsert({
    where: {
      organizationId_referenceKey: {
        organizationId,
        referenceKey: "DEMO-STORY-DEMAND-01",
      },
    },
    create: {
      id: MANAGER_DEMO_IDS.initiativeDemand,
      organizationId,
      departmentId: MANAGER_DEMO_IDS.deptInfb,
      referenceKey: "DEMO-STORY-DEMAND-01",
      title: "Supervisor live board for maintenance crews",
      requesterName: "Plant Maintenance",
      businessOwnerName: "Bo (Demo Manager)",
      businessOwnerResourceId: MANAGER_DEMO_IDS.managerResource,
      requesterResourceId: MANAGER_DEMO_IDS.klaraResource,
      currentStage: "DEMAND",
      status: "ACTIVE",
      demand: {
        create: {
          problemOpportunity:
            "Supervisors lack a live view of open work orders while crews are on the floor.",
          reasonForRequest:
            "Add a wallboard / tablet view fed by the mobile work-order app.",
          expectedValue:
            "Faster dispatch, fewer missed SLAs, clearer overtime decisions.",
          affectedAreas: "INFB apps, Plant A maintenance",
          urgency: "HIGH",
          strategicAlignment: "Digital maintenance excellence",
          initialImpact: "High visibility for managers during the morning meeting",
          notes: "Demo story — early intake item for the manager portfolio.",
        },
      },
    },
    update: {
      title: "Supervisor live board for maintenance crews",
      status: "ACTIVE",
      currentStage: "DEMAND",
    },
  });

  const projectInit = await prisma.initiative.upsert({
    where: {
      organizationId_referenceKey: {
        organizationId,
        referenceKey: "DEMO-STORY-PROJ-01",
      },
    },
    create: {
      id: MANAGER_DEMO_IDS.initiativeProject,
      organizationId,
      departmentId: MANAGER_DEMO_IDS.deptInfb,
      referenceKey: "DEMO-STORY-PROJ-01",
      title: "Maintenance work-order mobile app (demo)",
      requesterName: "Plant Maintenance",
      businessOwnerName: "Bo (Demo Manager)",
      businessOwnerResourceId: MANAGER_DEMO_IDS.managerResource,
      requesterResourceId: MANAGER_DEMO_IDS.frejaResource,
      currentStage: "PROJECT",
      status: "ACTIVE",
      demand: {
        create: {
          problemOpportunity:
            "Technicians lose time walking back to the workshop PC to update work orders.",
          reasonForRequest:
            "Deliver a mobile work-order app for Plant A maintenance crews.",
          expectedValue:
            "Faster close-out and live status for supervisors.",
          affectedAreas: "INFB apps, Plant A maintenance",
          urgency: "CRITICAL",
          strategicAlignment: "Digital maintenance excellence",
          initialImpact: "Flagship delivery for manager demos",
        },
      },
    },
    update: {
      title: "Maintenance work-order mobile app (demo)",
      status: "ACTIVE",
      currentStage: "PROJECT",
    },
  });

  const existingProject = await prisma.project.findFirst({
    where: {
      OR: [
        { id: MANAGER_DEMO_IDS.project },
        { organizationId, referenceKey: "PROJ-DEMO-01" },
        { initiativeId: projectInit.id },
      ],
    },
  });
  const project =
    existingProject ??
    (await prisma.project.create({
      data: {
        id: MANAGER_DEMO_IDS.project,
        initiativeId: projectInit.id,
        organizationId,
        departmentId: MANAGER_DEMO_IDS.deptInfb,
        referenceKey: "PROJ-DEMO-01",
        name: "Maintenance work-order mobile app (demo)",
        description:
          "Manager-demo flagship: mobile work orders, photo close-out, and a live supervisor board.",
        ownerName: "Bo (Demo Manager)",
        ownerResourceId: MANAGER_DEMO_IDS.managerResource,
        status: "ACTIVE",
        priority: "HIGH",
        plannedStart: isoDate(-60),
        plannedEnd: isoDate(90),
        estimatedCost: 185000,
        approvedBudget: 210000,
        plannedCost: 185000,
        forecastCost: 198000,
        actualCost: 82000,
        currencyCode: "EUR",
        objectives:
          "1) MVP for Plant A\n2) Offline-tolerant updates\n3) Supervisor live board",
      },
    }));
  if (existingProject) {
    await prisma.project.update({
      where: { id: existingProject.id },
      data: {
        name: "Maintenance work-order mobile app (demo)",
        forecastCost: 198000,
        actualCost: 82000,
        status: "ACTIVE",
        ownerResourceId: MANAGER_DEMO_IDS.managerResource,
      },
    });
  }

  const milestoneCount = await prisma.projectMilestone.count({
    where: { projectId: project.id },
  });
  if (milestoneCount === 0) {
    await prisma.projectMilestone.createMany({
      data: [
        {
          projectId: project.id,
          referenceKey: "MS-DEMO-01",
          title: "Field research complete",
          ownerName: "Klara (Demo Analyst)",
          ownerResourceId: MANAGER_DEMO_IDS.klaraResource,
          plannedDate: isoDate(-40),
          actualDate: isoDate(-38),
          status: "COMPLETED",
          criticality: true,
        },
        {
          projectId: project.id,
          referenceKey: "MS-DEMO-02",
          title: "Alpha on Plant A Wi-Fi",
          ownerName: "Freja (Demo Developer)",
          ownerResourceId: MANAGER_DEMO_IDS.frejaResource,
          plannedDate: isoDate(10),
          status: "IN_PROGRESS",
          criticality: true,
        },
        {
          projectId: project.id,
          referenceKey: "MS-DEMO-03",
          title: "MVP go-live Plant A",
          ownerName: "Bo (Demo Manager)",
          ownerResourceId: MANAGER_DEMO_IDS.managerResource,
          plannedDate: isoDate(45),
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
          referenceKey: "ISS-DEMO-01",
          title: "Basement Wi-Fi drops break order sync",
          description:
            "Technicians lose queued updates in two basement workshops. Blocks alpha confidence.",
          severity: "HIGH",
          status: "OPEN",
          isBlocker: true,
          ownerName: "Henrik (Demo Ops)",
          ownerResourceId: MANAGER_DEMO_IDS.henrikResource,
        },
        {
          organizationId,
          projectId: project.id,
          referenceKey: "ISS-DEMO-02",
          title: "Photo upload size limits on older devices",
          description: "Large photos fail silently on two rugged devices.",
          severity: "MEDIUM",
          status: "OPEN",
          isBlocker: false,
          ownerName: "Freja (Demo Developer)",
          ownerResourceId: MANAGER_DEMO_IDS.frejaResource,
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
          referenceKey: "WI-DEMO-E01",
          title: "Work-order lifecycle on mobile",
          ownerName: "Freja (Demo Developer)",
          ownerResourceId: MANAGER_DEMO_IDS.frejaResource,
          status: "IN_PROGRESS",
          priority: "CRITICAL",
          estimateHours: 320,
        },
        {
          projectId: project.id,
          type: "FEATURE",
          referenceKey: "WI-DEMO-F01",
          title: "Supervisor live board MVP",
          ownerName: "Klara (Demo Analyst)",
          ownerResourceId: MANAGER_DEMO_IDS.klaraResource,
          status: "READY",
          priority: "HIGH",
          estimateHours: 80,
        },
        {
          projectId: project.id,
          type: "FEATURE",
          referenceKey: "WI-DEMO-F02",
          title: "Offline queue for basement workshops",
          ownerName: "Freja (Demo Developer)",
          ownerResourceId: MANAGER_DEMO_IDS.frejaResource,
          status: "IN_PROGRESS",
          priority: "HIGH",
          estimateHours: 120,
        },
      ],
    });
  }

  void demand;
  return {
    initiatives: 2,
    projectReady: true,
  };
}
