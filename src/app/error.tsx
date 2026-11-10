"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClassName } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app.error]", {
      name: error.name,
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-md border border-[var(--line)] bg-white p-6">
      <h1 className="mp-page-title text-[var(--scania-blue-900)]">
        This page couldn&apos;t load
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        A server error occurred. Reload to try again.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          ERROR {error.digest}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClassName({ variant: "primary" })}
          onClick={() => reset()}
        >
          Reload
        </button>
        <Link href="/" className={buttonClassName({ variant: "secondary" })}>
          Home
        </Link>
      </div>
    </div>
  );
}
