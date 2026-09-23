"use server";

import { revalidatePath } from "next/cache";
import { AppError, toErrorPayload } from "@/modules/shared/errors";
import { createServices } from "@/server/container";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

export async function consumeBootstrapAction(
  token: string,
): Promise<ActionResult<{ consumed: true }>> {
  try {
    const { authz, identity } = createServices();
    const principal = await authz.requirePrincipal();
    await identity.consumeBootstrapToken(principal, token);
    revalidatePath("/");
    revalidatePath("/access-not-configured");
    revalidatePath("/setup/bootstrap");
    return { ok: true, data: { consumed: true } };
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error(error);
    }
    return { ok: false, error: toErrorPayload(error) };
  }
}
