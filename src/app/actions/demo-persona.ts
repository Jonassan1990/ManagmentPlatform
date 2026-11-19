"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  DEMO_PERSONA_COOKIE,
  isDemoPersonaSwitchEnabled,
} from "@/modules/demo/it-hierarchy-demo";
import {
  demoPersonaCookieOptions,
  ensurePersonaHasAccess,
  listSeededDemoPersonas,
  readDemoPersonaCookie,
  resolveImpersonationPrincipal,
} from "@/modules/demo/demo-persona-runtime";
import {
  impersonationKeyForPrincipal,
  isImpersonationKey,
} from "@/modules/demo/persona-keys";
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
  const normalized =
    isImpersonationKey(activeKey) &&
    personas.some((row) => row.key === activeKey)
      ? activeKey
      : isImpersonationKey(activeKey)
        ? activeKey
        : null;
  return {
    enabled: true as const,
    personas,
    activeKey: normalized,
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
    jar.set(DEMO_PERSONA_COOKIE, "", {
      ...demoPersonaCookieOptions(0),
      maxAge: 0,
    });
    jar.delete(DEMO_PERSONA_COOKIE);
    revalidatePath("/", "layout");
    return { ok: true as const };
  }
  if (!isImpersonationKey(personaKey)) {
    return { ok: false as const, error: "Choose a person from the list." };
  }

  let person = await resolveImpersonationPrincipal(personaKey);
  if (!person) {
    try {
      const { ensurePlatformAdminReady } = await import(
        "@/modules/demo/ensure-platform-admin-ready"
      );
      await ensurePlatformAdminReady(principal.id);
      person = await resolveImpersonationPrincipal(personaKey);
    } catch {
      // fall through
    }
  }
  if (!person) {
    return {
      ok: false as const,
      error: "That person was not found. Open Admin → Prepare people, then retry.",
    };
  }

  // Always store principal:<uuid> so cookies never contain spaces (e.g. IN MT).
  const safeKey = impersonationKeyForPrincipal(person);
  await ensurePersonaHasAccess(person.id);

  jar.set(DEMO_PERSONA_COOKIE, safeKey, demoPersonaCookieOptions());

  revalidatePath("/", "layout");
  return { ok: true as const, key: safeKey };
}
