"use server";

import { revalidatePath } from "next/cache";
import { AppError, toErrorPayload } from "@/modules/shared/errors";
import { createServices } from "@/server/container";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error(error);
    }
    return { ok: false, error: toErrorPayload(error) };
  }
}

function revalidateInitiative(id: string) {
  revalidatePath("/");
  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${id}`);
  revalidatePath(`/initiatives/${id}/demand`);
  revalidatePath(`/initiatives/${id}/requirements`);
  revalidatePath(`/initiatives/${id}/pre-study`);
  revalidatePath(`/initiatives/${id}/risks`);
  revalidatePath(`/initiatives/${id}/documents`);
  revalidatePath(`/initiatives/${id}/history`);
}

export async function createInitiativeAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    const created = await initiative.createInitiative(principal, input);
    revalidateInitiative(created.id);
    return created;
  });
}

export async function updateInitiativeAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    const updated = await initiative.updateInitiative(principal, input);
    revalidateInitiative(updated.id);
    return updated;
  });
}

export async function updateDemandAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    const updated = await initiative.updateDemand(principal, input);
    revalidateInitiative(String((input as { initiativeId: string }).initiativeId));
    return updated;
  });
}

export async function advanceLifecycleAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    const updated = await initiative.advanceLifecycle(principal, input);
    revalidateInitiative(updated.id);
    return updated;
  });
}

export async function createRequirementAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    const created = await initiative.createRequirement(principal, input);
    revalidateInitiative(created.initiativeId);
    return created;
  });
}

export async function updateRequirementAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    const updated = await initiative.updateRequirement(principal, input);
    revalidatePath("/initiatives");
    return updated;
  });
}

export async function addAcceptanceCriterionAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    return initiative.addAcceptanceCriterion(principal, input);
  });
}

export async function createRequirementRelationAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    return initiative.createRequirementRelation(principal, input);
  });
}

export async function upsertAssessmentAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await initiative.upsertAssessment(principal, input);
    revalidateInitiative(String((input as { initiativeId: string }).initiativeId));
    return result;
  });
}

export async function createAlternativeAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await initiative.createAlternative(principal, input);
    revalidateInitiative(String((input as { initiativeId: string }).initiativeId));
    return result;
  });
}

export async function updateAlternativeAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    return initiative.updateAlternative(principal, input);
  });
}

export async function createRiskAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await initiative.createRisk(principal, input);
    revalidateInitiative(result.initiativeId);
    return result;
  });
}

export async function updateRiskAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    return initiative.updateRisk(principal, input);
  });
}

export async function createDocumentAction(input: unknown) {
  return run(async () => {
    const { authz, initiative } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await initiative.createDocumentMetadata(principal, input);
    revalidateInitiative(result.initiativeId);
    return result;
  });
}
