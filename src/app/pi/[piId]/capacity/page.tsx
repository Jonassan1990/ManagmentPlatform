import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CapacityPanels } from "@/components/pi-planning/capacity-panels";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { buildPiTrail } from "@/modules/navigation/breadcrumbs";
import { parseReturnContext } from "@/modules/navigation/return-context";
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
  try {
    pi = await planning.getProgramIncrement(principal, piId);
    views = await planning.getCapacityViews(principal, piId);
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
      <PageHeader
        title="Capacity"
        description={`${pi.name} · ${piStatusLabel(pi.status)} — change planning commitments by iteration. For portfolio-wide resource coordination, open Portfolio Capacity.`}
        actions={
          <Link
            href={`/portfolio/capacity?organizationId=${pi.organizationId}&piId=${piId}`}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Portfolio Capacity
          </Link>
        }
      />
      <PiTabs piId={piId} active="capacity" preserveQuery={query} />
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
