import { notFound, redirect } from "next/navigation";
import { PlanningBoard } from "@/components/pi-planning/planning-board";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import { ScenarioPanel } from "@/components/pi-planning/scenario-panel";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { buildPiTrail } from "@/modules/navigation/breadcrumbs";
import { parseReturnContext } from "@/modules/navigation/return-context";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ piId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { piId } = await params;
  const query = await searchParams;
  const revisionIdParam =
    typeof query.revisionId === "string" ? query.revisionId : undefined;
  const returnContext = parseReturnContext(query);
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

  const teamSlots = board.capacityViews.teams;
  const availableHours = teamSlots.reduce(
    (sum, t) => sum + t.effectiveCapacityHours,
    0,
  );
  const committedHours = teamSlots.reduce(
    (sum, t) => sum + t.plannedLoadHours,
    0,
  );
  const capacitySummary = {
    availableHours: teamSlots.length === 0 ? null : availableHours,
    committedHours,
    overloadSlots: teamSlots.filter((t) => t.band === "overload").length,
    blockerConflictCount: board.conflicts.filter((c) => c.severity === "BLOCKER")
      .length,
    teamSlotCount: teamSlots.length,
  };

  return (
    <div>
      <Breadcrumbs
        items={buildPiTrail({
          piId,
          referenceKey: board.pi.referenceKey,
          name: board.pi.name,
          leaf: "Board",
          returnContext,
        })}
      />
      <PageHeader
        title="Planning board"
        description={`${board.pi.name} · ${piStatusLabel(board.pi.status)} — allocate work across teams and iterations. Drag cards or use Allocate / Move forms.`}
      />
      <PiTabs piId={piId} active="board" preserveQuery={query} />

      {/* A + C: context + compact scenario management (workspace follows) */}
      <ScenarioPanel
        piId={piId}
        piStatus={board.pi.status}
        activeRevision={{
          id: board.revision.id,
          key: board.revision.key,
          label: board.revision.label,
          isCurrent: board.revision.isCurrent,
          status: board.revision.status,
        }}
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
        capacitySummary={capacitySummary}
        capabilities={capabilities}
        preserveQuery={query}
      />

      {/* B: Planning workspace */}
      <section aria-label="Planning workspace">
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
      </section>
    </div>
  );
}
