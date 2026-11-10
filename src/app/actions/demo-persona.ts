"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DEMO_PERSONA_COOKIE,
  isDemoPersonaSwitchEnabled,
} from "@/modules/demo/it-hierarchy-demo";
import {
  listSeededDemoPersonas,
  readDemoPersonaCookie,
} from "@/modules/demo/demo-persona-runtime";
import { createServices } from "@/server/container";

function isSheetPersonaKey(key: string): boolean {
  return key.startsWith("sheet-manager:") || key.startsWith("sheet-user:");
}

export async function getDemoPersonaSwitcherStateAction() {
  if (!isDemoPersonaSwitchEnabled()) {
    return { enabled: false as const, personas: [], activeKey: null };
  }
  const { authz } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) {
    return { enabled: false as const, personas: [], activeKey: null };
  }
  const personas = await listSeededDemoPersonas();
  if (personas.length === 0) {
    return { enabled: false as const, personas: [], activeKey: null };
  }
  const activeKey = await readDemoPersonaCookie();
  return {
    enabled: true as const,
    personas,
    activeKey: isSheetPersonaKey(activeKey ?? "") ? activeKey : null,
  };
}

export async function setDemoPersonaAction(personaKey: string | null) {
  if (!isDemoPersonaSwitchEnabled()) {
    return { ok: false as const, error: "Person switch is disabled." };
  }
  const { authz } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) {
    return { ok: false as const, error: "Sign in first." };
  }

  const jar = await cookies();
  if (!personaKey || personaKey === "session") {
    jar.delete(DEMO_PERSONA_COOKIE);
    revalidatePath("/", "layout");
    return { ok: true as const };
  }
  if (!isSheetPersonaKey(personaKey)) {
    return { ok: false as const, error: "Choose a person from the vacation plan." };
  }
  const seeded = await listSeededDemoPersonas();
  if (!seeded.some((row) => row.key === personaKey)) {
    return { ok: false as const, error: "That person is not ready yet." };
  }
  jar.set(DEMO_PERSONA_COOKIE, personaKey, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}
