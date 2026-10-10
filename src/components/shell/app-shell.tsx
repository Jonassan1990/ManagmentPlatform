"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  extractActivePiId,
  resolveNavGroups,
} from "@/modules/navigation/nav-definition";
import type {
  ResolvedNavGroup,
  ShellNavCapabilities,
} from "@/modules/navigation/types";
import { RouteFocusMain } from "./route-focus-main";
import { SignOutButton } from "./sign-out-button";

export type ShellPrincipal = {
  displayName: string | null;
  email: string | null;
  source: string;
  hasAccess: boolean;
};

export type ShellNavProps = {
  capabilities: ShellNavCapabilities;
  organizationId: string | null;
};

export function AppShell({
  children,
  principal,
  nav,
}: {
  children: React.ReactNode;
  principal?: ShellPrincipal | null;
  nav: ShellNavProps;
}) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const navId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navPanelRef = useRef<HTMLElement>(null);

  const groups = useMemo(() => {
    return resolveNavGroups(pathname, {
      capabilities: nav.capabilities,
      organizationId: nav.organizationId,
      activePiId: extractActivePiId(pathname),
    });
  }, [pathname, nav.capabilities, nav.organizationId]);

  /** Manual expand/collapse; active route groups always stay open. */
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = navPanelRef.current;
    if (!panel) return;
    const focusable = panel.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [open]);

  function isGroupExpanded(group: ResolvedNavGroup): boolean {
    if (group.containsActive) return true;
    if (manualExpanded[group.id] !== undefined) {
      return manualExpanded[group.id]!;
    }
    return false;
  }

  const label =
    principal?.displayName ||
    principal?.email ||
    (principal ? "Signed in" : null);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <RouteFocusMain />
      {/* First focusable control in document order (WCAG 2.4.1 bypass). */}
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:block focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-md focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--ink)] focus:shadow-md focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        Skip to main content
      </a>
      <aside
        id={navId}
        ref={navPanelRef}
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-[var(--sidebar)] text-[var(--sidebar-ink)] transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg tracking-tight text-white">
              Management Platform
            </p>
            <p className="text-xs text-white/75">Workflow navigation</p>
          </div>
        </div>
        <nav className="space-y-1 p-3" aria-label="Primary">
          {groups.map((group) => (
            <NavGroupBlock
              key={group.id}
              group={group}
              expanded={isGroupExpanded(group)}
              onToggle={() =>
                setManualExpanded((prev) => ({
                  ...prev,
                  [group.id]: !isGroupExpanded(group),
                }))
              }
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="min-w-0" aria-hidden={open ? true : undefined}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              className="min-h-11 rounded-md border border-[var(--line)] px-3 py-1.5 text-sm lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
              aria-controls={navId}
            >
              Menu
            </button>
            <p className="text-sm text-[var(--muted)]">Management workspace</p>
          </div>
          <div className="flex items-center gap-3">
            {label ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-sm text-[var(--ink)]">{label}</p>
                  {principal?.email && principal.displayName ? (
                    <p className="text-xs text-[var(--muted)]">
                      {principal.email}
                    </p>
                  ) : null}
                </div>
                {principal?.source === "oidc" ? <SignOutButton /> : null}
                {principal?.source === "dev" ? (
                  <span className="rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)]">
                    DEV
                  </span>
                ) : null}
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-black/5"
              >
                Sign in
              </Link>
            )}
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="px-4 py-6 outline-none sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function NavGroupBlock({
  group,
  expanded,
  onToggle,
  onNavigate,
}: {
  group: ResolvedNavGroup;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const hasChildren = group.items.length > 0;
  const panelId = `nav-group-${group.id}`;

  // Home / single-hub without children: just a link
  if (!hasChildren && group.hubHref) {
    return (
      <Link
        href={group.hubHref}
        onClick={onNavigate}
        aria-current={group.hubActive ? "page" : undefined}
        className={`block min-h-11 rounded-md px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
          group.hubActive
            ? "bg-[var(--sidebar-active)] text-white"
            : "hover:bg-white/5"
        }`}
      >
        {group.label}
      </Link>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-stretch gap-0.5">
        {group.hubHref ? (
          <Link
            href={group.hubHref}
            onClick={onNavigate}
            aria-current={group.hubActive ? "page" : undefined}
            className={`min-h-11 min-w-0 flex-1 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              group.hubActive
                ? "bg-[var(--sidebar-active)] text-white"
                : "hover:bg-white/5"
            }`}
          >
            {group.label}
          </Link>
        ) : (
          <span className="min-w-0 flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/80">
            {group.label}
          </span>
        )}
        {hasChildren ? (
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-md px-2 text-white/85 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label}`}
            onClick={onToggle}
          >
            <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
          </button>
        ) : null}
      </div>
      {hasChildren && expanded ? (
        <ul id={panelId} className="space-y-0.5 pb-1 pl-2">
          {group.items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={item.active ? "page" : undefined}
                className={`block min-h-11 rounded-md px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  item.active
                    ? "bg-[var(--sidebar-active)] text-white"
                    : "text-white/85 hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
