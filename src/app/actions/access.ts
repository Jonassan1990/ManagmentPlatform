"use server";

import { revalidatePath } from "next/cache";
import { AppError, toErrorPayload } from "@/modules/shared/errors";
import { createServices } from "@/server/container";
import {
  assignRoleBindingInputSchema,
  expireRoleBindingInputSchema,
} from "@/modules/identity-access/application/schemas";

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

export async function assignRoleBindingAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const { authz } = createServices();
    const principal = await authz.requirePrincipal();
    const parsed = assignRoleBindingInputSchema.parse(input);
    const result = await authz.assignRoleBinding(principal, parsed);
    if (parsed.organizationId) {
      revalidatePath(`/organization/${parsed.organizationId}/access`);
    }
    return result;
  });
}

export async function expireRoleBindingAction(
  input: unknown,
): Promise<ActionResult> {
  return run(async () => {
    const { authz } = createServices();
    const principal = await authz.requirePrincipal();
    const parsed = expireRoleBindingInputSchema.parse(input);
    const result = await authz.expireRoleBinding(principal, parsed);
    if (result.organizationId) {
      revalidatePath(`/organization/${result.organizationId}/access`);
    }
    return result;
  });
}
