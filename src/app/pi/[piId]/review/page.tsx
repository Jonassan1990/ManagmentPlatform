import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { humanize } from "@/components/governance/governance-panels";
import { TransitionPiButtons } from "@/components/pi-planning/pi-forms";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import {
  Breadcrumbs,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiReviewPage({
  params,
}: {
  params: Promise<{ piId: string }>;
}) {
  const { piId } = await params;
  const { authz, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let overview;
  try {
    overview = await planning.getPiOverview(principal, piId);
  } catch {
    notFound();
  }

  const { pi, metrics, attention, conflicts } = overview;
  const capabilities = await resolveCapabilities(
    authz,
    principal,
    pi.organizationId,
  );

  const checklist = [
    {
      ok: metrics.iterationCount > 0,
      label: "Iterations defined",
      detail: `${metrics.iterationCount} iteration(s)`,
    },
    {
      ok: metrics.departmentCount > 0,
      label: "Participating departments",
      detail: `${metrics.departmentCount} department(s), ${metrics.teamCount} team(s)`,
    },
    {
      ok: metrics.blockerConflictCount === 0,
      label: "No blocker conflicts",
      detail:
        metrics.blockerConflictCount === 0
          ? "No blocker conflicts derived"
          : `${metrics.blockerConflictCount} blocker(s) need attention`,
    },
    {
      ok: metrics.overloadTeamSlots === 0,
      label: "No overloaded team slots",
      detail:
        metrics.overloadTeamSlots === 0
          ? "No team×iteration overload"
          : `${metrics.overloadTeamSlots} overloaded slot(s)`,
    },
    {
      ok: metrics.backlogCount === 0 || metrics.allocationCount > 0,
      label: "Allocations present when work exists",
      detail: `${metrics.backlogCount} unallocated · capacity slots with load: ${metrics.allocationCount}`,
    },
    {
      ok: attention.every((a) => a.severity !== "blocker"),
      label: "No structural blockers",
      detail:
        attention.filter((a) => a.severity === "blocker").length === 0
          ? "Structure looks complete"
          : attention
              .filter((a) => a.severity === "blocker")
              .map((a) => a.message)
              .join("; "),
    },
  ];

  const readyForBaseline =
    pi.status === "REVIEW" && checklist.every((c) => c.ok);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning", href: "/pi" },
          { label: pi.referenceKey, href: `/pi/${piId}` },
          { label: "Review" },
        ]}
      />
      <PageHeader
        title="Management review"
        description={`${pi.name} · ${piStatusLabel(pi.status)} — checklist from live conflicts and overview metrics.`}
      />
      <PiTabs piId={piId} active="review" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium">Review checklist</h2>
              <span
                className={`text-sm ${
                  readyForBaseline
                    ? "text-[var(--ok)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {readyForBaseline
                  ? "Ready to baseline"
                  : pi.status !== "REVIEW"
                    ? `Status is ${piStatusLabel(pi.status)}`
                    : "Resolve open items before baselining"}
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className="flex gap-3 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                >
                  <span
                    className={
                      item.ok ? "text-[var(--ok)]" : "text-[var(--danger)]"
                    }
                    aria-hidden
                  >
                    {item.ok ? "✓" : "✗"}
                  </span>
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-[var(--muted)]">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            {pi.status === "REVIEW" && capabilities.canBaselinePi ? (
              <Link
                href={`/pi/${piId}/baseline`}
                className="mt-4 inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Go to baseline
              </Link>
            ) : null}
          </Panel>

          <Panel>
            <h2 className="font-medium">Derived conflicts</h2>
            {conflicts.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No conflicts derived from the current plan.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {conflicts.map((c, i) => (
                  <li
                    key={`${c.type}-${c.subjectId}-${i}`}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      c.severity === "BLOCKER"
                        ? "border-[var(--danger)]/40"
                        : c.severity === "WARNING"
                          ? "border-[var(--warning)]/40"
                          : "border-[var(--line)]"
                    }`}
                  >
                    <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {humanize(c.severity)} · {c.type.replaceAll("_", " ")}
                    </span>
                    <p>{c.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <h2 className="mb-3 font-medium">Status</h2>
            <TransitionPiButtons
              piId={pi.id}
              status={pi.status}
              expectedVersion={pi.version}
              capabilities={capabilities}
            />
          </Panel>
          <Panel>
            <h2 className="font-medium">Links</h2>
            <ul className="mt-2 space-y-2 text-sm">
              <li>
                <Link
                  href={`/pi/${piId}/board`}
                  className="text-[var(--accent)]"
                >
                  Planning board
                </Link>
              </li>
              <li>
                <Link
                  href={`/pi/${piId}/capacity`}
                  className="text-[var(--accent)]"
                >
                  Capacity
                </Link>
              </li>
              <li>
                <Link
                  href={`/pi/${piId}/dependencies`}
                  className="text-[var(--accent)]"
                >
                  Dependencies
                </Link>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
