"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
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
  /** Highlight the clicked item before the route finishes loading. */
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    setPendingKey(null);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeIfDocked = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeIfDocked);
    return () => desktop.removeEventListener("change", closeIfDocked);
  }, []);

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

      <header className="scania-topbar sticky top-0 z-40 flex min-h-14 items-center justify-between gap-2 px-3 text-white sm:gap-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[4px] text-white hover:bg-white/10 md:hidden"
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
        <div className="mp-shell-actions flex shrink-0 items-center justify-end gap-2">
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
              <SignOutButton />
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
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <aside
          id={navId}
          ref={navPanelRef}
          className={`mp-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col overflow-hidden pt-4 text-white transition-transform duration-300 md:sticky md:top-14 md:z-20 md:h-[calc(100vh-3.5rem)] md:w-60 md:translate-x-0 xl:w-[17rem] ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 pb-4 md:hidden">
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
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-6">
              {groups.map((group) => (
                <NavGroupBlock
                  key={group.id}
                  group={group}
                  expanded={isGroupExpanded(group)}
                  pendingKey={pendingKey}
                  onArm={(key) => setPendingKey(key)}
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
            className="mp-main mp-fade space-y-4 outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function isPlainClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function markPressed(el: HTMLElement, clientX: number, clientY: number) {
  const box = el.getBoundingClientRect();
  el.style.setProperty("--press-x", `${clientX - box.left}px`);
  el.style.setProperty("--press-y", `${clientY - box.top}px`);
  el.classList.remove("is-pressed");
  void el.offsetWidth;
  el.classList.add("is-pressed");
}

function SideLink({
  href,
  selectKey,
  active,
  onArm,
  onNavigate,
  children,
}: {
  href: string;
  selectKey: string;
  active: boolean;
  onArm: (key: string) => void;
  onNavigate: () => void;
  children: ReactNode;
}) {
  const onArmRef = useRef(onArm);
  const keyRef = useRef(selectKey);
  onArmRef.current = onArm;
  keyRef.current = selectKey;
  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const onDown = (event: PointerEvent) => {
      if (!isPlainClick(event)) return;
      // Commit the highlight before click starts Next's navigation transition.
      flushSync(() => onArmRef.current(keyRef.current));
      markPressed(el, event.clientX, event.clientY);
    };
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, []);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (isPlainClick(event)) {
      flushSync(() => onArm(selectKey));
      markPressed(event.currentTarget, event.clientX, event.clientY);
    }
    onNavigate();
  }

  return (
    <Link
      ref={anchorRef}
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      data-nav-key={selectKey}
      className={`mp-side-link min-w-0 flex-1 ${active ? "is-active" : ""}`}
    >
      {children}
    </Link>
  );
}

function NavGlyph({ id }: { id: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (id === "home") {
    return (
      <svg {...common}>
        <path d="M2.5 7.2 8 2.8l5.5 4.4V13a1 1 0 0 1-1 1h-3.2V9.6H6.7V14H3.5a1 1 0 0 1-1-1V7.2Z" />
      </svg>
    );
  }
  if (id === "portfolio") {
    return (
      <svg {...common}>
        <path d="M2.5 12.5V3.5h4l1.2 1.5H13.5v7.5h-11Z" />
      </svg>
    );
  }
  if (id === "initiatives") {
    return (
      <svg {...common}>
        <path d="M3 3.5h10M3 8h10M3 12.5h6" />
      </svg>
    );
  }
  if (id === "pi-planning") {
    return (
      <svg {...common}>
        <rect x="2.5" y="3" width="11" height="10.5" rx="1.2" />
        <path d="M2.5 6.2h11M6 3v3.2" />
      </svg>
    );
  }
  if (id === "governance") {
    return (
      <svg {...common}>
        <path d="M8 2.4 13 4.6v3.4c0 3-2.1 4.8-5 5.6-2.9-.8-5-2.6-5-5.6V4.6L8 2.4Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="5" cy="5.2" r="1.6" />
      <circle cx="11" cy="5.2" r="1.6" />
      <path d="M2.8 12.4c.5-1.6 1.7-2.4 3.2-2.4s2.7.8 3.2 2.4M9.2 10.2c.6-.4 1.3-.6 2-.6 1.4 0 2.5.7 3 2.2" />
    </svg>
  );
}

function NavGroupBlock({
  group,
  expanded,
  pendingKey,
  onArm,
  onToggle,
  onNavigate,
}: {
  group: ResolvedNavGroup;
  expanded: boolean;
  pendingKey: string | null;
  onArm: (key: string) => void;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const hasChildren = group.items.length > 0;
  const panelId = `nav-group-${group.id}`;
  const hubKey = `${group.id}:hub`;
  const selected = (key: string, routeActive: boolean) =>
    pendingKey != null ? pendingKey === key : routeActive;

  if (!hasChildren && group.hubHref) {
    return (
      <SideLink
        href={group.hubHref}
        selectKey={hubKey}
        active={selected(hubKey, group.hubActive)}
        onArm={onArm}
        onNavigate={onNavigate}
      >
        <span className="mp-side-icon">
          <NavGlyph id={group.id} />
        </span>
        {group.label}
      </SideLink>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-stretch gap-1">
        {group.hubHref ? (
          <SideLink
            href={group.hubHref}
            selectKey={hubKey}
            active={selected(hubKey, group.hubActive)}
            onArm={onArm}
            onNavigate={onNavigate}
          >
            <span className="mp-side-icon">
              <NavGlyph id={group.id} />
            </span>
            <span className="truncate">{group.label}</span>
          </SideLink>
        ) : (
          <span className="mp-side-link pointer-events-none min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/60">
            <span className="mp-side-icon">
              <NavGlyph id={group.id} />
            </span>
            {group.label}
          </span>
        )}
        {hasChildren ? (
          <button
            type="button"
            className="mp-side-chevron focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label}`}
            onClick={onToggle}
            onPointerDown={(event) => {
              markPressed(event.currentTarget, event.clientX, event.clientY);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path
                d="M5 3.2 9 7 5 10.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
      {hasChildren ? (
        <div
          id={panelId}
          className="mp-side-children"
          data-open={expanded ? "true" : "false"}
          inert={expanded ? undefined : true}
        >
          <div className="mp-side-children-inner">
            <ul className="space-y-0.5 py-1 pl-7">
              {group.items.map((item) => (
                <li key={item.id}>
                  <SideLink
                    href={item.href}
                    selectKey={item.id}
                    active={selected(item.id, item.active)}
                    onArm={onArm}
                    onNavigate={onNavigate}
                  >
                    {item.label}
                  </SideLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
