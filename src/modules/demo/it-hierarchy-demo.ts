/**
 * IT hierarchy demo catalog — Organization I / Section IN / nested departments.
 * Stable IDs keep re-seeds idempotent and power the persona switcher.
 *
 * Names keep the real org codes (I, IN, INF…) and add a short manager-readable
 * label so walkthroughs are easy to follow without renaming the hierarchy.
 */

import { functionRoleAt } from "@/modules/organization/domain/function-roles";

export const DEMO_PERSONA_COOKIE = "mp_demo_persona";
export const DEMO_ORG_NAME = "I — Industrial IT";
export const DEMO_SECTION_NAME = "IN — IT Section";

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

export const IT_DEMO_DEPTS = {
  inf: {
    id: IT_DEMO_IDS.deptInf,
    name: "INF — Platforms",
    description:
      "Parent IT platforms department. Owns shared platforms and sponsors child departments INFB (apps) and INFF (data).",
  },
  infb: {
    id: IT_DEMO_IDS.deptInfb,
    name: "INFB — Business apps",
    description:
      "Business applications delivery & ops under INF. Owns product projects used by plant operations.",
  },
  inff: {
    id: IT_DEMO_IDS.deptInff,
    name: "INFF — Data & integration",
    description:
      "Master data, integration services, and plant-to-enterprise feeds under INF.",
  },
  ing: {
    id: IT_DEMO_IDS.deptIng,
    name: "ING — Infrastructure",
    description:
      "Networks, connectivity, and secure remote access for industrial sites.",
  },
  ina: {
    id: IT_DEMO_IDS.deptIna,
    name: "INA — Architecture & demand",
    description:
      "Demand intake, architecture steering, and early-stage initiative shaping.",
  },
} as const;

export type DemoPersonaKey =
  | "org-admin"
  | "in-manager"
  | "inf-manager"
  | "infb-manager"
  | "ing-manager"
  | "ina-manager"
  | "viewer"
  | `dept-${string}`;

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
    sees: "Full Industrial IT portfolio and organization setup",
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
    sees: "Section overview of INF, ING, INA — drill into any department",
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
    sees: "INF platforms plus child departments INFB and INFF",
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
    sees: "Full INFB delivery; can open parent INF initiatives for detail",
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
    sees: "ING infrastructure portfolio only",
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
    sees: "INA demand intake only",
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
    sees: "Read-only across Industrial IT",
    roleKey: "organization.viewer",
    scopeType: "ORGANIZATION",
    scopeId: IT_DEMO_IDS.org,
  },
];

export const DEMO_PERSONA_PRINCIPAL_IDS = new Set(
  DEMO_PERSONAS.map((persona) => persona.principalId),
);

/** Five test people per department. Dropdown label is name — role — department. */
export const DEMO_USERS_PER_DEPARTMENT = 5;

type DemoDeptKey = keyof typeof IT_DEMO_DEPTS;

const DEMO_DEPARTMENT_USER_NAMES: Record<DemoDeptKey, string[]> = {
  inf: ["Nora Lind", "Elias Berg", "Maja Holm", "Oscar Nystrom", "Linnea Dahl"],
  infb: ["Klara Voss", "Henrik Blom", "Sara Ek", "Johan Lindqvist", "Ida Bergstrom"],
  inff: ["Noah Ekman", "Alva Strand", "Liam Fors", "Ella Holm", "William Aberg"],
  ing: ["Hugo Nyman", "Alice Roos", "Leo Sand", "Wilma Falk", "Axel Borg"],
  ina: ["Elsa Vik", "Filip Orn", "Molly Rehn", "Arvid Lund", "Tilde Moss"],
};

export type DemoDepartmentUser = {
  key: string;
  principalId: string;
  resourceId: string;
  username: string;
  displayName: string;
  functionRole: string;
  departmentKey: DemoDeptKey;
  departmentLabel: string;
  departmentId: string;
  teamId: string;
};

const DEMO_DEPT_TEAM: Record<DemoDeptKey, string> = {
  inf: IT_DEMO_IDS.teamInfPlatform,
  infb: IT_DEMO_IDS.teamInfbApps,
  inff: IT_DEMO_IDS.teamInffData,
  ing: IT_DEMO_IDS.teamIngInfra,
  ina: IT_DEMO_IDS.teamInaDemand,
};

function demoUuid(slot: number): string {
  return `a1000000-0000-4000-8000-${String(slot).padStart(12, "0")}`;
}

export const DEMO_DEPARTMENT_USERS: DemoDepartmentUser[] = (
  Object.keys(IT_DEMO_DEPTS) as DemoDeptKey[]
).flatMap((departmentKey, deptIndex) => {
  const department = IT_DEMO_DEPTS[departmentKey];
  const short = department.name.split(" ")[0] ?? departmentKey.toUpperCase();
  return Array.from({ length: DEMO_USERS_PER_DEPARTMENT }, (_, roleIndex) => {
    const n = deptIndex * DEMO_USERS_PER_DEPARTMENT + roleIndex;
    const functionRole = functionRoleAt(n);
    return {
      key: `dept-${departmentKey}-${roleIndex + 1}`,
      principalId: demoUuid(200 + n),
      resourceId: demoUuid(300 + n),
      username: `demo.${departmentKey}.${roleIndex + 1}`,
      displayName: DEMO_DEPARTMENT_USER_NAMES[departmentKey][roleIndex]!,
      functionRole,
      departmentKey,
      departmentLabel: short,
      departmentId: department.id,
      teamId: DEMO_DEPT_TEAM[departmentKey],
    };
  });
});

export function demoUserOptionLabel(input: {
  displayName: string;
  functionRole: string;
  departmentLabel: string;
}): string {
  return `${input.displayName} — ${input.functionRole} — ${input.departmentLabel}`;
}

export type DemoSwitchPersona = DemoPersonaDefinition & {
  functionRole: string;
  departmentLabel: string;
  group: "levels" | "department-users";
};

export const DEMO_SWITCH_PERSONAS: DemoSwitchPersona[] = [
  ...DEMO_PERSONAS.map((persona) => ({
    ...persona,
    functionRole: persona.levelLabel,
    departmentLabel: persona.levelLabel,
    group: "levels" as const,
  })),
  ...DEMO_DEPARTMENT_USERS.map((user) => ({
    key: user.key as DemoPersonaKey,
    principalId: user.principalId,
    username: user.username,
    displayName: user.displayName,
    levelLabel: user.departmentLabel,
    sees: `${user.functionRole} in ${user.departmentLabel}`,
    roleKey: "organization.viewer",
    scopeType: "DEPARTMENT" as const,
    scopeId: user.departmentId,
    functionRole: user.functionRole,
    departmentLabel: user.departmentLabel,
    group: "department-users" as const,
  })),
];

export const DEMO_SWITCH_PRINCIPAL_IDS = new Set(
  DEMO_SWITCH_PERSONAS.map((persona) => persona.principalId),
);

export function getDemoPersona(key: string | null | undefined) {
  if (!key) return null;
  return DEMO_SWITCH_PERSONAS.find((persona) => persona.key === key) ?? null;
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
