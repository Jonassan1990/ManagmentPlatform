"use client";

import { signOut } from "next-auth/react";

/** Topbar action — white-on-navy, WorkMesh-style. */
export function SignOutButton() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs text-white/80 hover:bg-white/10 hover:text-white"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </button>
  );
}
