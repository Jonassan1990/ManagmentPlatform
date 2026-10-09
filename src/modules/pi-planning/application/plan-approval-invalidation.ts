import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type PlanApprovalInvalidationReason =
  | "CURRENT_EDITED"
  | "REPROMOTED"
  | "SUPERSEDED"
  | "FINGERPRINT_MISMATCH";

/**
 * Marks all VALID plan approvals for a PI as INVALIDATED.
 * Historical rows remain; returns invalidated approval ids.
 */
export async function invalidateValidPlanApprovals(
  db: DbClient,
  piId: string,
  reason: PlanApprovalInvalidationReason,
): Promise<string[]> {
  const valid = await db.piPlanApproval.findMany({
    where: { piId, status: "VALID" },
    select: { id: true },
  });
  if (valid.length === 0) return [];
  const now = new Date();
  await db.piPlanApproval.updateMany({
    where: { piId, status: "VALID" },
    data: {
      status: "INVALIDATED",
      invalidatedAt: now,
      invalidatedReason: reason,
    },
  });
  return valid.map((v) => v.id);
}
