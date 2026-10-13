"use client";

import { signOut } from "next-auth/react";

/** Topbar action — white-on-navy, WorkMesh-style. Shown for all signed-in sources. */
export function SignOutButton() {
  return (
    <button
      type="button"
      className="inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-[4px] border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/15"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </button>
  );
}
