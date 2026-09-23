import { notFound, redirect } from "next/navigation";
import { BaselinePanels } from "@/components/pi-planning/baseline-panels";
import { PiTabs, piStatusLabel } from "@/components/pi-planning/pi-nav";
import { Breadcrumbs, PageHeader } from "@/components/ui/page";
import { resolveCapabilities } from "@/modules/identity-access/application/capabilities";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function PiBaselinePage({
  params,
}: {
  params: Promise<{ piId: string }>;
}) {
  const { piId } = await params;
  const { authz, planning } = createServices();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  let pi;
  let baselines;
  let changesResult;
  try {
    pi = await planning.getProgramIncrement(principal, piId);
    [baselines, changesResult] = await Promise.all([
      planning.listBaselines(principal, piId),
      planning.getChangesSince(principal, piId),
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
        items={[
          { label: "Overview", href: "/" },
          { label: "PI Planning", href: "/pi" },
          { label: pi.referenceKey, href: `/pi/${piId}` },
          { label: "Baseline" },
        ]}
      />
      <PageHeader
        title="Baseline"
        description={`${pi.name} · ${piStatusLabel(pi.status)} — freeze the plan and track drift.`}
      />
      <PiTabs piId={piId} active="baseline" />
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
        capabilities={capabilities}
      />
    </div>
  );
}
