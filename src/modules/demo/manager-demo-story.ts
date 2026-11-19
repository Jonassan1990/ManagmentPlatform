/**
 * Focused manager-visibility demo cast for INFB.
 * Idempotent stable IDs — safe to re-run from Admin → Prepare.
 */

export const MANAGER_DEMO_PASSWORD = "DemoLevel2026!";

export const MANAGER_DEMO_IDS = {
  org: "a1000000-0000-4000-8000-000000000001", // same Industrial IT org
  sectionIn: "a1000000-0000-4000-8000-000000000010",
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
  initiativeDemand: "b2000000-0000-4000-8000-000000000201",
  initiativeProject: "b2000000-0000-4000-8000-000000000202",
  project: "b2000000-0000-4000-8000-000000000301",
} as const;

export const MANAGER_DEMO_CAST = [
  {
    key: "manager",
    principalId: MANAGER_DEMO_IDS.managerPrincipal,
    resourceId: MANAGER_DEMO_IDS.managerResource,
    username: "story.infb.manager",
    displayName: "Bo (Demo Manager)",
    role: "Department Manager",
    manager: true,
    sees: "Approvals queue, team vacation coverage, and INFB delivery project.",
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
    sees: "Already-approved leave so the plan shows green coverage.",
  },
] as const;

export type ManagerDemoCastMember = (typeof MANAGER_DEMO_CAST)[number];
