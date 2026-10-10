"use server";

import { z } from "zod";
import type { HomeDashboardResponse } from "@/modules/portfolio/domain/home-dashboard";
import { createServices } from "@/server/container";
import { runAction, type ActionResult } from "@/server/action-runner";

export type { ActionResult };

const homeDashboardInputSchema = z.object({
  organizationId: z.string().uuid().optional(),
  myWorkLimit: z.number().int().min(1).max(50).optional(),
  attentionLimit: z.number().int().min(1).max(20).optional(),
});

/**
 * M5B-A — role-aware Home dashboard query (read-only composition).
 * UI redesign is deferred to M5B-B; this action exposes the typed contract.
 */
export async function getHomeDashboardAction(
  input: unknown = {},
): Promise<ActionResult<HomeDashboardResponse>> {
  return runAction("home.getDashboard", async () => {
    const parsed = homeDashboardInputSchema.parse(input ?? {});
    const { authz, homeDashboard } = createServices();
    const principal = await authz.requirePrincipal();
    return homeDashboard.getHomeDashboard(principal, parsed);
  });
}
