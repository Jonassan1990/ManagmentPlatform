"use client";

import { useState, useTransition } from "react";
import { setDemoPersonaAction } from "@/app/actions/demo-persona";
import type { DemoPersonaKey } from "@/modules/demo/it-hierarchy-demo";

export type DemoPersonaOption = {
  key: DemoPersonaKey;
  displayName: string;
  levelLabel: string;
  sees: string;
  username: string;
  group?: "levels" | "department-users";
  optionLabel?: string;
};

export function DemoPersonaSwitcher({
  personas,
  activeKey,
}: {
  personas: DemoPersonaOption[];
  activeKey: DemoPersonaKey | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(activeKey ?? "session");

  if (personas.length === 0) return null;

  return (
    <div className="flex min-w-0 max-w-[11rem] flex-col items-stretch gap-0.5 sm:max-w-[20rem] min-[1920px]:max-w-[28rem]">
      <label className="sr-only" htmlFor="demo-persona-switcher">
        Simulate user level
      </label>
      <select
        id="demo-persona-switcher"
        className="min-h-9 rounded-[4px] border border-white/30 bg-[#0c2340] px-2 text-xs font-semibold text-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
        disabled={pending}
        value={selected}
        title={
          personas.find((persona) => persona.key === selected)?.sees ??
          "Simulate what each person can see"
        }
        onChange={(event) => {
          const value = event.target.value;
          const previous = selected;
          setSelected(value);
          setError(null);
          startTransition(async () => {
            const result = await setDemoPersonaAction(
              value === "session" ? null : value,
            );
            if (!result.ok) {
              setSelected(previous);
              setError(result.error);
              return;
            }
            // Stay on this URL, but load it again so the new role's view
            // replaces the previous one. router.refresh() keeps the old page.
            const stay = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign(stay);
          });
        }}
      >
        <option value="session">Signed-in user (no simulation)</option>
        <optgroup label="Manager levels">
          {personas
            .filter((persona) => persona.group !== "department-users")
            .map((persona) => (
              <option key={persona.key} value={persona.key}>
                {persona.optionLabel ??
                  `${persona.levelLabel} — ${persona.displayName}`}
              </option>
            ))}
        </optgroup>
        <optgroup label="Department test users">
          {personas
            .filter((persona) => persona.group === "department-users")
            .map((persona) => (
              <option key={persona.key} value={persona.key}>
                {persona.optionLabel ??
                  `${persona.displayName} — ${persona.levelLabel}`}
              </option>
            ))}
        </optgroup>
      </select>
      {activeKey ? (
        <p className="hidden truncate text-[10px] text-white/70 lg:block">
          {personas.find((persona) => persona.key === activeKey)?.sees}
        </p>
      ) : (
        <p className="hidden text-[10px] text-white/60 lg:block">
          Simulate user level
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
