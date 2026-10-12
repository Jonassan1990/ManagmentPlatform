"use client";

import { signIn } from "next-auth/react";
import { buttonClassName } from "@/components/ui/button";

export function SignInButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button
      type="button"
      className={buttonClassName({ variant: "primary" })}
      onClick={() => signIn("oidc", { callbackUrl })}
    >
      Sign in with SSO
    </button>
  );
}
