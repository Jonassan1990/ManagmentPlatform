import { notFound, redirect } from "next/navigation";
import {
  AssessmentForm,
  CreateAlternativeForm,
} from "@/components/initiative/initiative-forms";
import {
  InitiativeTabs,
  LifecycleRail,
  ReadinessPanel,
} from "@/components/initiative/workspace";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import {
  REQUIRED_ASSESSMENT_AREAS,
  assessmentAreaLabel,
} from "@/modules/initiative/application/readiness-policy";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PreStudyPage({
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
  const assessments = item.preStudy?.assessments ?? [];
  const alternatives = item.preStudy?.alternatives ?? [];

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey, href: `/initiatives/${item.id}` },
          { label: "Pre-study" },
        ]}
      />
      <PageHeader
        title={item.title}
        description={`${item.referenceKey} · Pre-study`}
      />
      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>
      <InitiativeTabs
        initiativeId={item.id}
        active="pre-study"
        currentStage={item.currentStage}
        hasGovernance={item.governanceGates.length > 0}
        hasPoC={Boolean(item.poc)}
      />

      {item.currentStage !== "PRE_STUDY" ? (
        <Panel>
          <p className="text-sm text-[var(--muted)]">
            Pre-study becomes editable after advancing from Requirements.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <ReadinessPanel readiness={workspace.readiness} />
            <Panel>
              <h2 className="mb-3 font-medium">Assessments</h2>
              <div className="space-y-6">
                {REQUIRED_ASSESSMENT_AREAS.map((area) => {
                  const existing = assessments.find((a) => a.area === area);
                  return (
                    <div key={area}>
                      <h3 className="font-medium">{assessmentAreaLabel(area)}</h3>
                      <AssessmentForm
                        initiativeId={item.id}
                        area={area}
                        existing={existing}
                      />
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
          <div className="space-y-4">
            <Panel>
              <h2 className="mb-3 font-medium">Alternatives</h2>
              {alternatives.length === 0 ? (
                <p className="mb-3 text-sm text-[var(--muted)]">None yet.</p>
              ) : (
                <ul className="mb-4 space-y-3">
                  {alternatives.map((alt) => (
                    <li key={alt.id} className="text-sm">
                      <p className="font-medium">
                        {alt.title}
                        {alt.isRecommended ? " · recommended" : ""}
                      </p>
                      <p className="text-[var(--muted)]">{alt.description}</p>
                    </li>
                  ))}
                </ul>
              )}
              <CreateAlternativeForm initiativeId={item.id} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
