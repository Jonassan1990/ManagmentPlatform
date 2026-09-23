import { notFound, redirect } from "next/navigation";
import { CapacityPanels } from "@/components/pi-planning/capacity-panels";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiCapacityPage({
  params,
}: {
  params: Promise<{ piId: string }>;
}) {
  const { piId } = await params;
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
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning", href: "/pi" },
          { label: pi.referenceKey, href: `/pi/${piId}` },
          { label: "Capacity" },
        ]}
      />
      <PageHeader
        title="Capacity"
        description={`${pi.name} · ${piStatusLabel(pi.status)} — team and resource utilization by iteration.`}
      />
      <PiTabs piId={piId} active="capacity" />
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
