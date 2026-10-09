/**
 * M2D-C non-destructive scenario matrix against the seeded QA org.
 * Does not truncate or reseed.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/m2d-qa-matrix.mjs
 */
import { PrismaClient } from "@prisma/client";
import { evaluateDeliveryHealth } from "../src/modules/portfolio/application/delivery-health.ts";

const db = new PrismaClient();
const AS_OF = new Date("2026-06-15T12:00:00.000Z");
const ORG_NAME = "M2D Health Org";

function result(name, ok, detail) {
  return { name, ok: Boolean(ok), detail: detail ?? "" };
}

async function main() {
  const org = await db.organization.findFirst({ where: { name: ORG_NAME } });
  if (!org) {
    console.error(JSON.stringify({ error: "M2D Health Org not found — seed first" }));
    process.exit(2);
  }

  const projects = await db.project.findMany({
    where: { organizationId: org.id, status: { not: "ARCHIVED" } },
    include: {
      closure: true,
      issues: true,
      milestones: true,
      workItems: { select: { id: true } },
    },
  });

  const byRef = Object.fromEntries(projects.map((p) => [p.referenceKey, p]));
  const deps = await db.planningDependency.findMany({
    where: { organizationId: org.id, status: "OPEN", criticality: "CRITICAL" },
  });

  const healthOf = (p) => {
    const criticalOpenDependencies = deps
      .filter(
        (d) =>
          (d.sourceType === "PROJECT" && d.sourceId === p.id) ||
          (d.targetType === "PROJECT" && d.targetId === p.id) ||
          (d.sourceType === "WORK_ITEM" &&
            p.workItems.some((w) => w.id === d.sourceId)) ||
          (d.targetType === "WORK_ITEM" &&
            p.workItems.some((w) => w.id === d.targetId)),
      )
      .map((d) => ({
        id: d.id,
        status: d.status,
        criticality: d.criticality,
      }));
    return evaluateDeliveryHealth(
      {
        id: p.id,
        initiativeId: p.initiativeId,
        status: p.status,
        plannedEnd: p.plannedEnd,
        plannedStart: p.plannedStart,
        closureOutcome: p.closure?.outcome ?? null,
        issues: p.issues,
        milestones: p.milestones,
        criticalOpenDependencies,
      },
      AS_OF,
    );
  };

  const rows = [];
  const ok = byRef["M2D-PRJ-OK"];
  const unk = byRef["M2D-PRJ-UNK"];
  const blk = byRef["M2D-PRJ-BLK"];
  const risk = byRef["M2D-PRJ-RISK"];
  const done = byRef["M2D-PRJ-DONE"];
  const can = byRef["M2D-PRJ-CAN"];

  rows.push(
    result(
      "ON_TRACK scheduled healthy",
      ok && healthOf(ok).classification === "ON_TRACK",
      ok ? healthOf(ok).classification : "missing",
    ),
  );
  rows.push(
    result(
      "UNKNOWN no schedule data",
      unk && healthOf(unk).classification === "UNKNOWN",
      unk ? healthOf(unk).classification : "missing",
    ),
  );
  rows.push(
    result(
      "BLOCKED active blocker",
      blk &&
        healthOf(blk).classification === "BLOCKED" &&
        healthOf(blk).reasons.some((r) => r.code === "ACTIVE_BLOCKER_ISSUE"),
      blk ? healthOf(blk).classification : "missing",
    ),
  );

  if (blk) {
    const resolved = {
      ...blk,
      issues: blk.issues.map((i) =>
        i.isBlocker ? { ...i, status: "RESOLVED" } : i,
      ),
    };
    const ev = healthOf(resolved);
    rows.push(
      result(
        "Resolved blocker no longer BLOCKED",
        ev.classification !== "BLOCKED",
        ev.classification,
      ),
    );
  }

  if (risk) {
    const ev = evaluateDeliveryHealth(
      {
        id: risk.id,
        initiativeId: risk.initiativeId,
        status: risk.status,
        plannedEnd: new Date("2027-01-01"),
        plannedStart: null,
        closureOutcome: null,
        issues: [
          {
            id: "tmp-crit",
            status: "OPEN",
            severity: "CRITICAL",
            isBlocker: false,
          },
        ],
        milestones: [],
        criticalOpenDependencies: [],
      },
      AS_OF,
    );
    rows.push(
      result(
        "Critical open Issue → AT_RISK",
        ev.classification === "AT_RISK" &&
          ev.reasons.some((r) => r.code === "CRITICAL_OPEN_ISSUE"),
        ev.classification,
      ),
    );
  }

  rows.push(
    result(
      "Missed milestone → AT_RISK",
      risk &&
        healthOf(risk).classification === "AT_RISK" &&
        healthOf(risk).reasons.some(
          (r) =>
            r.code === "OVERDUE_CRITICAL_MILESTONE" ||
            r.code === "MISSED_MILESTONE" ||
            r.code === "OVERDUE_PROJECT_END",
        ),
      risk ? healthOf(risk).reasons.map((r) => r.code).join(",") : "missing",
    ),
  );

  {
    const ev = evaluateDeliveryHealth(
      {
        id: "dep-p",
        initiativeId: "i",
        status: "ACTIVE",
        plannedEnd: new Date("2027-01-01"),
        plannedStart: null,
        closureOutcome: null,
        issues: [],
        milestones: [],
        criticalOpenDependencies: [
          { id: "d1", status: "OPEN", criticality: "CRITICAL" },
        ],
      },
      AS_OF,
    );
    rows.push(
      result(
        "Critical dependency → AT_RISK",
        ev.classification === "AT_RISK" &&
          ev.reasons.some((r) => r.code === "CRITICAL_DEPENDENCY"),
        ev.classification,
      ),
    );
  }

  rows.push(
    result(
      "COMPLETED",
      done && healthOf(done).classification === "COMPLETED",
      done ? healthOf(done).classification : "missing",
    ),
  );
  rows.push(
    result(
      "CANCELLED distinct",
      can &&
        healthOf(can).classification === "CANCELLED" &&
        healthOf(can).classification !== "COMPLETED",
      can ? healthOf(can).classification : "missing",
    ),
  );

  {
    const ev = evaluateDeliveryHealth(
      {
        id: "mix",
        initiativeId: "i",
        status: "ACTIVE",
        plannedEnd: new Date("2020-01-01"),
        plannedStart: null,
        closureOutcome: null,
        issues: [
          { id: "b", status: "OPEN", severity: "HIGH", isBlocker: true },
        ],
        milestones: [
          {
            id: "m",
            status: "MISSED",
            criticality: true,
            plannedDate: new Date("2020-01-01"),
          },
        ],
        criticalOpenDependencies: [],
      },
      AS_OF,
    );
    rows.push(
      result(
        "Multiple signals → BLOCKED precedence",
        ev.classification === "BLOCKED" &&
          ev.reasons.some((r) => r.code === "ACTIVE_BLOCKER_ISSUE") &&
          ev.reasons.some((r) => r.code === "OVERDUE_CRITICAL_MILESTONE"),
        `${ev.classification}:${ev.reasons.map((r) => r.code).join(",")}`,
      ),
    );
  }

  if (blk) {
    const a = healthOf(blk);
    const b = healthOf(blk);
    rows.push(
      result(
        "Same asOf consistency",
        a.classification === b.classification &&
          JSON.stringify(a.reasons) === JSON.stringify(b.reasons),
        a.classification,
      ),
    );
  }

  const counts = {
    BLOCKED: 0,
    AT_RISK: 0,
    ON_TRACK: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    UNKNOWN: 0,
  };
  for (const p of projects) {
    counts[healthOf(p).classification] += 1;
  }

  const failed = rows.filter((r) => !r.ok);
  console.log(
    JSON.stringify(
      {
        orgId: org.id,
        asOf: AS_OF.toISOString(),
        projectCount: projects.length,
        counts,
        results: rows,
        pass: failed.length === 0,
        failed: failed.map((f) => f.name),
      },
      null,
      2,
    ),
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main()
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  })
  .then(() => db.$disconnect());
