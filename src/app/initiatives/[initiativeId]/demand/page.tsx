import { notFound, redirect } from "next/navigation";
import { DemandForm } from "@/components/initiative/initiative-forms";
import {
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function DemandPage({
  params,
}: {
  params: Promise<{ initiativeId: string }>;
}) {
  const { initiativeId } = await params;
  const { authz, initiative } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");
  let workspace;
  try {
    workspace = await initiative.getInitiativeWorkspace(principal, initiativeId);
  } catch {
    notFound();
  }
  const item = workspace.initiative;
  if (!item.demand) notFound();

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey, href: `/initiatives/${item.id}` },
          { label: "Demand" },
        ]}
      />
      <PageHeader title={item.title} description={`${item.referenceKey} · Demand`} />
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs initiativeId={item.id} active="demand" />
      <Panel className="max-w-3xl">
        <DemandForm initiativeId={item.id} demand={item.demand} />
      </Panel>
    </div>
  );
}
