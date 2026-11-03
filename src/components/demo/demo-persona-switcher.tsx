"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setDemoPersonaAction } from "@/app/actions/demo-persona";
import type { DemoPersonaKey } from "@/modules/demo/it-hierarchy-demo";

export type DemoPersonaOption = {
  key: DemoPersonaKey;
  displayName: string;
  levelLabel: string;
  sees: string;
  username: string;
};

export function DemoPersonaSwitcher({
  personas,
  activeKey,
}: {
  personas: DemoPersonaOption[];
  activeKey: DemoPersonaKey | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (personas.length === 0) return null;

  return (
    <div className="flex min-w-0 max-w-[16rem] flex-col items-stretch gap-0.5 sm:max-w-[18rem]">
      <label className="sr-only" htmlFor="demo-persona-switcher">
        Simulate user level
      </label>
      <select
        id="demo-persona-switcher"
        className="min-h-9 rounded-[4px] border border-white/30 bg-[#0c2340] px-2 text-xs font-semibold text-white outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
        disabled={pending}
        value={activeKey ?? "session"}
        title={
          personas.find((persona) => persona.key === activeKey)?.sees ??
          "Simulate what each manager level can see"
        }
        onChange={(event) => {
          const value = event.target.value;
          setError(null);
          startTransition(async () => {
            const result = await setDemoPersonaAction(
              value === "session" ? null : value,
            );
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        <option value="session">Signed-in user (no simulation)</option>
        {personas.map((persona) => (
          <option key={persona.key} value={persona.key}>
            {persona.levelLabel} — {persona.displayName}
          </option>
        ))}
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
