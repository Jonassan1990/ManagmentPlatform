import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdvanceLifecycleButton } from "@/components/initiative/initiative-forms";
import {
  AttentionPanel,
  InitiativeTabs,
  LifecycleRail,
  ReadinessPanel,
} from "@/components/initiative/workspace";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { stageLabel } from "@/modules/initiative/application/attention";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function InitiativeOverviewPage({
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

  const { initiative: item, attention, readiness } = workspace;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "Initiatives", href: "/initiatives" },
          { label: item.referenceKey },
        ]}
      />
      <PageHeader
        title={item.title}
        description={`${item.referenceKey} · ${item.department.name} · Owner: ${item.businessOwnerName}`}
        actions={
          <span className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm">
            {stageLabel(item.currentStage)}
          </span>
        }
      />

      <div className="mb-5">
        <LifecycleRail current={item.currentStage} />
      </div>

      <InitiativeTabs initiativeId={item.id} active="overview" />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <AttentionPanel items={attention} />
          <ReadinessPanel readiness={readiness} />
          <Panel>
            <h2 className="mb-2 font-medium">Next action</h2>
            {item.currentStage === "DEMAND" ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Complete demand details, then advance to Requirements.
                </p>
                <Link
                  href={`/initiatives/${item.id}/demand`}
                  className="mr-2 text-sm text-[var(--accent)] underline"
                >
                  Open demand
                </Link>
                <AdvanceLifecycleButton
                  initiativeId={item.id}
                  expectedVersion={item.version}
                  toStage="REQUIREMENTS"
                  label="Advance to Requirements"
                />
              </div>
            ) : null}
            {item.currentStage === "REQUIREMENTS" ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Capture and accept requirements, then advance to Pre-study.
                </p>
                <Link
                  href={`/initiatives/${item.id}/requirements`}
                  className="mr-2 text-sm text-[var(--accent)] underline"
                >
                  Open requirements
                </Link>
                <AdvanceLifecycleButton
                  initiativeId={item.id}
                  expectedVersion={item.version}
                  toStage="PRE_STUDY"
                  label="Advance to Pre-study"
                />
              </div>
            ) : null}
            {item.currentStage === "PRE_STUDY" ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  Complete assessments, alternatives, and risks until readiness is
                  READY. Approval/decision execution is Phase 3.
                </p>
                <Link
                  href={`/initiatives/${item.id}/pre-study`}
                  className="text-sm text-[var(--accent)] underline"
                >
                  Open pre-study
                </Link>
              </div>
            ) : null}
          </Panel>
        </div>
        <Panel>
          <h2 className="mb-3 font-medium">Context</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--muted)]">Requester</dt>
              <dd>{item.requesterName}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Business owner</dt>
              <dd>{item.businessOwnerName}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Department</dt>
              <dd>{item.department.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Updated</dt>
              <dd>{item.updatedAt.toISOString().slice(0, 10)}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
