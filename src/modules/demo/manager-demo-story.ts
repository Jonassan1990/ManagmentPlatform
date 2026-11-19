/**
 * Focused manager-visibility demo cast + INFB portfolio for demos.
 * Idempotent stable IDs — safe to re-run from Admin → Prepare.
 */

export const MANAGER_DEMO_PASSWORD = "DemoLevel2026!";

export const MANAGER_DEMO_IDS = {
  org: "a1000000-0000-4000-8000-000000000001",
  sectionIn: "a1000000-0000-4000-8000-000000000010",
  deptInf: "a1000000-0000-4000-8000-000000000021",
  deptInfb: "a1000000-0000-4000-8000-000000000022",
  teamApps: "a1000000-0000-4000-8000-000000000032",
  managerPrincipal: "b2000000-0000-4000-8000-000000000001",
  managerResource: "b2000000-0000-4000-8000-000000000011",
  frejaPrincipal: "b2000000-0000-4000-8000-000000000002",
  frejaResource: "b2000000-0000-4000-8000-000000000012",
  klaraPrincipal: "b2000000-0000-4000-8000-000000000003",
  klaraResource: "b2000000-0000-4000-8000-000000000013",
  henrikPrincipal: "b2000000-0000-4000-8000-000000000004",
  henrikResource: "b2000000-0000-4000-8000-000000000014",
  vacationPendingFreja: "b2000000-0000-4000-8000-000000000101",
  vacationPendingKlara: "b2000000-0000-4000-8000-000000000102",
  vacationApprovedHenrik: "b2000000-0000-4000-8000-000000000103",
  vacationHoursFreja: "b2000000-0000-4000-8000-000000000104",
} as const;

/** INFB pipeline items across lifecycle stages (shown in Portfolio / Initiatives). */
export const INFB_DEMO_PIPELINE = [
  {
    referenceKey: "INFB-DEMAND-01",
    title: "Spare-parts QR labels on the line",
    stage: "DEMAND" as const,
    owner: "klara" as const,
    requester: "Plant Logistics",
    urgency: "MEDIUM" as const,
    budgetHintEur: 45000,
  },
  {
    referenceKey: "INFB-REQ-01",
    title: "Shift handover checklist app",
    stage: "REQUIREMENTS" as const,
    owner: "freja" as const,
    requester: "Production Supervisors",
    urgency: "HIGH" as const,
    budgetHintEur: 90000,
  },
  {
    referenceKey: "INFB-PRESTUDY-01",
    title: "Technician skill matrix platform",
    stage: "PRE_STUDY" as const,
    owner: "manager" as const,
    requester: "HR / Maintenance",
    urgency: "MEDIUM" as const,
    budgetHintEur: 160000,
  },
  {
    referenceKey: "INFB-POC-01",
    title: "AR work-instruction glasses PoC",
    stage: "POC" as const,
    owner: "henrik" as const,
    requester: "Plant A Continuous Improvement",
    urgency: "HIGH" as const,
    budgetHintEur: 35000,
  },
  {
    referenceKey: "INFB-PROJ-01",
    title: "Maintenance work-order mobile app",
    stage: "PROJECT" as const,
    owner: "manager" as const,
    requester: "Plant Maintenance",
    urgency: "CRITICAL" as const,
    budgetHintEur: 210000,
    project: {
      referenceKey: "PRJ-INFB-01",
      approvedBudget: 210000,
      plannedCost: 185000,
      forecastCost: 198000,
      actualCost: 82000,
      priority: "HIGH" as const,
      status: "ACTIVE" as const,
    },
  },
  {
    referenceKey: "INFB-PROJ-02",
    title: "Supervisor live board",
    stage: "PROJECT" as const,
    owner: "klara" as const,
    requester: "Plant Maintenance",
    urgency: "HIGH" as const,
    budgetHintEur: 75000,
    project: {
      referenceKey: "PRJ-INFB-02",
      approvedBudget: 75000,
      plannedCost: 62000,
      forecastCost: 68000,
      actualCost: 21000,
      priority: "MEDIUM" as const,
      status: "ACTIVE" as const,
    },
  },
] as const;

export const MANAGER_DEMO_CAST = [
  {
    key: "manager",
    principalId: MANAGER_DEMO_IDS.managerPrincipal,
    resourceId: MANAGER_DEMO_IDS.managerResource,
    username: "story.infb.manager",
    displayName: "Bo (Demo Manager)",
    role: "Department Manager",
    manager: true,
    sees: "Approvals queue, team vacation coverage, and INFB delivery portfolio.",
  },
  {
    key: "freja",
    principalId: MANAGER_DEMO_IDS.frejaPrincipal,
    resourceId: MANAGER_DEMO_IDS.frejaResource,
    username: "story.infb.freja",
    displayName: "Freja (Demo Developer)",
    role: "Developer",
    manager: false,
    sees: "Own vacation requests and project work items.",
  },
  {
    key: "klara",
    principalId: MANAGER_DEMO_IDS.klaraPrincipal,
    resourceId: MANAGER_DEMO_IDS.klaraResource,
    username: "story.infb.klara",
    displayName: "Klara (Demo Analyst)",
    role: "Business Analyst",
    manager: false,
    sees: "Own vacation — overlaps Freja so the manager sees a coverage conflict.",
  },
  {
    key: "henrik",
    principalId: MANAGER_DEMO_IDS.henrikPrincipal,
    resourceId: MANAGER_DEMO_IDS.henrikResource,
    username: "story.infb.henrik",
    displayName: "Henrik (Demo Ops)",
    role: "Ops Engineer",
    manager: false,
    sees: "Already-approved leave so the plan shows coverage taken.",
  },
] as const;

export type ManagerDemoCastMember = (typeof MANAGER_DEMO_CAST)[number];

export function castResourceId(
  key: ManagerDemoCastMember["key"],
): string {
  return MANAGER_DEMO_CAST.find((row) => row.key === key)!.resourceId;
}

export function castDisplayName(
  key: ManagerDemoCastMember["key"],
): string {
  return MANAGER_DEMO_CAST.find((row) => row.key === key)!.displayName;
}
