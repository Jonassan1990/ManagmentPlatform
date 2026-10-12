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

/**
 * WorkMesh-style chrome: full-width navy topbar + sticky blue-900 sidebar.
 * Inspired by Jonassan1990/projectmanagement (Scania Tegel CSS tokens).
 */
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
    <div className="tegel-rm min-h-screen bg-[var(--scania-grey-50)] text-[var(--ink)]">
      <RouteFocusMain />
      {/* First focusable control in document order (WCAG 2.4.1 bypass). */}
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:block focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-[4px] focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--ink)] focus:shadow-md focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        Skip to main content
      </a>

      <header className="scania-topbar sticky top-0 z-40 flex h-14 items-center justify-between gap-3 px-4 text-white lg:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            className="rounded-[4px] p-1.5 text-white hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls={navId}
          >
            <span aria-hidden className="block text-lg leading-none">
              ☰
            </span>
          </button>
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 no-underline"
            aria-label="Management Platform home"
          >
            <div className="tegel-shell-mark" aria-hidden>
              M
            </div>
            <div className="tegel-shell-brand min-w-0">
              Management
              <small>Scania Tegel · Resource Ops</small>
            </div>
          </Link>
        </div>
        <div className="flex min-w-0 max-w-[min(100%,48rem)] flex-wrap items-center justify-end gap-2 sm:gap-3">
          {label ? (
            <>
              <span
                className="hidden max-w-[12rem] truncate text-xs text-white/85 md:inline"
                title={label}
              >
                {label}
              </span>
              {principal?.email && principal.displayName ? (
                <span className="hidden truncate text-xs text-white/65 lg:inline">
                  {principal.email}
                </span>
              ) : null}
              {principal?.source === "oidc" ? <SignOutButton /> : null}
              {principal?.source === "dev" ? (
                <span className="rounded-[4px] border border-white/25 bg-white/10 px-2 py-1 text-xs font-semibold text-white/90">
                  DEV
                </span>
              ) : null}
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-9 items-center rounded-[4px] border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/15"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-56px)]">
        {open ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <aside
          id={navId}
          ref={navPanelRef}
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-[var(--scania-blue-900)] pt-4 text-white transition-transform lg:sticky lg:top-14 lg:z-20 lg:h-[calc(100vh-56px)] lg:w-64 lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 pb-4 lg:hidden">
            <span className="font-bold">Navigation</span>
            <button
              type="button"
              className="rounded-[4px] p-2 hover:bg-white/10"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          <nav
            className="flex min-h-0 flex-1 flex-col"
            aria-label="Primary"
          >
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
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
            </div>
          </nav>
        </aside>

        <div
          className="tegel-canvas min-w-0 flex-1"
          aria-hidden={open ? true : undefined}
        >
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto max-w-[1500px] space-y-4 px-4 py-6 outline-none sm:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>
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
        className={`block min-h-11 rounded-[4px] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
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
            className={`min-h-11 min-w-0 flex-1 rounded-[4px] px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
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
            className="min-h-11 min-w-11 rounded-[4px] px-2 text-white/85 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
                className={`block min-h-11 rounded-[4px] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
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
