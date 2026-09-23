import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  TransitionPiButtons,
} from "@/components/pi-planning/pi-forms";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import {
  Breadcrumbs,
  PageHeader,
  Panel,
} from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiOverviewPage({
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

  const nextActions: { href: string; label: string; detail: string }[] = [];
  if (pi.status === "DRAFT") {
    nextActions.push({
      href: `/pi/${piId}/settings`,
      label: "Set up structure",
      detail: "Add iterations and participating departments/teams",
    });
    if (capabilities.canTransitionPi) {
      nextActions.push({
        href: `/pi/${piId}`,
        label: "Enter planning",
        detail: "Transition DRAFT → PLANNING when structure is ready",
      });
    }
  }
  if (pi.status === "PLANNING" || pi.status === "DRAFT") {
    nextActions.push({
      href: `/pi/${piId}/board`,
      label: "Open planning board",
      detail: "Allocate work across teams and iterations",
    });
  }
  if (pi.status === "PLANNING" && capabilities.canTransitionPi) {
    nextActions.push({
      href: `/pi/${piId}`,
      label: "Send to review",
      detail: "Transition PLANNING → REVIEW for management check",
    });
  }
  if (pi.status === "REVIEW") {
    nextActions.push({
      href: `/pi/${piId}/review`,
      label: "Management review",
      detail: "Walk conflicts and checklist before baselining",
    });
    if (capabilities.canBaselinePi) {
      nextActions.push({
        href: `/pi/${piId}/baseline`,
        label: "Create baseline",
        detail: "Freeze the plan from Review",
      });
    }
  }

  const metricCards = [
    { label: "Iterations", value: metrics.iterationCount },
    { label: "Departments", value: metrics.departmentCount },
    { label: "Teams", value: metrics.teamCount },
    { label: "Backlog items", value: metrics.backlogCount },
    { label: "Conflicts", value: metrics.conflictCount },
    { label: "Blocker conflicts", value: metrics.blockerConflictCount },
    { label: "Overloaded team slots", value: metrics.overloadTeamSlots },
    { label: "Near-capacity slots", value: metrics.nearCapacityTeamSlots },
    { label: "Baselines", value: metrics.baselineCount },
  ];

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning", href: "/pi" },
          { label: pi.referenceKey },
        ]}
      />
      <PageHeader
        title={pi.name}
        description={`${pi.referenceKey} · ${piStatusLabel(pi.status)} · ${pi.startDate.toISOString().slice(0, 10)} → ${pi.endDate.toISOString().slice(0, 10)}`}
        actions={
          <Link
            href={`/pi/${piId}/board`}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Planning board
          </Link>
        }
      />
      <PiTabs piId={piId} active="overview" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metricCards.map((m) => (
              <Panel key={m.label}>
                <p className="text-sm text-[var(--muted)]">{m.label}</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl">
                  {m.value}
                </p>
              </Panel>
            ))}
          </div>

          <Panel>
            <h2 className="font-medium">Attention</h2>
            {attention.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No structural attention items right now.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {attention.map((item) => (
                  <li
                    key={item.key}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      item.severity === "blocker"
                        ? "border-[var(--danger)]/40 text-[var(--danger)]"
                        : item.severity === "warning"
                          ? "border-[var(--warning)]/40 text-[var(--warning)]"
                          : "border-[var(--line)] text-[var(--muted)]"
                    }`}
                  >
                    {item.message}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {conflicts.filter((c) => c.severity === "BLOCKER").length > 0 ? (
            <Panel>
              <h2 className="font-medium">Blocker conflicts</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {conflicts
                  .filter((c) => c.severity === "BLOCKER")
                  .slice(0, 8)
                  .map((c, i) => (
                    <li key={`${c.type}-${c.subjectId}-${i}`}>
                      <span className="text-[var(--danger)]">{c.message}</span>
                    </li>
                  ))}
              </ul>
              <Link
                href={`/pi/${piId}/review`}
                className="mt-3 inline-block text-sm text-[var(--accent)]"
              >
                Open full review checklist →
              </Link>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel>
            <h2 className="mb-3 font-medium">Status transition</h2>
            <TransitionPiButtons
              piId={pi.id}
              status={pi.status}
              expectedVersion={pi.version}
              capabilities={capabilities}
            />
          </Panel>
          <Panel>
            <h2 className="font-medium">Next actions</h2>
            {nextActions.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Continue on the board, capacity, or baseline pages as needed.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {nextActions.map((a) => (
                  <li key={a.label}>
                    <Link
                      href={a.href}
                      className="font-medium text-[var(--accent)]"
                    >
                      {a.label}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{a.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
