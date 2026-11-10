"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DEMO_PERSONA_COOKIE,
  getDemoPersona,
  isDemoPersonaSwitchEnabled,
} from "@/modules/demo/it-hierarchy-demo";
import {
  listSeededDemoPersonas,
  readDemoPersonaCookie,
} from "@/modules/demo/demo-persona-runtime";
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
  if (personas.length === 0) {
    return { enabled: false as const, personas: [], activeKey: null };
  }
  const activeKey = await readDemoPersonaCookie();
  return {
    enabled: true as const,
    personas,
    activeKey:
      activeKey?.startsWith("sheet-manager:")
        ? activeKey
        : (getDemoPersona(activeKey)?.key ?? null),
  };
}

export async function setDemoPersonaAction(personaKey: string | null) {
  if (!isDemoPersonaSwitchEnabled()) {
    return { ok: false as const, error: "Demo persona switch is disabled." };
  }
  const { authz } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) {
    return { ok: false as const, error: "Sign in first." };
  }

  const jar = await cookies();
  if (!personaKey || personaKey === "session") {
    jar.delete(DEMO_PERSONA_COOKIE);
  } else if (personaKey.startsWith("sheet-manager:")) {
    const seeded = await listSeededDemoPersonas();
    if (!seeded.some((row) => row.key === personaKey)) {
      return { ok: false as const, error: "That department manager is not ready yet." };
    }
    jar.set(DEMO_PERSONA_COOKIE, personaKey, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  } else {
    const persona = getDemoPersona(personaKey);
    if (!persona) {
      return { ok: false as const, error: "Unknown demo level." };
    }
    const seeded = await listSeededDemoPersonas();
    if (!seeded.some((row) => row.key === persona.key)) {
      return {
        ok: false as const,
        error: "Demo data is not seeded. Run npm run demo:seed-it",
      };
    }
    jar.set(DEMO_PERSONA_COOKIE, persona.key, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}
