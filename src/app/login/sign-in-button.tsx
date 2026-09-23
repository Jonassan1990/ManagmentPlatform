"use client";

import { signIn } from "next-auth/react";

export function SignInButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button
      type="button"
      className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      onClick={() => signIn("oidc", { callbackUrl })}
    >
      Sign in with SSO
    </button>
  );
}
