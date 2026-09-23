import Link from "next/link";
import type { InitiativeStage } from "@prisma/client";
import { stageLabel } from "@/modules/initiative/application/attention";

const ACTIVE: InitiativeStage[] = [
  "DEMAND",
  "REQUIREMENTS",
  "PRE_STUDY",
  "POC",
  "PILOT",
  "PROJECT",
];

const STAGE_RANK: Record<InitiativeStage, number> = {
  DEMAND: 0,
  REQUIREMENTS: 1,
  PRE_STUDY: 2,
  POC: 3,
  PILOT: 4,
  PROJECT: 5,
};

export function LifecycleRail({ current }: { current: InitiativeStage }) {
  const currentIndex = ACTIVE.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {ACTIVE.map((stage, index) => {
        const done = currentIndex >= 0 && index < currentIndex;
        const active = index === currentIndex;
        return (
          <li
            key={stage}
            className={`rounded-md border px-3 py-1.5 ${
              active
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : done
                  ? "border-[var(--line)] text-[var(--ok)]"
                  : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            {done ? "✓ " : active ? "● " : "○ "}
            {stageLabel(stage)}
          </li>
        );
      })}
      <li className="rounded-md border border-[var(--line)] px-3 py-1.5 text-[var(--muted)]">
        <Link href="/pi" className="hover:text-[var(--accent)]">
          ○ PI Planning
        </Link>
        <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">
          module
        </span>
      </li>
    </ol>
  );
}

export type InitiativeTabKey =
  | "overview"
  | "demand"
  | "requirements"
  | "pre-study"
  | "risks"
  | "documents"
  | "history"
  | "governance"
  | "decisions"
  | "poc"
  | "pilot"
  | "project";

export function InitiativeTabs({
  initiativeId,
  active,
  currentStage,
  hasGovernance,
  hasPoC,
  hasPilot,
  hasProject,
}: {
  initiativeId: string;
  active: InitiativeTabKey;
  currentStage?: InitiativeStage;
  hasGovernance?: boolean;
  hasPoC?: boolean;
  hasPilot?: boolean;
  hasProject?: boolean;
}) {
  const stageReached =
    currentStage != null && STAGE_RANK[currentStage] >= STAGE_RANK.PRE_STUDY;
  const showPhase3 = Boolean(stageReached || hasGovernance || hasPoC);
  const showPilot =
    Boolean(hasPilot) ||
    (currentStage != null && STAGE_RANK[currentStage] >= STAGE_RANK.PILOT) ||
    (currentStage != null &&
      STAGE_RANK[currentStage] >= STAGE_RANK.POC &&
      (hasPoC || showPhase3));
  const showProject =
    Boolean(hasProject) ||
    (currentStage != null && STAGE_RANK[currentStage] >= STAGE_RANK.PROJECT) ||
    Boolean(hasPilot);

  const tabs: { key: InitiativeTabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "demand", label: "Demand" },
    { key: "requirements", label: "Requirements" },
    { key: "pre-study", label: "Pre-study" },
  ];

  if (showPhase3) {
    tabs.push(
      { key: "governance", label: "Governance" },
      { key: "decisions", label: "Decisions" },
      { key: "poc", label: "PoC" },
    );
  }

  if (showPilot) {
    tabs.push({ key: "pilot", label: "Pilot" });
  }

  if (showProject) {
    tabs.push({ key: "project", label: "Project" });
  }

  tabs.push(
    { key: "risks", label: "Risks" },
    { key: "documents", label: "Documents" },
    { key: "history", label: "History" },
  );

  return (
    <nav
      className="mb-5 flex flex-wrap gap-1 border-b border-[var(--line)]"
      aria-label="Initiative sections"
    >
      {tabs.map(({ key, label }) => {
        const href =
          key === "overview"
            ? `/initiatives/${initiativeId}`
            : `/initiatives/${initiativeId}/${key}`;
        const isActive = active === key;
        return (
          <Link
            key={key}
            href={href}
            className={`border-b-2 px-3 py-2 text-sm ${
              isActive
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AttentionPanel({
  items,
}: {
  items: { key: string; severity: string; message: string }[];
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="font-medium">What needs attention</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          No attention items for the current state.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.key} className="text-sm">
              <span
                className={
                  item.severity === "blocker"
                    ? "text-[var(--danger)]"
                    : item.severity === "warning"
                      ? "text-[var(--warning)]"
                      : "text-[var(--muted)]"
                }
              >
                {item.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReadinessPanel({
  readiness,
}: {
  readiness: {
    ready: boolean;
    items: { key: string; label: string; status: string; detail: string }[];
  } | null;
}) {
  if (!readiness) return null;
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Pre-study readiness</h2>
        <span
          className={`text-sm font-medium ${
            readiness.ready ? "text-[var(--ok)]" : "text-[var(--danger)]"
          }`}
        >
          {readiness.ready ? "READY" : "NOT READY"}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Readiness means enough information to ask for a governance decision. It is
        not an approval.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {readiness.items.map((item) => (
          <li key={item.key} className="flex justify-between gap-3">
            <span>{item.label}</span>
            <span
              className={
                item.status === "complete"
                  ? "text-[var(--ok)]"
                  : item.status === "warning"
                    ? "text-[var(--warning)]"
                    : "text-[var(--danger)]"
              }
            >
              {item.status === "complete"
                ? "Complete"
                : item.status === "warning"
                  ? "Warning"
                  : "Incomplete"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
