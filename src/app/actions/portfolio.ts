"use server";

import { z } from "zod";
import { AppError, toErrorPayload } from "@/modules/shared/errors";
import type { PortfolioSnapshot } from "@/modules/portfolio/domain/types";
import { createServices } from "@/server/container";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

const portfolioQueryInputSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  asOf: z.coerce.date().optional(),
});

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

/**
 * M2A — authorization-aware portfolio snapshot for an organization.
 * Read-only; no mutations / revalidate needed.
 */
export async function getPortfolioSnapshotAction(
  input: unknown,
): Promise<ActionResult<PortfolioSnapshot>> {
  return run(async () => {
    const parsed = portfolioQueryInputSchema.parse(input);
    const { authz, portfolio } = createServices();
    const principal = await authz.requirePrincipal();
    return portfolio.getPortfolioSnapshot(principal, parsed);
  });
}
