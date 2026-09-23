import { notFound, redirect } from "next/navigation";
import {
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { stageLabel } from "@/modules/initiative/application/attention";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
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

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey, href: `/initiatives/${item.id}` },
          { label: "History" },
        ]}
      />
      <PageHeader
        title={item.title}
        description={`${item.referenceKey} · Lifecycle history`}
      />
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs initiativeId={item.id} active="history" />
      <Panel>
        <h2 className="mb-3 font-medium">Lifecycle transitions</h2>
        {item.lifecycleTransitions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No transitions yet. The initiative is in {stageLabel(item.currentStage)}.
          </p>
        ) : (
          <ol className="space-y-3 text-sm">
            {item.lifecycleTransitions.map((t) => (
              <li key={t.id} className="border-b border-[var(--line)] pb-3">
                <p className="font-medium">
                  {stageLabel(t.fromStage)} → {stageLabel(t.toStage)}
                </p>
                <p className="text-[var(--muted)]">
                  {t.occurredAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                  {t.comment ? ` · ${t.comment}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
