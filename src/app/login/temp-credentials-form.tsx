"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { TEMP_AUTH_PROVIDER_ID } from "@/modules/identity-access/application/temp-auth-constants";

export function TempCredentialsForm({ callbackUrl }: { callbackUrl: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setError(null);
        setPending(true);
        const fd = new FormData(e.currentTarget);
        const username = String(fd.get("username") ?? "");
        const password = String(fd.get("password") ?? "");
        try {
          const result = await signIn(TEMP_AUTH_PROVIDER_ID, {
            username,
            password,
            redirect: false,
            callbackUrl,
          });
          if (result?.error) {
            setError("Invalid username or password.");
            setPending(false);
            return;
          }
          window.location.href = result?.url || callbackUrl || "/";
        } catch {
          setError("Sign-in failed. Try again.");
          setPending(false);
        }
      }}
    >
      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Username</span>
        <input
          name="username"
          autoComplete="username"
          required
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
