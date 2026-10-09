import { notFound, redirect } from "next/navigation";
import { PlanningBoard } from "@/components/pi-planning/planning-board";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import {
  ScenarioModeBanner,
  ScenarioPanel,
} from "@/components/pi-planning/scenario-panel";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ piId: string }>;
  searchParams: Promise<{ revisionId?: string }>;
}) {
  const { piId } = await params;
  const { revisionId: revisionIdParam } = await searchParams;
  const { authz, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let board;
  let scenarios;
  try {
    scenarios = await planning.listScenarios(principal, piId, {
      includeArchived: false,
    });
    const resolvedRevisionId =
      revisionIdParam &&
      scenarios.some((s) => s.id === revisionIdParam)
        ? revisionIdParam
        : undefined;
    board = await planning.getPlanningBoard(
      principal,
      piId,
      resolvedRevisionId,
    );
  } catch {
    notFound();
  }

  const capabilities = await resolveCapabilities(
    authz,
    principal,
    board.pi.organizationId,
  );

  const backlog = board.backlog.map((item) => ({
    id: item.id,
    referenceKey: item.referenceKey,
    title: item.title,
    type: item.type,
    status: item.status,
    priority: item.priority,
    estimateHours: item.estimateHours?.toString() ?? null,
    project: item.project,
  }));

  const readOnlyScenario =
    !board.revision.isCurrent && board.revision.status !== "DRAFT";

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning", href: "/pi" },
          { label: board.pi.referenceKey, href: `/pi/${piId}` },
          { label: "Board" },
        ]}
      />
      <PageHeader
        title="Planning board"
        description={`${board.pi.name} · ${piStatusLabel(board.pi.status)} — drag work onto team × iteration cells, or use Move / Allocate forms.`}
      />
      <PiTabs piId={piId} active="board" />
      <ScenarioModeBanner revision={board.revision} />
      <ScenarioPanel
        piId={piId}
        activeRevisionId={board.revision.id}
        scenarios={scenarios.map((s) => ({
          id: s.id,
          key: s.key,
          label: s.label,
          isCurrent: s.isCurrent,
          status: s.status,
          version: s.version,
          kind: s.kind,
          archivedAt: s.archivedAt,
        }))}
        capabilities={capabilities}
      />
      <PlanningBoard
        piId={piId}
        revisionId={board.revision.id}
        departments={board.departments}
        iterations={board.pi.iterations.map((it) => ({
          id: it.id,
          name: it.name,
          sequence: it.sequence,
          referenceKey: it.referenceKey,
        }))}
        backlog={backlog}
        capabilities={capabilities}
        readOnlyScenario={readOnlyScenario}
      />
    </div>
  );
}
