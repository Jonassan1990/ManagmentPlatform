import { notFound, redirect } from "next/navigation";
import { PlanningBoard } from "@/components/pi-planning/planning-board";
import { PiTabs } from "@/components/pi-planning/pi-nav";
import { PiPlanningContextHeader } from "@/components/pi-planning/pi-planning-workspace";
import { ScenarioPanel } from "@/components/pi-planning/scenario-panel";
import { Breadcrumbs } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { buildPiTrail } from "@/modules/navigation/breadcrumbs";
import {
  appendPreservedQuery,
  parseReturnContext,
} from "@/modules/navigation/return-context";
import { summarizeCapacityFromViews } from "@/modules/pi-planning/application/pi-planning-presentation";
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

  const capacity = summarizeCapacityFromViews({
    teams: board.capacityViews.teams,
    blockerConflictCount: board.conflicts.filter((c) => c.severity === "BLOCKER")
      .length,
  });

  const capacitySummary = {
    availableHours: capacity.availableHours,
    committedHours: capacity.committedHours,
    overloadSlots: capacity.overloadSlots,
    blockerConflictCount: capacity.blockerConflictCount,
    teamSlotCount: capacity.teamSlotCount,
  };

  const currentId = scenarios.find((s) => s.isCurrent)?.id;
  const other =
    (!board.revision.isCurrent ? board.revision.id : undefined) ??
    scenarios.find((s) => !s.isCurrent)?.id;
  const comparePath =
    currentId && other
      ? `/pi/${piId}/compare?revs=${encodeURIComponent(`${currentId},${other}`)}&ref=${encodeURIComponent(currentId)}`
      : `/pi/${piId}/compare`;
  const compareHref = appendPreservedQuery(comparePath, query, [
    "from",
    "fromOrg",
    "organizationId",
  ]);
  const capacityHref = appendPreservedQuery(`/pi/${piId}/capacity`, query);

  return (
    <div>
      <Breadcrumbs
        items={buildPiTrail({
          piId,
          referenceKey: board.pi.referenceKey,
          name: board.pi.name,
          leaf: "Plan board",
          returnContext,
        })}
      />
      <PiPlanningContextHeader
        piReference={board.pi.referenceKey}
        piName={board.pi.name}
        piStatus={board.pi.status}
        startDate={board.pi.startDate}
        endDate={board.pi.endDate}
        teamCount={board.capacityViews.teams.length}
        revision={{
          isCurrent: board.revision.isCurrent,
          label: board.revision.label,
          key: board.revision.key,
          status: board.revision.status,
        }}
        capacity={capacity}
        canAllocate={capabilities.canAllocatePi}
        capacityHref={capacityHref}
        compareHref={scenarios.length >= 2 ? compareHref : null}
      />
      <PiTabs piId={piId} active="board" preserveQuery={query} />

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
        showPlanningContext={false}
      />

      <section aria-label="Plan board">
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
