"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { preparePlatformAdminReadyAction } from "@/app/actions/platform-admin";
import { buttonClassName } from "@/components/ui/button";
import { Panel } from "@/components/ui/page";

export type PlatformAdminStatusView = {
  organizationCount: number;
  sheetPeopleCount: number;
  sheetBindingCount: number;
  hasPlatformAdmin: boolean;
  hasOrganizationAdmin: boolean;
  demoOrganization: { id: string; name: string } | null;
  personaSwitchEnabled: boolean;
};

export function PlatformAdminPanel({
  status,
}: {
  status: PlatformAdminStatusView;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function prepare() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await preparePlatformAdminReadyAction();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMessage(
        `Ready: ${result.data.peopleCount} people synced in ${result.data.departmentCount} departments.`,
      );
      router.refresh();
    });
  }

  const peopleOk =
    status.sheetPeopleCount > 0 && status.sheetBindingCount > 0;

  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="text-base font-semibold text-[var(--ink)]">
          Platform setup
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Configure the organization, people, and roles so View as person and
          vacation approvals work.
        </p>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          <StatusRow
            ok={status.hasPlatformAdmin}
            label="Your platform admin access"
          />
          <StatusRow
            ok={status.hasOrganizationAdmin}
            label="Your organization admin access"
          />
          <StatusRow
            ok={status.organizationCount > 0}
            label={`Organizations (${status.organizationCount})`}
          />
          <StatusRow
            ok={peopleOk}
            label={`View-as people with roles (${status.sheetPeopleCount} people / ${status.sheetBindingCount} roles)`}
          />
          <StatusRow
            ok={status.personaSwitchEnabled}
            label="View as person switch enabled"
          />
        </ul>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={prepare}
            className={buttonClassName({ variant: "primary" })}
          >
            {pending
              ? "Preparing…"
              : peopleOk
                ? "Refresh people & roles"
                : "Prepare org, people & roles"}
          </button>
          {status.demoOrganization ? (
            <Link
              href={`/organization/${status.demoOrganization.id}/admin`}
              className={buttonClassName({ variant: "secondary" })}
            >
              Open org admin config
            </Link>
          ) : null}
          <Link
            href="/organization/setup"
            className={buttonClassName({ variant: "secondary" })}
          >
            Create organization
          </Link>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 text-sm text-emerald-800" role="status">
            {message}
          </p>
        ) : null}
      </Panel>

      <Panel>
        <h2 className="mb-2 text-base font-semibold text-[var(--ink)]">
          How to use after setup
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--ink)]">
          <li>
            Click <strong>Prepare org, people & roles</strong> once.
          </li>
          <li>
            Use the amber <strong>View as</strong> button in the header, pick an
            employee, and open Vacation to request leave.
          </li>
          <li>
            Switch to their manager in View as, then open Approvals to accept.
          </li>
          <li>
            For roles, departments, and logins use{" "}
            <strong>Open org admin config</strong>.
          </li>
        </ol>
      </Panel>
    </div>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2 rounded-[4px] border border-[var(--line)] px-3 py-2 text-sm">
      <span
        aria-hidden
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
          ok ? "bg-emerald-600" : "bg-amber-500"
        }`}
      >
        {ok ? "✓" : "!"}
      </span>
      <span className="text-[var(--ink)]">{label}</span>
    </li>
  );
}
