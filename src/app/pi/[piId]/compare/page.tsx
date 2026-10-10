import { notFound, redirect } from "next/navigation";
import { ScenarioComparisonView } from "@/components/pi-planning/scenario-comparison-view";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { AppError } from "@/modules/shared/errors";
import { buildPiTrail } from "@/modules/navigation/breadcrumbs";
import { parseReturnContext } from "@/modules/navigation/return-context";
import {
  COMPARE_MIN_REVISIONS,
  parseCompareSearchParams,
} from "@/modules/pi-planning/application/scenario-comparison-display";
import type { ScenarioComparisonResult } from "@/modules/pi-planning/application/scenario-comparison-types";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ piId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { piId } = await params;
  const sp = await searchParams;
  const returnContext = parseReturnContext(sp);
  const revs = typeof sp.revs === "string" ? sp.revs : undefined;
  const ref = typeof sp.ref === "string" ? sp.ref : undefined;
  const { authz, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let pi;
  let scenarios;
  try {
    pi = await planning.getProgramIncrement(principal, piId);
    scenarios = await planning.listScenarios(principal, piId, {
      includeArchived: true,
    });
  } catch {
    notFound();
  }

  const parsed = parseCompareSearchParams(revs, ref);
  let comparison: ScenarioComparisonResult | null = null;
  let compareError: string | null = parsed.error;

  const knownIds = new Set(scenarios.map((s) => s.id));
  for (const id of parsed.revisionIds) {
    if (!knownIds.has(id)) {
      compareError =
        compareError ??
        "One or more selected revisions are not available on this PI (or you cannot view them).";
    }
  }

  if (
    !compareError &&
    parsed.revisionIds.length >= COMPARE_MIN_REVISIONS &&
    parsed.revisionIds.every((id) => knownIds.has(id))
  ) {
    try {
      comparison = await planning.compareScenarios(principal, {
        piId,
        revisionIds: parsed.revisionIds,
        referenceRevisionId:
          parsed.referenceRevisionId ?? parsed.revisionIds[0],
      });
    } catch (error) {
      compareError =
        error instanceof AppError
          ? error.message
          : "Scenario comparison failed. Try again or adjust your selection.";
    }
  }

  const scenarioOptions = scenarios.map((s) => ({
    id: s.id,
    key: s.key,
    label: s.label,
    isCurrent: s.isCurrent,
    status: s.status,
    version: s.version,
    kind: s.kind,
    archivedAt: s.archivedAt
      ? typeof s.archivedAt === "string"
        ? s.archivedAt
        : s.archivedAt.toISOString()
      : null,
    clonedFromRevisionId: s.clonedFromRevisionId ?? null,
  }));

  return (
    <div>
      <Breadcrumbs
        items={buildPiTrail({
          piId,
          referenceKey: pi.referenceKey,
          name: pi.name,
          leaf: "Compare",
          returnContext,
        })}
      />
      <PageHeader
        title="Compare scenarios"
        description={`${pi.name} · ${piStatusLabel(pi.status)} — read-only side-by-side what-if analysis. The current plan remains authoritative.`}
      />
      <PiTabs piId={piId} active="compare" preserveQuery={sp} />
      <ScenarioComparisonView
        piId={piId}
        piReferenceKey={pi.referenceKey}
        scenarios={scenarioOptions}
        initialRevisionIds={parsed.revisionIds}
        initialReferenceRevisionId={
          parsed.referenceRevisionId ??
          parsed.revisionIds[0] ??
          scenarios.find((s) => s.isCurrent)?.id ??
          null
        }
        comparison={comparison}
        compareError={compareError}
      />
    </div>
  );
}
