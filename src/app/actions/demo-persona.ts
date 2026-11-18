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
import { isImpersonationKey } from "@/modules/demo/persona-keys";
import { createServices } from "@/server/container";

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
  const activeKey = await readDemoPersonaCookie();
  // Keep the drawer available whenever the flag is on, even before people
  // are synced — otherwise mobile/desktop hide the control with no clue why.
  return {
    enabled: true as const,
    personas,
    activeKey: isImpersonationKey(activeKey) ? activeKey : null,
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
  if (!isImpersonationKey(personaKey)) {
    return { ok: false as const, error: "Choose a person from the list." };
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
