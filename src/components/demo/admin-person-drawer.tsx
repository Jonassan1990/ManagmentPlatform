"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { setDemoPersonaAction } from "@/app/actions/demo-persona";
import {
  matchesPersonQuery,
  partitionPeopleByGroup,
} from "@/modules/demo/persona-keys";

export type DemoPersonaOption = {
  key: string;
  displayName: string;
  levelLabel: string;
  sees: string;
  username: string;
  group?: "levels" | "department-users" | "sheet-managers" | "managers" | "people";
  optionLabel?: string;
  departmentCode?: string | null;
  role?: string | null;
};

/**
 * Admin drawer: search everyone, open the dashboard as that person,
 * then walk vacation request → manager approval with their permissions.
 */
export function AdminPersonDrawer({
  personas,
  activeKey,
}: {
  personas: DemoPersonaOption[];
  activeKey: string | null;
}) {
  const titleId = useId();
  const searchId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(activeKey ?? "session");
  const shownKey = pending ? selected : (activeKey ?? selected);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
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
    if (!open) return;
    const input = document.getElementById(searchId);
    input?.focus();
  }, [open, searchId]);

  const active = personas.find((persona) => persona.key === shownKey) ?? null;
  const matches = useMemo(() => {
    const rows = personas.filter((persona) =>
      matchesPersonQuery(persona, query),
    );
    const levels = rows.filter((persona) => persona.group === "levels");
    const rest = rows.filter((persona) => persona.group !== "levels");
    const { managers, people } = partitionPeopleByGroup(rest);
    return { levels, managers, people, total: rows.length };
  }, [personas, query]);

  function choose(value: string) {
    const previous = selected;
    setSelected(value);
    setError(null);
    setOpen(false);
    setQuery("");
    startTransition(async () => {
      const result = await setDemoPersonaAction(
        value === "session" ? null : value,
      );
      if (!result.ok) {
        setSelected(previous);
        setError(result.error);
        return;
      }
      const stay = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(stay);
    });
  }

  return (
    <>
      <div className="relative flex min-w-0 max-w-[9.5rem] flex-col items-stretch gap-0.5 xs:max-w-[12rem] sm:max-w-[18rem]">
        <button
          type="button"
          disabled={pending}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? "admin-person-drawer" : undefined}
          className="flex min-h-10 min-w-[5.75rem] items-center justify-between gap-1.5 rounded-[4px] border border-amber-200/50 bg-amber-400/20 px-2 text-left text-xs font-semibold text-amber-50 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60 sm:min-h-9"
          title="Open admin drawer — search people and view the app as them"
          onClick={() => setOpen(true)}
        >
          <span className="min-w-0 truncate">
            {active
              ? `As: ${active.displayName}`
              : (
                <>
                  <span className="sm:hidden">View as</span>
                  <span className="hidden sm:inline">View as person…</span>
                </>
              )}
          </span>
          <span aria-hidden className="shrink-0 text-amber-50/80">
            ▸
          </span>
        </button>
        {error ? (
          <p className="text-[10px] text-red-200" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[60] flex justify-end" role="presentation">
          <button
            type="button"
            aria-label="Close person drawer"
            className="absolute inset-0 bg-black/45"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id="admin-person-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-[61] flex h-full w-[min(24rem,100vw)] flex-col border-l border-white/15 bg-[#041e42] text-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/15 px-4 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-bold">
                  Admin · view as person
                </h2>
                <p className="mt-1 text-xs text-white/70">
                  Search anyone, open their dashboard, send vacation as them,
                  then switch to their manager to approve.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[4px] border border-white/25 text-white hover:bg-white/10"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </header>

            <div className="border-b border-white/15 p-3">
              <label className="sr-only" htmlFor={searchId}>
                Search people
              </label>
              <input
                id={searchId}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, department, or role"
                className="min-h-11 w-full rounded-[4px] border border-white/25 bg-[#0c2340] px-3 text-sm text-white outline-none placeholder:text-white/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <button
                type="button"
                className={`flex min-h-12 w-full items-center px-4 text-left text-sm hover:bg-white/10 ${
                  shownKey === "session" ? "bg-white/15" : ""
                }`}
                onClick={() => choose("session")}
              >
                Signed-in user (exit simulation)
              </button>

              {personas.length === 0 ? (
                <p className="px-4 py-6 text-sm text-white/75">
                  No people are ready yet. Open Vacation plan once (or seed the
                  IT demo) so the roster can sync, then reopen this drawer.
                </p>
              ) : (
                <>
                  <PersonSection
                    title="Org levels"
                    rows={matches.levels}
                    shownKey={shownKey}
                    onChoose={choose}
                  />
                  <PersonSection
                    title="Department managers"
                    rows={matches.managers}
                    shownKey={shownKey}
                    onChoose={choose}
                  />
                  <PersonSection
                    title="People"
                    rows={matches.people}
                    shownKey={shownKey}
                    onChoose={choose}
                  />
                  {matches.total === 0 ? (
                    <p className="px-4 py-6 text-sm text-white/65">No match.</p>
                  ) : null}
                </>
              )}
            </div>

            {active ? (
              <footer className="border-t border-white/15 px-4 py-3 text-xs text-amber-100/90">
                <p className="font-semibold">{active.displayName}</p>
                <p className="mt-0.5 text-white/65">{active.sees}</p>
              </footer>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function PersonSection({
  title,
  rows,
  shownKey,
  onChoose,
}: {
  title: string;
  rows: DemoPersonaOption[];
  shownKey: string;
  onChoose: (key: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="pt-2">
      <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">
        {title}
      </p>
      {rows.map((persona) => (
        <button
          key={persona.key}
          type="button"
          className={`flex min-h-12 w-full flex-col justify-center px-4 text-left hover:bg-white/10 ${
            shownKey === persona.key ? "bg-white/15" : ""
          }`}
          onClick={() => onChoose(persona.key)}
        >
          <span className="truncate text-sm font-medium text-white">
            {persona.displayName}
          </span>
          <span className="truncate text-[11px] text-white/60">
            {[persona.departmentCode, persona.role, persona.username]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </button>
      ))}
    </div>
  );
}

/** @deprecated Prefer AdminPersonDrawer — kept for existing imports. */
export const DemoPersonaSwitcher = AdminPersonDrawer;
