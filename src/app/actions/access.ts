"use server";

import { revalidatePath } from "next/cache";
import { createServices } from "@/server/container";
import { runAction } from "@/server/action-runner";
import {
  assignRoleBindingInputSchema,
  expireRoleBindingInputSchema,
  linkOidcIdentityInputSchema,
} from "@/modules/identity-access/application/schemas";

export type { ActionResult } from "@/server/action-runner";

export async function assignRoleBindingAction(
  input: unknown,
) {
  return runAction("access.assignRoleBinding", async () => {
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
) {
  return runAction("access.expireRoleBinding", async () => {
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

/** Explicit OIDC identity link (PLATFORM ROLE_MANAGE). Never merges by email. */
export async function linkOidcIdentityAction(
  input: unknown,
) {
  return runAction("access.linkOidcIdentity", async () => {
    const { authz, identity } = createServices();
    const principal = await authz.requirePrincipal();
    const parsed = linkOidcIdentityInputSchema.parse(input);
    const result = await identity.linkOidcIdentityToPrincipal(principal, parsed);
    revalidatePath("/setup/link-oidc");
    return result;
  });
}
