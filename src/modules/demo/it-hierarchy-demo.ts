/**
 * IT hierarchy demo catalog — Organization I / Section IN / nested departments.
 * Stable IDs keep re-seeds idempotent and power the persona switcher.
 */

export const DEMO_PERSONA_COOKIE = "mp_demo_persona";
export const DEMO_ORG_NAME = "I";
export const DEMO_SECTION_NAME = "IN";

/** Shared password for seeded local login personas (demo environments only). */
export const DEMO_PERSONA_PASSWORD = "DemoLevel2026!";

export const IT_DEMO_IDS = {
  org: "a1000000-0000-4000-8000-000000000001",
  sectionIn: "a1000000-0000-4000-8000-000000000010",
  deptInf: "a1000000-0000-4000-8000-000000000021",
  deptInfb: "a1000000-0000-4000-8000-000000000022",
  deptInff: "a1000000-0000-4000-8000-000000000023",
  deptIng: "a1000000-0000-4000-8000-000000000024",
  deptIna: "a1000000-0000-4000-8000-000000000025",
  teamInfPlatform: "a1000000-0000-4000-8000-000000000031",
  teamInfbApps: "a1000000-0000-4000-8000-000000000032",
  teamInfbOps: "a1000000-0000-4000-8000-000000000033",
  teamInffData: "a1000000-0000-4000-8000-000000000034",
  teamIngInfra: "a1000000-0000-4000-8000-000000000035",
  teamInaDemand: "a1000000-0000-4000-8000-000000000036",
} as const;

export type DemoPersonaKey =
  | "org-admin"
  | "in-manager"
  | "inf-manager"
  | "infb-manager"
  | "ing-manager"
  | "ina-manager"
  | "viewer";

export type DemoPersonaDefinition = {
  key: DemoPersonaKey;
  principalId: string;
  username: string;
  displayName: string;
  levelLabel: string;
  sees: string;
  roleKey: string;
  scopeType: "ORGANIZATION" | "SECTION" | "DEPARTMENT";
  scopeId: string;
};

export const DEMO_PERSONAS: DemoPersonaDefinition[] = [
  {
    key: "org-admin",
    principalId: "a1000000-0000-4000-8000-000000000101",
    username: "demo.orgadmin",
    displayName: "Alex Org Admin",
    levelLabel: "Organization (I)",
    sees: "Everything under organization I",
    roleKey: "organization.admin",
    scopeType: "ORGANIZATION",
    scopeId: IT_DEMO_IDS.org,
  },
  {
    key: "in-manager",
    principalId: "a1000000-0000-4000-8000-000000000102",
    username: "demo.inmanager",
    displayName: "Sam IN Manager",
    levelLabel: "Section (IN)",
    sees: "Overview of INF, ING, INA, INFB, INFF — can deep-dive",
    roleKey: "section.manager",
    scopeType: "SECTION",
    scopeId: IT_DEMO_IDS.sectionIn,
  },
  {
    key: "inf-manager",
    principalId: "a1000000-0000-4000-8000-000000000103",
    username: "demo.infmanager",
    displayName: "Ira INF Manager",
    levelLabel: "Department (INF)",
    sees: "INF plus child departments INFB and INFF",
    roleKey: "department.manager",
    scopeType: "DEPARTMENT",
    scopeId: IT_DEMO_IDS.deptInf,
  },
  {
    key: "infb-manager",
    principalId: "a1000000-0000-4000-8000-000000000104",
    username: "demo.infbmanager",
    displayName: "Bo INFB Manager",
    levelLabel: "Department (INFB)",
    sees: "Full INFB; can open INF initiatives/projects with details",
    roleKey: "department.manager",
    scopeType: "DEPARTMENT",
    scopeId: IT_DEMO_IDS.deptInfb,
  },
  {
    key: "ing-manager",
    principalId: "a1000000-0000-4000-8000-000000000105",
    username: "demo.ingmanager",
    displayName: "Gina ING Manager",
    levelLabel: "Department (ING)",
    sees: "ING department only",
    roleKey: "department.manager",
    scopeType: "DEPARTMENT",
    scopeId: IT_DEMO_IDS.deptIng,
  },
  {
    key: "ina-manager",
    principalId: "a1000000-0000-4000-8000-000000000106",
    username: "demo.inamanager",
    displayName: "Ana INA Manager",
    levelLabel: "Department (INA)",
    sees: "INA department only",
    roleKey: "department.manager",
    scopeType: "DEPARTMENT",
    scopeId: IT_DEMO_IDS.deptIna,
  },
  {
    key: "viewer",
    principalId: "a1000000-0000-4000-8000-000000000107",
    username: "demo.viewer",
    displayName: "Vic Viewer",
    levelLabel: "Viewer (I)",
    sees: "Read-only across organization I",
    roleKey: "organization.viewer",
    scopeType: "ORGANIZATION",
    scopeId: IT_DEMO_IDS.org,
  },
];

export const DEMO_PERSONA_PRINCIPAL_IDS = new Set(
  DEMO_PERSONAS.map((persona) => persona.principalId),
);

export function getDemoPersona(key: string | null | undefined) {
  if (!key) return null;
  return DEMO_PERSONAS.find((persona) => persona.key === key) ?? null;
}

export function isDemoPersonaSwitchEnabled(): boolean {
  const flag = process.env.ALLOW_DEMO_PERSONA_SWITCH;
  if (flag === "true" || flag === "1") return true;
  // Local DEV bridge can always simulate levels after seed.
  return (
    process.env.NODE_ENV === "development" &&
    (process.env.ALLOW_DEV_AUTH === "true" || process.env.ALLOW_DEV_AUTH === "1")
  );
}
