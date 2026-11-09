"use server";

import { revalidatePath } from "next/cache";
import { createServices } from "@/server/container";
import { runAction, type ActionResult } from "@/server/action-runner";

export type { ActionResult };

function revalidateOnboarding(checklistId?: string) {
  revalidatePath("/onboarding");
  if (checklistId) revalidatePath(`/onboarding/${checklistId}`);
}

export async function createOnboardingChecklistAction(input: unknown) {
  return runAction("onboarding.create", async () => {
    const { authz, onboarding } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await onboarding.createChecklist(principal, input);
    revalidateOnboarding(result.id);
    return result;
  });
}

export async function toggleOnboardingItemAction(input: unknown) {
  return runAction("onboarding.toggle_item", async () => {
    const { authz, onboarding } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await onboarding.toggleItem(principal, input);
    revalidateOnboarding(result.id);
    return result;
  });
}

export async function updateOnboardingTaskAction(input: unknown) {
  return runAction("onboarding.update_task", async () => {
    const { authz, onboarding } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await onboarding.updateTask(principal, input);
    revalidateOnboarding(result.id);
    return result;
  });
}

export async function updateOnboardingItemsAction(input: unknown) {
  return runAction("onboarding.update_items", async () => {
    const { authz, onboarding } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await onboarding.updateItems(principal, input);
    revalidateOnboarding(result.id);
    return result;
  });
}

export async function cancelOnboardingChecklistAction(input: unknown) {
  return runAction("onboarding.cancel", async () => {
    const { authz, onboarding } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await onboarding.cancelChecklist(principal, input);
    revalidateOnboarding(result.id);
    return result;
  });
}
