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

function revalidateProject(initiativeId: string, projectId?: string) {
  revalidatePath("/");
  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${initiativeId}`);
  revalidatePath(`/initiatives/${initiativeId}/project`);
  revalidatePath(`/initiatives/${initiativeId}/history`);
  revalidatePath(`/initiatives/${initiativeId}/risks`);
  revalidatePath(`/initiatives/${initiativeId}/documents`);
  revalidatePath(`/initiatives/${initiativeId}/decisions`);
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

function initiativeIdFrom(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (typeof record.initiativeId === "string") return record.initiativeId;
  return null;
}

export async function updateProjectAction(input: unknown) {
  return run(async () => {
    const { authz, project } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await project.updateProject(principal, input);
    revalidateProject(result.initiativeId, result.id);
    return result;
  });
}

export async function updateBudgetAction(input: unknown) {
  return run(async () => {
    const { authz, project } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await project.updateBudget(principal, input);
    revalidateProject(result.initiativeId, result.id);
    return result;
  });
}

export async function createMilestoneAction(input: unknown) {
  return run(async () => {
    const { authz, project } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await project.createMilestone(principal, input);
    const initiativeId = initiativeIdFrom(input);
    if (initiativeId) {
      revalidateProject(initiativeId, result.projectId);
    } else {
      revalidatePath("/");
      revalidatePath("/initiatives");
    }
    return result;
  });
}

export async function updateMilestoneAction(input: unknown) {
  return run(async () => {
    const { authz, project } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await project.updateMilestone(principal, input);
    const initiativeId = initiativeIdFrom(input);
    if (initiativeId) {
      revalidateProject(initiativeId, result.projectId);
    } else {
      revalidatePath("/");
      revalidatePath("/initiatives");
    }
    return result;
  });
}

export async function createWorkItemAction(input: unknown) {
  return run(async () => {
    const { authz, project } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await project.createWorkItem(principal, input);
    const initiativeId = initiativeIdFrom(input);
    if (initiativeId) {
      revalidateProject(initiativeId, result.projectId);
    } else {
      revalidatePath("/");
      revalidatePath("/initiatives");
    }
    return result;
  });
}

export async function updateWorkItemAction(input: unknown) {
  return run(async () => {
    const { authz, project } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await project.updateWorkItem(principal, input);
    const initiativeId = initiativeIdFrom(input);
    if (initiativeId) {
      revalidateProject(initiativeId, result.projectId);
    } else {
      revalidatePath("/");
      revalidatePath("/initiatives");
    }
    return result;
  });
}
