import { notFound, redirect } from "next/navigation";
import { CreateRiskForm } from "@/components/initiative/initiative-forms";
import {
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { buildInitiativeTrail } from "@/modules/navigation/breadcrumbs";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function RisksPage({
  params,
  searchParams,
}: {
  params: Promise<{ initiativeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { initiativeId } = await params;
  const query = await searchParams;
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
        items={buildInitiativeTrail({
          initiativeId: item.id,
          referenceKey: item.referenceKey,
          title: item.title,
          leaf: "Risks",
        })}
      />
      <PageHeader title={item.title} description={`${item.referenceKey} · Risks`} />
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs
        initiativeId={item.id}
        active="risks"
        currentStage={item.currentStage}
        hasGovernance={item.governanceGates.length > 0}
        hasPoC={Boolean(item.poc)}
        hasPilot={Boolean(item.pilot)}
        hasProject={Boolean(item.project)}
        preserveQuery={query}
      />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <h2 className="mb-3 font-medium">Risk register</h2>
          <p className="mb-3 text-xs text-[var(--muted)]">
            Canonical risks owned by the initiative — reusable beyond Pre-study.
          </p>
          {item.risks.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No risks recorded.</p>
          ) : (
            <ul className="space-y-3">
              {item.risks.map((risk) => (
                <li key={risk.id} className="text-sm">
                  <p className="font-medium">
                    {risk.referenceKey} · {risk.title}
                  </p>
                  <p className="text-[var(--muted)]">
                    {risk.probability} probability · {risk.impact} impact ·{" "}
                    {risk.status}
                  </p>
                  <p className="mt-1">{risk.description}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <CreateRiskForm initiativeId={item.id} />
        </Panel>
      </div>
    </div>
  );
}
