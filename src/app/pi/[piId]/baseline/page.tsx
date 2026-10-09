import { notFound, redirect } from "next/navigation";
import { BaselinePanels } from "@/components/pi-planning/baseline-panels";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { buildPiTrail } from "@/modules/navigation/breadcrumbs";
import { parseReturnContext } from "@/modules/navigation/return-context";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiBaselinePage({
  params,
  searchParams,
}: {
  params: Promise<{ piId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { piId } = await params;
  const query = await searchParams;
  const returnContext = parseReturnContext(query);
  const { authz, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let pi;
  let baselines;
  let changesResult;
  let approvalPreview;
  try {
    pi = await planning.getProgramIncrement(principal, piId);
    [baselines, changesResult, approvalPreview] = await Promise.all([
      planning.listBaselines(principal, piId),
      planning.getChangesSince(principal, piId),
      planning.getPlanApprovalPreview(principal, piId),
    ]);
  } catch {
    notFound();
  }

  const capabilities = await resolveCapabilities(
    authz,
    principal,
    pi.organizationId,
  );

  const latest = baselines[0] ?? null;

  return (
    <div>
      <Breadcrumbs
        items={buildPiTrail({
          piId,
          referenceKey: pi.referenceKey,
          name: pi.name,
          leaf: "Baseline",
          returnContext,
        })}
      />
      <PageHeader
        title="Baseline"
        description={`${pi.name} · ${piStatusLabel(pi.status)} — freeze the approved CURRENT plan and track drift.`}
      />
      <PiTabs piId={piId} active="baseline" preserveQuery={query} />
      <BaselinePanels
        piId={piId}
        piStatus={pi.status}
        baselines={baselines}
        changes={changesResult.changes}
        latestBaselineLabel={
          latest
            ? `v${latest.versionNumber}${latest.label ? ` (${latest.label})` : ""}`
            : null
        }
        approvalPreview={approvalPreview}
        capabilities={capabilities}
      />
    </div>
  );
}
