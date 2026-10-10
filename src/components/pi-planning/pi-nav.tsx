import Link from "next/link";
import { humanize } from "@/components/governance/governance-panels";
import { appendPreservedQuery } from "@/modules/navigation/return-context";

export const PI_STATUS_ORDER = [
  "DRAFT",
  "PLANNING",
  "REVIEW",
  "BASELINED",
  "ACTIVE",
  "CLOSED",
] as const;

export type PiTabKey =
  | "overview"
  | "board"
  | "compare"
  | "capacity"
  | "dependencies"
  | "review"
  | "baseline"
  | "settings";

const TABS: { key: PiTabKey; label: string; href: (id: string) => string }[] = [
  { key: "overview", label: "Overview", href: (id) => `/pi/${id}` },
  { key: "board", label: "Plan board", href: (id) => `/pi/${id}/board` },
  {
    key: "compare",
    label: "Compare",
    href: (id) => `/pi/${id}/compare`,
  },
  { key: "capacity", label: "Capacity", href: (id) => `/pi/${id}/capacity` },
  {
    key: "dependencies",
    label: "Dependencies",
    href: (id) => `/pi/${id}/dependencies`,
  },
  { key: "review", label: "Review", href: (id) => `/pi/${id}/review` },
  { key: "baseline", label: "Baseline", href: (id) => `/pi/${id}/baseline` },
  { key: "settings", label: "Settings", href: (id) => `/pi/${id}/settings` },
];

/**
 * PI section tabs. Pass `preserveQuery` (page searchParams) so Board → Compare →
 * Review keeps revisionId / revs / ref and validated return context.
 */
export function PiTabs({
  piId,
  active,
  preserveQuery,
}: {
  piId: string;
  active: PiTabKey;
  preserveQuery?:
    | URLSearchParams
    | Record<string, string | string[] | undefined>;
}) {
  return (
    <nav
      aria-label="PI sections"
      className="mb-6 -mx-1 overflow-x-auto border-b border-[var(--line)] pb-3"
    >
      <div className="flex min-w-max flex-nowrap gap-2 px-1">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const href = preserveQuery
          ? appendPreservedQuery(tab.href(piId), preserveQuery)
          : tab.href(piId);
        return (
          <Link
            key={tab.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-md px-3 py-1.5 text-sm whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${
              isActive
                ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      </div>
    </nav>
  );
}

export function piStatusLabel(status: string): string {
  return humanize(status);
}

export function formatHours(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}h`;
}

export function utilizationBarClass(band: string | null | undefined): string {
  switch (band) {
    case "overload":
      return "bg-[var(--danger)]";
    case "near":
      return "bg-[var(--warning)]";
    case "under":
      return "bg-[var(--muted)]";
    case "ok":
      return "bg-[var(--ok)]";
    default:
      return "bg-[var(--line)]";
  }
}

export function dateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
