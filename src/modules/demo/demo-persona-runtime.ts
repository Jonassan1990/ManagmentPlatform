import { cookies } from "next/headers";
import type { Principal } from "@/modules/identity-access/domain/types";
import { prisma } from "@/server/db";
import { ensureDemoDepartmentUsers } from "@/modules/demo/ensure-department-test-users";
import {
  DEMO_PERSONA_COOKIE,
  isDemoPersonaSwitchEnabled,
} from "@/modules/demo/it-hierarchy-demo";
import {
  impersonationKeyForPrincipal,
  isImpersonationKey,
  principalIdFromImpersonationKey,
} from "@/modules/demo/persona-keys";
import { codeFromSheetReference } from "@/modules/vacation/application/vacation-plan-sheet";

export type SheetPersonaOption = {
  key: string;
  displayName: string;
  levelLabel: string;
  sees: string;
  username: string;
  group: "managers" | "people" | "levels";
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

/**
 * When the switch is enabled and a person cookie is set,
 * use that person instead of the signed-in account.
 */
export async function applyDemoPersonaOverride(
  base: Principal | null,
): Promise<Principal | null> {
  if (!base || !isDemoPersonaSwitchEnabled()) return base;
  const key = await readDemoPersonaCookie();
  if (!isImpersonationKey(key)) return base;

  const byId = principalIdFromImpersonationKey(key);
  const person = byId
    ? await prisma.principal.findFirst({ where: { id: byId } })
    : await prisma.principal.findFirst({ where: { externalSubject: key } });
  if (!person) return base;
  return {
    id: person.id,
    displayName: person.displayName,
    email: person.email,
    source: "demo",
  };
}

/** Everyone who can be opened in the admin person drawer. */
export async function listSeededDemoPersonas(): Promise<SheetPersonaOption[]> {
  if (!isDemoPersonaSwitchEnabled()) return [];
  await ensureDemoDepartmentUsers();
  const rows = await prisma.principal.findMany({
    where: {
      OR: [
        { externalSubject: { startsWith: "sheet-manager:" } },
        { externalSubject: { startsWith: "sheet-user:" } },
        { externalSubject: { startsWith: "demo:" } },
        { localLoginCredential: { isNot: null } },
      ],
    },
    select: {
      id: true,
      externalSubject: true,
      displayName: true,
      localLoginCredential: { select: { username: true } },
      linkedResource: {
        select: { functionRole: true, referenceCode: true },
      },
      roleBindings: {
        where: { roleDefinition: { key: { contains: "manager" } } },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { displayName: "asc" },
  });

  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const key = impersonationKeyForPrincipal(row);
    if (seen.has(key)) return [];
    seen.add(key);

    const subject = row.externalSubject ?? "";
    const manager =
      subject.startsWith("sheet-manager:") ||
      subject.includes("-manager") ||
      row.roleBindings.length > 0;
    const departmentCode = subject.startsWith("sheet-manager:")
      ? subject.slice("sheet-manager:".length)
      : subject.startsWith("demo:")
        ? subject.slice("demo:".length)
        : codeFromSheetReference(row.linkedResource?.referenceCode);
    const name = row.displayName?.trim() || departmentCode || "Person";
    const role =
      row.linkedResource?.functionRole ?? (manager ? "Manager" : null);
    const username = row.localLoginCredential?.username ?? "";
    const levelLabel = departmentCode ?? (manager ? "Manager" : "People");
    const group: SheetPersonaOption["group"] = subject.startsWith("demo:")
      ? "levels"
      : manager
        ? "managers"
        : "people";
    const sees = manager
      ? `Manager view${departmentCode ? ` for ${departmentCode}` : ""}. Can review vacation and mark the plan.`
      : `${name}${departmentCode ? ` in ${departmentCode}` : ""}. Sees their own dashboard and can request vacation.`;

    return [
      {
        key,
        displayName: name,
        levelLabel,
        sees,
        username,
        group,
        optionLabel: departmentCode
          ? `${name} · ${departmentCode}${role ? ` · ${role}` : ""}`
          : name,
        departmentCode,
        role,
      },
    ];
  });
}
