import { cookies } from "next/headers";
import type { Principal } from "@/modules/identity-access/domain/types";
import { prisma } from "@/server/db";
import { ensureDemoDepartmentUsers } from "@/modules/demo/ensure-department-test-users";
import {
  DEMO_PERSONA_COOKIE,
  isDemoPersonaSwitchEnabled,
} from "@/modules/demo/it-hierarchy-demo";
import { codeFromSheetReference } from "@/modules/vacation/application/vacation-plan-sheet";

export type SheetPersonaOption = {
  key: string;
  displayName: string;
  levelLabel: string;
  sees: string;
  username: string;
  group: "managers" | "people";
  optionLabel: string;
  departmentCode: string | null;
  role: string | null;
};

export async function readDemoPersonaCookie(): Promise<string | null> {
  if (!isDemoPersonaSwitchEnabled()) return null;
  try {
    const jar = await cookies();
    return jar.get(DEMO_PERSONA_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

function isSheetPersonaKey(key: string | null | undefined): key is string {
  return Boolean(
    key &&
      (key.startsWith("sheet-manager:") || key.startsWith("sheet-user:")),
  );
}

/**
 * When the switch is enabled and a sheet-person cookie is set,
 * use that person instead of the signed-in account.
 */
export async function applyDemoPersonaOverride(
  base: Principal | null,
): Promise<Principal | null> {
  if (!base || !isDemoPersonaSwitchEnabled()) return base;
  const key = await readDemoPersonaCookie();
  if (!isSheetPersonaKey(key)) return base;
  const person = await prisma.principal.findFirst({
    where: { externalSubject: key },
  });
  if (!person) return base;
  return {
    id: person.id,
    displayName: person.displayName,
    email: person.email,
    source: "demo",
  };
}

/** Real people from the vacation sheet for the header switcher. */
export async function listSeededDemoPersonas(): Promise<SheetPersonaOption[]> {
  if (!isDemoPersonaSwitchEnabled()) return [];
  await ensureDemoDepartmentUsers();
  const rows = await prisma.principal.findMany({
    where: {
      OR: [
        { externalSubject: { startsWith: "sheet-manager:" } },
        { externalSubject: { startsWith: "sheet-user:" } },
      ],
    },
    select: {
      externalSubject: true,
      displayName: true,
      localLoginCredential: { select: { username: true } },
      linkedResource: {
        select: { functionRole: true, referenceCode: true },
      },
    },
    orderBy: { displayName: "asc" },
  });

  return rows.flatMap((row) => {
    const subject = row.externalSubject;
    if (!subject) return [];
    const manager = subject.startsWith("sheet-manager:");
    const departmentCode = manager
      ? subject.slice("sheet-manager:".length)
      : codeFromSheetReference(row.linkedResource?.referenceCode);
    const name = row.displayName?.trim() || departmentCode || "Person";
    const role = row.linkedResource?.functionRole ?? (manager ? "Manager" : null);
    const username =
      row.localLoginCredential?.username ??
      (manager && departmentCode
        ? `sheet.${departmentCode.toLowerCase().replace(/[^a-z0-9]+/g, "")}`
        : "");
    const levelLabel = departmentCode ?? "Sheet";
    return [
      {
        key: subject,
        displayName: name,
        levelLabel,
        sees: manager
          ? `Manager for ${departmentCode}. Can mark the plan and accept vacation.`
          : `${name} in ${departmentCode ?? "the plan"}. Sees their own vacation row.`,
        username,
        group: manager ? ("managers" as const) : ("people" as const),
        optionLabel: departmentCode
          ? `${name} · ${departmentCode}${role ? ` · ${role}` : ""}`
          : name,
        departmentCode,
        role,
      },
    ];
  });
}
