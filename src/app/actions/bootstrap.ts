"use server";

import { revalidatePath } from "next/cache";
import { createServices } from "@/server/container";
import { runAction } from "@/server/action-runner";

export type { ActionResult } from "@/server/action-runner";

export async function consumeBootstrapAction(token: string) {
  return runAction("identity.bootstrap.consume", async () => {
    const { authz, identity } = createServices();
    const principal = await authz.requirePrincipal();
    await identity.consumeBootstrapToken(principal, token);
    revalidatePath("/");
    revalidatePath("/access-not-configured");
    revalidatePath("/setup/bootstrap");
    return { consumed: true as const };
  });
}
