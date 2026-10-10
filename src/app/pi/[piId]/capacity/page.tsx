import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CapacityPanels } from "@/components/pi-planning/capacity-panels";
import { PiTabs } from "@/components/pi-planning/pi-nav";
import {
  CapacityKpiStrip,
  PiPlanningContextHeader,
} from "@/components/pi-planning/pi-planning-workspace";
import { Breadcrumbs } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { buildPiTrail } from "@/modules/navigation/breadcrumbs";
import {
  appendPreservedQuery,
  parseReturnContext,
} from "@/modules/navigation/return-context";
import { summarizeCapacityFromViews } from "@/modules/pi-planning/application/pi-planning-presentation";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiCapacityPage({
  params,
  searchParams,
}: {
  params: Promise<{ piId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { piId } = await params;
  const query = await searchParams;
  const returnContext = parseReturnContext(query);
  const { authz, organization, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let pi;
  let views;
  let conflicts: { severity: string }[] = [];
  try {
    pi = await planning.getProgramIncrement(principal, piId);
    views = await planning.getCapacityViews(principal, piId);
    try {
      const overview = await planning.getPiOverview(principal, piId);
      conflicts = overview.conflicts ?? [];
    } catch {
      conflicts = [];
    }
  } catch {
    notFound();
  }

  const capabilities = await resolveCapabilities(
    authz,
    principal,
    pi.organizationId,
  );

  let resourceOptions: { id: string; name: string }[] = [];
  try {
    const resources = await organization.listResources(
      principal,
      pi.organizationId,
    );
    resourceOptions = resources.map((r) => ({
      id: r.id,
      name: r.name,
    }));
  } catch {
    resourceOptions = [
      ...new Map(
        views.resources.map((r) => [
          r.resourceId,
          { id: r.resourceId, name: r.resourceName },
        ]),
      ).values(),
    ];
  }

  const capacity = summarizeCapacityFromViews({
    teams: views.teams,
    blockerConflictCount: conflicts.filter((c) => c.severity === "BLOCKER")
      .length,
  });

  const boardHref = appendPreservedQuery(`/pi/${piId}/board`, query);

  return (
    <div>
      <Breadcrumbs
        items={buildPiTrail({
          piId,
          referenceKey: pi.referenceKey,
          name: pi.name,
          leaf: "Capacity",
          returnContext,
        })}
      />
      <PiPlanningContextHeader
        piReference={pi.referenceKey}
        piName={pi.name}
        piStatus={pi.status}
        startDate={pi.startDate}
        endDate={pi.endDate}
        teamCount={views.teams.length}
        revision={{
          isCurrent: true,
          label: "Current plan",
          key: "CURRENT",
          status: "ACTIVE_PLAN",
        }}
        capacity={capacity}
        canAllocate={capabilities.canAllocatePi}
        capacityHref={null}
        compareHref={appendPreservedQuery(`/pi/${piId}/compare`, query)}
      />
      <div className="mb-4">
        <Link
          href={boardHref}
          className="inline-flex min-h-11 items-center text-sm text-[var(--color-accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Open plan board
        </Link>
        <span className="mx-2 text-[var(--muted)]">·</span>
        <Link
          href={`/portfolio/capacity?organizationId=${pi.organizationId}&piId=${piId}`}
          className="inline-flex min-h-11 items-center text-sm text-[var(--color-accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          Portfolio Capacity
        </Link>
      </div>
      <PiTabs piId={piId} active="capacity" preserveQuery={query} />
      <CapacityKpiStrip capacity={capacity} />
      <CapacityPanels
        piId={piId}
        iterations={pi.iterations.map((it) => ({
          id: it.id,
          name: it.name,
          sequence: it.sequence,
        }))}
        teams={views.teams}
        resources={views.resources}
        resourceOptions={resourceOptions}
        capabilities={capabilities}
      />
    </div>
  );
}
