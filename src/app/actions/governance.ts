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

function revalidateGovernance(initiativeId: string) {
  revalidatePath("/");
  revalidatePath("/approvals");
  revalidatePath("/decisions");
  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${initiativeId}`);
  revalidatePath(`/initiatives/${initiativeId}/governance`);
  revalidatePath(`/initiatives/${initiativeId}/decisions`);
  revalidatePath(`/initiatives/${initiativeId}/poc`);
  revalidatePath(`/initiatives/${initiativeId}/pilot`);
  revalidatePath(`/initiatives/${initiativeId}/project`);
  revalidatePath(`/initiatives/${initiativeId}/pre-study`);
  revalidatePath(`/initiatives/${initiativeId}/history`);
}

function initiativeIdFrom(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (typeof record.initiativeId === "string") return record.initiativeId;
  return null;
}

export async function submitPreStudyForGovernanceAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.submitPreStudyForGovernance(principal, input);
    revalidateGovernance(result.submission.initiativeId);
    return result;
  });
}

export async function submitPoCForGovernanceAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.submitPoCForGovernance(principal, input);
    revalidateGovernance(result.submission.initiativeId);
    return result;
  });
}

export async function reviseGovernanceSubmissionAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.reviseGovernanceSubmission(principal, input);
    revalidateGovernance(result.submission.initiativeId);
    return result;
  });
}

export async function recordApprovalAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.recordApproval(principal, input);
    const initiativeId =
      typeof (input as { initiativeId?: string }).initiativeId === "string"
        ? (input as { initiativeId: string }).initiativeId
        : null;
    if (initiativeId) {
      revalidateGovernance(initiativeId);
    } else {
      revalidatePath("/");
      revalidatePath("/approvals");
      revalidatePath("/decisions");
    }
    return result;
  });
}

export async function recordDecisionAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.recordDecision(principal, input);
    revalidateGovernance(result.initiativeId);
    return result;
  });
}

export async function resolveDecisionConditionAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.resolveDecisionCondition(principal, input);
    const initiativeId = initiativeIdFrom(input);
    if (initiativeId) {
      revalidateGovernance(initiativeId);
    } else {
      revalidatePath("/");
      revalidatePath("/approvals");
      revalidatePath("/decisions");
    }
    return result;
  });
}

export async function createPoCAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.createPoC(principal, input);
    revalidateGovernance(result.initiativeId);
    return result;
  });
}

export async function updatePoCAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.updatePoC(principal, input);
    revalidateGovernance(result.initiativeId);
    return result;
  });
}

export async function transitionPoCAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.transitionPoC(principal, input);
    revalidateGovernance(result.initiativeId);
    return result;
  });
}

export async function upsertPoCCriterionAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.upsertPoCCriterion(principal, input);
    const initiativeId = initiativeIdFrom(input);
    if (initiativeId) {
      revalidateGovernance(initiativeId);
    } else {
      revalidatePath("/");
      revalidatePath("/approvals");
      revalidatePath("/decisions");
    }
    return result;
  });
}

export async function updateCriterionEvaluationAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.updateCriterionEvaluation(principal, input);
    const initiativeId = initiativeIdFrom(input);
    if (initiativeId) {
      revalidateGovernance(initiativeId);
    } else {
      revalidatePath("/");
      revalidatePath("/approvals");
      revalidatePath("/decisions");
    }
    return result;
  });
}

export async function updatePoCResultsAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.updatePoCResults(principal, input);
    revalidateGovernance(result.initiativeId);
    return result;
  });
}
