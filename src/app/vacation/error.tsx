"use client";

import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";

export default function VacationError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-md border border-[var(--line)] bg-white p-6">
      <h1 className="mp-page-title text-[var(--scania-blue-900)]">
        Vacation couldn&apos;t load
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        The vacation page hit a server error. Reload to try again.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClassName({ variant: "primary" })}
          onClick={() => reset()}
        >
          Reload
        </button>
        <Link href="/vacation" className={buttonClassName({ variant: "secondary" })}>
          Back to vacation
        </Link>
      </div>
    </div>
  );
}
