import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";

export type AllocationFingerprintRow = {
  workItemId: string;
  iterationId: string;
  teamId: string;
  resourceId: string | null;
  plannedHours: Prisma.Decimal | unknown;
  notes: string | null;
};

/**
 * Stable integrity marker for a revision's allocations.
 * Used by M3D-B idempotent promote replay and M3D-C approval/baseline binding.
 */
export function computeAllocationFingerprint(
  rows: AllocationFingerprintRow[],
): string {
  const normalized = [...rows]
    .map((a) => ({
      workItemId: a.workItemId,
      iterationId: a.iterationId,
      teamId: a.teamId,
      resourceId: a.resourceId,
      plannedHours: String(a.plannedHours),
      notes: a.notes ?? null,
    }))
    .sort((a, b) => a.workItemId.localeCompare(b.workItemId));
  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}
