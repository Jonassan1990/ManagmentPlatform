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

export async function listApprovalTemplatesAction(gateType?: string) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    return governance.listApprovalTemplates(
      principal,
      gateType as
        | "PRE_STUDY_GATE"
        | "POC_GATE"
        | "PILOT_GATE"
        | undefined,
    );
  });
}

export async function updateApprovalTemplateAction(input: unknown) {
  return run(async () => {
    const { authz, governance } = createServices();
    const principal = await authz.requirePrincipal();
    const result = await governance.updateApprovalTemplate(principal, input);
    revalidatePath("/");
    revalidatePath("/governance/policy");
    const orgId =
      input &&
      typeof input === "object" &&
      typeof (input as { organizationId?: string }).organizationId === "string"
        ? (input as { organizationId: string }).organizationId
        : null;
    if (orgId) {
      revalidatePath(`/organization/${orgId}/governance-policy`);
    }
    return result;
  });
}
