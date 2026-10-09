/**
 * Shared helper for integration tests that need a PiBaseline after M3D-C.
 * Path: clone CURRENT → select → promote → approve → baseline.
 */
import type { PrismaClient } from "@prisma/client";
import type { Principal } from "@/modules/identity-access/domain/types";
import type { PlanningService } from "@/modules/pi-planning/application/planning-service";

export async function promoteApproveAndBaseline(
  planning: PlanningService,
  db: PrismaClient,
  actor: Principal,
  args: {
    piId: string;
    label?: string | null;
    acknowledgeWarnings?: boolean;
  },
) {
  const ack = args.acknowledgeWarnings ?? true;
  const scenario = await planning.createScenarioFromCurrent(actor, {
    piId: args.piId,
    label: args.label ? `promote-${args.label}` : "promote-for-baseline",
  });

  let piRow = await db.programIncrement.findUniqueOrThrow({
    where: { id: args.piId },
  });
  await planning.selectScenario(actor, {
    piId: args.piId,
    revisionId: scenario.id,
    expectedPiVersion: piRow.version,
    expectedRevisionVersion: scenario.version,
  });

  piRow = await db.programIncrement.findUniqueOrThrow({
    where: { id: args.piId },
  });
  const selected = await db.planningRevision.findUniqueOrThrow({
    where: { id: scenario.id },
  });
  const current = await planning.pi.requireCurrentRevision(args.piId);

  await planning.promoteSelectedScenario(actor, {
    piId: args.piId,
    expectedPiVersion: piRow.version,
    expectedSelectedRevisionId: selected.id,
    expectedSelectedRevisionVersion: selected.version,
    expectedCurrentRevisionVersion: current.version,
    acknowledgeWarnings: ack,
  });

  piRow = await db.programIncrement.findUniqueOrThrow({
    where: { id: args.piId },
  });
  const currentAfterPromote = await planning.pi.requireCurrentRevision(
    args.piId,
  );

  const approval = await planning.approveCurrentPlan(actor, {
    piId: args.piId,
    expectedPiVersion: piRow.version,
    expectedCurrentRevisionVersion: currentAfterPromote.version,
    acknowledgeWarnings: ack,
  });

  piRow = await db.programIncrement.findUniqueOrThrow({
    where: { id: args.piId },
  });
  const currentAfterApprove = await planning.pi.requireCurrentRevision(
    args.piId,
  );

  const baseline = await planning.createBaseline(actor, {
    piId: args.piId,
    label: args.label ?? null,
    expectedApprovalId: approval.approvalId,
    expectedPiVersion: piRow.version,
    expectedCurrentRevisionVersion: currentAfterApprove.version,
  });

  return { baseline, approval, scenario };
}

/** Re-approve CURRENT after an edit, then create the next baseline. */
export async function reapproveAndBaseline(
  planning: PlanningService,
  db: PrismaClient,
  actor: Principal,
  args: {
    piId: string;
    label?: string | null;
    acknowledgeWarnings?: boolean;
  },
) {
  const ack = args.acknowledgeWarnings ?? true;
  let piRow = await db.programIncrement.findUniqueOrThrow({
    where: { id: args.piId },
  });
  const current = await planning.pi.requireCurrentRevision(args.piId);

  // Ensure promotion provenance exists (required by M3D-C).
  if (!piRow.lastPromotedFromRevisionId) {
    return promoteApproveAndBaseline(planning, db, actor, args);
  }

  const approval = await planning.approveCurrentPlan(actor, {
    piId: args.piId,
    expectedPiVersion: piRow.version,
    expectedCurrentRevisionVersion: current.version,
    acknowledgeWarnings: ack,
  });

  piRow = await db.programIncrement.findUniqueOrThrow({
    where: { id: args.piId },
  });
  const currentAfter = await planning.pi.requireCurrentRevision(args.piId);

  const baseline = await planning.createBaseline(actor, {
    piId: args.piId,
    label: args.label ?? null,
    expectedApprovalId: approval.approvalId,
    expectedPiVersion: piRow.version,
    expectedCurrentRevisionVersion: currentAfter.version,
  });

  return { baseline, approval };
}
