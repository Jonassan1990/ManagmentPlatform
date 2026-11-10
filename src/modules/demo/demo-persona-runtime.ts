import { cookies } from "next/headers";
import type { Principal } from "@/modules/identity-access/domain/types";
import { prisma } from "@/server/db";
import { ensureDemoDepartmentUsers } from "@/modules/demo/ensure-department-test-users";
import {
  DEMO_PERSONA_COOKIE,
  DEMO_SWITCH_PERSONAS,
  DEMO_SWITCH_PRINCIPAL_IDS,
  getDemoPersona,
  isDemoPersonaSwitchEnabled,
  demoUserOptionLabel,
  type DemoPersonaKey,
} from "@/modules/demo/it-hierarchy-demo";

export async function readDemoPersonaCookie(): Promise<string | null> {
  if (!isDemoPersonaSwitchEnabled()) return null;
  try {
    const jar = await cookies();
    return jar.get(DEMO_PERSONA_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * When demo switch is enabled and a valid persona cookie is set,
 * replace the signed-in principal with that demo level (visibility simulation).
 */
export async function applyDemoPersonaOverride(
  base: Principal | null,
): Promise<Principal | null> {
  if (!base || !isDemoPersonaSwitchEnabled()) return base;
  const key = await readDemoPersonaCookie();
  if (key?.startsWith("sheet-manager:")) {
    const manager = await prisma.principal.findFirst({
      where: { externalSubject: key },
    });
    if (!manager) return base;
    return {
      id: manager.id,
      displayName: manager.displayName,
      email: manager.email,
      source: "demo",
    };
  }
  const persona = getDemoPersona(key);
  if (!persona || !DEMO_SWITCH_PRINCIPAL_IDS.has(persona.principalId)) {
    return base;
  }
  const row = await prisma.principal.findUnique({
    where: { id: persona.principalId },
  });
  if (!row) return base;
  return {
    id: row.id,
    displayName: row.displayName ?? persona.displayName,
    email: row.email,
    source: "demo",
  };
}

export async function listSeededDemoPersonas() {
  if (!isDemoPersonaSwitchEnabled()) return [];
  await ensureDemoDepartmentUsers();
  const rows = await prisma.principal.findMany({
    where: { id: { in: [...DEMO_SWITCH_PRINCIPAL_IDS] } },
    select: { id: true },
  });
  const present = new Set(rows.map((row) => row.id));
  const sheetManagers = await prisma.principal.findMany({
    where: { externalSubject: { startsWith: "sheet-manager:" } },
    select: { externalSubject: true, displayName: true },
    orderBy: { displayName: "asc" },
  });
  return [
    ...DEMO_SWITCH_PERSONAS.filter((persona) =>
      present.has(persona.principalId),
    ).map((persona) => ({
      key: persona.key as DemoPersonaKey,
      displayName: persona.displayName,
      levelLabel: persona.levelLabel,
      sees: persona.sees,
      username: persona.username,
      group: persona.group,
      optionLabel:
        persona.group === "department-users"
          ? demoUserOptionLabel(persona)
          : `${persona.levelLabel} — ${persona.displayName}`,
    })),
    ...sheetManagers.flatMap((manager) => {
      const code = manager.externalSubject?.slice("sheet-manager:".length) ?? "";
      if (!code) return [];
      const username = `sheet.${code.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
      return [
        {
          key: manager.externalSubject ?? "",
          displayName: manager.displayName ?? code,
          levelLabel: code,
          sees: `Manager for ${code}. Can mark the plan and accept vacation.`,
          username,
          group: "sheet-managers" as const,
          optionLabel: `${code} — ${manager.displayName ?? "Manager"}`,
        },
      ];
    }),
  ];
}
