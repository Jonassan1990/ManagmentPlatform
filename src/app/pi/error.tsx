"use client";

import { buttonClassName } from "@/components/ui/button";

export default function PiPlanningError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-md border border-[var(--line)] bg-white p-6">
      <h1 className="mp-page-title text-[var(--scania-blue-900)]">
        PI Planning couldn&apos;t load
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        A server error occurred while loading Program Increments. Reload to try
        again.
      </p>
      <button
        type="button"
        className={`${buttonClassName({ variant: "primary" })} mt-4`}
        onClick={() => reset()}
      >
        Reload
      </button>
    </div>
  );
}
