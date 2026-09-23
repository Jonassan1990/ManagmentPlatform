import Link from "next/link";
import type { InitiativeStage } from "@prisma/client";
import { stageLabel } from "@/modules/initiative/application/attention";

const FUTURE = ["PoC", "Pilot", "Project", "PI Planning"] as const;
const ACTIVE: InitiativeStage[] = ["DEMAND", "REQUIREMENTS", "PRE_STUDY"];

export function LifecycleRail({ current }: { current: InitiativeStage }) {
  const currentIndex = ACTIVE.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {ACTIVE.map((stage, index) => {
        const done = index < currentIndex;
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
      {FUTURE.map((label) => (
        <li
          key={label}
          className="rounded-md border border-dashed border-[var(--line)] px-3 py-1.5 text-[var(--muted)]"
          title="Future stage — not available in Phase 2"
        >
          ○ {label}
        </li>
      ))}
    </ol>
  );
}

export function InitiativeTabs({
  initiativeId,
  active,
}: {
  initiativeId: string;
  active:
    | "overview"
    | "demand"
    | "requirements"
    | "pre-study"
    | "risks"
    | "documents"
    | "history";
}) {
  const tabs = [
    ["overview", "Overview"],
    ["demand", "Demand"],
    ["requirements", "Requirements"],
    ["pre-study", "Pre-study"],
    ["risks", "Risks"],
    ["documents", "Documents"],
    ["history", "History"],
  ] as const;

  return (
    <nav className="mb-5 flex flex-wrap gap-1 border-b border-[var(--line)]" aria-label="Initiative sections">
      {tabs.map(([key, label]) => {
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
