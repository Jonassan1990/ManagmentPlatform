import { notFound, redirect } from "next/navigation";
import {
  AddCriterionForm,
  CreateRelationForm,
  CreateRequirementForm,
  UpdateRequirementStatusForm,
} from "@/components/initiative/initiative-forms";
import {
  InitiativeTabs,
  LifecycleRail,
} from "@/components/initiative/workspace";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function RequirementsPage({
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
          { label: "Requirements" },
        ]}
      />
      <PageHeader
        title={item.title}
        description={`${item.referenceKey} · Requirements`}
      />
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs initiativeId={item.id} active="requirements" />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <h2 className="mb-3 font-medium">Requirements</h2>
          {item.requirements.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No requirements yet.</p>
          ) : (
            <ul className="space-y-5">
              {item.requirements.map((req) => (
                <li key={req.id} className="border-b border-[var(--line)] pb-4">
                  <p className="font-medium">
                    {req.referenceKey} · {req.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {req.category.replaceAll("_", " ")} · {req.priority} ·{" "}
                    {req.status}
                  </p>
                  <p className="mt-2 text-sm">{req.description}</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-[var(--muted)]">
                    {req.acceptanceCriteria.map((c) => (
                      <li key={c.id}>{c.description}</li>
                    ))}
                  </ul>
                  <div className="mt-3 space-y-2">
                    <UpdateRequirementStatusForm
                      id={req.id}
                      title={req.title}
                      description={req.description}
                      category={req.category}
                      priority={req.priority}
                      ownerName={req.ownerName}
                      source={req.source}
                      status={req.status}
                      version={req.version}
                    />
                    <AddCriterionForm requirementId={req.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel>
            <CreateRequirementForm initiativeId={item.id} />
          </Panel>
          <Panel>
            <CreateRelationForm
              requirements={item.requirements.map((r) => ({
                id: r.id,
                referenceKey: r.referenceKey,
                title: r.title,
              }))}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
