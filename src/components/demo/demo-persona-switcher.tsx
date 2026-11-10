"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { setDemoPersonaAction } from "@/app/actions/demo-persona";

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

export function DemoPersonaSwitcher({
  personas,
  activeKey,
}: {
  personas: DemoPersonaOption[];
  activeKey: string | null;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(activeKey ?? "session");
  const shownKey = pending ? selected : (activeKey ?? selected);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = personas.find((persona) => persona.key === shownKey) ?? null;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = personas.filter((persona) => {
      if (!needle) return true;
      return [
        persona.displayName,
        persona.levelLabel,
        persona.optionLabel,
        persona.username,
        persona.departmentCode,
        persona.role,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
    const managers = rows.filter(
      (persona) =>
        persona.group === "managers" || persona.group === "sheet-managers",
    );
    const people = rows.filter(
      (persona) =>
        persona.group !== "managers" && persona.group !== "sheet-managers",
    );
    return { managers, people, total: rows.length };
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

  if (personas.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="relative flex min-w-0 max-w-[14rem] flex-col items-stretch gap-0.5 sm:max-w-[22rem] min-[1920px]:max-w-[30rem]"
    >
      <label className="sr-only" htmlFor="person-switcher-trigger">
        Switch person
      </label>
      <button
        id="person-switcher-trigger"
        type="button"
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="flex min-h-9 items-center justify-between gap-2 rounded-[4px] border border-white/30 bg-[#0c2340] px-2 text-left text-xs font-semibold text-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
        title={active?.sees ?? "Search and open a person from the vacation plan"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 truncate">
          {active?.optionLabel ?? active?.displayName ?? "Signed-in user"}
        </span>
        <span aria-hidden className="shrink-0 text-white/70">
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute right-0 top-[calc(100%+0.25rem)] z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-[6px] border border-white/20 bg-[#0c2340] shadow-lg"
        >
          <div className="border-b border-white/15 p-2">
            <label className="sr-only" htmlFor="person-switcher-search">
              Search people
            </label>
            <input
              id="person-switcher-search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or department"
              className="min-h-10 w-full rounded-[4px] border border-white/25 bg-[#041e42] px-3 text-sm text-white outline-none placeholder:text-white/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            <button
              type="button"
              role="option"
              aria-selected={shownKey === "session"}
              className="flex min-h-10 w-full items-center px-3 text-left text-sm text-white hover:bg-white/10"
              onClick={() => choose("session")}
            >
              Signed-in user (no simulation)
            </button>
            {matches.managers.length > 0 ? (
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                Department managers
              </p>
            ) : null}
            {matches.managers.map((persona) => (
              <PersonaOptionButton
                key={persona.key}
                persona={persona}
                selected={shownKey === persona.key}
                onChoose={choose}
              />
            ))}
            {matches.people.length > 0 ? (
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                People
              </p>
            ) : null}
            {matches.people.map((persona) => (
              <PersonaOptionButton
                key={persona.key}
                persona={persona}
                selected={shownKey === persona.key}
                onChoose={choose}
              />
            ))}
            {matches.total === 0 ? (
              <p className="px-3 py-3 text-sm text-white/65">No match.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeKey && active ? (
        <p className="hidden truncate text-[10px] text-white/70 lg:block">
          {active.sees}
        </p>
      ) : (
        <p className="hidden text-[10px] text-white/60 lg:block">
          Search people from the plan
        </p>
      )}
      {error ? (
        <p className="text-[10px] text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PersonaOptionButton({
  persona,
  selected,
  onChoose,
}: {
  persona: DemoPersonaOption;
  selected: boolean;
  onChoose: (key: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`flex min-h-10 w-full flex-col justify-center px-3 text-left hover:bg-white/10 ${
        selected ? "bg-white/15" : ""
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
  );
}
