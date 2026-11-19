"use client";

import { useTransition } from "react";
import { setDemoPersonaAction } from "@/app/actions/demo-persona";
import { buttonClassName } from "@/components/ui/button";

export function ExitViewAsButton() {
  const [pending, startTransition] = useTransition();

  function exit() {
    startTransition(async () => {
      await setDemoPersonaAction(null);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/admin");
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={exit}
      className={buttonClassName({ variant: "primary" })}
    >
      {pending ? "Exiting…" : "Exit View as → Admin"}
    </button>
  );
}
