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

function revalidatePilot(initiativeId: string) {
  revalidatePath("/");
  revalidatePath("/approvals");
  revalidatePath("/decisions");
  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${initiativeId}`);
  revalidatePath(`/initiatives/${initiativeId}/pilot`);
  revalidatePath(`/initiatives/${initiativeId}/project`);
  revalidatePath(`/initiatives/${initiativeId}/governance`);
  revalidatePath(`/initiatives/${initiativeId}/decisions`);
  revalidatePath(`/initiatives/${initiativeId}/poc`);
  revalidatePath(`/initiatives/${initiativeId}/history`);
}

function initiativeIdFrom(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (typeof record.initiativeId === "string") return record.initiativeId;
  return null;
}

export async function createPilotAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.createPilot(principal, input);
    revalidatePilot(result.initiativeId);
    return result;
  });
}

export async function updatePilotAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.updatePilot(principal, input);
    const initiativeId = initiativeIdFrom(input) ?? result.initiativeId;
    revalidatePilot(initiativeId);
    return result;
  });
}

export async function transitionPilotAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.transitionPilot(principal, input);
    const initiativeId = initiativeIdFrom(input) ?? result.initiativeId;
    revalidatePilot(initiativeId);
    return result;
  });
}

export async function upsertPilotCriterionAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.upsertPilotCriterion(principal, input);
    const initiativeId = initiativeIdFrom(input);
    if (initiativeId) {
      revalidatePilot(initiativeId);
    } else {
      revalidatePath("/");
      revalidatePath("/initiatives");
    }
    return result;
  });
}

export async function evaluatePilotCriterionAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.evaluatePilotCriterion(principal, input);
    const initiativeId = initiativeIdFrom(input);
    if (initiativeId) {
      revalidatePilot(initiativeId);
    } else {
      revalidatePath("/");
      revalidatePath("/initiatives");
    }
    return result;
  });
}

export async function updatePilotResultsAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.updatePilotResults(principal, input);
    revalidatePilot(result.initiativeId);
    return result;
  });
}

export async function addPilotFeedbackAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.addPilotFeedback(principal, input);
    const initiativeId = initiativeIdFrom(input);
    if (initiativeId) {
      revalidatePilot(initiativeId);
    } else {
      revalidatePath("/");
      revalidatePath("/initiatives");
    }
    return result;
  });
}

export async function submitPilotForGovernanceAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.submitPilotForGovernance(principal, input);
    revalidatePilot(result.submission.initiativeId);
    return result;
  });
}

export async function convertToProjectAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.convertToProject(principal, input);
    revalidatePilot(result.initiativeId);
    revalidatePath(`/initiatives/${result.initiativeId}/project`);
    return result;
  });
}
