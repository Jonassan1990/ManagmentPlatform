"use server";

import { revalidatePath } from "next/cache";
import { createServices } from "@/server/container";
import { runAction, type ActionResult } from "@/server/action-runner";

export type { ActionResult };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return runAction("server_action", fn);
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

export async function createIssueAction(input: unknown) {
  return run(async () => {
    const { authz, projectIssues } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await projectIssues.createIssue(principal, input);
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

export async function updateIssueAction(input: unknown) {
  return run(async () => {
    const { authz, projectIssues } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await projectIssues.updateIssue(principal, input);
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

export async function changeIssueStatusAction(input: unknown) {
  return run(async () => {
    const { authz, projectIssues } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await projectIssues.changeIssueStatus(principal, input);
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

export async function resolveIssueAction(input: unknown) {
  return run(async () => {
    const { authz, projectIssues } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await projectIssues.resolveIssue(principal, input);
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

export async function closeProjectAction(input: unknown) {
  return runAction("project.close", async () => {
    const { authz, project } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await project.closeProject(principal, input);
    revalidateProject(result.project.initiativeId, result.project.id);
    return result;
  });
}
