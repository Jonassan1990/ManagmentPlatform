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

const INFB_DEPT = "a1000000-0000-4000-8000-000000000022";

export function PlatformAdminPanel({
  status,
}: {
  status: PlatformAdminStatusView;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(
    status.demoOrganization?.id ?? null,
  );

  function prepare() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await preparePlatformAdminReadyAction();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      const story = result.data.story;
      setOrgId(result.data.organizationId);
      setMessage(
        story
          ? `INFB demo ready: ${story.initiatives} initiatives, ${story.projects ?? 0} projects, ${story.pendingVacations} pending leave, ${story.castCount} people.`
          : `Ready: ${result.data.peopleCount} people synced.`,
      );
      router.refresh();
    });
  }

  const portfolioHref = orgId
    ? `/portfolio?organizationId=${orgId}&departmentId=${INFB_DEPT}`
    : "/portfolio";
  const initiativesHref = orgId
    ? `/initiatives?organizationId=${orgId}`
    : "/initiatives";

  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="text-base font-semibold text-[var(--ink)]">
          Platform setup
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Seed the INFB team portfolio: Demand → Requirements → Pre-study → PoC
          → Projects with owners, status, and cost.
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
            {pending ? "Seeding INFB demo…" : "Prepare INFB manager demo"}
          </button>
          <Link
            href={portfolioHref}
            className={buttonClassName({ variant: "secondary" })}
          >
            Open INFB Portfolio
          </Link>
          <Link
            href={initiativesHref}
            className={buttonClassName({ variant: "secondary" })}
          >
            Open Initiatives
          </Link>
          <Link
            href="/approvals"
            className={buttonClassName({ variant: "secondary" })}
          >
            Open Approvals
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
          What gets created for INFB
        </h2>
        <ul className="space-y-2 text-sm text-[var(--ink)]">
          <li>
            <strong>Demand</strong> — Spare-parts QR labels (~€45k)
          </li>
          <li>
            <strong>Requirements</strong> — Shift handover checklist (~€90k)
          </li>
          <li>
            <strong>Pre-study</strong> — Technician skill matrix (~€160k) with
            buy vs build alternatives
          </li>
          <li>
            <strong>PoC</strong> — AR work-instruction glasses (~€35k)
          </li>
          <li>
            <strong>Projects</strong> — Maintenance mobile app (€210k budget /
            €198k forecast / €82k actual) and Supervisor live board (€75k)
            with milestones, work items, owners, and blockers
          </li>
        </ul>
        <p className="mt-3 text-sm text-[var(--muted)]">
          After Prepare: View as <strong>Bo (Demo Manager)</strong>, open
          Portfolio filtered to INFB — or use the buttons above.
        </p>
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
