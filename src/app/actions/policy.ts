"use server";

import { revalidatePath } from "next/cache";
import { createServices } from "@/server/container";
import { runAction, type ActionResult } from "@/server/action-runner";

export type { ActionResult };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  return runAction("server_action", fn);
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
