"use server";

import { revalidatePath } from "next/cache";
import { createServices } from "@/server/container";
import { runAction, type ActionResult } from "@/server/action-runner";

export type { ActionResult };

function revalidateVacation(requestId?: string) {
  revalidatePath("/vacation");
  revalidatePath("/vacation/inbox");
  revalidatePath("/vacation/calendar");
  revalidatePath("/vacation/year");
  if (requestId) revalidatePath(`/vacation/${requestId}`);
}

export async function createVacationRequestAction(input: unknown) {
  return runAction("vacation.create", async () => {
    const { authz, vacation } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await vacation.createRequest(principal, input);
    revalidateVacation(result.id);
    return result;
  });
}

export async function updateVacationRequestAction(input: unknown) {
  return runAction("vacation.update", async () => {
    const { authz, vacation } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await vacation.updateAndResubmit(principal, input);
    revalidateVacation(result.id);
    return result;
  });
}

export async function cancelVacationRequestAction(input: unknown) {
  return runAction("vacation.cancel", async () => {
    const { authz, vacation } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await vacation.cancelRequest(principal, input);
    revalidateVacation(result.id);
    return result;
  });
}

export async function reviewVacationRequestAction(input: unknown) {
  return runAction("vacation.review", async () => {
    const { authz, vacation } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await vacation.reviewRequest(principal, input);
    revalidateVacation(result.id);
    return result;
  });
}
