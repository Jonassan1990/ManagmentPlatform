import { notFound, redirect } from "next/navigation";
import { ScenarioComparisonView } from "@/components/pi-planning/scenario-comparison-view";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { AppError } from "@/modules/shared/errors";
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
  searchParams: Promise<{ revs?: string; ref?: string }>;
}) {
  const { piId } = await params;
  const sp = await searchParams;
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

  const parsed = parseCompareSearchParams(sp.revs, sp.ref);
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
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning", href: "/pi" },
          { label: pi.referenceKey, href: `/pi/${piId}` },
          { label: "Compare scenarios" },
        ]}
      />
      <PageHeader
        title="Compare scenarios"
        description={`${pi.name} · ${piStatusLabel(pi.status)} — read-only side-by-side what-if analysis. CURRENT remains authoritative.`}
      />
      <PiTabs piId={piId} active="compare" />
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
