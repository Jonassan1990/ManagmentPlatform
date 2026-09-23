import Link from "next/link";
import { humanize } from "@/components/governance/governance-panels";

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
  | "capacity"
  | "dependencies"
  | "review"
  | "baseline"
  | "settings";

const TABS: { key: PiTabKey; label: string; href: (id: string) => string }[] = [
  { key: "overview", label: "Overview", href: (id) => `/pi/${id}` },
  { key: "board", label: "Planning board", href: (id) => `/pi/${id}/board` },
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

export function PiTabs({
  piId,
  active,
}: {
  piId: string;
  active: PiTabKey;
}) {
  return (
    <nav
      aria-label="PI sections"
      className="mb-6 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href(piId)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              isActive
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
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
