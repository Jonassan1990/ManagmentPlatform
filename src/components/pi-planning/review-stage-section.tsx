"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import type { PiWorkflowStageStatus } from "@/modules/pi-planning/application/pi-planning-workflow";

export function ReviewStageSection({
  title,
  description,
  status,
  defaultOpen,
  emphasize,
  children,
}: {
  title: string;
  description?: string;
  status: PiWorkflowStageStatus;
  defaultOpen: boolean;
  emphasize?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const statusLabel =
    status === "completed"
      ? "Completed"
      : status === "current"
        ? "Current step"
        : status === "blocked"
          ? "Blocked"
          : status === "available"
            ? "Available"
            : "Upcoming";

  return (
    <section
      className={`mb-4 rounded-[var(--radius-md)] border ${
        emphasize
          ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
          : "border-[var(--line)]"
      } bg-[var(--surface)]`}
      data-stage-status={status}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left sm:px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--ink)]">
            {title}
          </span>
          {description ? (
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              {description}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {statusLabel}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {open ? "Hide" : "Show"}
          </span>
        </span>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-[var(--line)] px-1 pb-1 pt-0 sm:px-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function ReviewJourneyNav({
  boardHref,
  compareHref,
  reviewHref,
  baselineHref,
}: {
  boardHref: string;
  compareHref: string;
  reviewHref: string;
  baselineHref: string;
}) {
  const links = [
    { href: boardHref, label: "← Board" },
    { href: compareHref, label: "Compare" },
    { href: reviewHref, label: "Review", current: true },
    { href: baselineHref, label: "Baseline →" },
  ];
  return (
    <nav
      aria-label="Planning journey"
      className="mb-4 flex flex-wrap gap-2"
    >
      {links.map((link) => (
        <Link
          key={link.href + link.label}
          href={link.href}
          aria-current={link.current ? "page" : undefined}
          className={`rounded-[var(--radius-md)] border px-2.5 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
            link.current
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface)]"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
