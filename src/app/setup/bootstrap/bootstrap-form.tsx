"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { consumeBootstrapAction } from "@/app/actions/bootstrap";

export function BootstrapForm({ principalLabel }: { principalLabel: string }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await consumeBootstrapAction(token);
          if (!result.ok) {
            setError(result.error.message);
            return;
          }
          router.push("/");
          router.refresh();
        });
      }}
    >
      <p className="text-sm text-[var(--muted)]">
        Signed in as <span className="text-[var(--ink)]">{principalLabel}</span>.
        The token can be used only once.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Bootstrap setup token</span>
        <input
          type="password"
          name="token"
          autoComplete="off"
          required
          minLength={16}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Consume bootstrap token"}
      </button>
    </form>
  );
}
